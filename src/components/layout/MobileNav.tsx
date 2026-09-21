"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { NavLinks, type NavItem } from "./NavLinks";
import { LocaleList } from "./LocaleSwitcher";

export type MobileNavLabels = {
  menu: string;
  closeMenu: string;
  language: string;
  languageSwitcher: string;
  mainNav: string;
  bookConsultation: string;
};

/** Disclosure menu for small screens (not a modal, so no focus trap is needed). */
export function MobileNav({ items, labels }: { items: NavItem[]; labels: MobileNavLabels }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-sm px-3 font-medium text-ink"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
          {open ? <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />}
        </svg>
        <span className="sr-only">{open ? labels.closeMenu : labels.menu}</span>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full z-40 max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-b border-stone bg-white shadow-card"
      >
        <div className="mx-auto max-w-content px-5 pt-4 pb-8">
          <nav aria-label={labels.mainNav}>
            <NavLinks items={items} orientation="vertical" onNavigate={close} />
          </nav>
          <hr className="my-5 border-stone" />
          <p className="proof-label mb-2 text-muted">{labels.language}</p>
          <LocaleList label={labels.languageSwitcher} onNavigate={close} />
          <Link href="/consultation" onClick={close} className="btn btn-primary mt-6 w-full">
            {labels.bookConsultation}
          </Link>
        </div>
      </div>
    </div>
  );
}
