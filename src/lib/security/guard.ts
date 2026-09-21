import "server-only";
import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting + idempotency. Upstash Redis (free plan) is durable across serverless
 * instances. Without it, an in-memory fallback is used — it is NOT durable on Vercel
 * (each instance has its own memory), so production logs a warning.
 */
export interface Guard {
  readonly durable: boolean;
  limit(key: string): Promise<boolean>;
  /** Returns true the first time a key is claimed within the TTL, false for duplicates. */
  claim(key: string, ttlSeconds: number): Promise<boolean>;
  /** Frees a claim so a failed operation can be retried with the same key. */
  release(key: string): Promise<void>;
}

class UpstashGuard implements Guard {
  readonly durable = true;
  private readonly perIp: Ratelimit;

  constructor(private readonly redis: Redis) {
    this.perIp = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "10 m"),
      prefix: "cpn:rl",
      analytics: false,
    });
  }

  async limit(key: string): Promise<boolean> {
    const { success } = await this.perIp.limit(key);
    return success;
  }

  async claim(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(`cpn:claim:${key}`, "1", { nx: true, ex: ttlSeconds });
    return result === "OK";
  }

  async release(key: string): Promise<void> {
    await this.redis.del(`cpn:claim:${key}`);
  }
}

export class MemoryGuard implements Guard {
  readonly durable = false;
  private readonly hits = new Map<string, number[]>();
  private readonly claims = new Map<string, number>();

  constructor(
    private readonly max = 5,
    private readonly windowMs = 10 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  async limit(key: string): Promise<boolean> {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((ts) => t - ts < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(key, recent);
    return true;
  }

  async claim(key: string, ttlSeconds: number): Promise<boolean> {
    const t = this.now();
    const expires = this.claims.get(key);
    if (expires && expires > t) return false;
    this.claims.set(key, t + ttlSeconds * 1000);
    return true;
  }

  async release(key: string): Promise<void> {
    this.claims.delete(key);
  }
}

let guard: Guard | undefined;

export function getGuard(): Guard {
  if (guard) return guard;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) {
    guard = new UpstashGuard(new Redis({ url, token }));
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn("[security] Upstash Redis not configured — using NON-durable in-memory rate limiting");
    }
    guard = new MemoryGuard();
  }
  return guard;
}

/** One-way hash so raw IP addresses are never stored. */
export function hashIdentifier(value: string): string {
  return createHash("sha256").update(`cpn:${value}`).digest("hex").slice(0, 32);
}
