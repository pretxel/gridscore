-- Pick / result payload validation (validate_market_pick through the
-- predictions trigger and the markets before-write trigger).
begin;
\ir lib/helpers.sql

do $$
declare
  s uuid := pg_temp.make_season(2092);
  s2 uuid := pg_temp.make_season(2093, 'manage');
  gp uuid := pg_temp.make_gp(s, 1, true);
  u1 uuid := pg_temp.make_user('picks-u1@test', 'Picks One');
  d1 uuid := pg_temp.driver(s, 'd1');
  d2 uuid := pg_temp.driver(s, 'd2');
  d3 uuid := pg_temp.driver(s, 'd3');
  other uuid := pg_temp.driver(s2, 'd1');
  ins constant text := 'insert into public.predictions (user_id, market_id, pick) values (%L, %L, %L)';
begin
  perform pg_temp.use_season('2092');

  -- Accepted shapes.
  execute format(ins, u1, pg_temp.market(gp, 'pole'), jsonb_build_object('driver_id', d1));
  execute format(ins, u1, pg_temp.market(gp, 'fastest_lap'), jsonb_build_object('driver_id', d2));
  execute format(ins, u1, pg_temp.market(gp, 'sprint_winner'), jsonb_build_object('driver_id', d3));
  execute format(ins, u1, pg_temp.market(gp, 'podium'), jsonb_build_object('p1', d1, 'p2', d2, 'p3', d3));
  execute format(ins, u1, pg_temp.market(gp, 'first_retirement'), '{"driver_id": null}'::jsonb);
  execute format(ins, u1, pg_temp.market(gp, 'safety_car'), '{"value": false}'::jsonb);
  perform pg_temp.check((select count(*) from public.predictions where user_id = u1) = 6, 'six valid picks accepted');

  -- first_retirement also accepts a real driver.
  update public.predictions set pick = jsonb_build_object('driver_id', d2)
  where user_id = u1 and market_id = pg_temp.market(gp, 'first_retirement');

  -- Rejected shapes.
  delete from public.predictions where user_id = u1;
  perform pg_temp.check(pg_temp.raises(format(ins, u1, pg_temp.market(gp, 'pole'), '{"driver": "x"}'::jsonb)),
    'pole: wrong key rejected');
  perform pg_temp.check(pg_temp.raises(format(ins, u1, pg_temp.market(gp, 'pole'), '{"driver_id": null}'::jsonb)),
    'pole: null driver rejected');
  perform pg_temp.check(pg_temp.raises(format(ins, u1, pg_temp.market(gp, 'pole'), jsonb_build_object('driver_id', other))),
    'pole: driver from another season rejected');
  perform pg_temp.check(pg_temp.raises(format(ins, u1, pg_temp.market(gp, 'pole'), jsonb_build_object('driver_id', d1, 'extra', 1))),
    'pole: extra key rejected');
  perform pg_temp.check(pg_temp.raises(format(ins, u1, pg_temp.market(gp, 'podium'), jsonb_build_object('p1', d1, 'p2', d1, 'p3', d3))),
    'podium: duplicate driver rejected');
  perform pg_temp.check(pg_temp.raises(format(ins, u1, pg_temp.market(gp, 'podium'), jsonb_build_object('p1', d1, 'p2', d2))),
    'podium: missing position rejected');
  perform pg_temp.check(pg_temp.raises(format(ins, u1, pg_temp.market(gp, 'podium'), jsonb_build_object('p1', d1, 'p2', d2, 'p3', other))),
    'podium: foreign driver rejected');
  perform pg_temp.check(pg_temp.raises(format(ins, u1, pg_temp.market(gp, 'safety_car'), '{"value": "yes"}'::jsonb)),
    'safety_car: non-boolean rejected');
  perform pg_temp.check(pg_temp.raises(format(ins, u1, pg_temp.market(gp, 'safety_car'), '{"value": true, "x": 1}'::jsonb)),
    'safety_car: extra key rejected');
  perform pg_temp.check(pg_temp.raises(format(ins, u1, pg_temp.market(gp, 'first_retirement'), '{}'::jsonb)),
    'first_retirement: empty object rejected');
  perform pg_temp.check(pg_temp.raises(format(ins, u1, pg_temp.market(gp, 'pole'), '"not-an-object"'::jsonb)),
    'non-object pick rejected');

  -- Results go through the same validator.
  perform pg_temp.check(pg_temp.raises(format(
    $q$update public.markets set result = %L where id = %L$q$, '{"driver_id": "00000000-0000-4000-8000-000000000000"}'::jsonb, pg_temp.market(gp, 'pole'))),
    'result with unknown driver rejected');
  perform pg_temp.check(pg_temp.raises(format(
    $q$update public.markets set suggested_result = %L where id = %L$q$, '{"value": 1}'::jsonb, pg_temp.market(gp, 'safety_car'))),
    'suggested_result with wrong shape rejected');

  -- Unknown market type is impossible through the CHECK, and the validator refuses it too.
  perform pg_temp.check(pg_temp.raises(format($q$select public.validate_market_pick('bogus', '{}', %L)$q$, s)),
    'unknown type rejected by validator');
end $$;

rollback;
\echo 'OK: picks.sql'
