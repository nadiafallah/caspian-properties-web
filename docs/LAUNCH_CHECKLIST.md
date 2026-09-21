# Launch checklist

Nothing is deployed to production, and no DNS is changed, without the owner’s explicit approval.

## A. Content and compliance (owner)

- [ ] Public phone, WhatsApp and email supplied and marked `verified` in `src/config/company.ts`
- [ ] Biography written (EN), Persian/Arabic reviewed
- [ ] Approved portrait(s) and real photography added (placeholders removed)
- [ ] Vector logo set received; temporary monogram, favicons and share image replaced
- [ ] Official Persian/Arabic tagline and brand-name treatment approved (brand guide §3.10)
- [ ] Native review of all Persian and Arabic copy
- [ ] Privacy notice and terms reviewed by a qualified adviser; privacy-request email set
- [ ] ORN 557 and BRN 70350 re-checked on the DLD verification service on launch day
- [ ] Holiday-home wording still matches the licence (purchase advice only)
- [ ] Decision on Arabic consultations recorded (`consultationLanguages`)

## B. Integrations (see INTEGRATIONS.md)

- [ ] Cal.com event hidden, Google Calendar connected, redirect set, webhook with secret created
- [ ] Production Google Sheet + service account; a separate Sheet for Preview
- [ ] Upstash Redis connected (log no longer warns about non-durable limiting)
- [ ] Test booking end to end on the **preview**: row created → booked → rescheduled → cancelled
- [ ] Cal.com fallback link tested (redirects to the thank-you page)
- [ ] Web Analytics enabled (optional) and `NEXT_PUBLIC_ENABLE_ANALYTICS=true`

## C. Automated checks

```bash
npm run check                 # typecheck, lint, unit tests, translation keys
npm run test:e2e              # Playwright: navigation, RTL, form, Cal.com stub, fallback, keyboard, axe
NEXT_PUBLIC_SITE_STAGE=launch npm run build
NEXT_PUBLIC_SITE_STAGE=launch npm run check:content   # must pass: no placeholders or markers
```

## D. Manual checks (all three languages)

- [ ] 320 px, 390 px, 768 px, 1280 px and 1600 px widths: no clipped headings, no horizontal scroll
- [ ] Browser zoom 200 %: content reflows, nothing overlaps
- [ ] Keyboard only: skip link, menu, language switcher, form, error summary, Cal.com step
- [ ] Screen reader spot check (VoiceOver): landmarks, headings, form errors announced, step changes announced
- [ ] `prefers-reduced-motion` on: no transitions
- [ ] Phone numbers, emails and BRN/ORN display left-to-right inside Persian/Arabic text
- [ ] Lighthouse mobile on `/`, `/fa`, `/ar`, `/consultation` (record results in DESIGN_BLUEPRINT §7)
- [ ] Share preview (WhatsApp/LinkedIn) shows title, description and image

## E. Hosting and domain

1. **Plan:** Vercel Hobby is for personal, non-commercial use. Before the public launch of a business site, choose a commercial option (e.g. Vercel Pro) — owner decision.
2. Vercel → Project → Settings → Environment Variables for **Production**:
   - `NEXT_PUBLIC_SITE_URL=https://caspian-properties.com`
   - `NEXT_PUBLIC_SITE_STAGE=launch`
   - `NEXT_PUBLIC_ALLOW_INDEXING=true` (it is `false` while the site runs on the temporary vercel.app address)
   - all integration variables
3. Deploy to production **after approval** of the tested preview.
4. **Domain** (Vercel → Settings → Domains → add `caspian-properties.com` and `www.caspian-properties.com`):
   - Before changing anything, export the current DNS records at the registrar, especially **MX/TXT records for email**. Only the web records change; email records must be left exactly as they are.
   - Add the A/CNAME records Vercel shows (typically apex `A 76.76.21.21`, `www CNAME cname.vercel-dns.com`; always use the values Vercel displays).
   - Choose one canonical host (recommended: apex). Vercel redirects the other.
   - HTTPS certificates are issued automatically.
5. After DNS propagates:
   - `https://caspian-properties.com/robots.txt` allows crawling and lists the sitemap.
   - `/sitemap.xml` shows 8 pages with alternates.
   - Submit the sitemap in Google Search Console.

## F. Rollback

- Vercel → Deployments → previous deployment → **Promote to Production** (instant).
- Content or config mistake: fix in git, redeploy. Leads are in Google Sheets and bookings in Cal.com, so rolling back the website never loses data.
- Emergency: set `NEXT_PUBLIC_ALLOW_INDEXING=false` (stop indexing) or `NEXT_PUBLIC_SITE_STAGE=preview` and redeploy.

## G. After launch — recurring

- Quarterly: re-check contact, registration and process details (brand guide §5.4).
- **Broker card and trade licence expire 8 May 2027.** When renewed, update `src/config/company.ts` and regenerate the card preview. `npm run check:content` warns 60 days before expiry.
- Review the lead Sheet’s `unqualified_booking` rows (bookings made without the form).
