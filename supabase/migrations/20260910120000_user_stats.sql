-- ===========================================================================
-- gridscore — per-user statistics (premium hook)
-- ---------------------------------------------------------------------------
-- Two read-only functions behind the /stats page. Both are scoped to the
-- active season and to the caller: a user reads their own numbers, an admin
-- reads anyone's. Aggregating in SQL keeps the page to two round trips and
-- lets the season scope live next to the leaderboards it mirrors.
--
-- No plan check here. The plan gate is a product decision and lives in the
-- app (lib/plans.ts); the database only decides who may read whose rows.
-- ===========================================================================

-- Caller may read p_user_id's rows.
create or replace function public.can_read_user_stats(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (auth.uid() = p_user_id or public.is_admin());
$$;

-- Accuracy per market type: how many of the user's calls were scored in the
-- active season, how many hit, and what they paid.
create or replace function public.user_market_stats(p_user_id uuid)
returns table (
  market_type text,
  scored int,
  hits int,
  points int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.type as market_type,
    count(*)::int as scored,
    count(*) filter (where s.hit_type <> 'miss')::int as hits,
    coalesce(sum(s.points), 0)::int as points
  from public.scores s
  join public.markets m on m.id = s.market_id
  join public.grands_prix g on g.id = m.grand_prix_id
  where s.user_id = p_user_id
    and g.season_id = public.active_season_id()
    and public.can_read_user_stats(p_user_id)
  group by m.type;
$$;

-- One row per Grand Prix the user was scored in, oldest first. Feeds the
-- streak and the comparison against the field.
create or replace function public.user_weekend_points(p_user_id uuid)
returns table (
  grand_prix_id uuid,
  round int,
  name text,
  points int,
  scored int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id as grand_prix_id,
    g.round,
    g.name,
    coalesce(sum(s.points), 0)::int as points,
    count(*)::int as scored
  from public.scores s
  join public.markets m on m.id = s.market_id
  join public.grands_prix g on g.id = m.grand_prix_id
  where s.user_id = p_user_id
    and g.season_id = public.active_season_id()
    and public.can_read_user_stats(p_user_id)
  group by g.id, g.round, g.name
  order by g.round;
$$;

-- The field's average total for the active season, so a user can see where
-- they sit. Admins are already excluded from the leaderboard view.
create or replace function public.season_average_points()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(avg(total_points), 0)::numeric
  from public.v_leaderboard_overall;
$$;

grant execute on function public.can_read_user_stats(uuid) to authenticated;
grant execute on function public.user_market_stats(uuid) to authenticated;
grant execute on function public.user_weekend_points(uuid) to authenticated;
grant execute on function public.season_average_points() to anon, authenticated;
