-- ===========================================================================
-- Season 2026 + default scoring rules
-- ---------------------------------------------------------------------------
-- Idempotent. Safe to run on a fresh project and again after edits (rules are
-- only inserted when missing, so admin edits survive a re-run).
-- ===========================================================================

-- `name` is rendered inside translated sentences ("Points per market in
-- {season}"), so it stays a bare year: any wording here would be English in
-- the Spanish UI and vice versa.
insert into public.seasons (year, slug, name, status, providers)
values (2026, '2026', '2026', 'active', '{"jolpica": {"season": "2026"}}'::jsonb)
on conflict (year) do nothing;

insert into public.scoring_rules (season_id, market_type, rule_key, points)
select s.id, r.market_type, r.rule_key, r.points
from public.seasons s
cross join (
  values
    ('podium', 'exact_position', 10),
    ('podium', 'in_podium', 4),
    ('podium', 'all_exact_bonus', 25),
    ('pole', 'exact', 8),
    ('fastest_lap', 'exact', 6),
    ('first_retirement', 'exact', 6),
    ('safety_car', 'exact', 3),
    ('sprint_winner', 'exact', 6)
) as r(market_type, rule_key, points)
where s.year = 2026
on conflict (season_id, market_type, rule_key) do nothing;
