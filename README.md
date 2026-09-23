# Caspian Properties by Nadia — website

The advisory website for **caspian-properties.com**, in English (the entry language), فارسی and العربية.

It introduces Nadia and Caspian Properties (since 2007), explains how Nadia advises, and turns suitable visitors into private consultations. Visitors fill in a short two-step form, the details go to a Google Sheet, and then they choose a time in Nadia’s Cal.com calendar, which is connected to Google Calendar.

> **Current state:** live at **https://caspian-properties-web.vercel.app** (Vercel production, launch stage, hidden from search engines). It still needs real photos, the biography, public contact details and the service connections (Cal.com, Google Sheets, Upstash). Until Google Sheets is connected, the form honestly reports that it could not save. See [docs/CONTENT_INVENTORY.md](docs/CONTENT_INVENTORY.md) and [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md). The `caspian-properties.com` domain is not connected yet.

## What you need

- A Mac or PC with **Node.js 24** (or newer) — download from nodejs.org.
- Free accounts, when you are ready to connect them: Cal.com, Google Cloud (for Sheets), Vercel, Upstash.

## See the site on your computer

Open Terminal in this folder and run:

```bash
npm install          # first time only
npm run dev          # start the preview
```

Then open http://localhost:3000. Persian is at http://localhost:3000/fa and Arabic at http://localhost:3000/ar.

Without any setup, the form saves to a temporary in-memory store, and the scheduling step says scheduling is being set up. To try the real services locally, copy `.env.example` to `.env.local` and fill in the values ([docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)).

To preview the production version: `npm run build && npm run start`.

## Where things are

```
src/messages/en.json, fa.json, ar.json   ← all website text (edit wording here)
src/config/company.ts                    ← company, licence and contact details (one place for all languages)
src/config/site.ts                       ← site settings (consultation languages, Cal.com, dates)
src/content/                             ← curated opportunities and market insights (empty until verified)
src/app/[locale]/…                       ← the pages
src/components/                          ← building blocks (header, footer, sections, form)
public/brand, public/credentials         ← logo (temporary) and watermarked broker-card preview
docs/                                    ← blueprint, content inventory, integrations, launch checklist
tests/                                   ← automated checks
```

## Editing text and translations

1. Open the language file in `src/messages/` and change the text between the quotes. Keep the keys (left side) unchanged in all three files.
2. Keep `{placeholders}` and `<link>…</link>` tags exactly as they are.
3. Run `npm run check:i18n`. It confirms all three languages have the same keys.

Company facts (licence numbers, phone, email) are **not** in the language files. Edit them in `src/config/company.ts` and mark each one `verified("value", "where it came from")`. Unverified details are never shown on the launched site.

## Adding an opportunity or insight

Follow [docs/CONTENT_INVENTORY.md §5](docs/CONTENT_INVENTORY.md#5-adding-a-verified-opportunity-or-insight). Every figure needs a source and date, and every property needs its own Trakheesi permit. The build refuses incomplete entries.

## Checks and tests

```bash
npm run check          # type check + lint + unit tests + translation check
npm run test:e2e       # browser tests (first time: npx playwright install chromium)
npm run check:content  # after a build: lists placeholders / missing content (blocks a launch build)
```

The browser tests use a fake Cal.com and a temporary store. They never create real bookings or touch real client data.

## Connecting the services

Step-by-step instructions for Cal.com + Google Calendar, Google Sheets, Upstash and analytics are in [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md). Never paste passwords, keys or secrets into chat or code; put them in `.env.local` or in Vercel’s Environment Variables.

## Deploying

The code is in the private GitHub repository `nadiafallah/caspian-properties-web`, connected to the Vercel project `caspian-properties-web` (team “nadia”, Hobby plan).

- **Every push to `main` goes live on production automatically.** Push other branches to get a private preview link first.
- Production environment variables: Vercel → Project → Settings → Environment Variables. Production uses `NEXT_PUBLIC_SITE_STAGE=launch` and `NEXT_PUBLIC_ALLOW_INDEXING=false`; Preview keeps its own values. After changing a variable, redeploy (Deployments → ⋯ → Redeploy).
- Only the main address is public. Individual deployment links (`caspian-properties-…-nadia-ea59.vercel.app`) ask for a Vercel login (Deployment Protection, “Standard”), so share the main address.
- The `caspian-properties.com` domain: follow [docs/LAUNCH_CHECKLIST.md §E](docs/LAUNCH_CHECKLIST.md#e-hosting-and-domain), including keeping your email DNS records untouched.

**Rollback:** Vercel → Deployments → pick the previous one → *Promote to Production*.

## Checking the three languages

- `/`, `/fa`, `/ar` — Persian and Arabic read right-to-left. The logo, phone numbers and licence numbers stay left-to-right.
- The language menu keeps you on the same page, and form answers survive a switch.
- Visitors always arrive in English, whatever their browser language.

## Known limitations

- Photos, biography, logo files and public contact details are awaiting Nadia (placeholders are labelled in preview).
- The Cal.com booking widget may appear in English on Persian/Arabic pages and is not mirrored. That is Cal.com’s own interface.
- The Cal.com link is public, so someone could book without the form. Such bookings are flagged as `unqualified_booking` in the Sheet.
- The broker-card preview can’t be protected from screenshots (no website can do that); it is reduced in size and watermarked instead.
- Persian/Arabic pages load their font slightly later than English pages (see the performance notes in [docs/DESIGN_BLUEPRINT.md](docs/DESIGN_BLUEPRINT.md#7-performance-budget-and-measurements)).
- Privacy notice and terms describe the real setup but still need legal review.

## Documents

- [Design blueprint](docs/DESIGN_BLUEPRINT.md) — decisions, visual system, architecture, measurements
- [Content inventory](docs/CONTENT_INVENTORY.md) — verified facts, what’s missing, assets, translation review
- [Integrations](docs/INTEGRATIONS.md) — service setup and verification
- [Launch checklist](docs/LAUNCH_CHECKLIST.md) — pre-launch, domain, rollback
- Brand guide v2 (PDF) — kept on Nadia's computer in `private/brand/`; it is not committed, because this repository is public.
