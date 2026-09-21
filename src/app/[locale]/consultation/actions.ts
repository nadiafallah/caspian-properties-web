"use server";

import { headers } from "next/headers";
import { getLeadStore } from "@/lib/leads/store";
import { submitLead, type SubmitResult } from "@/lib/leads/submit";
import { getGuard, hashIdentifier } from "@/lib/security/guard";

/**
 * Consultation form endpoint. Server Actions already reject cross-origin requests
 * (Origin must match Host); everything else is validated in submitLead.
 */
export async function submitConsultation(formData: FormData): Promise<SubmitResult> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") raw[key] = value;
  }

  return submitLead(raw, {
    store: getLeadStore(),
    guard: getGuard(),
    now: () => new Date(),
    clientKey: hashIdentifier(ip),
    log: (message) => console.info(message),
  });
}
