-- The scheduler authenticates to the notification worker with a single-use token:
-- crm_tick() stores a fresh random token (valid 2 minutes) and sends it as the
-- Bearer credential; the worker accepts a call only after crm_worker_auth() consumes
-- that exact token. No long-lived shared secret exists, and the public
-- (publishable) key cannot read or mint tokens.

alter table public.crm_worker_state
  add column worker_url text,
  add column nonce text,
  add column nonce_expires_at timestamptz;

create or replace function public.crm_tick() returns void
language plpgsql security definer set search_path = '' as $$
declare
  st    public.crm_worker_state;
  token text;
begin
  insert into public.crm_outbox (kind, channel, dedupe_key, client_id, follow_up_id, follow_up_version)
  select 'follow_up_due', ch, 'follow_up_due:' || f.id || ':' || f.version || ':' || ch, f.client_id, f.id, f.version
  from public.crm_follow_ups f cross join unnest(array['email', 'telegram']) as ch
  where f.status = 'open' and f.due_at <= now()
  on conflict (dedupe_key) do nothing;

  select * into st from public.crm_worker_state where id = 1;
  if st.worker_url is null then
    return;
  end if;
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

  token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update public.crm_worker_state
  set nonce = token, nonce_expires_at = now() + interval '2 minutes'
  where id = 1;

  perform net.http_post(
    url := st.worker_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || token),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
end;
$$;

-- Consumes the current token; true only for the exact, unexpired value.
create function public.crm_worker_auth(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  ok boolean;
begin
  if p_token is null or char_length(p_token) <> 64 then
    return false;
  end if;
  update public.crm_worker_state
  set nonce = null, nonce_expires_at = null
  where id = 1 and nonce = p_token and nonce_expires_at > now()
  returning true into ok;
  return coalesce(ok, false);
end;
$$;

revoke all on function public.crm_tick() from public, anon, authenticated;
revoke all on function public.crm_worker_auth(text) from public, anon, authenticated;
grant execute on function public.crm_worker_auth(text) to service_role;
