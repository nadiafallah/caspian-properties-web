import "server-only";

const TIMEOUT_MS = 10_000;

export class CrmError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
  ) {
    super(message);
  }
}

/**
 * Calls a CRM database function with the server-only secret key. Only functions
 * granted to service_role (submission, outbox worker) are reachable this way.
 * Returns null when Supabase is not configured.
 */
export function getCrmService(): { rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> } | null {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return null;
  const base = `${url.replace(/\/+$/, "")}/rest/v1/rpc`;

  return {
    async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
      const response = await fetch(`${base}/${fn}`, {
        method: "POST",
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        // Code and message only: "details" can echo row values (personal data).
        const error = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
        throw new CrmError(`crm ${fn} failed: ${response.status} ${error.code ?? ""} ${error.message ?? ""}`.trim(), error.code);
      }
      const text = await response.text();
      return (text ? JSON.parse(text) : null) as T;
    },
  };
}
