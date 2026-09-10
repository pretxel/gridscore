-- ===========================================================================
-- Local development fixture (never run in production)
-- ---------------------------------------------------------------------------
-- Two teams, six drivers, one completed Grand Prix with results and one
-- upcoming Grand Prix with open markets. Driver and team names are
-- placeholders; the calendar sync replaces them with provider data.
-- ===========================================================================

do $$
declare
  v_season uuid;
  v_team_a uuid;
  v_team_b uuid;
  v_d1 uuid; v_d2 uuid; v_d3 uuid; v_d4 uuid; v_d5 uuid; v_d6 uuid;
  v_gp_done uuid;
  v_gp_next uuid;
begin
  select id into v_season from public.seasons where year = 2026;
  if v_season is null then
    raise exception 'season 2026 missing: run seed/season-2026.sql first';
  end if;
  if exists (select 1 from public.grands_prix where season_id = v_season) then
    return; -- already seeded
  end if;

  insert into public.teams (season_id, provider_key, name, short_name, color)
  values (v_season, 'dev_team_a', 'Dev Racing A', 'DRA', '#E4572E')
  returning id into v_team_a;
  insert into public.teams (season_id, provider_key, name, short_name, color)
  values (v_season, 'dev_team_b', 'Dev Racing B', 'DRB', '#2E86E4')
  returning id into v_team_b;

  insert into public.drivers (season_id, provider_key, code, number, given_name, family_name, team_id)
  values (v_season, 'dev_driver_1', 'ONE', 1, 'Alpha', 'One', v_team_a) returning id into v_d1;
  insert into public.drivers (season_id, provider_key, code, number, given_name, family_name, team_id)
  values (v_season, 'dev_driver_2', 'TWO', 2, 'Bravo', 'Two', v_team_a) returning id into v_d2;
  insert into public.drivers (season_id, provider_key, code, number, given_name, family_name, team_id)
  values (v_season, 'dev_driver_3', 'THR', 3, 'Charlie', 'Three', v_team_b) returning id into v_d3;
  insert into public.drivers (season_id, provider_key, code, number, given_name, family_name, team_id)
  values (v_season, 'dev_driver_4', 'FOU', 4, 'Delta', 'Four', v_team_b) returning id into v_d4;
  insert into public.drivers (season_id, provider_key, code, number, given_name, family_name, team_id)
  values (v_season, 'dev_driver_5', 'FIV', 5, 'Echo', 'Five', v_team_a) returning id into v_d5;
  insert into public.drivers (season_id, provider_key, code, number, given_name, family_name, team_id)
  values (v_season, 'dev_driver_6', 'SIX', 6, 'Foxtrot', 'Six', v_team_b) returning id into v_d6;

  -- Completed sprint weekend one week ago: markets get results below.
  insert into public.grands_prix (
    season_id, round, slug, name, circuit_key, circuit_name, country, locality,
    has_sprint, multiplier, multiplier_reason,
    fp1_at, sprint_qualifying_at, sprint_at, qualifying_at, race_at, status
  ) values (
    v_season, 98, 'dev-circuit-one', 'Dev Grand Prix One', 'dev_one', 'Dev Circuit One', 'Nowhere', 'Devtown',
    true, 1.25, 'sprint',
    now() - interval '9 days', now() - interval '8 days 20 hours', now() - interval '8 days',
    now() - interval '7 days 20 hours', now() - interval '7 days', 'completed'
  ) returning id into v_gp_done;

  -- Next weekend, a legend circuit: all markets open.
  insert into public.grands_prix (
    season_id, round, slug, name, circuit_key, circuit_name, country, locality,
    has_sprint, multiplier, multiplier_reason,
    fp1_at, fp2_at, fp3_at, qualifying_at, race_at
  ) values (
    v_season, 99, 'dev-circuit-two', 'Dev Grand Prix Two', 'dev_two', 'Dev Circuit Two', 'Somewhere', 'Devville',
    false, 1.50, 'legend',
    now() + interval '5 days', now() + interval '5 days 4 hours', now() + interval '6 days',
    now() + interval '6 days 4 hours', now() + interval '7 days'
  ) returning id into v_gp_next;

  -- Results for the completed weekend. Setting `result` resolves the market
  -- (before-write trigger) and recomputes scores (after-write trigger).
  update public.markets set result = jsonb_build_object('driver_id', v_d1), resolution_source = 'manual'
    where grand_prix_id = v_gp_done and type = 'pole';
  update public.markets set result = jsonb_build_object('p1', v_d1, 'p2', v_d3, 'p3', v_d2), resolution_source = 'manual'
    where grand_prix_id = v_gp_done and type = 'podium';
  update public.markets set result = jsonb_build_object('driver_id', v_d3), resolution_source = 'manual'
    where grand_prix_id = v_gp_done and type = 'fastest_lap';
  update public.markets set result = jsonb_build_object('driver_id', v_d6), resolution_source = 'manual'
    where grand_prix_id = v_gp_done and type = 'first_retirement';
  update public.markets set result = jsonb_build_object('value', true), resolution_source = 'manual'
    where grand_prix_id = v_gp_done and type = 'safety_car';
  update public.markets set result = jsonb_build_object('driver_id', v_d2), resolution_source = 'manual'
    where grand_prix_id = v_gp_done and type = 'sprint_winner';
end
$$;
