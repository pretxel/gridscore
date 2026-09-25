-- Lock reminders: preference privacy and who reminder_candidates() selects.
begin;
\ir lib/helpers.sql

do $$
declare
  s uuid := pg_temp.make_season(2094);
  -- Race in 3 days: qualifying-locked markets lock in ~2 days 4 hours.
  gp uuid := pg_temp.make_gp(s, 1, false, 1, now() + interval '3 days');
  u1 uuid := pg_temp.make_user('rem-u1@test', 'Rem One');
  u2 uuid := pg_temp.make_user('rem-u2@test', 'Rem Two');
  u_off uuid := pg_temp.make_user('rem-off@test', 'Rem Off');
  u_2h uuid := pg_temp.make_user('rem-2h@test', 'Rem Two Hours');
  adm uuid := pg_temp.make_user('rem-admin@test', 'Rem Admin', true);
  pole uuid;
  podium uuid;
  n int;
begin
  perform pg_temp.use_season('2094');
  -- Other seeded seasons must not leak in: only this one is active here.
  update public.seasons set status = 'finished' where id <> s and status = 'active';
  pole := pg_temp.market(gp, 'pole');
  podium := pg_temp.market(gp, 'podium');
  -- Pole locks in 20 hours, the podium in 3 hours.
  update public.markets set locks_at = now() + interval '20 hours' where id = pole;
  update public.markets set locks_at = now() + interval '3 hours' where id = podium;
  update public.markets set locks_at = now() + interval '3 days'
  where grand_prix_id = gp and id not in (pole, podium);

  -- Preferences: default is 24h (no row).
  insert into public.reminder_preferences (user_id, lead_time) values (u_off, 'off'), (u_2h, '2h');

  -- Own row only.
  perform pg_temp.login(u1);
  insert into public.reminder_preferences (user_id, lead_time, locale) values (u1, '24h', 'es');
  update public.reminder_preferences set lead_time = '2h' where user_id = u1;
  perform pg_temp.check((select lead_time from public.reminder_preferences where user_id = u1) = '2h',
    'player updates own preference');
  update public.reminder_preferences set lead_time = '24h' where user_id = u1;
  perform pg_temp.check((select count(*) from public.reminder_preferences) = 1,
    'player sees only their own preference');
  update public.reminder_preferences set lead_time = 'off' where user_id = u_2h;
  perform pg_temp.check(pg_temp.raises(format(
    'insert into public.reminder_preferences (user_id, lead_time) values (%L, %L)', u2, 'off')),
    'cannot create another player''s preference');
  perform pg_temp.logout();
  perform pg_temp.check((select lead_time from public.reminder_preferences where user_id = u_2h) = '2h',
    'another player''s preference is unchanged');
  perform pg_temp.check(pg_temp.raises(format(
    'insert into public.reminder_preferences (user_id, lead_time) values (%L, %L)', u2, 'soon')),
    'unknown lead time rejected');

  -- u1 (24h) is due pole and podium; calling pole removes it.
  insert into public.predictions (user_id, market_id, pick)
  values (u1, pole, jsonb_build_object('driver_id', pg_temp.driver(s, 'd1')));
  select count(*) into n from public.reminder_candidates() c where c.user_id = u1;
  perform pg_temp.check(n = 1, 'called market excluded (u1 has only the podium)');
  perform pg_temp.check(
    (select locale from public.reminder_candidates() c where c.user_id = u1 limit 1) = 'es',
    'candidate carries the player locale');

  -- u2 (default 24h) gets both.
  select count(*) into n from public.reminder_candidates() c where c.user_id = u2;
  perform pg_temp.check(n = 2, 'default lead of 24h covers both markets');

  -- u_2h gets only the market locking within 2h... none: podium locks in 3h.
  select count(*) into n from public.reminder_candidates() c where c.user_id = u_2h;
  perform pg_temp.check(n = 0, '2h lead excludes a market 3 hours out');
  select count(*) into n from public.reminder_candidates(now() + interval '90 minutes') c where c.user_id = u_2h;
  perform pg_temp.check(n = 1, '2h lead includes it once it is inside the window');

  -- Off and admin never.
  perform pg_temp.check(not exists (select 1 from public.reminder_candidates() c where c.user_id = u_off),
    'preference off excluded');
  perform pg_temp.check(not exists (select 1 from public.reminder_candidates() c where c.user_id = adm),
    'admin excluded');

  -- Already reminded.
  insert into public.reminder_sends (user_id, market_id) values (u2, podium);
  select count(*) into n from public.reminder_candidates() c where c.user_id = u2;
  perform pg_temp.check(n = 1, 'reminded market excluded');

  -- Locked or past markets never.
  update public.markets set status = 'locked' where id = pole;
  perform pg_temp.check(not exists (select 1 from public.reminder_candidates() c where c.market_id = pole),
    'locked market excluded');

  -- Checked as a privilege, not by calling it as `authenticated`: a denied
  -- call inside pg_temp.raises() after the role switch segfaults Postgres
  -- 17.6 in this harness. Through PostgREST it is a clean 42501.
  perform pg_temp.check(
    not has_function_privilege('authenticated', 'public.reminder_candidates(timestamptz)', 'execute')
    and not has_function_privilege('anon', 'public.reminder_candidates(timestamptz)', 'execute'),
    'players cannot call reminder_candidates');

  -- The new operations kind is accepted and seeded off.
  perform pg_temp.check((select enabled from public.operation_settings where kind = 'send_reminders') = false,
    'send_reminders seeded disabled');
end $$;

rollback;
