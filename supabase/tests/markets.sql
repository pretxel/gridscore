-- Market generation, locks_at derivation, resolution state machine.
begin;
\ir lib/helpers.sql

do $$
declare
  s uuid := pg_temp.make_season(2094);
  gp uuid := pg_temp.make_gp(s, 1);
  gp_sprint uuid := pg_temp.make_gp(s, 2, true);
  d1 uuid := pg_temp.driver(s, 'd1');
  v_race timestamptz;
  v_quali timestamptz;
  v_before timestamptz;
begin
  -- 1. Market generation.
  perform pg_temp.check((select count(*) from public.markets where grand_prix_id = gp) = 5, 'plain weekend gets 5 markets');
  perform pg_temp.check((select count(*) from public.markets where grand_prix_id = gp_sprint) = 6, 'sprint weekend gets 6 markets');
  perform pg_temp.check((select count(*) from public.markets where grand_prix_id = gp and type = 'sprint_winner') = 0,
    'no sprint_winner market without a sprint');

  -- 2. locks_at derivation.
  select race_at, qualifying_at into v_race, v_quali from public.grands_prix where id = gp;
  perform pg_temp.check((select locks_at from public.markets where id = pg_temp.market(gp, 'pole')) = v_quali, 'pole locks at qualifying');
  perform pg_temp.check((select locks_at from public.markets where id = pg_temp.market(gp, 'podium')) = v_race, 'podium locks at race');
  perform pg_temp.check((select locks_at from public.markets where id = pg_temp.market(gp, 'safety_car')) = v_race, 'safety car locks at race');
  perform pg_temp.check((select locks_at from public.markets where id = pg_temp.market(gp_sprint, 'sprint_winner'))
    = (select sprint_at from public.grands_prix where id = gp_sprint), 'sprint winner locks at sprint');

  -- 3. Moving qualifying moves only the pole market.
  update public.grands_prix set qualifying_at = qualifying_at + interval '1 hour' where id = gp;
  perform pg_temp.check((select locks_at from public.markets where id = pg_temp.market(gp, 'pole')) = v_quali + interval '1 hour',
    'pole locks_at follows qualifying_at');
  perform pg_temp.check((select locks_at from public.markets where id = pg_temp.market(gp, 'podium')) = v_race,
    'podium locks_at unchanged by qualifying move');

  -- 4. A resolved market keeps its locks_at when sessions move.
  update public.markets set result = jsonb_build_object('driver_id', d1) where id = pg_temp.market(gp, 'pole');
  select locks_at into v_before from public.markets where id = pg_temp.market(gp, 'pole');
  update public.grands_prix set qualifying_at = qualifying_at + interval '1 hour' where id = gp;
  perform pg_temp.check((select locks_at from public.markets where id = pg_temp.market(gp, 'pole')) = v_before,
    'resolved market keeps locks_at');

  -- 5. Resolution state machine.
  perform pg_temp.check((select status from public.markets where id = pg_temp.market(gp, 'pole')) = 'resolved', 'result sets status resolved');
  perform pg_temp.check((select resolved_at is not null from public.markets where id = pg_temp.market(gp, 'pole')), 'result stamps resolved_at');
  perform pg_temp.check(pg_temp.raises(format($q$update public.markets set status = 'resolved' where id = %L$q$, pg_temp.market(gp, 'podium'))),
    'resolved without result is rejected');
  update public.markets set status = 'void' where id = pg_temp.market(gp, 'pole');
  perform pg_temp.check((select result is null from public.markets where id = pg_temp.market(gp, 'pole')), 'void clears the result');

  -- 6. Dropping the sprint voids the sprint_winner market.
  update public.grands_prix set has_sprint = false, sprint_at = null where id = gp_sprint;
  perform pg_temp.check((select status from public.markets where id = pg_temp.market(gp_sprint, 'sprint_winner')) = 'void',
    'sprint_winner voided when has_sprint drops');
  perform pg_temp.check(pg_temp.raises(format($q$update public.grands_prix set has_sprint = true where id = %L$q$, gp_sprint)),
    'has_sprint without sprint_at rejected');

  -- 7. Idempotent re-run creates nothing new.
  perform public.ensure_markets_for_grand_prix(gp);
  perform pg_temp.check((select count(*) from public.markets where grand_prix_id = gp) = 5, 'ensure_markets is idempotent');

  -- 8. Unique per (gp, type).
  perform pg_temp.check(pg_temp.raises(format($q$insert into public.markets (grand_prix_id, type, locks_at) values (%L, 'pole', now())$q$, gp)),
    'duplicate market type rejected');
end $$;

rollback;
\echo 'OK: markets.sql'
