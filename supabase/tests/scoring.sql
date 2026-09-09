-- Scoring: score_market_pick rules, multipliers and rounding, the recompute
-- trigger, idempotence, and the leaderboard aggregation.
begin;
\ir lib/helpers.sql

do $$
declare
  s uuid := pg_temp.make_season(2095);
  d1 uuid := pg_temp.driver(s, 'd1');
  d2 uuid := pg_temp.driver(s, 'd2');
  d3 uuid := pg_temp.driver(s, 'd3');
  d4 uuid := pg_temp.driver(s, 'd4');
  d5 uuid := pg_temp.driver(s, 'd5');
  d6 uuid := pg_temp.driver(s, 'd6');
  res jsonb := jsonb_build_object('p1', d1, 'p2', d2, 'p3', d3);
  r record;
begin
  -- 1. Podium rule table (multiplier 1).
  select * into r from public.score_market_pick('podium', jsonb_build_object('p1', d1, 'p2', d2, 'p3', d3), res, s, 1);
  perform pg_temp.check(r.points = 55 and r.hit_type = 'podium_exact_all', 'podium all exact = 30 + 25');
  select * into r from public.score_market_pick('podium', jsonb_build_object('p1', d1, 'p2', d2, 'p3', d4), res, s, 1);
  perform pg_temp.check(r.points = 20 and r.hit_type = 'podium_partial', 'podium two exact + one wrong = 20');
  select * into r from public.score_market_pick('podium', jsonb_build_object('p1', d1, 'p2', d3, 'p3', d2), res, s, 1);
  perform pg_temp.check(r.points = 18 and r.hit_type = 'podium_partial', 'podium one exact + two in podium = 18');
  select * into r from public.score_market_pick('podium', jsonb_build_object('p1', d3, 'p2', d1, 'p3', d2), res, s, 1);
  perform pg_temp.check(r.points = 12 and r.hit_type = 'podium_partial', 'podium three in wrong order = 12');
  select * into r from public.score_market_pick('podium', jsonb_build_object('p1', d4, 'p2', d5, 'p3', d6), res, s, 1);
  perform pg_temp.check(r.points = 0 and r.hit_type = 'miss', 'podium none = miss');

  -- 2. Single-driver markets and booleans.
  select * into r from public.score_market_pick('pole', jsonb_build_object('driver_id', d1), jsonb_build_object('driver_id', d1), s, 1);
  perform pg_temp.check(r.points = 8 and r.hit_type = 'exact', 'pole exact = 8');
  select * into r from public.score_market_pick('pole', jsonb_build_object('driver_id', d2), jsonb_build_object('driver_id', d1), s, 1);
  perform pg_temp.check(r.points = 0 and r.hit_type = 'miss', 'pole miss = 0');
  select * into r from public.score_market_pick('fastest_lap', jsonb_build_object('driver_id', d1), jsonb_build_object('driver_id', d1), s, 1);
  perform pg_temp.check(r.points = 6, 'fastest lap exact = 6');
  select * into r from public.score_market_pick('sprint_winner', jsonb_build_object('driver_id', d1), jsonb_build_object('driver_id', d1), s, 1);
  perform pg_temp.check(r.points = 6, 'sprint winner exact = 6');
  select * into r from public.score_market_pick('first_retirement', '{"driver_id": null}', '{"driver_id": null}', s, 1);
  perform pg_temp.check(r.points = 6 and r.hit_type = 'exact', 'first retirement none/none = exact');
  select * into r from public.score_market_pick('first_retirement', '{"driver_id": null}', jsonb_build_object('driver_id', d1), s, 1);
  perform pg_temp.check(r.points = 0, 'first retirement none vs driver = miss');
  select * into r from public.score_market_pick('safety_car', '{"value": true}', '{"value": true}', s, 1);
  perform pg_temp.check(r.points = 3 and r.hit_type = 'exact', 'safety car match = 3');
  select * into r from public.score_market_pick('safety_car', '{"value": false}', '{"value": true}', s, 1);
  perform pg_temp.check(r.points = 0, 'safety car mismatch = 0');

  -- 3. Multipliers and rounding (half away from zero).
  select * into r from public.score_market_pick('pole', jsonb_build_object('driver_id', d1), jsonb_build_object('driver_id', d1), s, 1.25);
  perform pg_temp.check(r.points = 10, 'pole x1.25 = 10');
  select * into r from public.score_market_pick('podium', jsonb_build_object('p1', d1, 'p2', d2, 'p3', d3), res, s, 1.5);
  perform pg_temp.check(r.points = 83, 'podium all exact x1.5 = 82.5 -> 83, got ' || r.points);
  select * into r from public.score_market_pick('safety_car', '{"value": true}', '{"value": true}', s, 1.5);
  perform pg_temp.check(r.points = 5, 'safety car x1.5 = 4.5 -> 5');
  select * into r from public.score_market_pick('pole', jsonb_build_object('driver_id', d1), jsonb_build_object('driver_id', d1), s, 2);
  perform pg_temp.check(r.points = 16, 'pole x2 = 16');

  -- 4. Missing rule rows score zero rather than failing.
  delete from public.scoring_rules where season_id = s and market_type = 'safety_car';
  select * into r from public.score_market_pick('safety_car', '{"value": true}', '{"value": true}', s, 1);
  perform pg_temp.check(r.points = 0 and r.hit_type = 'exact', 'missing rule -> 0 points, still exact');
end $$;

-- Recompute path: trigger, idempotence, void, correction, leaderboards.
do $$
declare
  s uuid := pg_temp.make_season(2096);
  gp uuid := pg_temp.make_gp(s, 1, false, 1.5);
  gp2 uuid := pg_temp.make_gp(s, 2, false, 1, now() + interval '5 days');
  d1 uuid := pg_temp.driver(s, 'd1');
  d2 uuid := pg_temp.driver(s, 'd2');
  d3 uuid := pg_temp.driver(s, 'd3');
  d4 uuid := pg_temp.driver(s, 'd4');
  u1 uuid := pg_temp.make_user('score-u1@test', 'Score One');
  u2 uuid := pg_temp.make_user('score-u2@test', 'Score Two');
  u3 uuid := pg_temp.make_user('score-u3@test', 'Score Three');
  adm uuid := pg_temp.make_user('score-adm@test', 'Score Admin', true);
  m_podium uuid := pg_temp.market(gp, 'podium');
  m_pole uuid := pg_temp.market(gp, 'pole');
  m_pole2 uuid := pg_temp.market(gp2, 'pole');
  v_rows int;
  v_first timestamptz;
begin
  perform pg_temp.use_season('2096');

  -- Picks (as the service role; the lock trigger still runs).
  insert into public.predictions (user_id, market_id, pick) values
    (u1, m_podium, jsonb_build_object('p1', d1, 'p2', d2, 'p3', d3)),   -- all exact  -> 55 x1.5 = 83
    (u2, m_podium, jsonb_build_object('p1', d3, 'p2', d1, 'p3', d2)),   -- wrong order -> 12 x1.5 = 18
    (u3, m_podium, jsonb_build_object('p1', d4, 'p2', d1, 'p3', d2)),   -- 2 in podium -> 8 x1.5 = 12
    (u1, m_pole, jsonb_build_object('driver_id', d2)),                   -- miss
    (u2, m_pole, jsonb_build_object('driver_id', d1)),                   -- exact -> 8 x1.5 = 12
    (u1, m_pole2, jsonb_build_object('driver_id', d1));                  -- unresolved: no score
  -- The admin's own pick (service-role insert bypasses RLS) must never rank.
  insert into public.predictions (user_id, market_id, pick) values (adm, m_pole, jsonb_build_object('driver_id', d1));

  -- No scores before resolution.
  perform pg_temp.check((select count(*) from public.scores where market_id = m_podium) = 0, 'no scores before result');

  -- Resolve via result: trigger recomputes.
  update public.markets set result = jsonb_build_object('p1', d1, 'p2', d2, 'p3', d3) where id = m_podium;
  update public.markets set result = jsonb_build_object('driver_id', d1) where id = m_pole;

  perform pg_temp.check((select points from public.scores where user_id = u1 and market_id = m_podium) = 83, 'u1 podium 83');
  perform pg_temp.check((select hit_type from public.scores where user_id = u1 and market_id = m_podium) = 'podium_exact_all', 'u1 hit type');
  perform pg_temp.check((select points from public.scores where user_id = u2 and market_id = m_podium) = 18, 'u2 podium 18');
  perform pg_temp.check((select points from public.scores where user_id = u3 and market_id = m_podium) = 12, 'u3 podium 12');
  perform pg_temp.check((select points from public.scores where user_id = u1 and market_id = m_pole) = 0, 'u1 pole miss');
  perform pg_temp.check((select points from public.scores where user_id = u2 and market_id = m_pole) = 12, 'u2 pole 12');
  perform pg_temp.check((select count(*) from public.scores where market_id = m_pole2) = 0, 'unresolved market has no scores');

  -- Idempotent recompute.
  perform public.compute_market_scores(m_podium);
  perform public.compute_market_scores(m_podium);
  perform pg_temp.check((select count(*) from public.scores where market_id = m_podium) = 3, 'recompute keeps one row per user');
  perform pg_temp.check((select points from public.scores where user_id = u1 and market_id = m_podium) = 83, 'recompute keeps points');

  -- Correction re-scores.
  update public.markets set result = jsonb_build_object('p1', d3, 'p2', d1, 'p3', d2) where id = m_podium;
  perform pg_temp.check((select points from public.scores where user_id = u2 and market_id = m_podium) = 83, 'correction: u2 now all exact');
  perform pg_temp.check((select points from public.scores where user_id = u1 and market_id = m_podium) = 18, 'correction: u1 now wrong order');

  -- Multiplier edit + GP recompute.
  update public.grands_prix set multiplier = 2, multiplier_reason = 'finale' where id = gp;
  perform pg_temp.check((select points from public.scores where user_id = u2 and market_id = m_podium) = 83, 'multiplier edit alone does not rescore');
  select public.compute_grand_prix_scores(gp) into v_rows;
  perform pg_temp.check((select points from public.scores where user_id = u2 and market_id = m_podium) = 110, 'GP recompute applies x2: 55 -> 110');
  perform pg_temp.check((select points from public.scores where user_id = u2 and market_id = m_pole) = 16, 'GP recompute pole x2');

  -- Void removes scores.
  update public.markets set status = 'void' where id = m_pole;
  perform pg_temp.check((select count(*) from public.scores where market_id = m_pole) = 0, 'void market has no scores');

  -- Leaderboard (season via header): admin excluded, ranks contiguous, tie-breaks.
  perform pg_temp.check((select count(*) from public.v_leaderboard_overall) = 3, 'three ranked users');
  perform pg_temp.check(not exists (select 1 from public.v_leaderboard_overall where user_id = adm), 'admin not on the board');
  perform pg_temp.check((select array_agg(rank order by rank) from public.v_leaderboard_overall) = array[1, 2, 3]::bigint[], 'ranks contiguous');
  perform pg_temp.check((select user_id from public.v_leaderboard_overall where rank = 1) = u2, 'u2 leads with 110');
  perform pg_temp.check((select podium_exact_all_hits from public.v_leaderboard_overall where user_id = u2) = 1, 'podium_exact_all_hits counted');
  perform pg_temp.check((select exact_hits from public.v_leaderboard_overall where user_id = u2) = 1, 'exact_hits includes podium_exact_all');

  -- Per-GP board sees the same three, scoped to gp.
  perform pg_temp.check((select count(*) from public.leaderboard_for_grand_prix(gp)) = 3, 'gp board has three rows');
  perform pg_temp.check((select count(*) from public.leaderboard_for_grand_prix(gp2)) = 0, 'gp2 board empty');

  -- Season scoping: another season's board is empty.
  perform pg_temp.use_season('2095');
  perform pg_temp.check((select count(*) from public.v_leaderboard_overall) = 0, 'board scoped by x-season header');
end $$;

rollback;
\echo 'OK: scoring.sql'
