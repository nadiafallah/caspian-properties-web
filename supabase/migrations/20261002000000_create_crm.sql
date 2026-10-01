-- Client CRM for the website assistant and the consultation form.
--
-- Tables: crm_clients (one case per person), crm_requests (every enquiry, never
-- overwritten), crm_activities (notes + automatic history), crm_follow_ups,
-- crm_outbox (durable notification queue), crm_admins (allow-list of panel users).
--
-- Access model
-- * The public site never touches these tables directly. It calls
--   crm_submit_request() with the server-only secret key (service_role).
-- * The admin panel uses the signed-in user's session. RLS lets a user in only if
--   their auth.uid() is listed in crm_admins — being "authenticated" is not enough,
--   and nothing is derived from user-editable metadata.
-- * anon gets nothing. The outbox worker runs with the secret key.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ── Admin allow-list ────────────────────────────────────────────────────

create table public.crm_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create function public.crm_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.crm_admins where user_id = (select auth.uid()));
$$;

-- ── Core tables ─────────────────────────────────────────────────────────

create table public.crm_clients (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null check (char_length(full_name) between 1 and 120),
  phone_e164       text unique check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  email            text check (char_length(email) <= 254),
  status           text not null default 'new'
    check (status in ('new', 'in_progress', 'awaiting_reply', 'won', 'closed')),
  close_reason     text check (char_length(close_reason) <= 300),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  constraint crm_clients_has_contact check (phone_e164 is not null or email is not null)
);
create index crm_clients_email_idx on public.crm_clients (lower(email)) where email is not null;
create index crm_clients_status_idx on public.crm_clients (status, last_activity_at desc);

create table public.crm_requests (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.crm_clients (id) on delete cascade,
  -- buy = purchase, ready/off-plan not decided; rental = rent or let, not decided.
  intent          text not null
    check (intent in ('buy_ready', 'buy_off_plan', 'buy', 'sell', 'rent', 'let', 'rental', 'other')),
  purpose_text    text check (char_length(purpose_text) <= 1000),
  submitted_name  text not null check (char_length(submitted_name) between 1 and 120),
  locale          text not null check (locale in ('en', 'fa', 'ar')),
  source          text not null check (source in ('chatbot', 'consultation_form')),
  consent_at      timestamptz not null default now(),
  idempotency_key uuid not null unique,
  lead_id         text references public.leads (lead_id) on delete set null,
  client_hash     text,
  created_at      timestamptz not null default now()
);
create index crm_requests_client_idx on public.crm_requests (client_id, created_at desc);
create index crm_requests_intent_idx on public.crm_requests (intent);
create index crm_requests_client_hash_idx on public.crm_requests (client_hash, created_at) where client_hash is not null;

create table public.crm_activities (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.crm_clients (id) on delete cascade,
  kind        text not null check (kind in (
    'note', 'call', 'message', 'meeting',
    'request', 'status_change', 'details_changed',
    'follow_up_set', 'follow_up_changed', 'follow_up_done', 'follow_up_cancelled')),
  body        text check (char_length(body) <= 4000),
  outcome     text check (char_length(outcome) <= 1000),
  next_action text check (char_length(next_action) <= 1000),
  occurred_at timestamptz not null default now(),
  meta        jsonb not null default '{}'::jsonb,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index crm_activities_client_idx on public.crm_activities (client_id, occurred_at desc);

create table public.crm_follow_ups (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.crm_clients (id) on delete cascade,
  due_at       timestamptz not null,
  note         text check (char_length(note) <= 1000),
  status       text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  -- Bumped whenever an open follow-up is rescheduled, so stale reminders are never sent.
  version      integer not null default 1,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index crm_follow_ups_open_due_idx on public.crm_follow_ups (due_at) where status = 'open';
create index crm_follow_ups_client_idx on public.crm_follow_ups (client_id);

create table public.crm_outbox (
  id                  bigint generated always as identity primary key,
  kind                text not null check (kind in ('new_request', 'follow_up_due')),
  channel             text not null check (channel in ('email', 'telegram')),
  -- One row per event and channel; also sent to the email provider as its idempotency key.
  dedupe_key          text not null unique,
  client_id           uuid not null references public.crm_clients (id) on delete cascade,
  request_id          uuid references public.crm_requests (id) on delete cascade,
  follow_up_id        uuid references public.crm_follow_ups (id) on delete cascade,
  follow_up_version   integer,
  status              text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts            integer not null default 0,
  next_attempt_at     timestamptz not null default now(),
  locked_until        timestamptz,
  last_error          text,
  provider_message_id text,
  sent_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index crm_outbox_due_idx on public.crm_outbox (next_attempt_at) where status in ('pending', 'processing');
create index crm_outbox_request_idx on public.crm_outbox (request_id);
create index crm_outbox_follow_up_idx on public.crm_outbox (follow_up_id);
create index crm_outbox_client_idx on public.crm_outbox (client_id);

-- Which notification channels the worker has configured, and when it last ran.
create table public.crm_worker_state (
  id          integer primary key default 1 check (id = 1),
  channels    text[] not null default '{}',
  last_run_at timestamptz
);
insert into public.crm_worker_state (id) values (1);

-- ── History triggers ────────────────────────────────────────────────────

create function public.crm_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger crm_clients_touch before update on public.crm_clients
  for each row execute function public.crm_touch_updated_at();
create trigger crm_activities_touch before update on public.crm_activities
  for each row execute function public.crm_touch_updated_at();
create trigger crm_follow_ups_touch before update on public.crm_follow_ups
  for each row execute function public.crm_touch_updated_at();
create trigger crm_outbox_touch before update on public.crm_outbox
  for each row execute function public.crm_touch_updated_at();

-- A reopened case loses its close reason (the old one stays in the history).
create function public.crm_clients_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status not in ('won', 'closed') then
    new.close_reason := null;
  end if;
  return new;
end;
$$;
create trigger crm_clients_before_update before update on public.crm_clients
  for each row execute function public.crm_clients_before_update();

create function public.crm_clients_after_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  changed text[] := '{}';
begin
  if old.status is distinct from new.status then
    insert into public.crm_activities (client_id, kind, body, meta)
    values (new.id, 'status_change', new.close_reason,
            jsonb_build_object('from', old.status, 'to', new.status));
    -- Closing a case (successfully or not) cancels its open follow-ups.
    if new.status in ('won', 'closed') then
      update public.crm_follow_ups set status = 'cancelled'
      where client_id = new.id and status = 'open';
    end if;
  end if;

  if old.full_name is distinct from new.full_name then changed := changed || 'full_name'; end if;
  if old.phone_e164 is distinct from new.phone_e164 then changed := changed || 'phone'; end if;
  if old.email is distinct from new.email then changed := changed || 'email'; end if;
  if cardinality(changed) > 0 then
    insert into public.crm_activities (client_id, kind, meta)
    values (new.id, 'details_changed', jsonb_build_object('fields', to_jsonb(changed)));
  end if;
  return null;
end;
$$;
create trigger crm_clients_after_update after update on public.crm_clients
  for each row execute function public.crm_clients_after_update();

-- Any new activity marks the case as recently active.
create function public.crm_activities_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.crm_clients set last_activity_at = greatest(last_activity_at, new.occurred_at)
  where id = new.client_id;
  return null;
end;
$$;
create trigger crm_activities_after_insert after insert on public.crm_activities
  for each row execute function public.crm_activities_after_insert();

create function public.crm_follow_ups_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.due_at is distinct from new.due_at and new.status = 'open' then
    new.version := old.version + 1;
  end if;
  if new.status = 'done' and old.status <> 'done' then
    new.completed_at := now();
  elsif new.status = 'open' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger crm_follow_ups_before_update before update on public.crm_follow_ups
  for each row execute function public.crm_follow_ups_before_update();

create function public.crm_follow_ups_after_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  kind text;
begin
  if tg_op = 'INSERT' then
    kind := 'follow_up_set';
  elsif old.status is distinct from new.status then
    kind := case new.status
      when 'done' then 'follow_up_done'
      when 'cancelled' then 'follow_up_cancelled'
      else 'follow_up_set' end;
  elsif old.due_at is distinct from new.due_at or old.note is distinct from new.note then
    kind := 'follow_up_changed';
  else
    return null;
  end if;

  insert into public.crm_activities (client_id, kind, body, meta)
  values (new.client_id, kind, new.note,
          jsonb_build_object('follow_up_id', new.id, 'due_at', new.due_at));

  -- Reminders that are no longer valid are cancelled before the worker sees them.
  if tg_op = 'UPDATE' then
    update public.crm_outbox set status = 'cancelled', locked_until = null
    where follow_up_id = new.id and status = 'pending'
      and (new.status <> 'open' or follow_up_version <> new.version);
  end if;
  return null;
end;
$$;
create trigger crm_follow_ups_after_change after insert or update on public.crm_follow_ups
  for each row execute function public.crm_follow_ups_after_change();

-- ── Public submission (service role only) ───────────────────────────────

-- Records one enquiry and its notifications in a single transaction.
-- Idempotent per p_idempotency_key: a retry returns the original request and
-- creates nothing new. A returning visitor (same phone, or same email when no
-- phone) gets the new request added to their existing case; their stored name,
-- earlier requests and Nadia's notes are never overwritten.
create function public.crm_submit_request(
  p_idempotency_key uuid,
  p_full_name       text,
  p_phone_e164      text,
  p_email           text,
  p_intent          text,
  p_purpose_text    text,
  p_locale          text,
  p_source          text,
  p_lead_id         text default null,
  p_client_hash     text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_client  uuid;
  v_status  text;
  v_request uuid;
begin
  select r.id, r.client_id into v_request, v_client
  from public.crm_requests r where r.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('request_id', v_request, 'client_id', v_client, 'created', false);
  end if;

  if p_client_hash is not null and (
    select count(*) from public.crm_requests r
    where r.client_hash = p_client_hash and r.created_at > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if p_phone_e164 is not null then
    insert into public.crm_clients (full_name, phone_e164, email)
    values (p_full_name, p_phone_e164, nullif(p_email, ''))
    on conflict (phone_e164) do nothing
    returning id into v_client;
    if v_client is null then
      select c.id, c.status into v_client, v_status from public.crm_clients c where c.phone_e164 = p_phone_e164;
    end if;
  else
    select c.id, c.status into v_client, v_status from public.crm_clients c
    where lower(c.email) = lower(p_email) order by c.created_at limit 1;
    if v_client is null then
      insert into public.crm_clients (full_name, email) values (p_full_name, p_email) returning id into v_client;
    end if;
  end if;

  begin
    insert into public.crm_requests
      (client_id, intent, purpose_text, submitted_name, locale, source, idempotency_key, lead_id, client_hash)
    values
      (v_client, p_intent, nullif(p_purpose_text, ''), p_full_name, p_locale, p_source, p_idempotency_key, p_lead_id, p_client_hash)
    returning id into v_request;
  exception when unique_violation then
    -- The same submission arrived twice at the same moment; the other one won.
    select r.id, r.client_id into v_request, v_client
    from public.crm_requests r where r.idempotency_key = p_idempotency_key;
    return jsonb_build_object('request_id', v_request, 'client_id', v_client, 'created', false);
  end;

  -- A new enquiry on a finished case puts it back in front of Nadia.
  if v_status in ('won', 'closed') then
    update public.crm_clients set status = 'new' where id = v_client;
  end if;

  insert into public.crm_activities (client_id, kind, body, meta)
  values (v_client, 'request', nullif(p_purpose_text, ''),
          jsonb_build_object('request_id', v_request, 'intent', p_intent, 'source', p_source));

  insert into public.crm_outbox (kind, channel, dedupe_key, client_id, request_id)
  select 'new_request', ch, 'new_request:' || v_request || ':' || ch, v_client, v_request
  from unnest(array['email', 'telegram']) as ch;

  return jsonb_build_object('request_id', v_request, 'client_id', v_client, 'created', true);
end;
$$;

-- ── Notification worker (service role only) ─────────────────────────────

-- Claims due notifications for the given channels. Concurrent workers never get the
-- same row (SKIP LOCKED); rows left "processing" by a crashed worker are reclaimed
-- after their lock expires. Reminders are re-checked here, immediately before
-- sending: a cancelled, completed or rescheduled follow-up is never sent.
create function public.crm_claim_outbox(p_channels text[], p_limit integer default 10)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r     public.crm_outbox;
  fu    public.crm_follow_ups;
  c     public.crm_clients;
  req   public.crm_requests;
  note  text;
  items jsonb := '[]'::jsonb;
  max_attempts constant integer := 6;
begin
  update public.crm_worker_state set channels = p_channels, last_run_at = now() where id = 1;

  for r in
    select * from public.crm_outbox o
    where o.channel = any(p_channels)
      and ((o.status = 'pending' and o.next_attempt_at <= now())
        or (o.status = 'processing' and o.locked_until < now()))
    order by o.next_attempt_at, o.id
    limit greatest(1, least(p_limit, 50))
    for update skip locked
  loop
    if r.attempts >= max_attempts then
      update public.crm_outbox set status = 'failed', locked_until = null where id = r.id;
      continue;
    end if;

    if r.kind = 'follow_up_due' then
      select * into fu from public.crm_follow_ups where id = r.follow_up_id;
      if not found or fu.status <> 'open' or fu.version <> r.follow_up_version or fu.due_at > now() then
        update public.crm_outbox set status = 'cancelled', locked_until = null where id = r.id;
        continue;
      end if;
    end if;

    update public.crm_outbox
    set status = 'processing', attempts = attempts + 1, locked_until = now() + interval '2 minutes'
    where id = r.id;

    select * into c from public.crm_clients where id = r.client_id;
    if r.request_id is not null then
      select * into req from public.crm_requests where id = r.request_id;
    else
      select * into req from public.crm_requests where client_id = r.client_id order by created_at desc limit 1;
    end if;
    select a.body into note from public.crm_activities a
    where a.client_id = r.client_id and a.kind in ('note', 'call', 'message', 'meeting') and a.body is not null
    order by a.occurred_at desc limit 1;

    items := items || jsonb_build_object(
      'id', r.id,
      'kind', r.kind,
      'channel', r.channel,
      'dedupe_key', r.dedupe_key,
      'client', jsonb_build_object('id', c.id, 'full_name', c.full_name, 'phone_e164', c.phone_e164, 'email', c.email),
      'request', case when req.id is null then null else jsonb_build_object(
        'intent', req.intent, 'purpose_text', req.purpose_text, 'created_at', req.created_at,
        'source', req.source, 'locale', req.locale) end,
      'follow_up', case when r.kind = 'follow_up_due' then jsonb_build_object('due_at', fu.due_at, 'note', fu.note) else null end,
      'latest_note', note
    );
  end loop;

  return items;
end;
$$;

-- Records the result of one send. Failures back off 2, 4, 8, 16, 32 minutes and
-- give up after the sixth attempt. "sent" means the provider accepted the message —
-- not that it reached the inbox.
create function public.crm_complete_outbox(p_id bigint, p_ok boolean, p_provider_id text default null, p_error text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.crm_outbox set
    status              = case when p_ok then 'sent' when attempts >= 6 then 'failed' else 'pending' end,
    sent_at             = case when p_ok then now() else null end,
    provider_message_id = case when p_ok then left(p_provider_id, 200) else provider_message_id end,
    last_error          = case when p_ok then null else left(p_error, 300) end,
    next_attempt_at     = case when p_ok then next_attempt_at
                               else now() + make_interval(mins => power(2, attempts)::integer) end,
    locked_until        = null
  where id = p_id and status = 'processing';
end;
$$;

-- Runs every minute (pg_cron): queues due follow-up reminders, then wakes the worker
-- when there is something to send — and at least hourly, which also keeps the
-- worker's channel list current. The worker URL and secret live in Supabase Vault.
create function public.crm_tick() returns void
language plpgsql security definer set search_path = '' as $$
declare
  st     public.crm_worker_state;
  url    text;
  secret text;
begin
  insert into public.crm_outbox (kind, channel, dedupe_key, client_id, follow_up_id, follow_up_version)
  select 'follow_up_due', ch, 'follow_up_due:' || f.id || ':' || f.version || ':' || ch, f.client_id, f.id, f.version
  from public.crm_follow_ups f cross join unnest(array['email', 'telegram']) as ch
  where f.status = 'open' and f.due_at <= now()
  on conflict (dedupe_key) do nothing;

  select * into st from public.crm_worker_state where id = 1;
  if not (
    st.last_run_at is null
    or st.last_run_at < now() - interval '1 hour'
    or exists (
      select 1 from public.crm_outbox o
      where o.channel = any(st.channels)
        and ((o.status = 'pending' and o.next_attempt_at <= now())
          or (o.status = 'processing' and o.locked_until < now()))
    )
  ) then
    return;
  end if;

  select decrypted_secret into url from vault.decrypted_secrets where name = 'crm_worker_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'crm_worker_secret';
  if url is null or secret is null then
    return;
  end if;

  perform net.http_post(
    url := url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
end;
$$;

-- ── Privileges and RLS ──────────────────────────────────────────────────

alter table public.crm_admins enable row level security;
alter table public.crm_clients enable row level security;
alter table public.crm_requests enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_follow_ups enable row level security;
alter table public.crm_outbox enable row level security;
alter table public.crm_worker_state enable row level security;

revoke all on table
  public.crm_admins, public.crm_clients, public.crm_requests, public.crm_activities,
  public.crm_follow_ups, public.crm_outbox, public.crm_worker_state
from anon, authenticated;

-- Signed-in users get table privileges, but every row is filtered by crm_is_admin().
grant select, insert, update, delete on public.crm_clients, public.crm_activities, public.crm_follow_ups to authenticated;
grant select on public.crm_requests, public.crm_outbox to authenticated;

create policy crm_clients_admin on public.crm_clients for all to authenticated
  using ((select public.crm_is_admin())) with check ((select public.crm_is_admin()));
create policy crm_activities_admin on public.crm_activities for all to authenticated
  using ((select public.crm_is_admin())) with check ((select public.crm_is_admin()));
create policy crm_follow_ups_admin on public.crm_follow_ups for all to authenticated
  using ((select public.crm_is_admin())) with check ((select public.crm_is_admin()));
create policy crm_requests_admin_read on public.crm_requests for select to authenticated
  using ((select public.crm_is_admin()));
create policy crm_outbox_admin_read on public.crm_outbox for select to authenticated
  using ((select public.crm_is_admin()));

revoke all on function public.crm_is_admin() from public, anon;
grant execute on function public.crm_is_admin() to authenticated, service_role;

revoke all on function public.crm_submit_request(uuid, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.crm_claim_outbox(text[], integer) from public, anon, authenticated;
revoke all on function public.crm_complete_outbox(bigint, boolean, text, text) from public, anon, authenticated;
revoke all on function public.crm_tick() from public, anon, authenticated;
grant execute on function public.crm_submit_request(uuid, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.crm_claim_outbox(text[], integer) to service_role;
grant execute on function public.crm_complete_outbox(bigint, boolean, text, text) to service_role;

revoke all on function
  public.crm_touch_updated_at(), public.crm_clients_before_update(), public.crm_clients_after_update(),
  public.crm_activities_after_insert(), public.crm_follow_ups_before_update(), public.crm_follow_ups_after_change()
from public, anon, authenticated;

-- ── Schedules ───────────────────────────────────────────────────────────

select cron.schedule('crm-tick', '* * * * *', 'select public.crm_tick()');
-- Keep the scheduler's own run log small.
select cron.schedule('crm-cron-log-cleanup', '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '3 days'$$);

-- ── Existing consultation-form leads become CRM cases (no notifications) ──

do $$
declare
  l       public.leads;
  v_phone text;
  v_client uuid;
  v_request uuid;
  v_intent text;
begin
  for l in
    select * from public.leads
    where booking_status <> 'unqualified_booking'
      and lead_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and not exists (select 1 from public.crm_requests r where r.lead_id = leads.lead_id)
    order by created_at_utc
  loop
    v_phone := nullif(regexp_replace(l.phone, '[^0-9+]', '', 'g'), '');
    if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{6,14}$' then
      v_phone := null;
    end if;
    if v_phone is null and l.email = '' then
      continue;
    end if;

    v_client := null;
    if v_phone is not null then
      select id into v_client from public.crm_clients where phone_e164 = v_phone;
    else
      select id into v_client from public.crm_clients where lower(email) = lower(l.email) limit 1;
    end if;
    if v_client is null then
      insert into public.crm_clients (full_name, phone_e164, email, created_at, last_activity_at)
      values (coalesce(nullif(l.full_name, ''), '—'), v_phone, nullif(l.email, ''), l.created_at_utc, l.created_at_utc)
      returning id into v_client;
    end if;

    v_intent := case l.interest
      when 'off-plan' then 'buy_off_plan'
      when 'resale' then 'buy_ready'
      when 'leasing' then 'rental'
      else 'other' end;

    insert into public.crm_requests
      (client_id, intent, purpose_text, submitted_name, locale, source, consent_at, idempotency_key, lead_id, created_at)
    values (
      v_client, v_intent,
      left(concat_ws(' · ',
        nullif('Interest: ' || l.interest, 'Interest: '),
        nullif('Purpose: ' || l.purpose, 'Purpose: '),
        nullif('Budget: ' || l.budget_range, 'Budget: '),
        nullif('Timeline: ' || l.timeline, 'Timeline: '),
        nullif(l.notes, '')), 1000),
      coalesce(nullif(l.full_name, ''), '—'),
      case when l.locale in ('en', 'fa', 'ar') then l.locale else 'en' end,
      'consultation_form',
      coalesce(l.consent_at_utc, l.created_at_utc),
      l.lead_id::uuid, l.lead_id, l.created_at_utc)
    returning id into v_request;

    insert into public.crm_activities (client_id, kind, meta, occurred_at, created_at)
    values (v_client, 'request',
            jsonb_build_object('request_id', v_request, 'intent', v_intent, 'source', 'consultation_form'),
            l.created_at_utc, l.created_at_utc);
  end loop;
end;
$$;
