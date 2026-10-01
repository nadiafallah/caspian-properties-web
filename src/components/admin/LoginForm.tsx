"use client";

import { useActionState } from "react";
import { sendLoginLink, type LoginState } from "@/app/[locale]/admin/actions";
import type { AppLocale } from "@/i18n/locales";
import { SubmitButton } from "./ActionForm";

type Texts = { email: string; submit: string; sending: string; sent: string; invalid: string; error: string; rateLimited: string };

export function LoginForm({ locale, texts }: { locale: AppLocale; texts: Texts }) {
  const [state, action] = useActionState<LoginState, FormData>(sendLoginLink, null);
  const message =
    state?.status === "sent" ? texts.sent : state?.status === "invalid" ? texts.invalid : state?.status === "rate_limited" ? texts.rateLimited : state ? texts.error : null;

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label htmlFor="login-email" className="block font-medium">
          {texts.email}
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          className="mt-1 min-h-11 w-full rounded-sm border border-stone-strong px-3 py-2"
        />
      </div>
      <SubmitButton pendingText={texts.sending}>{texts.submit}</SubmitButton>
      {message ? (
        <p key={state?.at} role={state?.status === "sent" ? "status" : "alert"} className={state?.status === "sent" ? "text-success" : "text-error"}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
