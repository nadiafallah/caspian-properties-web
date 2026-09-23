-- Lead register for the consultation form and Cal.com webhook.
-- Columns mirror SHEET_COLUMNS in src/lib/leads/record.ts.
-- Only the server writes here, with the secret key (which bypasses RLS).
-- RLS is on with no policies, so the public (anon) key can read or write nothing.

create table public.leads (
  lead_id            text primary key,
  created_at_utc     timestamptz not null default now(),
  locale             text not null default '',
  full_name          text not null default '',
  email              text not null default '',
  phone              text not null default '',
  location           text not null default '',
  preferred_language text not null default '',
  preferred_contact  text not null default '',
  interest           text not null default '',
  purpose            text not null default '',
  budget_range       text not null default '',
  timeline           text not null default '',
  decision_makers    text not null default '',
  meeting_format     text not null default '',
  notes              text not null default '',
  referral_source    text not null default '',
  source_page        text not null default '',
  utm_source         text not null default '',
  utm_medium         text not null default '',
  utm_campaign       text not null default '',
  utm_content        text not null default '',
  utm_term           text not null default '',
  consent_version    text not null default '',
  consent_at_utc     timestamptz,
  booking_status     text not null default 'submitted'
    check (booking_status in ('submitted', 'booked', 'rescheduled', 'cancelled', 'unqualified_booking')),
  cal_booking_uid    text not null default '',
  booking_start_utc  timestamptz,
  booking_end_utc    timestamptz,
  updated_at_utc     timestamptz not null default now()
);

comment on table public.leads is 'Consultation leads (server-only; personal data).';

create index leads_cal_booking_uid_idx on public.leads (cal_booking_uid) where cal_booking_uid <> '';
create index leads_created_at_idx on public.leads (created_at_utc desc);

alter table public.leads enable row level security;
revoke all on table public.leads from anon, authenticated;
