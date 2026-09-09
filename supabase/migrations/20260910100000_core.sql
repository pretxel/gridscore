-- ===========================================================================
-- gridscore — core domain schema
-- ---------------------------------------------------------------------------
-- seasons, teams, drivers, grands_prix, markets, predictions, scoring_rules,
-- scores, leaderboards, leagues, operations ledger. Builds on
-- 20260910000000_profiles.sql. Design: docs/superpowers/specs/
-- 2026-09-10-gridscore-design.md §3. Column-level detail lives in
-- docs/data-model.md.
--
-- Conventions (inherited from Winscore):
--   * every season-scoped view / policy / RPC resolves through
--     active_season_id(), which reads the per-request `x-season` header and
--     falls back to the single active season;
--   * SECURITY DEFINER functions are the only mutation path for anything a
--     user must not write directly (scores, league membership);
--   * the prediction lock is enforced twice: by RLS (anon/user JWT) and by a
--     BEFORE trigger (also stops service-role writes).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. seasons
-- ---------------------------------------------------------------------------

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  year int not null unique check (year between 1950 and 2100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 60),
  status text not null default 'manage'
    check (status in ('upcoming', 'active', 'finished', 'manage')),
  providers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_seasons_updated_at
  before update on public.seasons
  for each row execute function public.set_updated_at();

-- Season named by the request's `x-season` header (slug), else the first
-- active season. Every season-scoped object resolves through this.
create or replace function public.active_season_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select s.id from public.seasons s
      where s.slug = nullif(current_setting('request.headers', true)::json ->> 'x-season', '')
      limit 1
    ),
    (select s.id from public.seasons s where s.status = 'active' order by s.year desc limit 1)
  );
$$;

alter table public.seasons enable row level security;

create policy "seasons_select_public"
  on public.seasons for select
  to anon, authenticated
  using (true);

create policy "seasons_admin_write"
  on public.seasons for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. teams, drivers
-- ---------------------------------------------------------------------------

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  provider_key text not null check (char_length(provider_key) between 1 and 60),
  name text not null check (char_length(name) between 1 and 80),
  short_name text not null check (char_length(short_name) between 1 and 40),
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, provider_key)
);

create trigger trg_teams_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  provider_key text not null check (char_length(provider_key) between 1 and 60),
  code text check (code is null or code ~ '^[A-Z]{3}$'),
  number int check (number is null or number between 0 and 99),
  given_name text not null check (char_length(given_name) between 1 and 60),
  family_name text not null check (char_length(family_name) between 1 and 60),
  team_id uuid references public.teams(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, provider_key)
);
create index drivers_season_active_idx on public.drivers (season_id, active);

create trigger trg_drivers_updated_at
  before update on public.drivers
  for each row execute function public.set_updated_at();

alter table public.teams enable row level security;
alter table public.drivers enable row level security;

create policy "teams_select_public" on public.teams for select to anon, authenticated using (true);
create policy "teams_admin_write" on public.teams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "drivers_select_public" on public.drivers for select to anon, authenticated using (true);
create policy "drivers_admin_write" on public.drivers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. grands_prix
-- ---------------------------------------------------------------------------

create table public.grands_prix (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  round int not null check (round between 1 and 40),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  circuit_key text not null check (char_length(circuit_key) between 1 and 60),
  circuit_name text not null check (char_length(circuit_name) between 1 and 120),
  country text,
  locality text,
  has_sprint boolean not null default false,
  multiplier numeric(4,2) not null default 1.00 check (multiplier >= 1),
  multiplier_reason text not null default 'normal'
    check (multiplier_reason in ('normal', 'sprint', 'legend', 'finale', 'custom')),
  multiplier_locked boolean not null default false,
  fp1_at timestamptz,
  fp2_at timestamptz,
  fp3_at timestamptz,
  sprint_qualifying_at timestamptz,
  sprint_at timestamptz,
  qualifying_at timestamptz,
  race_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, round),
  unique (season_id, slug),
  constraint grands_prix_sprint_needs_time check (not has_sprint or sprint_at is not null)
);
create index grands_prix_season_race_idx on public.grands_prix (season_id, race_at);

create trigger trg_grands_prix_updated_at
  before update on public.grands_prix
  for each row execute function public.set_updated_at();

alter table public.grands_prix enable row level security;

create policy "grands_prix_select_public" on public.grands_prix for select
  to anon, authenticated using (true);
create policy "grands_prix_admin_write" on public.grands_prix for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. markets
-- ---------------------------------------------------------------------------

-- Pick / result shape validation. Raises on a malformed payload. Driver ids
-- must exist in the given season (active or not: a driver can retire after a
-- pick was made and the pick must still validate on recompute).
create or replace function public.validate_market_pick(p_type text, p_pick jsonb, p_season_id uuid)
returns void
language plpgsql
stable
as $$
declare
  v_keys text[];
  v_driver text;
  v_p1 text; v_p2 text; v_p3 text;
begin
  if p_pick is null or jsonb_typeof(p_pick) <> 'object' then
    raise exception 'pick must be a JSON object';
  end if;
  select coalesce(array_agg(k order by k), array[]::text[]) into v_keys
  from jsonb_object_keys(p_pick) k;

  if p_type in ('pole', 'fastest_lap', 'sprint_winner') then
    if v_keys <> array['driver_id'] then
      raise exception 'pick for % must be {"driver_id": uuid}', p_type;
    end if;
    v_driver := p_pick ->> 'driver_id';
    if v_driver is null then
      raise exception 'pick for % needs a driver_id', p_type;
    end if;
    if not exists (select 1 from public.drivers d where d.id = v_driver::uuid and d.season_id = p_season_id) then
      raise exception 'driver % is not in this season', v_driver;
    end if;

  elsif p_type = 'first_retirement' then
    if v_keys <> array['driver_id'] then
      raise exception 'pick for first_retirement must be {"driver_id": uuid | null}';
    end if;
    if jsonb_typeof(p_pick -> 'driver_id') <> 'null' then
      v_driver := p_pick ->> 'driver_id';
      if not exists (select 1 from public.drivers d where d.id = v_driver::uuid and d.season_id = p_season_id) then
        raise exception 'driver % is not in this season', v_driver;
      end if;
    end if;

  elsif p_type = 'safety_car' then
    if v_keys <> array['value'] or jsonb_typeof(p_pick -> 'value') <> 'boolean' then
      raise exception 'pick for safety_car must be {"value": boolean}';
    end if;

  elsif p_type = 'podium' then
    if v_keys <> array['p1', 'p2', 'p3'] then
      raise exception 'pick for podium must be {"p1","p2","p3"} driver uuids';
    end if;
    v_p1 := p_pick ->> 'p1'; v_p2 := p_pick ->> 'p2'; v_p3 := p_pick ->> 'p3';
    if v_p1 is null or v_p2 is null or v_p3 is null then
      raise exception 'podium pick needs three drivers';
    end if;
    if v_p1 = v_p2 or v_p1 = v_p3 or v_p2 = v_p3 then
      raise exception 'podium drivers must be distinct';
    end if;
    if (select count(*) from public.drivers d
        where d.season_id = p_season_id
          and d.id in (v_p1::uuid, v_p2::uuid, v_p3::uuid)) <> 3 then
      raise exception 'podium pick references a driver outside this season';
    end if;

  else
    raise exception 'unknown market type %', p_type;
  end if;
end;
$$;

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  grand_prix_id uuid not null references public.grands_prix(id) on delete cascade,
  type text not null
    check (type in ('pole', 'podium', 'fastest_lap', 'first_retirement', 'safety_car', 'sprint_winner')),
  locks_at timestamptz not null,
  status text not null default 'open'
    check (status in ('open', 'locked', 'resolved', 'void')),
  result jsonb,
  suggested_result jsonb,
  resolution_source text check (resolution_source is null or resolution_source in ('provider', 'manual')),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grand_prix_id, type),
  constraint markets_resolved_has_result check (status <> 'resolved' or result is not null),
  constraint markets_result_means_resolved check (result is null or status = 'resolved')
);
create index markets_locks_at_idx on public.markets (locks_at);
create index markets_status_idx on public.markets (status);

create trigger trg_markets_updated_at
  before update on public.markets
  for each row execute function public.set_updated_at();

-- Session instant a market locks at, derived from its Grand Prix.
create or replace function public.market_locks_at(p_gp public.grands_prix, p_type text)
returns timestamptz
language sql
immutable
as $$
  select case p_type
    when 'pole' then coalesce(p_gp.qualifying_at, p_gp.race_at)
    when 'sprint_winner' then coalesce(p_gp.sprint_at, p_gp.race_at)
    else p_gp.race_at
  end;
$$;

-- Validate result payloads and keep status/result consistent. A non-null
-- result makes the market resolved; clearing the result while resolved is
-- rejected (void it instead).
create or replace function public.trg_markets_before_write()
returns trigger
language plpgsql
as $$
declare
  v_season uuid;
begin
  select g.season_id into v_season from public.grands_prix g where g.id = new.grand_prix_id;
  -- Void wins: it is the only way out of `resolved`, and it drops the result.
  if new.status = 'void' then
    new.result := null;
  elsif new.result is not null then
    perform public.validate_market_pick(new.type, new.result, v_season);
    new.status := 'resolved';
    new.resolved_at := coalesce(new.resolved_at, now());
  end if;
  if new.suggested_result is not null then
    perform public.validate_market_pick(new.type, new.suggested_result, v_season);
  end if;
  return new;
end;
$$;

create trigger trg_markets_before_write
  before insert or update on public.markets
  for each row execute function public.trg_markets_before_write();

-- Create the missing markets for a Grand Prix and refresh locks_at on the
-- ones still open. sprint_winner exists only for sprint weekends; if a
-- weekend loses its sprint the market is voided rather than deleted.
create or replace function public.ensure_markets_for_grand_prix(p_gp_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.grands_prix;
  t text;
  v_types text[] := array['pole', 'podium', 'fastest_lap', 'first_retirement', 'safety_car'];
begin
  select * into g from public.grands_prix where id = p_gp_id;
  if g is null then return; end if;
  if g.has_sprint then
    v_types := array_append(v_types, 'sprint_winner');
  end if;

  foreach t in array v_types loop
    insert into public.markets (grand_prix_id, type, locks_at)
    values (g.id, t, public.market_locks_at(g, t))
    on conflict (grand_prix_id, type) do update
      set locks_at = excluded.locks_at
      where public.markets.status = 'open';
  end loop;

  if not g.has_sprint then
    update public.markets
    set status = 'void'
    where grand_prix_id = g.id and type = 'sprint_winner' and status in ('open', 'locked');
  end if;
end;
$$;

create or replace function public.trg_grands_prix_ensure_markets()
returns trigger
language plpgsql
as $$
begin
  perform public.ensure_markets_for_grand_prix(new.id);
  return new;
end;
$$;

create trigger trg_grands_prix_ensure_markets
  after insert or update of has_sprint, race_at, qualifying_at, sprint_at on public.grands_prix
  for each row execute function public.trg_grands_prix_ensure_markets();

-- Flip due markets from open to locked. Idempotent; safe for any caller.
create or replace function public.lock_due_markets()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.markets
  set status = 'locked'
  where status = 'open' and locks_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

alter table public.markets enable row level security;

create policy "markets_select_public" on public.markets for select
  to anon, authenticated using (true);
create policy "markets_admin_write" on public.markets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. predictions (with the lock)
-- ---------------------------------------------------------------------------

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  pick jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (user_id, market_id)
);
create index predictions_market_id_idx on public.predictions (market_id);
create index predictions_user_id_idx on public.predictions (user_id);

-- Second lock layer (the first is RLS). Runs for every writer, including the
-- service role. Also validates the pick shape and refreshes submitted_at.
create or replace function public.guard_prediction_lock()
returns trigger
language plpgsql
as $$
declare
  m public.markets;
  v_season uuid;
begin
  select * into m from public.markets where id = new.market_id;
  if m is null then
    raise exception 'market % does not exist', new.market_id;
  end if;
  if m.locks_at <= now() or m.status <> 'open' then
    raise exception 'prediction locked';
  end if;
  select g.season_id into v_season from public.grands_prix g where g.id = m.grand_prix_id;
  perform public.validate_market_pick(m.type, new.pick, v_season);
  new.submitted_at := now();
  return new;
end;
$$;

create trigger trg_predictions_guard_lock
  before insert or update on public.predictions
  for each row execute function public.guard_prediction_lock();

alter table public.predictions enable row level security;

create policy "predictions_select_own"
  on public.predictions for select
  to authenticated
  using (user_id = auth.uid());

-- Picks become public once their market has locked, so league members can
-- compare calls before the result is in.
create policy "predictions_select_after_lock"
  on public.predictions for select
  to authenticated
  using (
    exists (
      select 1 from public.markets m
      where m.id = predictions.market_id and m.locks_at <= now()
    )
  );

create policy "predictions_admin_select_all"
  on public.predictions for select
  to authenticated
  using (public.is_admin());

create policy "predictions_insert_own_before_lock"
  on public.predictions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and not public.is_admin()
    and exists (
      select 1 from public.markets m
      where m.id = predictions.market_id
        and m.status = 'open'
        and m.locks_at > now()
    )
  );

create policy "predictions_update_own_before_lock"
  on public.predictions for update
  to authenticated
  using (
    user_id = auth.uid()
    and not public.is_admin()
    and exists (
      select 1 from public.markets m
      where m.id = predictions.market_id
        and m.status = 'open'
        and m.locks_at > now()
    )
  )
  with check (
    user_id = auth.uid()
    and not public.is_admin()
    and exists (
      select 1 from public.markets m
      where m.id = predictions.market_id
        and m.status = 'open'
        and m.locks_at > now()
    )
  );

-- No delete policy: users cannot remove a pick.

-- ---------------------------------------------------------------------------
-- 6. scoring_rules
-- ---------------------------------------------------------------------------

create table public.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  market_type text not null
    check (market_type in ('pole', 'podium', 'fastest_lap', 'first_retirement', 'safety_car', 'sprint_winner')),
  rule_key text not null
    check (rule_key in ('exact', 'exact_position', 'in_podium', 'all_exact_bonus')),
  points int not null check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, market_type, rule_key)
);

create trigger trg_scoring_rules_updated_at
  before update on public.scoring_rules
  for each row execute function public.set_updated_at();

create or replace function public.scoring_rule_points(p_season_id uuid, p_market_type text, p_rule_key text)
returns int
language sql
stable
as $$
  select coalesce(
    (select r.points from public.scoring_rules r
     where r.season_id = p_season_id and r.market_type = p_market_type and r.rule_key = p_rule_key),
    0
  );
$$;

alter table public.scoring_rules enable row level security;

create policy "scoring_rules_select_public" on public.scoring_rules for select
  to anon, authenticated using (true);
create policy "scoring_rules_admin_write" on public.scoring_rules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. scores + scoring functions
-- ---------------------------------------------------------------------------

create table public.scores (
  user_id uuid not null references public.profiles(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  points int not null check (points >= 0),
  hit_type text not null check (hit_type in ('exact', 'podium_exact_all', 'podium_partial', 'miss')),
  computed_at timestamptz not null default now(),
  primary key (user_id, market_id)
);
create index scores_market_id_idx on public.scores (market_id);

-- Canonical scoring primitive. Base points come from scoring_rules for the
-- season; the Grand Prix multiplier is applied last and rounded half away
-- from zero. lib/scoring.ts mirrors this exactly.
create or replace function public.score_market_pick(
  p_type text,
  p_pick jsonb,
  p_result jsonb,
  p_season_id uuid,
  p_multiplier numeric
)
returns table (points int, hit_type text)
language plpgsql
stable
as $$
declare
  v_base int := 0;
  v_hit text := 'miss';
  v_exact_positions int := 0;
  v_pos text;
  v_pick_driver text;
  v_result_set text[];
begin
  if p_type in ('pole', 'fastest_lap', 'sprint_winner') then
    if (p_pick ->> 'driver_id') = (p_result ->> 'driver_id') then
      v_base := public.scoring_rule_points(p_season_id, p_type, 'exact');
      v_hit := 'exact';
    end if;

  elsif p_type = 'first_retirement' then
    if (p_pick ->> 'driver_id') is not distinct from (p_result ->> 'driver_id') then
      v_base := public.scoring_rule_points(p_season_id, p_type, 'exact');
      v_hit := 'exact';
    end if;

  elsif p_type = 'safety_car' then
    if (p_pick ->> 'value')::boolean = (p_result ->> 'value')::boolean then
      v_base := public.scoring_rule_points(p_season_id, p_type, 'exact');
      v_hit := 'exact';
    end if;

  elsif p_type = 'podium' then
    v_result_set := array[p_result ->> 'p1', p_result ->> 'p2', p_result ->> 'p3'];
    foreach v_pos in array array['p1', 'p2', 'p3'] loop
      v_pick_driver := p_pick ->> v_pos;
      if v_pick_driver = (p_result ->> v_pos) then
        v_base := v_base + public.scoring_rule_points(p_season_id, 'podium', 'exact_position');
        v_exact_positions := v_exact_positions + 1;
      elsif v_pick_driver = any (v_result_set) then
        v_base := v_base + public.scoring_rule_points(p_season_id, 'podium', 'in_podium');
      end if;
    end loop;
    if v_exact_positions = 3 then
      v_base := v_base + public.scoring_rule_points(p_season_id, 'podium', 'all_exact_bonus');
      v_hit := 'podium_exact_all';
    elsif v_base > 0 then
      v_hit := 'podium_partial';
    end if;

  else
    raise exception 'unknown market type %', p_type;
  end if;

  points := round(v_base * p_multiplier)::int;
  hit_type := v_hit;
  return next;
end;
$$;

-- Rewrites every score row for one market from its current result. Idempotent:
-- always clears first; a market that is not resolved ends with no rows.
create or replace function public.compute_market_scores(p_market_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.markets;
  g public.grands_prix;
  v_pred record;
  v_points int;
  v_hit text;
begin
  delete from public.scores where market_id = p_market_id;

  select * into m from public.markets where id = p_market_id;
  if m is null or m.status <> 'resolved' or m.result is null then
    return;
  end if;
  select * into g from public.grands_prix where id = m.grand_prix_id;

  for v_pred in
    select p.user_id, p.pick from public.predictions p where p.market_id = p_market_id
  loop
    select s.points, s.hit_type into v_points, v_hit
    from public.score_market_pick(m.type, v_pred.pick, m.result, g.season_id, g.multiplier) s;
    insert into public.scores (user_id, market_id, points, hit_type, computed_at)
    values (v_pred.user_id, p_market_id, v_points, v_hit, now());
  end loop;
end;
$$;

-- Recompute every market of a Grand Prix (after a multiplier or rule edit).
create or replace function public.compute_grand_prix_scores(p_gp_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_n int := 0;
begin
  for v_id in select id from public.markets where grand_prix_id = p_gp_id loop
    perform public.compute_market_scores(v_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

create or replace function public.trg_markets_recompute_scores()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT'
     or new.result is distinct from old.result
     or new.status is distinct from old.status then
    perform public.compute_market_scores(new.id);
  end if;
  return new;
end;
$$;

create trigger trg_markets_recompute_scores
  after insert or update on public.markets
  for each row execute function public.trg_markets_recompute_scores();

alter table public.scores enable row level security;

create policy "scores_select_authenticated"
  on public.scores for select
  to authenticated
  using (true);

-- No write policies: only compute_market_scores() (security definer) writes.

-- ---------------------------------------------------------------------------
-- 8. leaderboards
-- ---------------------------------------------------------------------------
-- Admins are filtered inside the aggregate so ranks stay contiguous.
-- Tie-break: total_points desc, podium_exact_all_hits desc, exact_hits desc,
-- first_submit asc.

create or replace view public.v_leaderboard_overall as
with agg as (
  select
    s.user_id,
    sum(s.points)::int as total_points,
    count(*) filter (where s.hit_type = 'podium_exact_all')::int as podium_exact_all_hits,
    count(*) filter (where s.hit_type in ('exact', 'podium_exact_all'))::int as exact_hits,
    count(*)::int as markets_scored,
    min(p.submitted_at) as first_submit
  from public.scores s
  join public.markets m on m.id = s.market_id
  join public.grands_prix g on g.id = m.grand_prix_id and g.season_id = public.active_season_id()
  join public.predictions p on p.user_id = s.user_id and p.market_id = s.market_id
  join public.profiles pr_f on pr_f.id = s.user_id and pr_f.is_admin = false
  group by s.user_id
)
select
  a.user_id,
  pr.display_name,
  a.total_points,
  a.podium_exact_all_hits,
  a.exact_hits,
  a.markets_scored,
  a.first_submit,
  rank() over (
    order by a.total_points desc, a.podium_exact_all_hits desc, a.exact_hits desc, a.first_submit asc
  ) as rank
from agg a
join public.profiles pr on pr.id = a.user_id;

create or replace function public.leaderboard_for_grand_prix(p_gp_id uuid)
returns table (
  user_id uuid,
  display_name text,
  total_points int,
  podium_exact_all_hits int,
  exact_hits int,
  markets_scored int,
  first_submit timestamptz,
  rank bigint
)
language sql
stable
as $$
  with agg as (
    select
      s.user_id,
      sum(s.points)::int as total_points,
      count(*) filter (where s.hit_type = 'podium_exact_all')::int as podium_exact_all_hits,
      count(*) filter (where s.hit_type in ('exact', 'podium_exact_all'))::int as exact_hits,
      count(*)::int as markets_scored,
      min(p.submitted_at) as first_submit
    from public.scores s
    join public.markets m on m.id = s.market_id and m.grand_prix_id = p_gp_id
    join public.predictions p on p.user_id = s.user_id and p.market_id = s.market_id
    join public.profiles pr_f on pr_f.id = s.user_id and pr_f.is_admin = false
    group by s.user_id
  )
  select
    a.user_id, pr.display_name, a.total_points, a.podium_exact_all_hits, a.exact_hits,
    a.markets_scored, a.first_submit,
    rank() over (
      order by a.total_points desc, a.podium_exact_all_hits desc, a.exact_hits desc, a.first_submit asc
    ) as rank
  from agg a
  join public.profiles pr on pr.id = a.user_id;
$$;

-- ---------------------------------------------------------------------------
-- 9. leagues, league_members
-- ---------------------------------------------------------------------------

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 40),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  join_code text not null,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index leagues_join_code_key on public.leagues (join_code);
create index leagues_owner_id_idx on public.leagues (owner_id);
create index leagues_season_id_idx on public.leagues (season_id);

create trigger trg_leagues_updated_at
  before update on public.leagues
  for each row execute function public.set_updated_at();

create table public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  invited_by_user_id uuid references public.profiles(id) on delete set null,
  primary key (league_id, user_id)
);
create index league_members_user_id_idx on public.league_members (user_id);

-- Only the service role may change a league's plan (payments hook).
create or replace function public.guard_leagues_plan()
returns trigger
language plpgsql
as $$
declare
  jwt_role text;
begin
  if new.plan is distinct from old.plan then
    jwt_role := (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role');
    if jwt_role is null or jwt_role = 'service_role' then
      return new;
    end if;
    raise exception 'plan cannot be changed via the user API';
  end if;
  return new;
end;
$$;

create trigger trg_leagues_guard_plan
  before update on public.leagues
  for each row execute function public.guard_leagues_plan();

-- Membership helpers (security definer → no policy recursion).
create or replace function public.is_league_member(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_league_owner(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.leagues where id = p_league_id and owner_id = auth.uid()
  );
$$;

-- Member cap per plan. NULL = unlimited. Mirrored in lib/plans.ts.
create or replace function public.league_member_cap(p_plan text)
returns int
language sql
immutable
as $$
  select case p_plan when 'free' then 10 else null end;
$$;

-- GP-XXXXX over an alphabet without the ambiguous glyphs 0 O 1 I L.
create or replace function public.generate_join_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code text := '';
  i int;
begin
  for i in 1..5 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return 'GP-' || code;
end;
$$;

create or replace function public.create_league(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_season uuid := public.active_season_id();
  v_status text;
  v_league_id uuid;
  v_code text;
  v_attempts int := 0;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 40 then
    raise exception 'league name must be between 2 and 40 characters';
  end if;
  if v_season is null then
    raise exception 'no active season';
  end if;
  select status into v_status from public.seasons where id = v_season;
  if v_status <> 'active' then
    raise exception 'season is not active';
  end if;

  loop
    v_attempts := v_attempts + 1;
    v_code := public.generate_join_code();
    begin
      insert into public.leagues (season_id, name, owner_id, join_code)
      values (v_season, v_name, v_uid, v_code)
      returning id into v_league_id;
      exit;
    exception when unique_violation then
      if v_attempts >= 10 then
        raise exception 'could not generate a unique join code';
      end if;
    end;
  end loop;

  insert into public.league_members (league_id, user_id, role)
  values (v_league_id, v_uid, 'owner');

  return v_league_id;
end;
$$;

create or replace function public.join_league(p_code text, p_invited_by uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_league public.leagues;
  v_cap int;
  v_count int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_league from public.leagues
  where join_code = upper(btrim(coalesce(p_code, '')));
  if v_league is null then
    raise exception 'invalid join code';
  end if;

  if exists (select 1 from public.league_members where league_id = v_league.id and user_id = v_uid) then
    return v_league.id;
  end if;

  v_cap := public.league_member_cap(v_league.plan);
  if v_cap is not null then
    select count(*) into v_count from public.league_members where league_id = v_league.id;
    if v_count >= v_cap then
      raise exception 'league is full';
    end if;
  end if;

  insert into public.league_members (league_id, user_id, role, invited_by_user_id)
  values (
    v_league.id, v_uid, 'member',
    case when p_invited_by is not null and p_invited_by <> v_uid
          and exists (select 1 from public.league_members where league_id = v_league.id and user_id = p_invited_by)
         then p_invited_by else null end
  );

  return v_league.id;
end;
$$;

create or replace function public.league_preview(p_code text)
returns table (id uuid, name text, member_count int, plan text)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.name,
    (select count(*)::int from public.league_members lm where lm.league_id = l.id) as member_count,
    l.plan
  from public.leagues l
  where l.join_code = upper(btrim(coalesce(p_code, '')));
$$;

create or replace function public.leave_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if public.is_league_owner(p_league_id) then
    raise exception 'owner cannot leave; delete the league instead';
  end if;
  delete from public.league_members where league_id = p_league_id and user_id = v_uid;
end;
$$;

create or replace function public.remove_league_member(p_league_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_league_owner(p_league_id) then
    raise exception 'only the owner can remove members';
  end if;
  if p_user_id = v_uid then
    raise exception 'owner cannot remove themselves; delete the league instead';
  end if;
  delete from public.league_members where league_id = p_league_id and user_id = p_user_id;
end;
$$;

-- League board: members only, each member counted from the Grand Prix on or
-- after their own joined_at (race_at >= joined_at, boundary inclusive).
create or replace function public.leaderboard_for_league(p_league_id uuid)
returns table (
  user_id uuid,
  display_name text,
  total_points int,
  podium_exact_all_hits int,
  exact_hits int,
  markets_scored int,
  first_submit timestamptz,
  rank bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with agg as (
    select
      s.user_id,
      sum(s.points)::int as total_points,
      count(*) filter (where s.hit_type = 'podium_exact_all')::int as podium_exact_all_hits,
      count(*) filter (where s.hit_type in ('exact', 'podium_exact_all'))::int as exact_hits,
      count(*)::int as markets_scored,
      min(p.submitted_at) as first_submit
    from public.scores s
    join public.league_members lm on lm.user_id = s.user_id and lm.league_id = p_league_id
    join public.leagues l on l.id = p_league_id
    join public.markets m on m.id = s.market_id
    join public.grands_prix g on g.id = m.grand_prix_id
     and g.season_id = l.season_id
     and g.race_at >= lm.joined_at
    join public.predictions p on p.user_id = s.user_id and p.market_id = s.market_id
    join public.profiles pr_f on pr_f.id = s.user_id and pr_f.is_admin = false
    where public.is_league_member(p_league_id)
    group by s.user_id
  )
  select
    a.user_id, pr.display_name, a.total_points, a.podium_exact_all_hits, a.exact_hits,
    a.markets_scored, a.first_submit,
    rank() over (
      order by a.total_points desc, a.podium_exact_all_hits desc, a.exact_hits desc, a.first_submit asc
    ) as rank
  from agg a
  join public.profiles pr on pr.id = a.user_id;
$$;

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;

create policy "leagues_select_members"
  on public.leagues for select
  to authenticated
  using (public.is_league_member(id) or public.is_admin());

create policy "leagues_update_owner"
  on public.leagues for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "leagues_delete_owner"
  on public.leagues for delete
  to authenticated
  using (owner_id = auth.uid());

create policy "league_members_select_comembers"
  on public.league_members for select
  to authenticated
  using (public.is_league_member(league_id) or public.is_admin());

-- No insert/update/delete policies on league_members: RPCs only.

-- ---------------------------------------------------------------------------
-- 10. operations ledger + kill switch
-- ---------------------------------------------------------------------------

create table public.operation_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sync_calendar', 'sync_results')),
  trigger text not null default 'cron' check (trigger in ('cron', 'manual')),
  status text not null check (status in ('success', 'partial', 'error')),
  summary jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index operation_runs_kind_started_idx on public.operation_runs (kind, started_at desc);

create table public.operation_settings (
  kind text primary key check (kind in ('sync_calendar', 'sync_results')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.operation_runs enable row level security;
alter table public.operation_settings enable row level security;

create policy "operation_runs_admin_select" on public.operation_runs for select
  to authenticated using (public.is_admin());
create policy "operation_settings_admin_select" on public.operation_settings for select
  to authenticated using (public.is_admin());
-- Writes come from the service role only.

-- ---------------------------------------------------------------------------
-- 11. realtime + grants
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scores'
  ) then
    alter publication supabase_realtime add table public.scores;
  end if;
end
$$;

grant select on public.v_leaderboard_overall to anon, authenticated;
grant execute on function public.active_season_id() to anon, authenticated;
grant execute on function public.validate_market_pick(text, jsonb, uuid) to anon, authenticated;
grant execute on function public.market_locks_at(public.grands_prix, text) to anon, authenticated;
grant execute on function public.lock_due_markets() to anon, authenticated;
grant execute on function public.scoring_rule_points(uuid, text, text) to anon, authenticated;
grant execute on function public.score_market_pick(text, jsonb, jsonb, uuid, numeric) to anon, authenticated;
revoke execute on function public.compute_market_scores(uuid) from public, anon, authenticated;
revoke execute on function public.compute_grand_prix_scores(uuid) from public, anon, authenticated;
grant execute on function public.leaderboard_for_grand_prix(uuid) to anon, authenticated;
grant execute on function public.is_league_member(uuid) to authenticated;
grant execute on function public.is_league_owner(uuid) to authenticated;
grant execute on function public.league_member_cap(text) to anon, authenticated;
grant execute on function public.create_league(text) to authenticated;
grant execute on function public.join_league(text, uuid) to authenticated;
grant execute on function public.league_preview(text) to authenticated;
grant execute on function public.leave_league(uuid) to authenticated;
grant execute on function public.remove_league_member(uuid, uuid) to authenticated;
grant execute on function public.leaderboard_for_league(uuid) to authenticated;

-- ensure_markets_for_grand_prix and generate_join_code are internal: no
-- grant to app roles. compute_* run under the service role from admin actions
-- (assertAdmin first), never from a user JWT.
revoke execute on function public.ensure_markets_for_grand_prix(uuid) from public, anon, authenticated;
revoke execute on function public.generate_join_code() from public, anon, authenticated;
