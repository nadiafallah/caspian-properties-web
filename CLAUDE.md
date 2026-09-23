# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev                 # dev server on :3000 (/fa and /ar for Persian/Arabic)
npm run check               # typecheck (next typegen + tsc) + eslint + vitest + i18n key check
npm run test:e2e            # Playwright: builds prod and serves on :3100 (desktop + Pixel 7 projects)
npm run check:content       # after a build: scans .next HTML for placeholders/[VERIFY] markers
```

- Single unit test: `npx vitest run tests/unit/submit.test.ts` (or `-t "name"`).
- Single e2e test: `npx playwright test tests/e2e/consultation.spec.ts --project=desktop`. First run needs `npx playwright install chromium`. Playwright reuses an already-running server on :3100 outside CI — stop it if you changed code.
- Launch gate: `NEXT_PUBLIC_SITE_STAGE=launch npm run build && NEXT_PUBLIC_SITE_STAGE=launch npm run check:content` (fails on anything left to fill in).
- Node 24.x. Next.js 16 + next-intl 4 + Tailwind 4 + zod 4 — check `node_modules/next/dist/docs/` before using Next APIs (e.g. middleware is `src/proxy.ts`, `next/root-params`, `experimental.globalNotFound`).

## Architecture

**Routing / i18n.** All pages live under `src/app/[locale]/`. `src/proxy.ts` runs next-intl middleware (excludes `/api`, `_next`, files). `localePrefix: "as-needed"` — English has no prefix, fa/ar do. Use `Link`/`redirect`/`useRouter` from `src/i18n/navigation.ts`, not `next/link`. Locale metadata (dir, Intl tag with Gregorian calendar, OG locale) is in `src/i18n/locales.ts`; `resolveLocale()` in `src/i18n/server.ts` validates the route param. hreflang alternates come from `src/lib/seo.ts`, not the middleware. Pages are statically rendered (`generateStaticParams` in the locale layout) — avoid anything that forces dynamic rendering (this is also why the CSP in `next.config.ts` is not nonce-based).

**Site stage.** `src/config/site.ts` derives `isLaunch` from `NEXT_PUBLIC_SITE_STAGE` (`preview` | `launch`) and `allowIndexing` from `NEXT_PUBLIC_ALLOW_INDEXING`. In preview, `pending` fields from `src/config/company.ts` and the markers in `src/components/placeholders.tsx` render visibly; in launch they are hidden. Always read company fields through `displayValue(field, isLaunch)`.

**Curated content.** `src/content/index.ts` holds opportunities/insights (intentionally empty) validated by `src/content/schema.ts` at build time — an invalid entry fails the build. Process: `docs/CONTENT_INVENTORY.md` §5.

**Consultation → lead → booking flow.**
1. `ConsultationFlow` (two-step form) calls the server action `src/app/[locale]/consultation/actions.ts`.
2. The action wires deps into `submitLead()` (`src/lib/leads/submit.ts`) — a pure, dependency-injected function (honeypot, zod schema, min fill time, rate limit, duplicate claim). Unit tests exercise it with fakes; keep it free of direct env/IO access.
3. `getLeadStore()` (`src/lib/leads/store.ts`) returns the Supabase store (`LEAD_STORE=supabase`, production default; `leads` table, RLS on with no policies, written with the server-only secret key), the Google Sheets store (`LEAD_STORE=sheets`), the memory store (dev/e2e only; refused in production unless `ALLOW_MEMORY_STORE=true`), or `null` — callers must report failure, never fake success.
4. The visitor then books via the Cal.com embed (`CalScheduler`), passing `metadata[leadId]`.
5. `src/app/api/webhooks/calcom/route.ts` verifies the HMAC signature, dedupes via the guard, and updates the lead row by leadId / previous booking uid; unmatched bookings are appended as `unqualified_booking`.

`src/lib/security/guard.ts` provides rate limiting + idempotency claims via Upstash Redis, falling back to non-durable in-memory. Logs must contain only lead ids/outcomes, never personal data; client keys are hashed IPs.

**Tests.** Unit tests (`tests/unit`) run in plain Node; `server-only` is aliased to a stub in `vitest.config.mts`. E2E runs against a production build with the memory store and a stubbed Cal.com embed (`tests/e2e/cal-embed-stub.js`) and includes axe accessibility checks.

## Deployment

Public GitHub repo, connected to Vercel: **every push to `main` deploys to production.** Use a branch for a preview. Env vars are documented in `.env.example`; integration setup in `docs/INTEGRATIONS.md`; launch steps in `docs/LAUNCH_CHECKLIST.md`. Owner-only documents go in the git-ignored `private/` folder.
