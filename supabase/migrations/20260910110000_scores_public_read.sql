-- ===========================================================================
-- Scores are public once results land (the leaderboard view already is), so
-- anonymous visitors may read them too. This also lets Realtime deliver
-- score changes to every leaderboard viewer, signed in or not.
-- ===========================================================================

drop policy if exists "scores_select_authenticated" on public.scores;

create policy "scores_select_public"
  on public.scores for select
  to anon, authenticated
  using (true);
