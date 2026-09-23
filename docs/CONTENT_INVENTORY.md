# Content inventory

Status of every public fact, asset and translation. **Nothing marked “needed” or “pending” may appear on the launched site.** `npm run check:content` enforces this for placeholders and markers.

Where facts live: `src/config/company.ts` (company, licence, contact), `src/messages/{en,fa,ar}.json` (all wording), `src/content/` (opportunities and insights).

## 1. Verified facts

| Fact | Value | Source |
|---|---|---|
| Legal name | Caspian Properties Brokers LLC / كاسبين للوساطة العقارية ذ.م.م | Dubai DET commercial licence 595102 (printed 24 Apr 2026) |
| Commercial licence | 595102, valid to 8 May 2027 | DET licence |
| Established | 9 May 2007 (backs “Since 2007”) | DET licence issue date |
| Licensed activities | Real estate buying & selling brokerage; leasing property brokerage agents | DET licence, RERA certificate, broker card |
| ORN | 557 | RERA office registration certificate; confirmed current by owner, 22 Sep 2026 |
| Nadia’s BRN | 70350, card valid to 8 May 2027 | DLD/RERA broker card (issued 30 May 2024) |
| Public name | Nadia Fallah (credentials) / Nadia (elsewhere) | Owner decision, 22 Sep 2026 |
| Role | Real Estate Advisor | Brand guide v2 |
| Consultation languages | English, Persian | Brand guide v2 |
| Instagram | @caspian_properties | Brand guide v2 |
| Brand strategy, method, values, voice, hero copy | — | Brand guide v2 (§1, §3, §4.1) |

**Compliance note from the licence:** the DET licence remarks prohibit leasing others’ properties and re-letting them. The holiday-home service is therefore written as *purchase advice only*; letting and operation “sit with separately licensed providers”. Keep it that way unless the licence changes.

**Not published** (personal/commercial data on the licence): partners, shares, nationalities, person numbers, capital, receipts. The PRO-service email on the licence is not the company’s public email.

## 2. Content Nadia needs to supply

| Item | Where it goes | Blocks launch? |
|---|---|---|
| Public phone number (E.164, e.g. +9715…) | `company.phone` | Recommended |
| Public WhatsApp number | `company.whatsapp` | Recommended |
| Public enquiry email | `company.email` | Recommended |
| Email for privacy requests | `company.privacyEmail` | Recommended (privacy notice currently points to the contact page) |
| Office address confirmation (building name) | `company.address` | No (hidden until verified) |
| Response-time commitment (“within one business day”?) | `company.responseTime` | No (hidden until verified) |
| Biography (English; Persian/Arabic reviewed) | `/about` | **Yes** (marker on the page) |
| Professional portrait(s) with usage rights | hero, `/about`, meet Nadia | **Yes** (placeholders) |
| Real Dubai / community / consultation photography | hero | **Yes** (placeholder) |
| Vector logo set (primary signature, monogram, favicon) | header, footer, icons | Strongly recommended |
| Official Persian and Arabic tagline and name treatment | messages | Recommended (see §4) |
| Cal.com event link | `NEXT_PUBLIC_CALCOM_LINK` | **Yes** (without it the form says scheduling is being set up) |
| Legal review of privacy notice and terms | `/privacy`, `/terms` | Strongly recommended |
| Decision on Arabic-language consultations | `consultationLanguages` | No |

Update the matching field to `verified("…", "source")` in `src/config/company.ts`, then rebuild.

## 3. Assets

| Asset | Status | Notes |
|---|---|---|
| Monogram plate (`public/brand/monogram-plate.png`, favicons) | **Temporary** | Extracted from the brand guide cover (raster). The guide forbids low-resolution artwork as final — replace with the vector set. |
| Header/footer lock-up | **Temporary** | Monogram + live-text “NADIA / Caspian Properties · Since 2007”, modelled on the guide cover. Replace with the approved primary signature. |
| Social share image (`src/app/[locale]/opengraph-image.png`) | **Temporary** | Charcoal card with monogram and tagline. Replace with a designed 1200×630 image. |
| Broker card preview (`public/credentials/rera-card-preview.webp`) | Approved use | 720 px, watermark baked in, `noindex`. Regenerate when the card is renewed (`scripts/make-credential-preview.mjs`). Original PDF is never committed. |
| Photography | **Missing** | Tonal placeholders only (labelled in preview). |
| Brand guide PDF | Reference | owner's local `private/brand/` (not in the public repository) |

**Photography brief** (guide §2.10):

| Slot | Ratio | Minimum size | Content |
|---|---|---|---|
| Home hero | 4:5 desktop, 4:3 mobile | 1600 × 2000 | A real Dubai community or advisory setting in warm natural light, no Burj cliché |
| Hero portrait card | 4:5 | 800 × 1000 | Nadia, mid-torso, tailored neutral wardrobe, natural retouch |
| Meet Nadia / About | 4:5 | 1200 × 1500 | Nadia in a real advisory context |

Never use AI imagery as real property, generic handshake stock, or client images without written consent.

## 4. Translations needing native review

All Persian and Arabic copy was written as natural localisation, not word-for-word. Before launch, a native reviewer should approve:

- **Tagline** (brand guide §3.10 requires one approved rendering): fa «ریشه در میراث. به رهبری نادیا.» · ar «جذورٌ في الإرث. بقيادة نادية.»
- **Brand name in running text**: fa «کاسپین پراپرتیز» · ar «كاسبيان للعقارات». The legal name stays in Latin.
- **Hero** (fa/ar), service names, legal pages.
- Arabic uses the feminine forms for Nadia (مستشارة، الوسيطة), following the brand guide’s “she”.
- Persian digits appear in running text; Arabic uses Western digits (UAE convention); legal identifiers are always Western.

## 5. Adding a verified opportunity or insight

1. Gather the facts with **source, date and claim type** (asking / registered / forecast / illustrative / developer-provided). For an opportunity, you also need its **own Trakheesi permit**, plus the Madmoun QR where issued.
2. Add the item to the array in `src/content/index.ts`. It must match the schema in `src/content/schema.ts`, and titles are required in all three languages.
3. Run `npm run build`. An item with a missing field fails the build rather than being published.
4. Once the first item exists, the page becomes indexable and joins the sitemap automatically. Add it to the navigation (`src/components/layout/nav-items.ts`) when there are enough items to be useful.
5. Never reuse a permit or QR code from another property. Label renders as renders.
