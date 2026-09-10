-- Leagues: RPC lifecycle, free-plan cap, plan guard, join-date scoring.
begin;
\ir lib/helpers.sql

do $$
declare
  s uuid := pg_temp.make_season(2097);
  gp uuid := pg_temp.make_gp(s, 1);
  d1 uuid := pg_temp.driver(s, 'd1');
  own uuid := pg_temp.make_user('lg-owner@test', 'League Owner');
  late_id uuid := pg_temp.make_user('lg-late@test', 'Late Joiner');
  adm uuid := pg_temp.make_user('lg-adm@test', 'League Admin', true);
  outsider uuid := pg_temp.make_user('lg-out@test', 'Outsider');
  members uuid[] := array[]::uuid[];
  lg uuid;
  pro_id uuid;
  v_code text;
  v_uid uuid;
  i int;
  m_pole uuid := pg_temp.market(gp, 'pole');
begin
  perform pg_temp.use_season('2097');

  -- 1. Create: owner becomes a member with role owner; code has the GP- prefix.
  perform pg_temp.login(own);
  select public.create_league('Paddock Club') into lg;
  select join_code into v_code from public.leagues where id = lg;
  perform pg_temp.check(v_code ~ '^GP-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$', 'join code format: ' || v_code);
  perform pg_temp.check((select role from public.league_members where league_id = lg and user_id = own) = 'owner', 'owner membership');
  perform pg_temp.check(pg_temp.raises($q$select public.create_league('x')$q$), 'name too short rejected');

  -- 2. Preview is readable by a non-member; league row is not.
  perform pg_temp.login(outsider);
  perform pg_temp.check((select name from public.league_preview(v_code)) = 'Paddock Club', 'preview by code');
  perform pg_temp.check((select count(*) from public.leagues where id = lg) = 0, 'non-member cannot read the league row');

  -- 3. Fill the free league to its cap of 10, then refuse the 11th.
  perform pg_temp.logout();
  for i in 1..9 loop
    members := array_append(members, pg_temp.make_user('lg-m' || i || '@test', 'Member ' || i));
  end loop;
  for i in 1..9 loop
    perform pg_temp.login(members[i]);
    perform public.join_league(v_code);
  end loop;
  perform pg_temp.check((select count(*) from public.league_members where league_id = lg) = 10, 'ten members on free plan');
  perform pg_temp.login(late_id);
  perform pg_temp.check(pg_temp.raises_with(format($q$select public.join_league(%L)$q$, v_code), 'league is full'), '11th member refused');
  perform pg_temp.check(pg_temp.raises_with($q$select public.join_league('GP-ZZZZZ')$q$, 'invalid join code'), 'bad code refused');

  -- 4. Joining twice is idempotent.
  perform pg_temp.login(members[1]);
  perform public.join_league(v_code);
  perform pg_temp.check((select count(*) from public.league_members where league_id = lg) = 10, 'rejoin is a no-op');

  -- 5. Plan is service-role only; on pro the cap lifts.
  perform pg_temp.login(own);
  perform pg_temp.check(pg_temp.raises(format($q$update public.leagues set plan = 'pro' where id = %L$q$, lg)), 'owner cannot self-upgrade plan');
  perform pg_temp.check(pg_temp.raises(format($q$update public.profiles set plan = 'pro' where id = %L$q$, own)), 'user cannot self-upgrade profile plan');
  update public.profiles set timezone = 'Europe/Madrid' where id = own;
  perform pg_temp.check((select timezone from public.profiles where id = own) = 'Europe/Madrid', 'user still edits other profile columns');
  perform pg_temp.logout();
  update public.leagues set plan = 'pro' where id = lg;
  perform pg_temp.login(late_id);
  perform public.join_league(v_code);
  perform pg_temp.check((select count(*) from public.league_members where league_id = lg) = 11, 'pro league accepts the 11th');

  -- 6. Owner cannot leave; member can; only owner removes; owner cannot remove self.
  perform pg_temp.login(own);
  perform pg_temp.check(pg_temp.raises(format($q$select public.leave_league(%L)$q$, lg)), 'owner cannot leave');
  perform pg_temp.check(pg_temp.raises(format($q$select public.remove_league_member(%L, %L)$q$, lg, own)), 'owner cannot remove self');
  perform public.remove_league_member(lg, members[9]);
  perform pg_temp.login(members[8]);
  perform pg_temp.check(pg_temp.raises(format($q$select public.remove_league_member(%L, %L)$q$, lg, members[7])), 'member cannot remove others');
  perform public.leave_league(lg);
  perform pg_temp.logout();
  perform pg_temp.check((select count(*) from public.league_members where league_id = lg) = 9, 'after removal and leave: 9');

  -- 7. Members read co-members; outsiders read nothing.
  perform pg_temp.login(members[1]);
  perform pg_temp.check((select count(*) from public.league_members where league_id = lg) = 9, 'member sees the roster');
  perform pg_temp.login(outsider);
  perform pg_temp.check((select count(*) from public.league_members where league_id = lg) = 0, 'outsider sees no roster');
  perform pg_temp.check((select count(*) from public.leaderboard_for_league(lg)) = 0, 'outsider gets an empty board');

  -- 8. Join-date scoring: picks by owner and late joiner, result, cutoff.
  perform pg_temp.logout();
  insert into public.predictions (user_id, market_id, pick) values
    (own, m_pole, jsonb_build_object('driver_id', d1)),
    (late_id, m_pole, jsonb_build_object('driver_id', d1)),
    (adm, m_pole, jsonb_build_object('driver_id', d1));
  -- The admin joins too (service role): must never rank.
  insert into public.league_members (league_id, user_id) values (lg, adm);
  update public.markets set locks_at = now() - interval '1 minute' where id = m_pole;
  update public.markets set result = jsonb_build_object('driver_id', d1) where id = m_pole;
  -- Late joiner's membership starts after the race.
  update public.league_members set joined_at = (select race_at from public.grands_prix where id = gp) + interval '1 second'
  where league_id = lg and user_id = late_id;

  perform pg_temp.login(own);
  perform pg_temp.check((select total_points from public.leaderboard_for_league(lg) where user_id = own) = 8, 'owner scores 8 on the league board');
  perform pg_temp.check(not exists (select 1 from public.leaderboard_for_league(lg) where user_id = late_id), 'late joiner excluded by joined_at cutoff');
  perform pg_temp.check(not exists (select 1 from public.leaderboard_for_league(lg) where user_id = adm), 'admin excluded from league board');
  perform pg_temp.check((select total_points from public.v_leaderboard_overall where user_id = late_id) = 8, 'global board still counts the late joiner');

  -- 9. Owner deletes the league: memberships cascade.
  delete from public.leagues where id = lg;
  perform pg_temp.logout();
  perform pg_temp.check((select count(*) from public.league_members where league_id = lg) = 0, 'delete cascades memberships');

  -- 10. Creating a league needs an active season.
  update public.seasons set status = 'finished' where id = s;
  perform pg_temp.login(own);
  perform pg_temp.check(pg_temp.raises_with($q$select public.create_league('Late League')$q$, 'season is not active'), 'no league on a finished season');
end $$;

rollback;
\echo 'OK: leagues.sql'
