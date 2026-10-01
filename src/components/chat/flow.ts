import {
  cleanName,
  detectIntent,
  extractName,
  looksLikeQuestion,
  refineIntent,
  type Intent,
} from "@/lib/assistant/understand";
import { findPhoneInText, normalizePhone, redactPhones } from "@/lib/crm/phone";

export type Step =
  | "intent"
  | "clarify_buy"
  | "clarify_rental"
  | "name"
  | "phone"
  | "country"
  | "confirm"
  | "done";

export type Draft = {
  intent: Intent | null;
  /** The visitor's own words about their goal, kept beside the category. */
  purposeText: string;
  name: string;
  /** E.164 once validated. */
  phone: string;
  /** A local number waiting for its country code. */
  pendingPhone: string;
  buyAsked: boolean;
  rentalAsked: boolean;
};

export const EMPTY_DRAFT: Draft = {
  intent: null,
  purposeText: "",
  name: "",
  phone: "",
  pendingPhone: "",
  buyAsked: false,
  rentalAsked: false,
};

/** The next missing piece, asked one at a time. Nothing already known is asked again. */
export function nextStep(draft: Draft): Step {
  if (!draft.intent) return "intent";
  if (draft.intent === "buy" && !draft.buyAsked) return "clarify_buy";
  if (draft.intent === "rental" && !draft.rentalAsked) return "clarify_rental";
  if (!draft.name) return "name";
  if (!draft.phone) return draft.pendingPhone ? "country" : "phone";
  return "confirm";
}

export type Notice = "nameInvalid" | "phoneInvalid" | "askCountry";

export type TextOutcome = {
  draft: Draft;
  /** Something useful was taken from the message. */
  captured: boolean;
  /** A problem to tell the visitor about, if any. */
  notice?: Notice;
  /** The message should be answered by the assistant (a question, or not understood). */
  ask: boolean;
};

const PURPOSE_MAX = 300;

/** Applies a typed message to the draft without any server call. */
export function applyText(draft: Draft, step: Step, text: string): TextOutcome {
  const next = { ...draft };
  let captured = false;
  let notice: Notice | undefined;
  const question = looksLikeQuestion(text);

  // Phone: the whole message on the phone steps, otherwise any number found in it.
  if (!next.phone) {
    const onPhoneStep = step === "phone";
    const candidate = onPhoneStep ? text : findPhoneInText(text);
    if (candidate) {
      const result = normalizePhone(candidate);
      if (result.status === "ok") {
        next.phone = result.e164;
        next.pendingPhone = "";
        captured = true;
      } else if (result.status === "needs_country") {
        next.pendingPhone = candidate;
        captured = true;
        notice = "askCountry";
      } else if (onPhoneStep) {
        notice = "phoneInvalid";
      }
    } else if (onPhoneStep && !question) {
      notice = "phoneInvalid";
    }
  }

  // Name.
  if (!next.name) {
    if (step === "name" && !question) {
      const name = cleanName(text);
      if (name) {
        next.name = name;
        captured = true;
      } else if (!captured) {
        notice = "nameInvalid";
      }
    } else {
      const name = extractName(text);
      if (name) {
        next.name = name;
        captured = true;
      }
    }
  }

  // Goal.
  if (step === "clarify_buy" || step === "clarify_rental") {
    const refined = refineIntent(step === "clarify_buy" ? "buy" : "rental", text);
    if (refined === "unsure") {
      if (step === "clarify_buy") next.buyAsked = true;
      else next.rentalAsked = true;
      captured = true;
    } else if (refined) {
      next.intent = refined;
      captured = true;
    }
  } else if (!next.intent) {
    const intent = detectIntent(text);
    if (intent) {
      next.intent = intent;
      next.purposeText = redactPhones(text).trim().slice(0, PURPOSE_MAX);
      captured = true;
    }
  }

  const ask = !captured && !notice ? true : question && !captured;
  return { draft: next, captured, notice, ask };
}

/** Sets the goal from a button. */
export function chooseIntent(draft: Draft, intent: Intent): Draft {
  return {
    ...draft,
    intent,
    buyAsked: draft.buyAsked || intent !== "buy",
    rentalAsked: draft.rentalAsked || intent !== "rental",
  };
}

/** Clears one field from the summary so it is asked again. */
export function editField(draft: Draft, field: "name" | "phone" | "intent"): Draft {
  if (field === "name") return { ...draft, name: "" };
  if (field === "phone") return { ...draft, phone: "", pendingPhone: "" };
  return { ...draft, intent: null, purposeText: "", buyAsked: false, rentalAsked: false };
}

/** Pre-filled WhatsApp link. The visitor edits and sends the message themselves. */
export function whatsappLink(phoneE164: string, message: string): string {
  return `https://wa.me/${phoneE164.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
