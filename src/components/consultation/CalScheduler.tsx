"use client";

import { useEffect, useRef, useState } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { ExternalIcon } from "@/components/ui";

type Props = {
  calLink: string;
  namespace: string;
  origin: string;
  leadId: string;
  name: string;
  email: string;
  bookingUrl: string;
  onBooked: () => void;
  labels: {
    loading: string;
    fallbackTitle: string;
    fallbackBody: string;
    fallbackCta: string;
    opensInNewTab: string;
  };
  children?: React.ReactNode; // direct-contact fallback
};

const LOAD_TIMEOUT_MS = 10_000;

/**
 * Official Cal.com inline embed. Cal.com owns availability (via its Google Calendar
 * connection), time zones, invitations, rescheduling and cancellation. Only the lead id
 * is passed as booking metadata so the webhook can match the booking to the enquiry.
 */
export function CalScheduler({ calLink, namespace, origin, leadId, name, email, bookingUrl, onBooked, labels, children }: Props) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const onBookedRef = useRef(onBooked);
  useEffect(() => {
    onBookedRef.current = onBooked;
  }, [onBooked]);
  const embedJsUrl = `${origin}/embed/embed.js`;

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (active) setState((s) => (s === "loading" ? "failed" : s));
    }, LOAD_TIMEOUT_MS);

    getCalApi({ namespace, embedJsUrl })
      .then((cal) => {
        if (!active) return;
        cal("ui", {
          theme: "light",
          layout: "month_view",
          hideEventTypeDetails: false,
          cssVarsPerTheme: {
            light: { "cal-brand": "#9D4F2B" },
            dark: { "cal-brand": "#E9AF8B" },
          },
        });
        cal("on", { action: "linkReady", callback: () => active && setState("ready") });
        cal("on", { action: "linkFailed", callback: () => active && setState("failed") });
        cal("on", { action: "bookingSuccessfulV2", callback: () => onBookedRef.current() });
      })
      .catch(() => active && setState("failed"));

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [namespace, embedJsUrl]);

  return (
    <div>
      {state === "loading" ? (
        <p role="status" className="type-small mb-4 text-muted">
          {labels.loading}
        </p>
      ) : null}

      {state !== "failed" ? (
        <div className="min-h-[36rem] overflow-hidden rounded-card border border-stone bg-white" dir="ltr">
          <Cal
            namespace={namespace}
            calLink={calLink}
            calOrigin={origin}
            embedJsUrl={embedJsUrl}
            config={{
              name,
              email,
              "metadata[leadId]": leadId,
              layout: "month_view",
              theme: "light",
            }}
            style={{ width: "100%", height: "100%", overflow: "auto" }}
          />
        </div>
      ) : null}

      {state === "failed" ? (
        <div role="alert" className="rounded-card border border-stone bg-ivory p-6">
          <h3 className="type-h3">{labels.fallbackTitle}</h3>
          <p className="mt-2 text-charcoal">{labels.fallbackBody}</p>
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-5">
            {labels.fallbackCta}
            <ExternalIcon />
            <span className="sr-only">{labels.opensInNewTab}</span>
          </a>
          {children ? <div className="mt-6">{children}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
