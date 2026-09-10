-- Per-user statistics: season scoping, the caller check, and the numbers the
-- /stats page renders.
begin;
\ir lib/helpers.sql

do $$
declare
  s uuid := pg_temp.make_season(2098);
  other uuid := pg_temp.make_season(2099, 'finished');
  d1 uuid := pg_temp.driver(s, 'd1');
  d2 uuid := pg_temp.driver(s, 'd2');
  od1 uuid := pg_temp.driver(other, 'd1');
  -- Weekends start in the future so picks are accepted; `locks_at` is moved
  -- back below, which is what turns a pick into a scoreable call.
  gp1 uuid := pg_temp.make_gp(s, 1, false, 1, now() + interval '2 days');
  gp2 uuid := pg_temp.make_gp(s, 2, false, 2, now() + interval '9 days');
  ogp uuid := pg_temp.make_gp(other, 1, false, 1, now() + interval '16 days');
  me uuid := pg_temp.make_user('st-me@test', 'Stats Me');
  rival uuid := pg_temp.make_user('st-rival@test', 'Stats Rival');
  adm uuid := pg_temp.make_user('st-adm@test', 'Stats Admin', true);
  m1_pole uuid := pg_temp.market(gp1, 'pole');
  m1_sc uuid := pg_temp.market(gp1, 'safety_car');
  m2_pole uuid := pg_temp.market(gp2, 'pole');
  om_pole uuid := pg_temp.market(ogp, 'pole');
  v_rows int;
  v_points int;
  v_hits int;
begin
  perform pg_temp.use_season('2098');

  -- Picks: I take pole right twice and miss the safety car; the rival takes
  -- one pole. One pick sits in a different season and must never be counted.
  perform pg_temp.logout();
  insert into public.predictions (user_id, market_id, pick) values
    (me,    m1_pole, jsonb_build_object('driver_id', d1)),
    (me,    m1_sc,   '{"value": true}'::jsonb),
    (me,    m2_pole, jsonb_build_object('driver_id', d1)),
    (rival, m1_pole, jsonb_build_object('driver_id', d2)),
    (me,    om_pole, jsonb_build_object('driver_id', od1));

  update public.markets set locks_at = now() - interval '1 minute'
   where id in (m1_pole, m1_sc, m2_pole, om_pole);
  update public.markets set result = jsonb_build_object('driver_id', d1) where id in (m1_pole, m2_pole);
  update public.markets set result = '{"value": false}'::jsonb where id = m1_sc;
  update public.markets set result = jsonb_build_object('driver_id', od1) where id = om_pole;

  -- 1. Own rows: pole is 2 of 2 at 8 and 16 points (round 2 carries x2).
  perform pg_temp.login(me);
  select scored, hits, points into v_rows, v_hits, v_points
    from public.user_market_stats(me) where market_type = 'pole';
  perform pg_temp.check(v_rows = 2, 'pole scored 2, got ' || coalesce(v_rows::text, 'null'));
  perform pg_temp.check(v_hits = 2, 'pole hits 2');
  perform pg_temp.check(v_points = 24, 'pole points 24, got ' || coalesce(v_points::text, 'null'));

  select scored, hits, points into v_rows, v_hits, v_points
    from public.user_market_stats(me) where market_type = 'safety_car';
  perform pg_temp.check(v_rows = 1 and v_hits = 0 and v_points = 0, 'safety car scored but missed');

  -- 2. The other season's pick is invisible from this one.
  perform pg_temp.check(
    (select count(*) from public.user_market_stats(me)) = 2,
    'only markets of the active season are counted'
  );

  -- 3. Weekend rows come back oldest first with the weekend total.
  perform pg_temp.check(
    (select array_agg(round order by round) from public.user_weekend_points(me)) = array[1, 2],
    'two weekends, ordered by round'
  );
  perform pg_temp.check(
    (select points from public.user_weekend_points(me) where round = 2) = 16,
    'round 2 pays 8 x 2'
  );

  -- 4. Another player cannot read my rows; an admin can.
  perform pg_temp.login(rival);
  perform pg_temp.check(
    (select count(*) from public.user_market_stats(me)) = 0,
    'a rival reads none of my stats'
  );
  perform pg_temp.check(
    (select count(*) from public.user_weekend_points(me)) = 0,
    'a rival reads none of my weekends'
  );
  perform pg_temp.login(adm);
  perform pg_temp.check(
    (select count(*) from public.user_market_stats(me)) = 2,
    'an admin reads any player'
  );

  -- 5. Anonymous callers read nothing.
  perform pg_temp.logout();
  perform pg_temp.check(
    (select count(*) from public.user_market_stats(me)) = 0,
    'anonymous reads no stats'
  );

  -- 6. The field average covers ranked players only (admins are excluded by
  --    the leaderboard view). I scored 24 and the rival missed their only
  --    call, so the mean is 12 — a player on zero still counts as a player.
  perform pg_temp.login(me);
  perform pg_temp.check(
    public.season_average_points() = 12,
    'season average is 12, got ' || public.season_average_points()::text
  );
end $$;

rollback;
\echo 'OK: stats.sql'
