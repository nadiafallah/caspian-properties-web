import type { AppLocale } from "@/i18n/locales";

/**
 * Enquiry categories. "buy" = purchase with ready/off-plan undecided;
 * "rental" = rent or let, direction undecided.
 */
export const intents = ["buy_ready", "buy_off_plan", "buy", "sell", "rent", "let", "rental"] as const;
export type Intent = (typeof intents)[number];
/** The five routes offered as buttons. */
export const primaryIntents = ["buy_ready", "buy_off_plan", "sell", "rent", "let"] as const satisfies readonly Intent[];

export function isIntent(value: unknown): value is Intent {
  return typeof value === "string" && (intents as readonly string[]).includes(value);
}

/** Lower-case, Arabic/Persian letter variants unified, diacritics and ZWNJ removed. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/‌/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

const pattern = (words: string[], flags = "u") => new RegExp(words.map((w) => normalizeText(w)).join("|"), flags);

const OFF_PLAN = pattern([
  "off-plan", "off plan", "offplan", "pre-launch", "prelaunch", "new launch", "under construction", "presale", "pre-sale",
  "آف پلن", "آف‌پلن", "افپلن", "اف پلن", "پیش خرید", "پیش‌خرید", "پیش فروش", "پیش‌فروش", "در حال ساخت",
  "على الخارطة", "على الخريطة", "قيد الانشاء", "قيد الإنشاء", "اوف بلان", "أوف بلان",
]);
const READY = pattern([
  "ready", "resale", "completed", "move-in", "move in", "secondary market",
  "آماده", "تحویل فوری", "ساخته شده", "دست دوم",
  "جاهز", "جاهزة", "اعادة بيع", "إعادة بيع", "ريسيل",
]);
const BUY = pattern([
  "\\bbuy", "purchas", "\\bown a", "invest in a",
  "خرید", "بخرم", "بخریم", "بخرن", "خریدن", "بخرد", "سرمایه گذاری روی ملک",
  "شراء", "اشتري", "أشتري", "نشتري", "تملک", "امتلاک",
]);
const SELL = pattern([
  "\\bsell", "selling",
  "(?:^|\\s)فروش(?:\\s|$)", "فروش ملک", "فروختن", "بفروشم", "بفروشیم", "میفروشم", "می‌فروشم", "فروش آپارتمان", "فروش خانه", "فروش واحد",
  "(?:^|\\s)(?:ال)?بيع(?:\\s|$)", "بيع عقار", "ابيع", "أبيع", "نبيع", "بيع شقه", "بيع شقة", "بيع منزل", "بيع فيلا", "بيع وحده",
]);
const RENT_IN = pattern([
  "to rent a", "rent a ", "looking to rent", "want to rent", "renting a", "tenant", "lease a ",
  "اجاره کنم", "اجاره کنیم", "اجاره کردن", "اجاره بگیرم", "اجاره بگیریم", "مستاجر", "مستأجر", "اجاره میکنم", "رهن کنم",
  "استئجار", "استاجر", "أستأجر", "استأجر", "نستاجر", "مستاجر",
]);
const LET_OUT_WORDS = [
  "rent out", "let out", "letting", "\\blet my", "landlord", "lease out", "rent my",
  "اجاره بدم", "اجاره بدهم", "اجاره بدیم", "اجاره دادن", "موجر", "صاحبخانه", "صاحب خانه", "اجاره دهم",
  "تاجیر", "تأجير", "اؤجر", "أؤجر", "نؤجر", "مالک العقار",
];
const LET_OUT = pattern(LET_OUT_WORDS);
const LET_OUT_ALL = pattern(LET_OUT_WORDS, "gu");
const RENTAL = pattern(["\\brent", "rental", "leasing", "\\blease", "اجاره", "رهن", "ایجار", "إيجار", "اجار"]);
// "Pre-sale" mentions selling but is an off-plan purchase.
const PRESALE = pattern(["پیش فروش", "پیش‌فروش", "presale", "pre-sale", "بيع على الخارطة", "بيع على الخريطة"]);

/** Recognises the visitor's goal from free text in English, Persian or Arabic. */
export function detectIntent(text: string): Intent | null {
  const t = normalizeText(text);
  const offPlan = OFF_PLAN.test(t);
  const ready = READY.test(t);
  const buy = BUY.test(t) || offPlan;
  const sell = SELL.test(t.replace(PRESALE, " "));

  if (buy && !sell) return offPlan && !ready ? "buy_off_plan" : ready && !offPlan ? "buy_ready" : "buy";
  if (sell && !buy) return "sell";
  if (buy && sell) return null;

  // "Rent out" contains "rent": judge renting-in only on what is left without let-out phrases.
  const letOut = LET_OUT.test(t);
  const rentIn = RENT_IN.test(t.replace(LET_OUT_ALL, " "));
  if (rentIn && !letOut) return "rent";
  if (letOut && !rentIn) return "let";
  if (rentIn || letOut || RENTAL.test(t)) return "rental";
  return null;
}

const UNSURE = pattern([
  "not sure", "don't know", "dont know", "either", "both", "no idea", "unsure",
  "نمی دانم", "نمی‌دانم", "نمیدانم", "نمیدونم", "نمی دونم", "مطمئن نیستم", "فرقی نمی", "هر دو", "هردو",
  "لا اعرف", "لا أعرف", "غير متاکد", "غير متأكد", "کلاهما", "لست متاکد",
]);

/** Answer to "ready or off-plan?" / "renting or letting?". null = not understood. */
export function refineIntent(current: "buy" | "rental", text: string): Intent | "unsure" | null {
  if (UNSURE.test(normalizeText(text))) return "unsure";
  const detected = detectIntent(text);
  if (current === "buy") {
    if (OFF_PLAN.test(normalizeText(text))) return "buy_off_plan";
    if (READY.test(normalizeText(text))) return "buy_ready";
    return detected === "buy_ready" || detected === "buy_off_plan" ? detected : null;
  }
  return detected === "rent" || detected === "let" ? detected : null;
}

const QUESTION_START = pattern([
  "^(what|how|where|when|who|why|which|do|does|can|could|is|are|will|should)\\b",
  "^(چه|چطور|چگونه|کجا|کی |چرا|آیا|چقدر|چند|کدام)",
  "^(ما |ماذا|کیف|این|متی|لماذا|هل|کم|ای )",
]);

// Persian and Arabic questions often put the question word mid-sentence.
const QUESTION_WORD = pattern([
  "(?:^|\\s)(?:چقدر|چطور|چگونه|کجا|چرا|آیا|چند|کدام|چیست|چه)(?:\\s|$)",
  "(?:^|\\s)(?:کم|کیف|این|متی|لماذا|هل|ماذا)(?:\\s|$)",
]);

export function looksLikeQuestion(text: string): boolean {
  const t = normalizeText(text);
  return /[?؟]/.test(text) || QUESTION_START.test(t) || QUESTION_WORD.test(t);
}

// Topics the assistant must never answer itself: they go to Nadia.
const ADVISOR_ONLY = pattern([
  "price", "cost", "how much", "payment plan", "instal", "availab", "units", "roi", "yield", "return on", "discount",
  "commission", "fee", "cheapest", "best project", "which project", "recommend a", "invest",
  "قیمت", "چقدر", "هزینه", "قسط", "اقساط", "پرداخت", "موجود", "سود", "بازده", "کمیسیون", "تخفیف", "کدام پروژه", "ارزان",
  "سعر", "اسعار", "کم ", "تکلفه", "اقساط", "خطه الدفع", "متوفر", "عائد", "عمول", "خصم", "ارخص", "افضل مشروع",
]);

export function isAdvisorOnlyTopic(text: string): boolean {
  return ADVISOR_ONLY.test(normalizeText(text));
}

export const faqTopics = ["services", "process", "about", "languages", "office", "contact"] as const;
export type FaqTopic = (typeof faqTopics)[number];

const TOPICS: Record<FaqTopic, RegExp> = {
  services: pattern(["service", "what do you do", "help with", "offer", "خدمات", "چه کار", "چه کمکی", "خدمت", "الخدمات", "خدمه", "تقدم"]),
  process: pattern(["process", "how does it work", "steps", "how do you work", "consultation", "روند", "مراحل", "چطور کار", "مشاوره", "کیف تعمل", "الخطوات", "استشاره", "العملیه"]),
  about: pattern(["who is", "about", "licen", "rera", "experience", "since", "nadia", "company", "درباره", "نادیا", "مجوز", "سابقه", "شرکت", "کاسپین", "من هي", "ترخیص", "خبره", "الشرکه", "نادیه"]),
  languages: pattern(["language", "speak", "persian", "farsi", "arabic", "english", "زبان", "فارسی", "عربی", "انگلیسی", "لغه", "اللغات", "العربیه", "الفارسیه"]),
  office: pattern(["office", "address", "located", "where are you", "business bay", "دفتر", "آدرس", "کجا هستید", "مکتب", "عنوان", "مقر", "این انتم"]),
  contact: pattern(["contact", "call", "phone", "whatsapp", "talk to", "speak to", "تماس", "تلفن", "واتساپ", "واتس‌اپ", "شماره", "اتصال", "اتصل", "هاتف", "واتساب", "رقم"]),
};

export function detectFaqTopic(text: string): FaqTopic | null {
  const t = normalizeText(text);
  for (const topic of faqTopics) if (TOPICS[topic].test(t)) return topic;
  return null;
}

/** Language of a message, from its script; null when it cannot tell (digits, emoji…). */
export function detectLanguage(text: string): AppLocale | null {
  // Letters only: Persian/Arabic digits and punctuation say nothing about the language.
  const letters = text.replace(/[٠-٬۰-۹،؛؟]/g, "");
  if (/[پچژگکی]/.test(letters)) return "fa"; // letters (or forms) used in Persian but not Arabic
  if (/[ء-ي]/.test(letters)) return "ar";
  if ((letters.match(/[a-z]/gi) ?? []).length >= 3) return "en";
  return null;
}

const NAME_INTRO = [
  /\bmy name is\s+([\p{L}][\p{L}\p{M}' .-]{1,60})/iu,
  /\bi am\s+([\p{L}][\p{L}\p{M}'-]{1,30}(?:\s+[\p{L}][\p{L}\p{M}'-]{1,30})?)\s*(?:[,.!]|$)/iu,
  /(?:اسمم|اسم من|نام من)\s+([\p{L}\p{M}‌ ]{2,60}?)\s*(?:است|هست|ه\b|[،,.!]|$)/u,
  /(?:اسمي|اسمی|أنا|انا)\s+([\p{L}\p{M} ]{2,60}?)\s*(?:[،,.!]|$)/u,
];

/** "My name is Sara", "اسمم سارا است", "اسمي سارة" → the name, or null. */
export function extractName(text: string): string | null {
  for (const re of NAME_INTRO) {
    const m = text.match(re);
    const name = m?.[1]?.trim();
    if (name && name.length >= 2 && !/\d/.test(name)) return name;
  }
  return null;
}

/** A plausible name typed as an answer to "what is your name?". */
export function cleanName(text: string): string | null {
  const name = (extractName(text) ?? text).replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 80 || /\d|@|https?:/i.test(name)) return null;
  if (!/\p{L}/u.test(name)) return null;
  return name;
}
