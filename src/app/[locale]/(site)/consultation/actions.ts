"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { getCrmStore } from "@/lib/crm/store";
import { formLeadToCrm } from "@/lib/crm/submit";
import { notifyNewLead } from "@/lib/leads/notify";
import type { LeadRecord } from "@/lib/leads/record";
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
    // Runs after the response is sent, so the CRM and notifications never delay or fail the form.
    onStored: (record) => after(() => addLeadToCrm(record)),
  });
}

/**
 * Opens (or extends) the client's CRM case; its notifications then go through the
 * durable outbox. If the CRM is unreachable, Nadia is notified directly instead.
 */
async function addLeadToCrm(record: LeadRecord) {
  const crm = getCrmStore();
  try {
    if (!crm) throw new Error("crm not configured");
    await crm.submit(formLeadToCrm(record));
  } catch {
    console.error(`[leads] CRM unavailable for ${record.lead_id}; notifying directly`);
    await notifyNewLead(record);
  }
}
