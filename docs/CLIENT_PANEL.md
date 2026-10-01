# Website assistant and client panel

The floating **Caspian smart assistant** on every public page collects three things — name, one phone/WhatsApp number and the purpose of the enquiry — and records them in Supabase. Nadia follows up in the private **client panel** at `/fa/admin` (also `/admin`, `/ar/admin`). Product spec: [`specs/CHATBOT_CRM_MVP.md`](specs/CHATBOT_CRM_MVP.md).

## How it fits together

```
Visitor ─ chat (src/components/chat) ─ server action ─ crm_submit_request()  ──┐ one transaction:
                                                                              │ case + request + history
Consultation form ─ leads table ─ after() ─ crm_submit_request()  ────────────┘ + outbox jobs
Supabase Cron (every minute) ─ crm_tick() ─ queues due reminders ─ calls /api/crm/worker when work is due
/api/crm/worker ─ crm_claim_outbox() ─ email (Resend) / Telegram ─ crm_complete_outbox()
Nadia ─ magic-link sign-in ─ /[locale]/admin (RLS: only users in crm_admins)
```

- **Database:** `supabase/migrations/20261002000000_create_crm.sql` and `…000100_crm_worker_nonce.sql`. Tables `crm_clients` (one case per person, unique phone), `crm_requests` (every enquiry, never overwritten), `crm_activities` (notes + automatic history), `crm_follow_ups`, `crm_outbox`, `crm_admins`, `crm_worker_state`.
- **Duplicates:** each chat submission carries an idempotency key; a retry or double click returns the original request and creates no new notification. A returning visitor (same number) gets a new request on the existing case; the stored name, earlier requests and Nadia's notes are untouched, and the visitor is never told the number was known.
- **Notifications:** queued in `crm_outbox` in the same transaction as the request. The worker retries failures after 2, 4, 8, 16 and 32 minutes, then marks them failed; the panel shows each job's state. “Sent” means the provider accepted the message, not that it reached the inbox. A channel that is not configured keeps its jobs queued (“waiting for setup”) and sends them once it is.
- **Reminders:** follow-ups are stored in UTC and entered/shown in Dubai time. `crm_tick()` (pg_cron, every minute) queues a reminder when one is due — tested at 0 s after the due time. Rescheduling bumps the follow-up's version; completing, cancelling or closing the case cancels queued reminders; the worker re-checks each reminder immediately before sending.
- **Worker security:** `crm_tick()` stores a random single-use token (valid 2 minutes) and sends it as the Bearer credential; `/api/crm/worker` accepts the call only after `crm_worker_auth()` consumes that token. No static shared secret exists. The worker URL is `crm_worker_state.worker_url` (set it to `https://<production host>/api/crm/worker`; `null` pauses calls, reminders still queue).
- **Access:** RLS on every table. Anonymous: nothing. Signed-in users: rows only if their `auth.uid()` is in `crm_admins`. Public submission and the worker use service-role-only functions. The panel's session cookies are HttpOnly; every panel action re-checks the session and allow-list on the server.
- **Assistant answers:** with `OPENAI_API_KEY`, the OpenAI Responses API (`OPENAI_MODEL`, default `gpt-5-mini`) answers general questions from the site's own copy (`src/lib/assistant/knowledge.ts`), with no tools and phone numbers removed. Price/availability/payment-plan/project questions are always referred to Nadia without calling the model. Without a key, or if the call fails, keyword rules answer from the same copy and the buttons keep working.

## Setup checklist

1. **Supabase Auth → URL Configuration** (dashboard only):
   - Site URL: the production address, e.g. `https://caspian-properties-web.vercel.app`.
   - Redirect URLs: add `https://caspian-properties-web.vercel.app/api/auth/callback**` (and the custom domain later).
   Without this, sign-in links fall back to the Site URL and fail.
2. **Admin account:** Nadia's Auth user exists and is listed in `crm_admins`. To add another admin later: create the user in Auth, then `insert into crm_admins (user_id) values ('<uuid>');`.
3. **Vercel env (Production and Preview):** `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `LEAD_STORE=supabase`, `ADMIN_LOCALE=fa`; optional `OPENAI_API_KEY`/`OPENAI_MODEL`, `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`, `RESEND_API_KEY`/`LEAD_NOTIFY_EMAIL_TO`/`LEAD_NOTIFY_EMAIL_FROM` (see INTEGRATIONS.md §2c).
4. **Worker URL:** `update crm_worker_state set worker_url = 'https://<production host>/api/crm/worker';`
5. **Supabase free plan:** the worker is called at least hourly, which keeps the project active; if the project is ever paused, restore it in the dashboard — queued jobs are kept and sent afterwards.

## Using the panel (for Nadia)

- **Sign in:** open `/fa/admin`, enter your email, open the link from the email on the same device.
- **Overview:** counts by status, overdue / later-today / upcoming follow-ups, latest requests with their notification state.
- **Clients:** search by name or number; filter by status, request type and follow-up.
- **Case page:** call / WhatsApp buttons; change status (with a short reason when completing or closing; “Reopen case” brings it back); add notes (type, what was discussed, outcome, next action, time); edit a single note; set, change, complete or cancel follow-ups; see every request and the full history.
- All times are Dubai time.
