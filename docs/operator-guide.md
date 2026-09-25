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
   | `RESEND_API_KEY` | Resend → API Keys (sending access is enough) |
   | `REMINDER_FROM_EMAIL` | the reminder sender on your verified domain, e.g. `gridscore <reminders@YOUR-DOMAIN>` |
   | `REMINDER_SIGNING_SECRET` | any long random string; signs the opt-out links in reminder emails. Changing it breaks the links in emails already sent |

5. **Point Supabase Auth at the deployment.** A fresh project allows only
   `http://localhost:3000`, so a magic link sends production readers to
   localhost until this is set. Push it from the repo rather than clicking
   through the dashboard — `supabase/config.toml` resolves these with
   `env(...)`:

   ```bash
   SUPABASE_AUTH_SITE_URL="https://YOUR-DOMAIN" \
   SUPABASE_AUTH_CALLBACK_URL="https://YOUR-DOMAIN/auth/callback" \
   SUPABASE_AUTH_PREVIEW_CALLBACK_URL="https://<project>-<team>.vercel.app/auth/callback" \
   SUPABASE_AUTH_EMAIL_MAX_FREQUENCY="60s" \
   supabase config push
   ```

   Re-run it to verify: a clean push prints "Remote Auth config is up to date".

6. **Set up a custom SMTP sender.** Supabase's built-in email service is
   rate-limited to a handful of messages per hour and is not meant for
   production. It also refuses custom templates on the free tier, which is why
   the branded emails in `supabase/templates/` are wired up in `config.toml`
   but commented out. Once SMTP is configured, uncomment those blocks and push
   the config again. The set covers the magic link the app sends today plus
   sign-up confirmation, invite, email change and reauthentication, so no flow
   falls back to Supabase's unstyled default.
7. **Set up lock reminders** (optional; the job stays off until you do).
   Reminder emails go through Resend, not Supabase SMTP, which is kept for
   sign-in links.
   - In Resend, add your sending domain and create the SPF, DKIM and DMARC
     records it lists. Mail from an unverified domain is refused.
   - Set the three reminder variables above in Vercel.
   - The job runs **hourly**, which the Vercel Hobby plan cannot do, so
     Supabase triggers it: the `lock_reminders` migration schedules
     `pg_cron` to call `/api/cron/send-reminders` through `pg_net`. Give it
     the URL and the bearer in the SQL editor:

     ```sql
     select vault.create_secret('https://YOUR-DOMAIN/api/cron/send-reminders', 'reminders_cron_url');
     select vault.create_secret('<the same value as CRON_SECRET>', 'cron_secret');
     ```

     Until both exist the hourly call does nothing.
   - After deploying, send yourself one: Admin → Operations → Lock reminders
     → **Run now** (with a market of yours due inside 24 hours), then
     **Resume** to switch the schedule on. It ships paused.
8. **Deploy**, then **sign in once** with the email that will own the site.
   That creates the `auth.users` row.
9. **Promote yourself.** Edit `supabase/seed/admin.sql` with that email and run
   it. The "Admin" link then appears in the nav.
10. **Import the season.** Admin → Operations → Calendar sync → **Run now**.
   Teams, drivers and the calendar land, and the database trigger creates the
   markets for every weekend.

---

## 2. The weekly rhythm

Most weekends need nothing from you. Three jobs carry the load:

| job | when | what it does |
|---|---|---|
| Calendar sync | daily 06:00 UTC | refreshes teams, drivers, sessions, multipliers |
| Results sync | daily 03:00 UTC | locks due markets, resolves what the timing data can settle |
| Lock reminders | hourly, via Supabase `pg_cron` | emails each player the markets they have not called that lock within their lead time (24 h by default, 2 h, or off) |

A player is reminded about a market once at most; `reminder_sends` records it
after Resend accepts the email, so a failed send is retried the next hour.
Players change the lead time in Settings, or turn reminders off from the link
in every email.

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
quiet week), `no-active-season`, or `missing-env` (`CRON_SECRET`, the
provider, or for reminders `RESEND_API_KEY` / `REMINDER_FROM_EMAIL` /
`REMINDER_SIGNING_SECRET` is not configured).

**Reminders stopped.** Operations shows the last `Lock reminders` run. No new
runs means `pg_cron` is not reaching the app: check the Vault secrets and
`select * from cron.job_run_details order by start_time desc limit 5;`. Runs
reported `partial` mean Resend refused some sends; the run's summary counts
them and the Vercel log has the reason (usually the sending domain). To stop
all reminder mail at once, **Pause** the job in Operations.

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
