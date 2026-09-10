# Operator guide

Running gridscore in production: standing an environment up, the weekly rhythm
of a race season, and what to do when something goes wrong.

Everything here assumes you are an admin (`profiles.is_admin = true`). The
admin panel lives at `/admin` and is the intended path for all of it; the SQL
snippets are the fallback when the panel cannot help, and every one of them
needs the **service-role** connection (the Supabase SQL editor, or `psql` with
the connection string from the dashboard).

---

## 1. Stand up an environment

1. **Create the Supabase project** (or `supabase projects create`). Note the
   project ref and the database password.
2. **Apply the schema.**
   ```bash
   supabase link --project-ref <REF>
   supabase db push
   ```
3. **Seed the season and its scoring rules.** Run
   `supabase/seed/season-2026.sql` in the SQL editor. It is idempotent: rules
   are only inserted when missing, so a re-run never overwrites an edit you
   made in the admin panel.

   Keep `seasons.name` locale-neutral (a bare year). It is interpolated into
   translated sentences, so "2026 season" would read as English inside the
   Spanish UI.
4. **Set the environment variables** in Vercel, for Production *and* Preview:

   | variable | where it comes from |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page, `anon` key |
   | `SUPABASE_SERVICE_ROLE_KEY` | same page, `service_role` key — server only, never expose it |
   | `NEXT_PUBLIC_SITE_URL` | your production origin, e.g. `https://gridscore.example` |
   | `CRON_SECRET` | any long random string; Vercel sends it on every cron call |
   | `JOLPICA_BASE_URL` | optional override of the race data endpoint |

5. **Point Supabase Auth at the deployment.** Authentication → URL
   Configuration: site URL is your production origin; additional redirect URLs
   must include `https://YOUR-DOMAIN/auth/callback` and the preview pattern
   `https://<project>-*-<team>.vercel.app/auth/callback`. Sign-in fails
   silently for anyone on a URL that is not listed.
6. **Deploy**, then **sign in once** with the email that will own the site.
   That creates the `auth.users` row.
7. **Promote yourself.** Edit `supabase/seed/admin.sql` with that email and run
   it. The "Admin" link then appears in the nav.
8. **Import the season.** Admin → Operations → Calendar sync → **Run now**.
   Teams, drivers and the calendar land, and the database trigger creates the
   markets for every weekend.

---

## 2. The weekly rhythm

Most weekends need nothing from you. The two crons carry the load:

| job | when | what it does |
|---|---|---|
| Calendar sync | daily 06:00 UTC | refreshes teams, drivers, sessions, multipliers |
| Results sync | daily 03:00 UTC | locks due markets, resolves what the timing data can settle |

On the Vercel Hobby plan each cron may run once a day. On a paid plan, set
results sync back to hourly in `vercel.json` **and** in
`lib/operations/schedule.ts` so the "next run" the panel shows stays honest.

**What the sync cannot settle, and you must:**

- **Safety car.** Never in the provider data. Admin → Grands Prix → the
  weekend → Safety car → Yes/No → Save result.
- **First retirement.** The sync proposes the retired car with the fewest laps
  and leaves it as a suggestion; a tie yields no suggestion at all. Press
  **Confirm suggestion**, or pick a driver by hand.

Saving a result resolves the market and rescores it immediately. The public
leaderboard moves on its own over Realtime.

**Corrections.** A resolved market is immutable to the sync, so a wrong result
stays wrong until you fix it: open the weekend, either save the right result
or press **Reopen** (which clears the result and its points) and start again.
**Void** is for a session that never ran — it removes the points without
pretending there was an outcome.

---

## 3. Multipliers and scoring rules

Both are data, both are editable, and **neither rescores anything by itself.**

- A hand-set multiplier is **locked** (`multiplier_locked`), so the next
  calendar sync leaves it alone. Press **Unlock** to hand it back to the sync.
- After changing a multiplier or a scoring rule, press **Rescore** on each
  Grand Prix whose points should change. Weekends you do not rescore keep the
  points they were awarded — that is deliberate, so a mid-season correction
  never silently rewrites history.

---

## 4. Plans

`profiles.plan` and `leagues.plan` are `free | pro` and only the service role
can write them. There is no checkout.

- **A league:** Admin → Leagues → Upgrade. Pro lifts the 10-member cap.
- **A person:** SQL only.
  ```sql
  update public.profiles
     set plan = 'pro'
   where id = (select id from auth.users where email = 'reader@example.com');
  ```
  Pro unlocks `/stats` and hides every sponsor slot. What each plan grants is
  listed once, in `PLAN_FEATURES` in `lib/plans.ts`.

---

## 5. Monitoring

The Operations page shows the last 20 runs per job with their summary, and the
next scheduled run. Start there. These queries answer what it cannot:

**Is anything waiting on me right now?**
```sql
select g.round, g.name, m.type, m.status, m.suggested_result is not null as suggested
  from public.markets m
  join public.grands_prix g on g.id = m.grand_prix_id
 where g.season_id = public.active_season_id()
   and m.status in ('open', 'locked')
   and g.race_at < now()
 order by g.round, m.type;
```

**Did the syncs run clean?**
```sql
select kind, trigger, status, started_at, duration_ms, error, summary
  from public.operation_runs
 order by started_at desc
 limit 20;
```

**Is a job paused?** An absent row means enabled.
```sql
select kind, enabled, updated_at from public.operation_settings;
```

**How many people are playing?**
```sql
select count(*) filter (where display_name is not null) as onboarded,
       count(*) filter (where plan = 'pro')             as pro,
       count(*) filter (where is_admin)                 as admins
  from public.profiles;
```

**Trigger a job by hand without the panel** (`?force=1` skips the results
sync's "nothing due" self-skip):
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://YOUR-DOMAIN/api/cron/sync-results?force=1"
```

---

## 6. When something goes wrong

**Nobody can sign in.** Check Supabase Auth → URL Configuration first: a
missing `/auth/callback` entry is the usual cause, and it fails without an
error the visitor can see.

**The calendar is empty.** No season is `active`, or the calendar sync has
never run. Check `select year, slug, status from public.seasons;` then run the
job from Operations.

**A cron returns 204.** That is a deliberate skip, and the `x-skipped` header
says which: `disabled` (paused in Operations), `nothing-due` (results sync on a
quiet week), `no-active-season`, or `missing-env` (`CRON_SECRET` or the
provider is not configured).

**A player says their pick vanished.** Picks are refused after `locks_at` by
both an RLS policy and a database trigger, so a late save never lands. Confirm
with:
```sql
select m.type, m.locks_at, p.submitted_at, p.pick
  from public.predictions p
  join public.markets m on m.id = p.market_id
 where p.user_id = '<uuid>'
 order by p.submitted_at desc
 limit 20;
```

**Points look wrong.** The scorer runs in the database, and
`tests/scoring-cases.ts` is mirrored into SQL so both agree. Check the market's
`result` and the weekend's `multiplier` first; then rescore the Grand Prix.

**The provider is down or rate-limiting.** Pause the job in Operations so the
schedule stops retrying, enter results by hand, and resume when it recovers.

---

## 7. Off-season

- Seed the next season with its own `seasons` row and scoring rules.
- Set the old season to `finished` and the new one to `active`. Everything
  season-scoped follows `active_season_id()`.
- To prepare a season before making it active, use the season switcher on
  Admin → Grands Prix. It points the whole panel at another season through a
  cookie, without changing what visitors see.
