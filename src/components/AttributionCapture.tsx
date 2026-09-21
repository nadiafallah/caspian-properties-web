"use client";

import { useEffect } from "react";

export const ATTRIBUTION_KEY = "cpn.attribution.v1";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type Attribution = Partial<Record<(typeof UTM_KEYS)[number], string>> & { landing?: string };

/**
 * Remembers the first page and any campaign tags of this browser session
 * (sessionStorage only — cleared when the tab closes). Attached to a consultation request.
 */
export function AttributionCapture() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(ATTRIBUTION_KEY)) return;
      const params = new URLSearchParams(window.location.search);
      const data: Attribution = { landing: window.location.pathname.slice(0, 200) };
      for (const key of UTM_KEYS) {
        const value = params.get(key);
        if (value) data[key] = value.slice(0, 200);
      }
      sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(data));
    } catch {
      // Storage unavailable (private mode, blocked) — attribution is optional.
    }
  }, []);
  return null;
}

export function readAttribution(): Attribution {
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch {
    return {};
  }
}
