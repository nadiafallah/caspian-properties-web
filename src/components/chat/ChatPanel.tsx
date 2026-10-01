"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { localeMeta, locales, type AppLocale } from "@/i18n/locales";
import { detectLanguage, looksLikeQuestion, primaryIntents, type Intent } from "@/lib/assistant/understand";
import { formatPhone, normalizePhone } from "@/lib/crm/phone";
import { cx } from "@/lib/format";
import type { ChatSubmitResult } from "@/lib/crm/submit";
import type { AssistantTurn } from "@/lib/assistant/reply";
import { askAssistant, submitChatEnquiry } from "./actions";
import { EMPTY_DRAFT, applyText, chooseIntent, editField, nextStep, whatsappLink, type Draft, type Step } from "./flow";
import type { ChatDictionary } from "./types";

type Props = {
  initialLocale: AppLocale;
  dictionaries: Record<AppLocale, ChatDictionary>;
  phoneE164: string;
  privacyPaths: Record<AppLocale, string>;
  onClose: () => void;
};

type PromptKey =
  | "greeting"
  | "askIntent"
  | "askIntentAgain"
  | "clarifyBuy"
  | "clarifyRental"
  | "askName"
  | "askPhone"
  | "askCountry"
  | "nameInvalid"
  | "phoneInvalid"
  | "failed"
  | "rateLimited"
  | "rejected"
  | "networkError";

type Message =
  | { id: string; from: "user"; text: string }
  | { id: string; from: "bot"; key: PromptKey }
  | { id: string; from: "bot"; text: string }
  | { id: string; from: "bot"; success: true; name: string };

type NewMessage = Message extends infer M ? (M extends Message ? Omit<M, "id"> : never) : never;
type Status = "idle" | "thinking" | "submitting" | "failed" | "done";

type Stored = {
  v: 1;
  lang: AppLocale;
  messages: Message[];
  draft: Draft;
  key: string;
  startedAt: number;
  status: Status;
  waDraft: string;
};

const STORAGE_KEY = "cpn.chat.v1";
const PROMPT_FOR_STEP: Partial<Record<Step, PromptKey>> = {
  intent: "askIntent",
  clarify_buy: "clarifyBuy",
  clarify_rental: "clarifyRental",
  name: "askName",
  phone: "askPhone",
  country: "askCountry",
};

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()));

function freshState(lang: AppLocale): Stored {
  return {
    v: 1,
    lang,
    messages: [
      { id: uid(), from: "bot", key: "greeting" },
      { id: uid(), from: "bot", key: "askIntent" },
    ],
    draft: EMPTY_DRAFT,
    key: uid(),
    startedAt: Date.now(),
    status: "idle",
    waDraft: "",
  };
}

function readStored(): Stored | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Stored) : null;
    return parsed?.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

/** The site's floating assistant: answers general questions and records a call request. */
export function ChatPanel({ initialLocale, dictionaries, phoneE164, privacyPaths, onClose }: Props) {
  const [state, setState] = useState<Stored>(() => freshState(initialLocale));
  const [input, setInput] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);

  const { lang, messages, draft, status } = state;
  const t = dictionaries[lang];
  const step = status === "done" ? "done" : nextStep(draft);
  const busy = status === "thinking" || status === "submitting";
  const intentLabels = t.intents as Record<Intent, string>;

  // Restore this tab's conversation (kept for the session only).
  useEffect(() => {
    const stored = readStored();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore after hydration
    if (stored) setState({ ...stored, status: stored.status === "done" ? "done" : stored.status === "failed" ? "failed" : "idle" });
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable (private mode): the conversation simply isn't kept.
    }
  }, [state]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length, status, step]);

  // Full-screen on phones: follow the visual viewport so the on-screen keyboard never covers the input.
  useEffect(() => {
    const vv = window.visualViewport;
    const panel = panelRef.current;
    if (!vv || !panel) return;
    const update = () => {
      if (window.matchMedia("(min-width: 640px)").matches) {
        panel.style.removeProperty("height");
        panel.style.removeProperty("top");
        return;
      }
      panel.style.height = `${vv.height}px`;
      panel.style.top = `${vv.offsetTop}px`;
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const push = useCallback((...items: NewMessage[]) => {
    setState((s) => ({ ...s, messages: [...s.messages, ...items.map((m) => ({ ...m, id: uid() }) as Message)] }));
  }, []);

  /** Asks the next question for the given draft (one at a time). */
  const promptNext = useCallback(
    (nextDraft: Draft, again = false) => {
      const nextS = nextStep(nextDraft);
      const key = nextS === "intent" && again ? "askIntentAgain" : PROMPT_FOR_STEP[nextS];
      if (key) push({ from: "bot", key });
    },
    [push],
  );

  const setDraft = (nextDraft: Draft) => setState((s) => ({ ...s, draft: nextDraft }));

  async function handleText(text: string) {
    const currentStep = step;
    // Follow the visitor's language — but a name or number typed in another script
    // (e.g. a Latin name in a Persian chat) is an answer, not a language choice.
    const answering = currentStep === "name" || currentStep === "phone" || currentStep === "country";
    const detected = answering && !looksLikeQuestion(text) ? null : detectLanguage(text);
    const replyLang = detected ?? lang;
    setState((s) => ({ ...s, lang: replyLang, messages: [...s.messages, { id: uid(), from: "user", text }] }));

    if (currentStep === "done" || currentStep === "confirm") {
      await ask(text, replyLang, draft, currentStep === "confirm" ? null : undefined);
      return;
    }

    const outcome = applyText(draft, currentStep, text);
    setDraft(outcome.draft);
    if (outcome.notice === "nameInvalid" || outcome.notice === "phoneInvalid") {
      push({ from: "bot", key: outcome.notice });
      return;
    }
    if (outcome.ask) {
      await ask(text, replyLang, outcome.draft);
      return;
    }
    promptNext(outcome.draft);
  }

  /** Sends the conversation to the assistant, then resumes the flow. */
  async function ask(text: string, replyLang: AppLocale, current: Draft, resume?: null) {
    setState((s) => ({ ...s, status: "thinking" }));
    const history = [...messages, { id: "", from: "user" as const, text }]
      .flatMap((m): AssistantTurn[] => {
        if (m.from === "user") return [{ from: "user" as const, text: m.text }];
        if ("text" in m && m.text) return [{ from: "bot" as const, text: m.text }];
        return [];
      })
      .slice(-12);
    let updated = current;
    try {
      const result = await askAssistant({ locale: replyLang, history });
      if (result.reply) push({ from: "bot", text: result.reply });
      if (result.intent && !current.intent && status !== "done") {
        updated = { ...chooseIntent(current, result.intent), purposeText: text.slice(0, 300) };
        setDraft(updated);
      }
    } catch {
      push({ from: "bot", key: "networkError" });
    }
    setState((s) => ({ ...s, status: s.status === "thinking" ? "idle" : s.status }));
    if (resume !== null && status !== "done") promptNext(updated, true);
  }

  function pickIntent(intent: Intent) {
    push({ from: "user", text: intentLabels[intent] });
    const updated = chooseIntent(draft, intent);
    setDraft(updated);
    promptNext(updated);
  }

  function pickClarify(choice: Intent | "unsure", label: string) {
    push({ from: "user", text: label });
    const updated =
      choice === "unsure"
        ? { ...draft, buyAsked: true, rentalAsked: true }
        : { ...draft, intent: choice, buyAsked: true, rentalAsked: true };
    setDraft(updated);
    promptNext(updated);
  }

  function pickCountry(code: "971" | "98" | null, label: string) {
    push({ from: "user", text: label });
    if (!code) {
      const updated = { ...draft, pendingPhone: "" };
      setDraft(updated);
      push({ from: "bot", key: "askPhone" });
      return;
    }
    const result = normalizePhone(draft.pendingPhone, code);
    if (result.status === "ok") {
      const updated = { ...draft, phone: result.e164, pendingPhone: "" };
      setDraft(updated);
      promptNext(updated);
    } else {
      setDraft({ ...draft, pendingPhone: "" });
      push({ from: "bot", key: "phoneInvalid" });
    }
  }

  function edit(field: "name" | "phone" | "intent") {
    const updated = editField(draft, field);
    setState((s) => ({ ...s, draft: updated, status: "idle" }));
    promptNext(updated);
  }

  async function submit() {
    if (busy) return;
    setState((s) => ({ ...s, status: "submitting" }));
    let result: ChatSubmitResult;
    try {
      result = await submitChatEnquiry({
        idempotencyKey: state.key,
        name: draft.name,
        phone: draft.phone,
        intent: draft.intent,
        purposeText: draft.purposeText,
        locale: lang,
        startedAt: state.startedAt,
        website: honeypot,
      });
    } catch {
      setState((s) => ({ ...s, status: "failed" }));
      push({ from: "bot", key: "networkError" });
      return;
    }

    if (result.status === "success") {
      const purpose = draft.purposeText || intentLabels[draft.intent ?? "buy"];
      setState((s) => ({
        ...s,
        status: "done",
        waDraft: fill(t.whatsappDraft, { name: draft.name, purpose }),
        messages: [...s.messages, { id: uid(), from: "bot", success: true, name: draft.name }],
      }));
      return;
    }
    if (result.status === "invalid") {
      setState((s) => ({ ...s, status: "idle" }));
      edit(result.field);
      return;
    }
    setState((s) => ({ ...s, status: result.status === "rejected" ? "idle" : "failed" }));
    push({ from: "bot", key: result.status === "rate_limited" ? "rateLimited" : result.status === "rejected" ? "rejected" : "failed" });
  }

  function startOver() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
    setState(freshState(lang));
  }

  function onSubmitInput(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void handleText(text.slice(0, 1000));
  }

  function onInputKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmitInput(event);
    }
  }

  function onPanelKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") onClose();
  }

  const telHref = `tel:${phoneE164}`;
  const waBase = `https://wa.me/${phoneE164.replace(/\D/g, "")}`;
  const dir = localeMeta[lang].dir;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="chat-title"
      lang={lang}
      dir={dir}
      onKeyDown={onPanelKey}
      className="chat-panel fixed inset-x-0 top-0 z-50 flex h-dvh flex-col bg-white text-ink shadow-card sm:inset-auto sm:end-4 sm:bottom-4 sm:h-[min(40rem,calc(100dvh-2rem))] sm:w-[24rem] sm:rounded-card sm:border sm:border-stone"
    >
      <header className="flex items-start gap-3 border-b border-stone bg-ivory px-4 py-3 sm:rounded-t-card">
        <div className="min-w-0 flex-1">
          <h2 id="chat-title" className="font-semibold leading-snug">
            {t.title}
          </h2>
          <p className="type-caption text-muted">{t.subtitle}</p>
        </div>
        <div role="group" aria-label={t.language} className="flex shrink-0 items-center">
          {locales.map((code) => (
            <button
              key={code}
              type="button"
              lang={code}
              aria-pressed={code === lang}
              onClick={() => setState((s) => ({ ...s, lang: code }))}
              className={cx(
                "min-h-9 min-w-9 rounded-sm px-1.5 text-sm",
                code === lang ? "font-semibold text-bronze-deep underline underline-offset-4" : "text-muted hover:text-ink",
              )}
            >
              {t.languageShort[code]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="-me-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-stone/50"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="flex gap-2 border-b border-stone px-4 py-2">
        <a href={telHref} className="btn btn-secondary min-h-10 flex-1 px-3 py-1.5 text-sm">
          {t.call}
        </a>
        <a href={waBase} target="_blank" rel="noopener noreferrer" className="btn btn-secondary min-h-10 flex-1 px-3 py-1.5 text-sm">
          {t.whatsapp}
        </a>
      </div>

      <div ref={logRef} role="log" aria-live="polite" aria-label={t.title} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => {
          if (m.from === "user") {
            return (
              <p key={m.id} className="ms-auto w-fit max-w-[85%] rounded-card bg-bronze-deep px-3 py-2 whitespace-pre-wrap text-white">
                <span className="sr-only">{t.you}: </span>
                {m.text}
              </p>
            );
          }
          const text = "key" in m ? t[m.key] : "text" in m ? m.text : null;
          if ("success" in m) {
            return (
              <div key={m.id} className="me-6 rounded-card border border-success/30 bg-ivory px-3 py-2">
                <p>{fill(t.success, { name: m.name })}</p>
              </div>
            );
          }
          return (
            <p key={m.id} className="w-fit max-w-[85%] rounded-card bg-ivory px-3 py-2 whitespace-pre-wrap">
              <span className="sr-only">{t.bot}: </span>
              {text}
            </p>
          );
        })}

        {status === "thinking" ? (
          <p className="type-small text-muted" role="status">
            {t.thinking}
          </p>
        ) : null}

        {step === "confirm" && status !== "done" ? (
          <section aria-labelledby="chat-summary" className="rounded-card border border-stone p-4">
            <h3 id="chat-summary" className="font-semibold">
              {t.summaryTitle}
            </h3>
            <dl className="mt-2 space-y-2 text-sm">
              <SummaryRow label={t.summaryName} value={draft.name} action={t.change} onEdit={() => edit("name")} />
              <SummaryRow label={t.summaryPhone} value={formatPhone(draft.phone)} ltr action={t.change} onEdit={() => edit("phone")} />
              <SummaryRow
                label={t.summaryPurpose}
                value={[draft.intent ? intentLabels[draft.intent] : "", draft.purposeText].filter(Boolean).join(" — ")}
                action={t.change}
                onEdit={() => edit("intent")}
              />
            </dl>
            <p className="type-small mt-3 text-muted">
              {t.consentNote}{" "}
              <a href={privacyPaths[lang]} target="_blank" rel="noopener" className="link">
                {t.privacyLink}
              </a>
            </p>
            <button type="button" onClick={submit} disabled={busy} className="btn btn-primary mt-3 w-full">
              {status === "submitting" ? t.submitting : status === "failed" ? t.retry : t.submit}
            </button>
          </section>
        ) : null}

        {status === "done" ? (
          <section aria-label={t.successNext} className="space-y-3 rounded-card border border-stone p-4">
            <p className="font-medium">{t.successNext}</p>
            <a href={telHref} className="btn btn-primary w-full">
              {t.call} <span dir="ltr">{formatPhone(phoneE164)}</span>
            </a>
            <label htmlFor="chat-wa-draft" className="type-small block font-medium">
              {t.whatsappDraftLabel}
            </label>
            <textarea
              id="chat-wa-draft"
              value={state.waDraft}
              onChange={(e) => setState((s) => ({ ...s, waDraft: e.target.value.slice(0, 1000) }))}
              rows={3}
              className="w-full rounded-sm border border-stone-strong px-3 py-2 text-sm"
            />
            <a href={whatsappLink(phoneE164, state.waDraft)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full">
              {t.openWhatsapp}
            </a>
            <p className="type-caption text-muted">{t.whatsappNote}</p>
            <button type="button" onClick={startOver} className="link min-h-11 text-sm">
              {t.startOver}
            </button>
          </section>
        ) : null}
      </div>

      {!busy && step === "intent" ? (
        <QuickReplies>
          {primaryIntents.map((intent) => (
            <QuickReply key={intent} onClick={() => pickIntent(intent)}>
              {intentLabels[intent]}
            </QuickReply>
          ))}
        </QuickReplies>
      ) : null}
      {!busy && step === "clarify_buy" ? (
        <QuickReplies>
          <QuickReply onClick={() => pickClarify("buy_ready", t.clarifyOptions.ready)}>{t.clarifyOptions.ready}</QuickReply>
          <QuickReply onClick={() => pickClarify("buy_off_plan", t.clarifyOptions.offPlan)}>{t.clarifyOptions.offPlan}</QuickReply>
          <QuickReply onClick={() => pickClarify("unsure", t.clarifyOptions.unsure)}>{t.clarifyOptions.unsure}</QuickReply>
        </QuickReplies>
      ) : null}
      {!busy && step === "clarify_rental" ? (
        <QuickReplies>
          <QuickReply onClick={() => pickClarify("rent", intentLabels.rent)}>{intentLabels.rent}</QuickReply>
          <QuickReply onClick={() => pickClarify("let", intentLabels.let)}>{intentLabels.let}</QuickReply>
          <QuickReply onClick={() => pickClarify("unsure", t.clarifyOptions.unsure)}>{t.clarifyOptions.unsure}</QuickReply>
        </QuickReplies>
      ) : null}
      {!busy && step === "country" ? (
        <QuickReplies>
          <QuickReply onClick={() => pickCountry("971", t.countryOptions.uae)}>{t.countryOptions.uae}</QuickReply>
          <QuickReply onClick={() => pickCountry("98", t.countryOptions.iran)}>{t.countryOptions.iran}</QuickReply>
          <QuickReply onClick={() => pickCountry(null, t.countryOptions.other)}>{t.countryOptions.other}</QuickReply>
        </QuickReplies>
      ) : null}

      <form onSubmit={onSubmitInput} className="flex items-end gap-2 border-t border-stone px-3 py-3">
        {/* Honeypot: hidden from people and assistive technology. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="absolute -start-[9999px] h-px w-px opacity-0"
        />
        <label htmlFor="chat-input" className="sr-only">
          {t.inputLabel}
        </label>
        <textarea
          ref={inputRef}
          id="chat-input"
          rows={1}
          value={input}
          maxLength={1000}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onInputKey}
          placeholder={t.placeholder}
          inputMode={step === "phone" ? "tel" : "text"}
          autoComplete={step === "phone" ? "tel" : step === "name" ? "name" : "off"}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-sm border border-stone-strong px-3 py-2.5 text-base"
        />
        <button type="submit" disabled={busy || !input.trim()} className="btn btn-primary min-h-11 px-4">
          {t.send}
        </button>
      </form>
    </div>
  );
}

function SummaryRow({ label, value, action, onEdit, ltr }: { label: string; value: string; action: string; onEdit: () => void; ltr?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <dt className="type-caption text-muted">{label}</dt>
        <dd className="break-words" dir={ltr ? "ltr" : undefined}>
          {ltr ? <bdi>{value}</bdi> : value}
        </dd>
      </div>
      <button type="button" onClick={onEdit} className="link min-h-9 shrink-0 text-sm" aria-label={`${action}: ${label}`}>
        {action}
      </button>
    </div>
  );
}

function QuickReplies({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2 border-t border-stone px-3 pt-3">{children}</div>;
}

function QuickReply({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-10 rounded-full border border-bronze-deep px-3 py-1.5 text-sm text-bronze-deep hover:bg-ivory"
    >
      {children}
    </button>
  );
}
