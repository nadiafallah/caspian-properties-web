"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export const fieldId = (name: string) => `cf-${name}`;

type Common = {
  name: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  optionalLabel?: string;
  required?: boolean;
};

function describedBy(name: string, hint: unknown, error: unknown): string | undefined {
  const ids = [hint ? `${fieldId(name)}-hint` : null, error ? `${fieldId(name)}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function LabelText({ label, optionalLabel, required }: { label: string; optionalLabel?: string; required?: boolean }) {
  return (
    <>
      {label}
      {!required && optionalLabel ? <span className="font-normal text-muted"> ({optionalLabel})</span> : null}
    </>
  );
}

function FieldMessages({ name, hint, error }: { name: string; hint?: ReactNode; error?: string }) {
  return (
    <>
      {hint ? (
        <p id={`${fieldId(name)}-hint`} className="type-small mt-1 text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${fieldId(name)}-error`} className="type-small mt-2 flex items-start gap-2 font-medium text-error">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor">
            <path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 4.25a.9.9 0 0 0-.9.9v3.6a.9.9 0 1 0 1.8 0v-3.6a.9.9 0 0 0-.9-.9Zm0 8.2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
          </svg>
          {error}
        </p>
      ) : null}
    </>
  );
}

const inputClass = (error?: string) =>
  cx(
    "mt-2 block min-h-12 w-full rounded-sm border bg-white px-4 py-3 text-base text-ink placeholder:text-muted",
    "focus-visible:border-bronze-deep focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bronze-deep",
    error ? "border-error" : "border-stone-strong",
  );

export function TextField({
  name,
  label,
  error,
  hint,
  optionalLabel,
  required,
  value,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
  dir,
}: Common & {
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel";
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel";
  dir?: "ltr" | "rtl" | "auto";
}) {
  return (
    <div>
      <label htmlFor={fieldId(name)} className="font-semibold text-ink">
        <LabelText label={label} optionalLabel={optionalLabel} required={required} />
      </label>
      <input
        id={fieldId(name)}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        dir={dir}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={inputClass(error)}
      />
      <FieldMessages name={name} hint={hint} error={error} />
    </div>
  );
}

export function TextAreaField({
  name,
  label,
  error,
  hint,
  optionalLabel,
  value,
  onChange,
  maxLength,
  counter,
}: Common & { value: string; onChange: (value: string) => void; maxLength: number; counter: string }) {
  return (
    <div>
      <label htmlFor={fieldId(name)} className="font-semibold text-ink">
        <LabelText label={label} optionalLabel={optionalLabel} />
      </label>
      <textarea
        id={fieldId(name)}
        name={name}
        rows={4}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        dir="auto"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={cx(inputClass(error), "resize-y")}
      />
      <div className="flex flex-wrap items-start justify-between gap-x-4">
        <FieldMessages name={name} hint={hint} error={error} />
        <p className="type-caption mt-1 text-muted" aria-hidden="true">
          {counter}
        </p>
      </div>
    </div>
  );
}

export function SelectField({
  name,
  label,
  error,
  hint,
  optionalLabel,
  required,
  value,
  onChange,
  options,
  placeholder,
}: Common & {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  return (
    <div>
      <label htmlFor={fieldId(name)} className="font-semibold text-ink">
        <LabelText label={label} optionalLabel={optionalLabel} required={required} />
      </label>
      <select
        id={fieldId(name)}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={cx(inputClass(error), "appearance-auto pe-10")}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldMessages name={name} hint={hint} error={error} />
    </div>
  );
}

export function RadioGroup({
  name,
  label,
  error,
  hint,
  value,
  onChange,
  options,
  columns = 1,
}: Common & {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; lang?: string }>;
  columns?: 1 | 2 | 3;
}) {
  return (
    <fieldset aria-describedby={describedBy(name, hint, error)} aria-invalid={error ? true : undefined}>
      <legend className="font-semibold text-ink">{label}</legend>
      <div
        className={cx(
          "mt-3 grid gap-2",
          columns === 2 && "sm:grid-cols-2",
          columns === 3 && "sm:grid-cols-3",
        )}
      >
        {options.map((option, index) => {
          const id = index === 0 ? fieldId(name) : `${fieldId(name)}-${index}`;
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={cx(
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border px-4 py-3 transition-colors",
                checked ? "border-bronze-deep bg-ivory" : error ? "border-error" : "border-stone-strong hover:bg-ivory/60",
              )}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="h-5 w-5 shrink-0 accent-bronze-deep"
              />
              <span lang={option.lang} className="text-ink">
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
      <FieldMessages name={name} hint={hint} error={error} />
    </fieldset>
  );
}

export function CheckboxField({
  name,
  label,
  error,
  checked,
  onChange,
}: {
  name: string;
  label: ReactNode;
  error?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={fieldId(name)}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId(name)}-error` : undefined}
          className="mt-1 h-5 w-5 shrink-0 accent-bronze-deep"
        />
        <label htmlFor={fieldId(name)} className="text-charcoal">
          {label}
        </label>
      </div>
      <FieldMessages name={name} error={error} />
    </div>
  );
}
