-- ===========================================================================
-- gridscore — lock reminders
-- ---------------------------------------------------------------------------
-- An hourly job emails each player the open markets they have not called
-- that lock within their chosen lead time. This migration adds:
--
--   reminder_preferences   the player's lead time (24h / 2h / off) and locale.
--                          Its own table, not profiles columns: every signed-in
--                          user can read every profile (leaderboards need the
--                          names), and a preference is nobody else's business.
--   reminder_sends         one row per market already reminded, per player, so
--                          a market is never mailed twice.
--   reminder_candidates()  the whole selection in one query, for the job.
--   send_reminders         a new operations kind, off until rollout.
--   pg_cron schedule       hourly, calling the app route through pg_net. The
--                          Vercel Hobby plan runs each cron once a day, too
--                          coarse for a 2-hour lead.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- reminder_preferences
-- ---------------------------------------------------------------------------

create table public.reminder_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- No row means the default: reminded 24 hours ahead.
  lead_time text not null default '24h' check (lead_time in ('24h', '2h', 'off')),
  -- The language the player last used the app in; null falls back to English.
  locale text check (locale in ('en', 'es')),
  updated_at timestamptz not null default now()
);

create trigger trg_reminder_preferences_updated_at
  before update on public.reminder_preferences
  for each row execute function public.set_updated_at();

alter table public.reminder_preferences enable row level security;

create policy "reminder_preferences_select_own" on public.reminder_preferences for select
  to authenticated using (user_id = auth.uid());
create policy "reminder_preferences_insert_own" on public.reminder_preferences for insert
  to authenticated with check (user_id = auth.uid());
create policy "reminder_preferences_update_own" on public.reminder_preferences for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.reminder_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- reminder_sends
-- ---------------------------------------------------------------------------

create table public.reminder_sends (
  user_id uuid not null references public.profiles(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (user_id, market_id)
);

create index reminder_sends_market_idx on public.reminder_sends (market_id);

-- Written and read by the service role only.
alter table public.reminder_sends enable row level security;

-- ---------------------------------------------------------------------------
-- reminder_candidates(now): every (player, market) pair the job should mail
-- ---------------------------------------------------------------------------
-- An open market of the active season, locking within the player's lead
-- time, that the player has neither called nor been reminded about. Admins
-- cannot make calls, so they are never reminded.

create or replace function public.reminder_candidates(p_now timestamptz default now())
returns table (
  user_id uuid,
  email text,
  locale text,
  timezone text,
  market_id uuid,
  market_type text,
  locks_at timestamptz,
  grand_prix_slug text,
  grand_prix_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    u.email::text,
    rp.locale,
    p.timezone,
    m.id,
    m.type,
    m.locks_at,
    g.slug,
    g.name
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.reminder_preferences rp on rp.user_id = p.id
  join public.markets m
    on m.status = 'open'
   and m.locks_at > p_now
   and m.locks_at <= p_now + case coalesce(rp.lead_time, '24h')
                               when '2h' then interval '2 hours'
                               else interval '24 hours'
                             end
  join public.grands_prix g on g.id = m.grand_prix_id
  join public.seasons s on s.id = g.season_id and s.status = 'active'
  where not p.is_admin
    and coalesce(rp.lead_time, '24h') <> 'off'
    and u.email is not null
    and not exists (
      select 1 from public.predictions pr where pr.user_id = p.id and pr.market_id = m.id
    )
    and not exists (
      select 1 from public.reminder_sends rs where rs.user_id = p.id and rs.market_id = m.id
    )
  order by p.id, m.locks_at;
$$;

-- It reads auth.users; only the job (service role) may call it.
revoke all on function public.reminder_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.reminder_candidates(timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Operations: a third job kind
-- ---------------------------------------------------------------------------

alter table public.operation_runs drop constraint operation_runs_kind_check;
alter table public.operation_runs add constraint operation_runs_kind_check
  check (kind in ('sync_calendar', 'sync_results', 'send_reminders'));

alter table public.operation_settings drop constraint operation_settings_kind_check;
alter table public.operation_settings add constraint operation_settings_kind_check
  check (kind in ('sync_calendar', 'sync_results', 'send_reminders'));

-- Off until the sending domain is verified; an admin switches it on.
insert into public.operation_settings (kind, enabled) values ('send_reminders', false)
on conflict (kind) do nothing;

-- ---------------------------------------------------------------------------
-- Hourly trigger: pg_cron -> pg_net -> /api/cron/send-reminders
-- ---------------------------------------------------------------------------
-- The URL and the bearer live in Vault, never in the repo:
--
--   select vault.create_secret('https://YOUR-DOMAIN/api/cron/send-reminders', 'reminders_cron_url');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
--
-- Until both exist the call is a no-op, so local and CI databases stay quiet.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.call_send_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'reminders_cron_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_get(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function public.call_send_reminders() from public, anon, authenticated;

select cron.schedule('send-reminders', '0 * * * *', 'select public.call_send_reminders()');
