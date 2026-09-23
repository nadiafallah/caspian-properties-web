# Integrations

Every service uses a free plan. None of them is live until you complete the steps below and run the verification check at the end of each section.

| Service | Purpose | Status |
|---|---|---|
| Cal.com (free) | Availability, booking, invitations, reschedule/cancel | **Not configured** — needs your event link |
| Google Calendar | Nadia’s real availability, connected *inside Cal.com* | **Not configured** |
| Supabase (free) | Lead register (`leads` table) | **Table created**; needs `SUPABASE_URL` + `SUPABASE_SECRET_KEY` on Vercel — dev uses an in-memory store |
| Google Sheets | Alternative lead register (`LEAD_STORE=sheets`) | Not used |
| Upstash Redis (free) | Durable rate limiting and duplicate protection | **Not configured** — falls back to non-durable memory |
| Vercel (Hobby) | Hosting | **Live** — production at https://caspian-properties-web.vercel.app, deployed from GitHub `main` |
| Vercel Web Analytics | Cookieless page-view statistics | Off (`NEXT_PUBLIC_ENABLE_ANALYTICS=false`) |

Secrets go only in `.env.local` (your computer) or Vercel → Project → Settings → Environment Variables. Never paste them into chat, email or code.

---

## 1. Cal.com + Google Calendar

The website never touches Google Calendar directly. Cal.com owns availability, time zones, conflicts, invitations, rescheduling and cancellation.

1. Create a free account at cal.com. Use Nadia’s professional Google account for sign-in if you like; the password stays with Google.
2. **Settings → Calendars → Connect Google Calendar.** Approve Google’s consent screen yourself. The website never sees these credentials.
   - Check the calendars used for conflict checking.
   - Choose the calendar where bookings are added.
3. **Availability:** set working hours in **Asia/Dubai** time, plus any holidays.
4. **Event Types → New:** “Private consultation”.
   - Duration: e.g. 45 min, plus a buffer before and after.
   - Minimum notice: e.g. 12 h. Limit future bookings, e.g. 30 days.
   - Locations: Google Meet, phone, and/or in-person office. Visitors choose here, which is why the website form doesn’t ask.
   - **Advanced → Hidden** (not listed on your public Cal.com profile).
   - **Advanced → Redirect on booking:** `https://caspian-properties.com/consultation/thank-you`. This covers visitors who use the fallback booking link.
   - Keep Cal.com’s own booking questions to name and email. The website has already collected the rest.
5. Copy the event link (e.g. `nadia-fallah/private-consultation`) into `NEXT_PUBLIC_CALCOM_LINK`.
6. **Webhook** (keeps the lead register in sync): Settings → Developer → Webhooks → New.
   - Subscriber URL: `https://<your-domain>/api/webhooks/calcom`
   - Events: Booking created, Booking rescheduled, Booking cancelled.
   - Secret: generate a long random string (e.g. `openssl rand -hex 32`). Put the same value in `CALCOM_WEBHOOK_SECRET`.

**How the pieces connect:**
- The embed passes `metadata[leadId]` with each booking.
- The webhook uses the lead id to find the lead’s row and fill in `booking_status`, `cal_booking_uid`, `booking_start_utc`, `booking_end_utc` and `meeting_format`.
- Signatures are verified: HMAC-SHA256 of the raw body, header `x-cal-signature-256`.
- Deliveries are de-duplicated, and failed deliveries return 500 so Cal.com retries.

**Verify with a test booking:**
1. Make a booking on the preview through the whole form.
2. Confirm the event appears in Google Calendar and the invitation arrives.
3. Confirm the Sheet row changes to `booked`.
4. Reschedule: the row should change to `rescheduled`. Cancel: it should change to `cancelled`.
5. Also confirm the webhook payload’s `metadata` contains `leadId`. It does in current Cal.com; if it ever doesn’t, rows will show as `unqualified_booking`.

**Known limitations:**
- **The booking link is public**, so someone could book without filling in the form. Keeping the event hidden reduces this, and such bookings are logged as `unqualified_booking` so Nadia can see them.
- **Language and RTL:** the Cal.com widget is Cal.com’s own UI. It may appear in English on the Persian and Arabic pages, and it is not mirrored. The site says so beside the calendar.

## 2. Supabase lead register

Project `nadiafallah's Project` (ref `mdblpfwjzliilkrqtkwc`, region ap-south-1). The table is created by [`supabase/migrations/20260923000000_create_leads.sql`](../supabase/migrations/20260923000000_create_leads.sql); its columns match the Sheets header below.

1. Supabase Dashboard → **Project Settings → API Keys** → copy the **secret** key (`sb_secret_…`). Never paste it into chat or code.
2. Set the environment variables (Vercel: mark `SUPABASE_SECRET_KEY` as Sensitive):
   - `SUPABASE_URL=https://mdblpfwjzliilkrqtkwc.supabase.co`
   - `SUPABASE_SECRET_KEY` — the secret key.
   - `LEAD_STORE=supabase`
3. Redeploy.

**Security:** row level security is on with **no policies**, and `anon`/`authenticated` have no grants, so the public key can neither read nor write leads. Only the server, with the secret key, can. View leads in Dashboard → Table Editor → `leads`.

**Behaviour:** a retried submission with the same `lead_id` is ignored (no duplicates). Error logs contain only the Postgres code and message, never row data. If Supabase is not configured or unreachable, the visitor sees “We couldn’t save your details” — never false success.

**Free-plan note:** free projects pause after about a week without activity. A paused project makes the form fail; restore it from the dashboard.

**Verify:** submit the form on a preview, and a row appears in `leads` with `booking_status = submitted`.

## 2b. Google Sheets lead register (alternative)

Only if you set `LEAD_STORE=sheets` instead of Supabase.


1. Create a Google Sheet named e.g. “CPN Leads”. Rename the first tab to `Leads`.
2. Paste this exact header row into row 1 (one value per column, A → AD):

   ```
   lead_id	created_at_utc	locale	full_name	email	phone	location	preferred_language	preferred_contact	interest	purpose	budget_range	timeline	decision_makers	meeting_format	notes	referral_source	source_page	utm_source	utm_medium	utm_campaign	utm_content	utm_term	consent_version	consent_at_utc	booking_status	cal_booking_uid	booking_start_utc	booking_end_utc	updated_at_utc
   ```
3. Google Cloud Console (console.cloud.google.com):
   1. Create a project, e.g. `caspian-website`.
   2. **APIs & Services → Enable APIs → Google Sheets API.**
   3. **IAM & Admin → Service Accounts → Create**, e.g. `website-leads`. Grant **no** project roles.
   4. Open the account → **Keys → Add key → JSON**. The file downloads once; keep it private and never commit it.
4. **Share** the Sheet with the service account’s email (…@…iam.gserviceaccount.com) as **Editor**. Nobody else needs access.
5. Set the environment variables:
   - `GOOGLE_SHEETS_SPREADSHEET_ID` — the long id in the Sheet URL between `/d/` and `/edit`.
   - `GOOGLE_SHEETS_SHEET_NAME=Leads`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` — `client_email` from the JSON file.
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — `private_key` from the JSON file, including the BEGIN/END lines. On Vercel, paste it as-is; `\n` sequences are converted automatically.
   - `LEAD_STORE=sheets`
6. **Notifications:** in the Sheet, Tools → Notification settings → “Any changes are made” → email right away. Cal.com also emails Nadia every booking.
7. Use a **separate Sheet** for Preview deployments, so test leads never mix with real ones.

**Behaviour:**
- Values are written with `valueInputOption=RAW`, so nothing is interpreted as a formula. Free text starting with `= + - @` is prefixed with `'` so it stays text after export.
- If Sheets is not configured or unreachable, the visitor sees “We couldn’t save your details”, with retry and direct-contact options. The form never reports false success. The in-memory store is refused in production.

**Verify:** submit the form on a preview, and a row appears within seconds with `booking_status = submitted`.

## 3. Upstash Redis (rate limiting and duplicate protection)

1. Vercel → Project → **Storage / Marketplace → Upstash for Redis → Free plan** → connect to the project. It injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`; the site reads both those names and `UPSTASH_REDIS_REST_*`.
2. Redeploy.

**Limits:**
- 5 submissions per 10 minutes per client. IPs are stored only as a one-way hash and expire automatically.
- The same submission is recorded only once within 24 h.

**Failure behaviour:** if Redis is unreachable, the form still accepts the enquiry (fail-open) — losing a real client is worse than one extra request.

**Verify:** the production log should no longer show `Upstash Redis not configured`.

## 4. Vercel Web Analytics (optional)

1. Vercel → Project → Analytics → Enable Web Analytics (Hobby includes a limited free quota; check current limits in the dashboard).
2. Set `NEXT_PUBLIC_ENABLE_ANALYTICS=true` and redeploy.

It is cookieless and already described in the privacy notice. Funnel conversion (form → booking) comes from the `booking_status` column in Supabase.

## 5. Environment variables

See [`.env.example`](../.env.example) for every name with an explanation. Summary:

| Name | Secret? | Needed for |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | no | canonical URLs, sitemap |
| `NEXT_PUBLIC_SITE_STAGE` | no | `preview` / `launch` |
| `NEXT_PUBLIC_ALLOW_INDEXING` | no | `false` keeps search engines out of a launch-stage site |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | no | analytics |
| `NEXT_PUBLIC_CALCOM_LINK`, `_NAMESPACE`, `_ORIGIN` | no | scheduling |
| `CALCOM_WEBHOOK_SECRET` | **yes** | booking sync |
| `LEAD_STORE` | no | `supabase` in production |
| `SUPABASE_URL` | no | lead register |
| `SUPABASE_SECRET_KEY` | **yes** | lead register |
| `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SHEETS_SHEET_NAME` | no* | lead register (Sheets alternative) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | **yes** | lead register (Sheets alternative) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | **yes** | rate limiting |

\*Not secret, but keep them private.

`NEXT_PUBLIC_*` values are baked into the build: change them, then redeploy.
