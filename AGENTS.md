<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project notes

- Brand rules: `docs/brand/Caspian_Properties_by_Nadia_Brand_Guide_v2.pdf`; decisions: `docs/DESIGN_BLUEPRINT.md`.
- Never invent facts. Company/licence/contact data lives in `src/config/company.ts` with `verified`/`pending` + source.
- All UI text is in `src/messages/{en,fa,ar}.json` — keys must match (`npm run check:i18n`); keys must not contain dots.
- English is the entry language (`localeDetection: false`); fa/ar are RTL — use logical CSS properties.
- Before finishing: `npm run check` and `npm run test:e2e`.
