import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/locales";
import type { OutboxRow } from "@/lib/crm/admin-data";
import { formatPhone } from "@/lib/crm/phone";
import { formatDubai } from "@/lib/crm/time";
import { cx } from "@/lib/format";

const statusTone: Record<string, string> = {
  new: "bg-bronze-light/40 text-ink",
  in_progress: "bg-ivory text-ink border border-stone-strong",
  awaiting_reply: "bg-stone text-ink",
  won: "bg-success/15 text-success",
  closed: "bg-stone/60 text-muted",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={cx("type-caption inline-block rounded-full px-2.5 py-0.5", statusTone[status])}>{label}</span>;
}

export function Card({ title, id, children, className }: { title?: ReactNode; id?: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={title && id ? id : undefined} className={cx("rounded-card border border-stone bg-white p-4 md:p-5", className)}>
      {title ? (
        <h2 id={id} className="mb-3 text-lg font-semibold">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

export function Phone({ e164 }: { e164: string | null }) {
  if (!e164) return null;
  return (
    <bdi dir="ltr" className="whitespace-nowrap">
      {formatPhone(e164)}
    </bdi>
  );
}

export function ContactButtons({ e164, callLabel, whatsappLabel }: { e164: string | null; callLabel: string; whatsappLabel: string }) {
  if (!e164) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`tel:${e164}`} className="btn btn-primary min-h-11 px-4 py-2 text-sm">
        {callLabel}
      </a>
      <a href={`https://wa.me/${e164.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary min-h-11 px-4 py-2 text-sm">
        {whatsappLabel}
      </a>
    </div>
  );
}

export function When({ iso, locale }: { iso: string; locale: AppLocale }) {
  return <time dateTime={iso}>{formatDubai(iso, locale)}</time>;
}

type OutboxTexts = {
  channels: Record<string, string>;
  pending: string;
  pendingSetup: string;
  processing: string;
  sent: string;
  retrying: string;
  failed: string;
  cancelled: string;
};

/** "Email: accepted by provider 3 Oct, 14:30" — never claims the inbox received it. */
export function OutboxStatus({ rows, texts, configured, locale }: { rows: OutboxRow[]; texts: OutboxTexts; configured: string[]; locale: AppLocale }) {
  if (rows.length === 0) return null;
  return (
    <ul className="type-small space-y-0.5 text-muted">
      {rows.map((row) => {
        const channel = texts.channels[row.channel] ?? row.channel;
        let state: string;
        if (row.status === "sent" && row.sent_at) state = texts.sent.replace("{date}", formatDubai(row.sent_at, locale));
        else if (row.status === "pending" && !configured.includes(row.channel)) state = texts.pendingSetup;
        else if (row.status === "pending" && row.attempts > 0) state = texts.retrying.replace("{attempts}", String(row.attempts));
        else state = texts[row.status as "pending" | "processing" | "failed" | "cancelled"] ?? row.status;
        return (
          <li key={row.id}>
            {channel}: {state}
          </li>
        );
      })}
    </ul>
  );
}

export function ClientLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Link href={`/admin/clients/${id}`} className="link font-semibold">
      {children}
    </Link>
  );
}
