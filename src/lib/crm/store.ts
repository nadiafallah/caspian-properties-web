import "server-only";
import { getCrmService } from "./service";
import type { CrmSubmitArgs } from "./submit";

export type CrmStore = { readonly name: string; submit(args: CrmSubmitArgs): Promise<{ created: boolean }> };

/** In-memory stand-in for local development and e2e tests only. */
class MemoryCrmStore implements CrmStore {
  readonly name = "memory";
  readonly requests = new Map<string, CrmSubmitArgs>();
  async submit(args: CrmSubmitArgs) {
    if (this.requests.has(args.p_idempotency_key)) return { created: false };
    this.requests.set(args.p_idempotency_key, args);
    return { created: true };
  }
}

let memoryStore: MemoryCrmStore | undefined;

/**
 * The CRM follows LEAD_STORE: "memory" (dev/e2e) keeps everything in this process;
 * otherwise enquiries go to Supabase. Returns null when nothing usable is configured —
 * callers must then report failure, never success.
 */
export function getCrmStore(): CrmStore | null {
  const mode = process.env.LEAD_STORE ?? (process.env.NODE_ENV === "production" ? "supabase" : "memory");
  if (mode === "memory") {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_MEMORY_STORE !== "true") return null;
    memoryStore ??= new MemoryCrmStore();
    return memoryStore;
  }

  const service = getCrmService();
  if (!service) {
    console.error("[crm] Supabase is not configured (see docs/INTEGRATIONS.md)");
    return null;
  }
  return {
    name: "supabase",
    async submit(args) {
      const result = await service.rpc<{ created: boolean }>("crm_submit_request", args);
      return { created: Boolean(result?.created) };
    },
  };
}
