-- Prediction lock: RLS for user JWTs and the BEFORE trigger for everyone.
begin;
\ir lib/helpers.sql

do $$
declare
  s uuid := pg_temp.make_season(2091);
  gp uuid := pg_temp.make_gp(s, 1);
  u1 uuid := pg_temp.make_user('lock-u1@test', 'Lock One');
  u2 uuid := pg_temp.make_user('lock-u2@test', 'Lock Two');
  adm uuid := pg_temp.make_user('lock-adm@test', 'Lock Admin', true);
  m_pole uuid := pg_temp.market(gp, 'pole');
  m_sc uuid := pg_temp.market(gp, 'safety_car');
  d1 uuid := pg_temp.driver(s, 'd1');
  d2 uuid := pg_temp.driver(s, 'd2');
  v_n int;
begin
  perform pg_temp.use_season('2091');

  -- 1. A signed-in user can insert and update while the market is open.
  perform pg_temp.login(u1);
  insert into public.predictions (user_id, market_id, pick)
  values (u1, m_pole, jsonb_build_object('driver_id', d1));
  update public.predictions set pick = jsonb_build_object('driver_id', d2)
  where user_id = u1 and market_id = m_pole;
  perform pg_temp.check((select pick ->> 'driver_id' from public.predictions where user_id = u1 and market_id = m_pole) = d2::text,
    'open market: update applied');

  -- 2. A user cannot write a pick for someone else.
  perform pg_temp.check(pg_temp.raises(format(
    $q$insert into public.predictions (user_id, market_id, pick) values (%L, %L, '{"value": true}')$q$, u2, m_sc)),
    'cannot insert a pick for another user');

  -- 3. Before lock, another user cannot see u1's pick; admins can.
  perform pg_temp.login(u2);
  perform pg_temp.check((select count(*) from public.predictions where market_id = m_pole) = 0,
    'other users cannot read picks before lock');
  perform pg_temp.login(adm);
  perform pg_temp.check((select count(*) from public.predictions where market_id = m_pole) = 1,
    'admins can read every pick');

  -- 4. Admins are operators: RLS refuses their picks even on an open market.
  perform pg_temp.check(pg_temp.raises(format(
    $q$insert into public.predictions (user_id, market_id, pick) values (%L, %L, '{"value": true}')$q$, adm, m_sc)),
    'admin cannot submit a pick');

  -- 5. Move the pole market into the past (service role).
  perform pg_temp.logout();
  update public.markets set locks_at = now() - interval '1 second' where id = m_pole;

  -- 5a. RLS: insert on a locked market is refused for a user JWT.
  perform pg_temp.login(u2);
  perform pg_temp.check(pg_temp.raises(format(
    $q$insert into public.predictions (user_id, market_id, pick) values (%L, %L, %L)$q$,
    u2, m_pole, jsonb_build_object('driver_id', d1))),
    'RLS refuses insert after locks_at');

  -- 5b. RLS: upsert of an existing pick on a locked market is refused.
  perform pg_temp.login(u1);
  perform pg_temp.check(pg_temp.raises(format(
    $q$insert into public.predictions (user_id, market_id, pick) values (%L, %L, %L)
       on conflict (user_id, market_id) do update set pick = excluded.pick$q$,
    u1, m_pole, jsonb_build_object('driver_id', d1))),
    'RLS refuses upsert after locks_at');
  -- A plain UPDATE is filtered to zero rows by RLS (no error), so the pick is unchanged.
  update public.predictions set pick = jsonb_build_object('driver_id', d1) where user_id = u1 and market_id = m_pole;
  perform pg_temp.check((select pick ->> 'driver_id' from public.predictions where user_id = u1 and market_id = m_pole) = d2::text,
    'RLS-filtered update leaves the pick unchanged');

  -- 5c. Trigger: even the service role cannot write after locks_at.
  perform pg_temp.logout();
  perform pg_temp.check(pg_temp.raises_with(format(
    $q$update public.predictions set pick = %L where user_id = %L and market_id = %L$q$,
    jsonb_build_object('driver_id', d1), u1, m_pole), 'prediction locked'),
    'trigger blocks service-role update after locks_at');
  perform pg_temp.check(pg_temp.raises_with(format(
    $q$insert into public.predictions (user_id, market_id, pick) values (%L, %L, %L)$q$,
    u2, m_pole, jsonb_build_object('driver_id', d1)), 'prediction locked'),
    'trigger blocks service-role insert after locks_at');

  -- 5d. A stale `open` status cannot unlock: locks_at alone decides.
  perform pg_temp.check((select status from public.markets where id = m_pole) = 'open', 'status still open (stale)');
  perform pg_temp.check(pg_temp.raises_with(format(
    $q$insert into public.predictions (user_id, market_id, pick) values (%L, %L, %L)$q$,
    u2, m_pole, jsonb_build_object('driver_id', d1)), 'prediction locked'),
    'stale open status does not unlock');

  -- 6. After lock, every signed-in user can read the picks.
  perform pg_temp.login(u2);
  perform pg_temp.check((select count(*) from public.predictions where market_id = m_pole) = 1,
    'picks are public after lock');
  perform pg_temp.logout();

  -- 7. A market with status locked/void refuses writes even if locks_at is ahead.
  update public.markets set status = 'void' where id = m_sc;
  perform pg_temp.login(u1);
  perform pg_temp.check(pg_temp.raises(format(
    $q$insert into public.predictions (user_id, market_id, pick) values (%L, %L, '{"value": false}')$q$, u1, m_sc)),
    'void market refuses picks');
  perform pg_temp.logout();

  -- 8. lock_due_markets flips only the due, still-open markets.
  select public.lock_due_markets() into v_n;
  perform pg_temp.check(v_n = 1, 'lock_due_markets locked exactly one market, got ' || v_n);
  perform pg_temp.check((select status from public.markets where id = m_pole) = 'locked', 'pole market now locked');
  perform pg_temp.check((select status from public.markets where id = pg_temp.market(gp, 'podium')) = 'open', 'podium still open');
end $$;

rollback;
\echo 'OK: lock.sql'
