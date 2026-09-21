"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { localeMeta, locales } from "@/i18n/locales";
import { cx } from "@/lib/format";

function GlobeIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="10" cy="10" r="7.25" />
      <path d="M2.75 10h14.5M10 2.75c2 2.1 3 4.5 3 7.25s-1 5.15-3 7.25c-2-2.1-3-4.5-3-7.25s1-5.15 3-7.25Z" />
    </svg>
  );
}

/** Links to the current page in each language. Each label is written in its own script. */
function LocaleLinks({
  onNavigate,
  className,
  tone = "light",
}: {
  onNavigate?: () => void;
  className?: string;
  tone?: "light" | "dark";
}) {
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <ul className={className}>
      {locales.map((l) => (
        <li key={l}>
          <Link
            href={pathname}
            locale={l}
            hrefLang={l}
            lang={l}
            dir={localeMeta[l].dir}
            onClick={onNavigate}
            aria-current={l === locale ? "true" : undefined}
            className={cx(
              "flex min-h-11 items-center rounded-sm px-3 no-underline",
              tone === "light"
                ? l === locale
                  ? "font-semibold text-bronze-deep"
                  : "text-ink hover:bg-ivory"
                : l === locale
                  ? "font-semibold text-bronze-light"
                  : "text-stone hover:bg-white/5 hover:text-white",
            )}
          >
            {localeMeta[l].label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Compact disclosure for the desktop header. */
export function LocaleMenu({ label }: { label: string }) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${label}: ${localeMeta[locale].label}`}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center gap-2 rounded-sm px-3 font-medium text-ink hover:text-bronze-deep"
      >
        <GlobeIcon />
        <span lang={locale}>{localeMeta[locale].label}</span>
        <svg aria-hidden="true" viewBox="0 0 12 12" className={cx("h-3 w-3 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="m2.5 4.5 3.5 3.5 3.5-3.5" />
        </svg>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute end-0 top-full z-50 mt-2 min-w-44 rounded-card border border-stone bg-white p-2 shadow-card"
      >
        <LocaleLinks onNavigate={() => setOpen(false)} />
      </div>
    </div>
  );
}

/** Inline list for the mobile menu, footer and consultation page. */
export function LocaleList({
  label,
  className,
  onNavigate,
  tone,
}: {
  label: string;
  className?: string;
  onNavigate?: () => void;
  tone?: "light" | "dark";
}) {
  return (
    <nav aria-label={label}>
      <LocaleLinks onNavigate={onNavigate} tone={tone} className={cx("flex flex-wrap gap-1", className)} />
    </nav>
  );
}
