"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { getPathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/locales";
import { submitConsultation } from "@/app/[locale]/consultation/actions";
import { readAttribution } from "@/components/AttributionCapture";
import { cx, formatNumber } from "@/lib/format";
import {
  NOTES_MAX,
  budgetOptionsFor,
  channels,
  decisionMakers,
  interests,
  purposes,
  referrals,
  stepOneFields,
  timelines,
  validateStepOne,
  validateStepTwo,
  type Budget,
  type FieldName,
  type Interest,
} from "@/lib/leads/schema";
import type { SubmitResult } from "@/lib/leads/submit";
import { CheckboxField, RadioGroup, SelectField, TextAreaField, TextField, fieldId } from "./fields";

// The Cal.com embed is only downloaded once the visitor reaches the scheduling step.
const CalScheduler = dynamic(() => import("./CalScheduler").then((m) => m.CalScheduler), { ssr: false });

export type DirectContact = {
  phone: string | null;
  whatsappUrl: string | null;
  email: string | null;
  instagramUrl: string;
  instagramHandle: string;
};

type Props = {
  locale: AppLocale;
  consultationLanguages: readonly string[];
  calcom: { configured: boolean; link: string; namespace: string; origin: string; bookingUrlBase: string | null };
  contact: DirectContact;
};

type Values = Record<FieldName, string>;
type Lead = { leadId: string; firstName: string; fullName: string; email: string };
type Problem = "rate_limited" | "rejected" | "unavailable" | "network";
type Stored = {
  v: 1;
  values: Values;
  submissionId: string;
  startedAt: number;
  step: 1 | 2 | 3;
  lead: Lead | null;
};

const STORAGE_KEY = "cpn.consultation.v1";
const EMPTY: Values = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  consultationLanguage: "",
  contactChannel: "",
  interest: "",
  purpose: "",
  budget: "",
  timeline: "",
  decisionMakers: "",
  notes: "",
  referral: "",
  consent: "",
};
const ERROR_KEYS = ["fullName", "email", "phone", "phoneRequired", "location", "choose", "notes", "consent"] as const;
type ErrorKey = (typeof ERROR_KEYS)[number];

function readStored(): Stored | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    return parsed?.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(data: Stored) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable: the form still works, it just won't survive a reload.
  }
}

function clearStored() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/** RFC 4122 v4 id; falls back to getRandomValues where randomUUID is unavailable (non-secure origins). */
function newSubmissionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function sameOriginReferrerPath(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const ref = new URL(document.referrer);
    return ref.origin === window.location.origin ? ref.pathname.slice(0, 200) : undefined;
  } catch {
    return undefined;
  }
}

export function ConsultationFlow({ locale, consultationLanguages, calcom, contact }: Props) {
  const t = useTranslations("Consultation");
  const tCommon = useTranslations("Common");
  const router = useRouter();

  const [values, setValues] = useState<Values>(EMPTY);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const [meta, setMeta] = useState({ submissionId: "", startedAt: 0 });
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();

  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const focusTarget = useRef<"heading" | "summary" | "problem" | null>(null);

  // Restore an unfinished draft (e.g. after switching language) or start a new submission.
  useEffect(() => {
    const stored = readStored();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from sessionStorage after hydration */
    if (stored) {
      setValues({ ...EMPTY, ...stored.values });
      setStep(stored.step === 3 && !stored.lead ? 1 : stored.step);
      setLead(stored.lead);
      setMeta({ submissionId: stored.submissionId, startedAt: stored.startedAt });
    } else {
      setMeta({ submissionId: newSubmissionId(), startedAt: Date.now() });
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStored({ v: 1, values, submissionId: meta.submissionId, startedAt: meta.startedAt, step, lead });
  }, [hydrated, values, meta, step, lead]);

  // Move focus after the DOM reflects the new step, error summary or problem notice.
  useEffect(() => {
    const target = focusTarget.current;
    focusTarget.current = null;
    if (target === "heading") headingRef.current?.focus();
    if (target === "summary") summaryRef.current?.focus();
    if (target === "problem") problemRef.current?.focus();
  });

  const set = useCallback((name: FieldName, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      // Budget bands depend on the interest (rent vs purchase); drop a band that no longer applies.
      if (name === "interest" && next.budget && !(budgetOptionsFor(value as Interest) as readonly string[]).includes(next.budget)) {
        next.budget = "";
      }
      return next;
    });
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const errorText = (name: FieldName): string | undefined => {
    const key = errors[name];
    if (!key) return undefined;
    return t(`errors.${(ERROR_KEYS as readonly string[]).includes(key) ? (key as ErrorKey) : "choose"}`);
  };

  function goToStepTwo() {
    const found = validateStepOne(values);
    if (Object.keys(found).length) {
      setErrors(found);
      focusTarget.current = "summary";
      return;
    }
    setErrors({});
    setStep(2);
    focusTarget.current = "heading";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToStepOne() {
    setErrors({});
    setStep(1);
    focusTarget.current = "heading";
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) {
      goToStepTwo();
      return;
    }

    const one = validateStepOne(values);
    const found = { ...one, ...validateStepTwo(values) };
    if (Object.keys(found).length) {
      setErrors(found);
      if (Object.keys(one).length) setStep(1);
      focusTarget.current = "summary";
      return;
    }

    const attribution = readAttribution();
    const payload: Record<string, string | undefined> = {
      ...values,
      submissionId: meta.submissionId,
      startedAt: String(meta.startedAt),
      website: honeypotRef.current?.value ?? "",
      locale,
      sourcePage: sameOriginReferrerPath() ?? attribution.landing,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_content: attribution.utm_content,
      utm_term: attribution.utm_term,
    };
    const formData = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== "") formData.append(key, value);
    }

    setProblem(null);
    startTransition(async () => {
      let result: SubmitResult;
      try {
        result = await submitConsultation(formData);
      } catch {
        setProblem("network");
        focusTarget.current = "problem";
        return;
      }

      if (result.status === "success") {
        setLead({ leadId: result.leadId, firstName: result.firstName, fullName: values.fullName.trim(), email: result.email });
        setValues(EMPTY); // personal answers are no longer needed in the browser
        setErrors({});
        setStep(3);
        focusTarget.current = "heading";
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (result.status === "invalid") {
        setErrors(result.errors);
        if (Object.keys(result.errors).some((f) => stepOneFields.includes(f as FieldName))) setStep(1);
        focusTarget.current = "summary";
      } else {
        setProblem(result.status);
        focusTarget.current = "problem";
      }
    });
  }

  const onBooked = useCallback(() => {
    clearStored();
    router.push("/consultation/thank-you");
  }, [router]);

  // ── Option lists ──────────────────────────────────────────────────────
  const languageOptions = consultationLanguages.map((code) => ({
    value: code,
    label: t(`options.language.${code as "en" | "fa" | "ar"}`),
    lang: code,
  }));
  const channelOptions = channels.map((c) => ({ value: c, label: t(`options.channel.${c}`) }));
  const interestOptions = interests.map((i) => ({ value: i, label: t(`options.interest.${i}`) }));
  const purposeOptions = purposes.map((p) => ({ value: p, label: t(`options.purpose.${p}`) }));
  const budgetOptions = budgetOptionsFor(values.interest as Interest).map((b: Budget) => ({
    value: b,
    label: t(`options.budget.${b}`),
  }));
  const timelineOptions = timelines.map((v) => ({ value: v, label: t(`options.timeline.${v}`) }));
  const decisionOptions = decisionMakers.map((v) => ({ value: v, label: t(`options.decisionMakers.${v}`) }));
  const referralOptions = referrals.map((v) => ({ value: v, label: t(`options.referral.${v}`) }));
  const needsPhone = values.contactChannel === "phone" || values.contactChannel === "whatsapp";
  const fieldLabel = (name: FieldName) =>
    name === "consent" ? t("errors.consent") : name === "budget" && values.interest === "leasing" ? t("fields.budgetRent") : t(`fields.${name}`);

  const errorEntries = Object.entries(errors) as Array<[FieldName, string]>;
  const stepsTotal = 3;

  return (
    <div>
      {/* Progress */}
      <div className="mb-10">
        <p className="proof-label text-muted" aria-live="polite">
          {t("progress", { current: formatNumber(locale, step), total: formatNumber(locale, stepsTotal) })}
        </p>
        <ol className="mt-3 grid grid-cols-3 gap-2">
          {(["about", "goals", "schedule"] as const).map((key, index) => {
            const n = index + 1;
            const state = n < step ? "done" : n === step ? "current" : "todo";
            return (
              <li key={key} aria-current={state === "current" ? "step" : undefined}>
                <span
                  aria-hidden="true"
                  className={cx("block h-1 rounded-full", state === "todo" ? "bg-stone" : "bg-bronze-deep")}
                />
                <span className={cx("type-small mt-2 block", state === "current" ? "font-semibold text-ink" : "text-muted")}>
                  {t(`steps.${key}`)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <noscript>
        <p className="rounded-card border border-stone bg-ivory p-6">
          {t("noScript")}{" "}
          <a href={contact.instagramUrl} className="link" dir="ltr">
            {contact.instagramHandle}
          </a>
        </p>
      </noscript>

      {problem ? (
        <div ref={problemRef} tabIndex={-1} role="alert" className="mb-8 rounded-card border border-error/40 bg-[#fdf3f2] p-6 outline-none">
          <p className="font-semibold text-error">{t(`status.${problem === "rate_limited" ? "rateLimited" : problem}`)}</p>
          {problem === "unavailable" || problem === "network" ? (
            <button type="submit" form="consultation-form" className="btn btn-primary mt-4" disabled={pending}>
              {t("actions.retry")}
            </button>
          ) : null}
          <DirectContactBlock contact={contact} className="mt-5" />
        </div>
      ) : null}

      {errorEntries.length > 0 && step !== 3 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="error-summary-title"
          className="mb-8 rounded-card border-2 border-error bg-white p-6 outline-none"
        >
          <h2 id="error-summary-title" className="font-semibold text-error">
            {t("errors.summaryTitle")}
          </h2>
          <ul className="mt-3 list-disc space-y-1 ps-5">
            {errorEntries.map(([name]) => (
              <li key={name}>
                <a
                  href={`#${fieldId(name)}`}
                  className="text-error underline"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(fieldId(name))?.focus();
                  }}
                >
                  {name === "consent" ? errorText(name) : `${fieldLabel(name)}: ${errorText(name)}`}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {step !== 3 ? (
        <form id="consultation-form" noValidate onSubmit={onSubmit} aria-busy={pending || undefined}>
          {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
          <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
            <label htmlFor="cf-website">{t("fields.honeypot")}</label>
            <input ref={honeypotRef} id="cf-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>

          <div hidden={step !== 1}>
            <h2 ref={step === 1 ? headingRef : undefined} tabIndex={-1} className="type-h2 outline-none">
              {t("steps.about")}
            </h2>
            <div className="mt-8 grid gap-6">
              <TextField name="fullName" label={t("fields.fullName")} required autoComplete="name" value={values.fullName} onChange={(v) => set("fullName", v)} error={errorText("fullName")} />
              <TextField name="email" type="email" inputMode="email" dir="ltr" label={t("fields.email")} required autoComplete="email" value={values.email} onChange={(v) => set("email", v)} hint={t("fields.emailHint")} error={errorText("email")} />
              <RadioGroup name="contactChannel" label={t("fields.contactChannel")} required value={values.contactChannel} onChange={(v) => set("contactChannel", v)} options={channelOptions} columns={3} error={errorText("contactChannel")} />
              <TextField
                name="phone"
                type="tel"
                inputMode="tel"
                dir="ltr"
                label={t("fields.phone")}
                required={needsPhone}
                optionalLabel={t("optional")}
                autoComplete="tel"
                value={values.phone}
                onChange={(v) => set("phone", v)}
                hint={needsPhone ? `${t("fields.phoneHint")} ${t("fields.phoneRequiredHint")}` : t("fields.phoneHint")}
                error={errorText("phone")}
              />
              <TextField name="location" label={t("fields.location")} optionalLabel={t("optional")} autoComplete="country-name" value={values.location} onChange={(v) => set("location", v)} hint={t("fields.locationHint")} error={errorText("location")} />
              <RadioGroup
                name="consultationLanguage"
                label={t("fields.consultationLanguage")}
                required
                value={values.consultationLanguage}
                onChange={(v) => set("consultationLanguage", v)}
                options={languageOptions}
                columns={2}
                hint={locale === "ar" && !consultationLanguages.includes("ar") ? t("arabicNote") : undefined}
                error={errorText("consultationLanguage")}
              />
            </div>
            <div className="mt-10">
              <button type="button" onClick={goToStepTwo} className="btn btn-primary w-full sm:w-auto">
                {t("actions.continue")}
              </button>
            </div>
          </div>

          <div hidden={step !== 2}>
            <h2 ref={step === 2 ? headingRef : undefined} tabIndex={-1} className="type-h2 outline-none">
              {t("steps.goals")}
            </h2>
            <div className="mt-8 grid gap-6">
              <RadioGroup name="interest" label={t("fields.interest")} required value={values.interest} onChange={(v) => set("interest", v)} options={interestOptions} columns={2} error={errorText("interest")} />
              <SelectField name="purpose" label={t("fields.purpose")} required value={values.purpose} onChange={(v) => set("purpose", v)} options={purposeOptions} placeholder={t("options.choose")} error={errorText("purpose")} />
              <SelectField
                name="budget"
                label={values.interest === "leasing" ? t("fields.budgetRent") : t("fields.budget")}
                required
                value={values.budget}
                onChange={(v) => set("budget", v)}
                options={budgetOptions}
                placeholder={t("options.choose")}
                hint={t("fields.budgetHint")}
                error={errorText("budget")}
              />
              <SelectField name="timeline" label={t("fields.timeline")} required value={values.timeline} onChange={(v) => set("timeline", v)} options={timelineOptions} placeholder={t("options.choose")} error={errorText("timeline")} />
              <SelectField name="decisionMakers" label={t("fields.decisionMakers")} optionalLabel={t("optional")} value={values.decisionMakers} onChange={(v) => set("decisionMakers", v)} options={decisionOptions} placeholder={t("options.choose")} error={errorText("decisionMakers")} />
              <TextAreaField
                name="notes"
                label={t("fields.notes")}
                optionalLabel={t("optional")}
                value={values.notes}
                onChange={(v) => set("notes", v)}
                maxLength={NOTES_MAX}
                hint={t("fields.notesHint")}
                counter={t("fields.notesCounter", { count: formatNumber(locale, values.notes.length), max: formatNumber(locale, NOTES_MAX) })}
                error={errorText("notes")}
              />
              <SelectField name="referral" label={t("fields.referral")} optionalLabel={t("optional")} value={values.referral} onChange={(v) => set("referral", v)} options={referralOptions} placeholder={t("options.choose")} error={errorText("referral")} />

              <p className="type-small rounded-card bg-ivory p-4 text-charcoal">{t("privacyNote")}</p>
              <CheckboxField
                name="consent"
                checked={values.consent === "yes"}
                onChange={(checked) => set("consent", checked ? "yes" : "")}
                error={errorText("consent")}
                label={t.rich("fields.consent", {
                  link: (chunks) => (
                    <a href={getPathname({ locale, href: "/privacy" })} target="_blank" rel="noopener noreferrer" className="link">
                      {chunks}
                      <span className="sr-only"> {tCommon("opensInNewTab")}</span>
                    </a>
                  ),
                })}
              />
            </div>
            <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              <button type="button" onClick={backToStepOne} className="btn btn-secondary" disabled={pending}>
                {t("actions.back")}
              </button>
              <button type="submit" className="btn btn-primary" disabled={pending || !hydrated}>
                {pending ? t("actions.submitting") : t("actions.submit")}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <section aria-labelledby="schedule-title">
          {lead ? (
            <p role="status" className="mb-6 rounded-card bg-ivory px-4 py-3 font-medium text-success">
              {t("saved", { name: lead.firstName })}
            </p>
          ) : null}
          <h2 id="schedule-title" ref={headingRef} tabIndex={-1} className="type-h2 outline-none">
            {t("scheduler.title")}
          </h2>
          <p className="mt-3 max-w-measure text-charcoal">{t("scheduler.lead")}</p>
          {locale !== "en" ? <p className="type-small mt-2 text-muted">{t("scheduler.providerNote")}</p> : null}

          <div className="mt-8">
            {calcom.configured && lead && calcom.bookingUrlBase ? (
              <CalScheduler
                calLink={calcom.link}
                namespace={calcom.namespace}
                origin={calcom.origin}
                leadId={lead.leadId}
                name={lead.fullName}
                email={lead.email}
                bookingUrl={`${calcom.bookingUrlBase}?metadata%5BleadId%5D=${encodeURIComponent(lead.leadId)}`}
                onBooked={onBooked}
                labels={{
                  loading: t("scheduler.loading"),
                  fallbackTitle: t("scheduler.fallbackTitle"),
                  fallbackBody: t("scheduler.fallbackBody"),
                  fallbackCta: t("scheduler.fallbackCta"),
                  opensInNewTab: tCommon("opensInNewTab"),
                }}
              >
                <DirectContactBlock contact={contact} />
              </CalScheduler>
            ) : (
              <div className="rounded-card border border-stone bg-ivory p-6">
                <p className="text-charcoal">{t("scheduler.notConfigured")}</p>
                <DirectContactBlock contact={contact} className="mt-5" />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function DirectContactBlock({ contact, className }: { contact: DirectContact; className?: string }) {
  const t = useTranslations("Consultation.direct");
  const tContact = useTranslations("Contact");
  const tCommon = useTranslations("Common");
  const items = [
    contact.whatsappUrl ? { label: tContact("whatsapp"), href: contact.whatsappUrl, text: tContact("whatsapp"), external: true } : null,
    contact.phone ? { label: tContact("phone"), href: `tel:${contact.phone.replace(/\s/g, "")}`, text: contact.phone, external: false } : null,
    contact.email ? { label: tContact("email"), href: `mailto:${contact.email}`, text: contact.email, external: false } : null,
    { label: tContact("instagram"), href: contact.instagramUrl, text: contact.instagramHandle, external: true },
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  const onlyInstagram = items.length === 1;

  return (
    <div className={className}>
      <p className="font-semibold text-ink">{t("title")}</p>
      <p className="type-small mt-1 text-muted">{onlyInstagram ? t("unavailable") : t("body")}</p>
      <ul className="mt-3 flex flex-wrap gap-x-6">
        {items.map((item) => (
          <li key={item.label}>
            <a
              href={item.href}
              className="link inline-flex min-h-11 items-center"
              dir="ltr"
              {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {item.text}
              {item.external ? <span className="sr-only"> {tCommon("opensInNewTab")}</span> : null}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
