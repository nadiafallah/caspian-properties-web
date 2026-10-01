"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/[locale]/admin/actions";
import { cx } from "@/lib/format";

type Props = {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  /** Translated texts: "saved" plus one entry per error key. */
  messages: Record<string, string>;
  className?: string;
  children: ReactNode;
};

/**
 * Form bound to an admin server action. Shows "saved" only after the server confirmed
 * the change, and a clear message when it did not.
 */
export function ActionForm({ action, messages, className, children }: Props) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state ? (
        <p
          key={state.at}
          role={state.ok ? "status" : "alert"}
          className={cx("type-small mt-2", state.ok ? "text-success" : "text-error")}
        >
          {state.ok ? messages.saved : messages[state.error] ?? messages.generic}
        </p>
      ) : null}
    </form>
  );
}

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  name,
  value,
  className,
}: {
  children: ReactNode;
  pendingText: string;
  variant?: "primary" | "secondary";
  name?: string;
  value?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={cx("btn min-h-11 px-5 py-2 text-sm", variant === "primary" ? "btn-primary" : "btn-secondary", className)}
    >
      {pending ? pendingText : children}
    </button>
  );
}
