-- Shared helpers for the SQL invariant tests. Included with `\ir lib/helpers.sql`
-- from each test file; everything lives in pg_temp so nothing persists.

-- True when the statement raises (any error). The exception block runs in a
-- subtransaction, so a failure never aborts the enclosing test transaction.
create or replace function pg_temp.raises(sql text) returns boolean
language plpgsql as $$
begin
  execute sql;
  return false;
exception when others then
  return true;
end;
$$;

-- True when the statement raises with a message containing `needle`.
create or replace function pg_temp.raises_with(sql text, needle text) returns boolean
language plpgsql as $$
begin
  execute sql;
  return false;
exception when others then
  return position(needle in sqlerrm) > 0;
end;
$$;

create or replace function pg_temp.check(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'FAIL: %', msg;
  end if;
end;
$$;

-- Creates an auth user (the signup trigger creates the profile), then sets the
-- display name and admin flag directly. Returns the user id.
create or replace function pg_temp.make_user(p_email text, p_name text, p_admin boolean default false)
returns uuid
language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_id, '00000000-0000-0000-0000-000000000000', p_email, 'authenticated', 'authenticated', '{}', '{}', now(), now());
  update public.profiles set display_name = p_name, is_admin = p_admin where id = v_id;
  return v_id;
end;
$$;

-- Act as a signed-in user: sets the JWT claims PostgREST would set and
-- switches to the `authenticated` role so RLS applies.
create or replace function pg_temp.login(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Back to the superuser (service-role equivalent: no JWT claims).
create or replace function pg_temp.logout() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Scope season-resolved objects to a given season slug (the x-season header).
create or replace function pg_temp.use_season(p_slug text) returns void
language plpgsql as $$
begin
  perform set_config('request.headers', json_build_object('x-season', p_slug)::text, true);
end;
$$;

-- A throwaway season with drivers and scoring rules mirroring the seed.
-- Returns the season id; drivers are provider_key d1..d6.
create or replace function pg_temp.make_season(p_year int, p_status text default 'active')
returns uuid
language plpgsql as $$
declare
  v_season uuid;
  v_team uuid;
  i int;
begin
  insert into public.seasons (year, slug, name, status)
  values (p_year, p_year::text, p_year || ' test season', p_status)
  returning id into v_season;
  insert into public.teams (season_id, provider_key, name, short_name)
  values (v_season, 'team', 'Test Team', 'TT') returning id into v_team;
  for i in 1..6 loop
    insert into public.drivers (season_id, provider_key, code, number, given_name, family_name, team_id)
    values (v_season, 'd' || i, 'D' || chr(64 + i) || 'R', i, 'Driver', i::text, v_team);
  end loop;
  insert into public.scoring_rules (season_id, market_type, rule_key, points) values
    (v_season, 'podium', 'exact_position', 10),
    (v_season, 'podium', 'in_podium', 4),
    (v_season, 'podium', 'all_exact_bonus', 25),
    (v_season, 'pole', 'exact', 8),
    (v_season, 'fastest_lap', 'exact', 6),
    (v_season, 'first_retirement', 'exact', 6),
    (v_season, 'safety_car', 'exact', 3),
    (v_season, 'sprint_winner', 'exact', 6);
  return v_season;
end;
$$;

create or replace function pg_temp.driver(p_season uuid, p_key text) returns uuid
language sql stable as $$
  select id from public.drivers where season_id = p_season and provider_key = p_key;
$$;

-- A Grand Prix whose sessions are all in the future (open markets).
create or replace function pg_temp.make_gp(
  p_season uuid, p_round int, p_has_sprint boolean default false,
  p_multiplier numeric default 1, p_race_at timestamptz default now() + interval '2 days'
)
returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.grands_prix (
    season_id, round, slug, name, circuit_key, circuit_name, has_sprint, multiplier, multiplier_reason,
    sprint_at, qualifying_at, race_at
  ) values (
    p_season, p_round, 'gp-' || p_round, 'Test Grand Prix ' || p_round, 'circuit' || p_round, 'Circuit ' || p_round,
    p_has_sprint, p_multiplier, case when p_multiplier = 1 then 'normal' else 'custom' end,
    case when p_has_sprint then p_race_at - interval '1 day' else null end,
    p_race_at - interval '1 day' + interval '4 hours',
    p_race_at
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function pg_temp.market(p_gp uuid, p_type text) returns uuid
language sql stable as $$
  select id from public.markets where grand_prix_id = p_gp and type = p_type;
$$;
