# Design blueprint — Caspian Properties by Nadia

Approved 22 Sep 2026. Source of truth for brand rules: `Caspian_Properties_by_Nadia_Brand_Guide_v2.pdf` (v2.0, Sep 2026), kept in the owner's local `private/brand/` folder and deliberately not committed, because this repository is public.
This document records how the website applies the guide and every decision taken with the owner.

## 1. Purpose

An advisory website — not a listing portal — that:

1. establishes Nadia as the visible, accountable advisor;
2. presents Caspian Properties Brokers LLC (licensed in Dubai since 9 May 2007) as the corporate foundation;
3. makes the advisory method visible before asking for anything;
4. converts suitable visitors through a qualification form → Cal.com booking (Cal.com connected to Google Calendar).

## 2. Decisions confirmed with the owner

| Topic | Decision |
|---|---|
| Languages | English, Persian, Arabic — every page fully translated. |
| Entry language | Always English. No `Accept-Language` or cookie detection. English URLs have no prefix (`/about`); Persian `/fa/…`, Arabic `/ar/…`. |
| Switching | Header (desktop menu / mobile menu), footer, and top of the consultation page. Form answers survive a language switch. |
| Consultation languages | English and Persian (brand guide). Arabic appears only after an Arabic-speaking advisor is confirmed (`consultationLanguages` in `src/config/site.ts`). |
| Credentials | BRN/ORN as text + link to the DLD verification service + reduced, watermarked broker-card preview. Screenshots cannot be prevented on the web; this is stated plainly. |
| Public name | “Nadia Fallah” in credentials; “Nadia” elsewhere. |
| ORN | 557 — confirmed current by owner (22 Sep 2026). |
| Phone / WhatsApp / email | Owner will supply new public numbers; hidden until then. |
| Rate limiting | Upstash Redis (free plan) + honeypot + minimum fill time + Server Action origin check. Turnstile held in reserve. |
| Analytics | Vercel Web Analytics (cookieless), off until enabled in the dashboard. Funnel conversion measured from the Supabase `leads` table. |
| Paid services | None until the owner has validated the site. Vercel Hobby for previews; the commercial-plan question is raised only at public launch. |

## 3. Information architecture

| Route | In nav | Notes |
|---|---|---|
| `/` | — | Home |
| `/about` | ✓ | Nadia, values, Caspian facts, licence & registration (`#licence`) |
| `/approach` | ✓ | Four-stage method, evidence standard, what I will not do |
| `/client-journey` | ✓ | Five stages, documents/privacy expectations, FAQ |
| `/contact` | ✓ | Consultation card + verified direct channels |
| `/consultation` | CTA | Two-step form → Cal.com scheduling |
| `/consultation/thank-you` | — | `noindex` |
| `/opportunities`, `/insights` | hidden | Built with a validated content model; `noindex`, out of nav and sitemap until the first verified item exists |
| `/privacy`, `/terms` | footer | Describe the real configuration; flagged for legal review |
| 404 / error | — | Localised; `app/global-not-found.tsx` for non-locale paths |

**Homepage order:** header → hero → trust strip (verified facts) → meet Nadia → four-stage method → services (framed as client questions) → Since 2007 (charcoal, five proof pillars) → two lenses, one decision → client journey → private-consultation invitation → legal footer.

The full form lives only on `/consultation` (one funnel, one analytics path, no cramped modal on mobile).

## 4. Visual system

Tokens live in `src/app/globals.css` (`@theme`). Palette from guide §2.4; ratio target 70 / 20 / ≤10 % bronze.

| Token | Hex | Use |
|---|---|---|
| charcoal | #383838 | authority sections, footer |
| bronze-light | #E9AF8B | accents & CTAs on dark |
| bronze | #CE7D51 | large numerals, Horizon rule (decorative / large only) |
| bronze-deep | #9D4F2B | CTAs and links on light |
| ivory | #F7F2EC | editorial light surface |
| stone | #D8D1CA | dividers, card borders (decorative only) |
| ink | #1F1F1F | body text |

**Documented deviations** (functional colours the brand palette lacks):

| Token | Hex | Reason | Contrast |
|---|---|---|---|
| stone-strong | #8A827B | form field borders — Stone is 1.51:1, below WCAG 1.4.11’s 3:1 | 3.78 on white / 3.39 on ivory |
| muted | #5C5652 | secondary text | 7.22 on white |
| error | #B42318 | validation | 6.57 on white |
| success | #2E6B3F | confirmations | 6.38 on white |

Also: **Bronze Signature on Ivory is 2.83:1** and fails even for large text, so on ivory it is used only decoratively (`aria-hidden`).

**Typography** (guide §2.6): Cormorant Garamond 600 (English display), Inter (English body/UI), Vazirmatn (Persian and Arabic — one family for harmony and performance; swap to Noto Sans Arabic via `--font-rtl` if a native Arabic reviewer prefers). Scale: Display 64/68 (44/48 mobile), H1 48/54 (38/44), H2 36/42, H3 24/30, Lead 20/32, Body 16/26, never below 16 px. RTL headings are ~15 % smaller with line-height ≥ 1.5; RTL body line-height 1.85.

**Graphic devices:** Caspian Horizon (1 px bronze rule, once per composition), Nadia Frame (one cut corner, mirrored in RTL), Proof Label (Inter Medium 12 px, +0.08 em; not uppercased in RTL).

**Layout:** 1200 px max width, 12/8/4 columns, 20 px mobile margin, 8-pt spacing, cards 8 px radius, pill-shaped buttons, 48 px targets.

**Buttons — liquid glass** (owner request, 23 Sep 2026; after the 21st.dev LiquidButton): every `.btn`, plus the header menu and language controls (`.glass`), gets a pill shape, an inset glass rim (dark rim on light surfaces, light rim on `.surface-dark`) and a displaced-backdrop layer via the SVG filter in `src/components/GlassFilter.tsx`, rendered once per document. Primary fills stay opaque so contrast is unchanged; the distortion is visible on transparent (secondary) buttons in Chromium only — other browsers show the rim alone.

**Motion:** colour transitions, plus a 1.05 hover scale on buttons; all transitions disabled under `prefers-reduced-motion`.

**Never mirrored in RTL:** logo lock-up, monogram, photos, phone numbers, emails, BRN/ORN, the Cal.com widget.

## 5. Consultation funnel

1. **Step 1 — About you:** name, email, contact channel, phone (required only for phone/WhatsApp, must start with `+country`), location (optional), consultation language.
2. **Step 2 — Goals:** interest, purpose, budget (AED purchase bands, or annual-rent bands for leasing, plus “discuss in consultation”), timeline, decision-makers (optional), notes ≤ 1,000 (optional, warns against sensitive data), referral (optional), consent (links to privacy notice).
3. **Server Action** → `submitLead()`: honeypot, ≥ 3 s fill time, Zod validation, rate limit (5 / 10 min per hashed IP), idempotency by submission UUID, Supabase insert (Sheets adapter kept as an alternative). Errors are never reported as success.
4. **Step 3 — Cal.com inline embed** (lazy-loaded) with name/email prefill and `metadata[leadId]`. On `bookingSuccessfulV2` → `/consultation/thank-you`. If the embed fails (event or 10 s timeout), a direct booking link and direct-contact options are shown.
5. **Webhook** `/api/webhooks/calcom` (HMAC-verified, idempotent) writes booking status, uid and times back to the lead row. Bookings without a lead id are recorded as `unqualified_booking`.

The form is JavaScript-first (a `<noscript>` message points to direct contact); all content pages work without JavaScript.

## 6. Architecture

Next.js 16.3 (App Router, Turbopack) · React 19.2 · TypeScript 5 strict · Tailwind CSS 4 · next-intl 4.14 (`localePrefix: "as-needed"`, `localeDetection: false`, no locale cookie) · Zod 4 · `@calcom/embed-react` 1.5 · Supabase PostgREST via `fetch` (no SDK) · `google-auth-library` + Sheets REST v4 (alternative) · `@upstash/ratelimit` · Vitest · Playwright + axe.

- Server Components by default; client components: navigation, language switcher, consultation form, Cal.com embed, card preview.
- Content pages are statically generated for all three locales.
- Company/compliance facts: `src/config/company.ts` (each field verified or pending, with source). Unverified fields never render in the launch stage.
- Integrations sit behind adapters: `LeadStore` (Supabase / Sheets / memory), `Guard` (Upstash / memory).
- Security headers and CSP in `next.config.ts`. The CSP allows `'unsafe-inline'` scripts because pages are static (nonces would force dynamic rendering); everything else is locked to self + Cal.com.

## 7. Performance budget and measurements

Measured 22 Sep 2026 with Lighthouse 12 (mobile, simulated slow 4G) against a local production build:

| Page | Performance | LCP | CLS | Accessibility |
|---|---|---|---|---|
| `/` | 95–98 | 2.3–3.0 s | 0 | 100 |
| `/fa` | 91–95 | 2.9–3.4 s | 0.02 | 100 |
| `/ar` | 90–94 | 2.9–3.4 s | 0.065 | 100 |
| `/consultation` | 93–99 | 2.1–3.2 s | 0 | 100 |
| `/about` | 98 | 2.3 s | 0 | 100 |

SEO scores 69 in preview only because preview pages are deliberately `noindex`.

Budget targets: LCP ≤ 2.5 s, CLS ≤ 0.05, INP ≤ 200 ms. The original “initial JS ≤ 120 KB gz” target is not reachable with the framework baseline: content pages ship ≈ 200 KB gz, of which React DOM + the Next.js runtime are ≈ 160 KB. The Cal.com embed and Zod load only on the consultation route.

Known gaps and next steps:
- Persian/Arabic pages: Vazirmatn is not preloaded, to avoid penalising English pages, which adds FCP time on `/fa` and `/ar`. Next step: self-host the Vazirmatn subset and preload it only for fa/ar.
- Real-user Web Vitals appear once Vercel Analytics is enabled.

## 8. SEO

Localised title/description, canonical and hreflang (en, fa, ar, x-default → English) on every page; localised sitemap with alternates; `robots.txt` blocks everything in preview. JSON-LD: RealEstateAgent (founding date from the DET licence), Person, WebSite, BreadcrumbList. No ratings or reviews. The social image is the brand monogram until approved imagery exists.
