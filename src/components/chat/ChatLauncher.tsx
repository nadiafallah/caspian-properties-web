"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { AppLocale } from "@/i18n/locales";
import type { ChatDictionary } from "./types";

// The conversation code (and phone-number rules) downloads only when the visitor opens the chat.
const ChatPanel = dynamic(() => import("./ChatPanel").then((m) => m.ChatPanel), { ssr: false });

const OPEN_KEY = "cpn.chat.open";

type Props = {
  locale: AppLocale;
  dictionaries: Record<AppLocale, ChatDictionary>;
  phoneE164: string;
  privacyPaths: Record<AppLocale, string>;
};

export function ChatLauncher({ locale, dictionaries, phoneE164, privacyPaths }: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const t = dictionaries[locale];

  // Keep the chat open across language switches and page loads within this tab.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from sessionStorage after hydration
      if (sessionStorage.getItem(OPEN_KEY) === "1") setOpen(true);
    } catch {}
  }, []);

  function toggle(next: boolean) {
    setOpen(next);
    try {
      if (next) sessionStorage.setItem(OPEN_KEY, "1");
      else sessionStorage.removeItem(OPEN_KEY);
    } catch {}
    if (!next) requestAnimationFrame(() => buttonRef.current?.focus());
  }

  return (
    <>
      {open ? (
        <ChatPanel
          initialLocale={locale}
          dictionaries={dictionaries}
          phoneE164={phoneE164}
          privacyPaths={privacyPaths}
          onClose={() => toggle(false)}
        />
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => toggle(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        hidden={open}
        className="btn btn-primary fixed end-4 bottom-4 z-40 gap-2 px-5 shadow-card"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h7A2.5 2.5 0 0 1 16 5.5v5a2.5 2.5 0 0 1-2.5 2.5H9l-3.5 3v-3A2.5 2.5 0 0 1 4 10.5v-5Z" strokeLinejoin="round" />
        </svg>
        {t.launcher}
      </button>
    </>
  );
}
