# Manual test plan

The automated suites cover the rules: `pnpm test` (unit and integration),
`pnpm test:db` (SQL invariants), `pnpm typecheck`, `biome check`. What they
cannot cover is a real browser against a real deployment — sign-in, cookies,
Realtime, crons, timezones.

Walk this list once before announcing a release, and once after any change to
auth, the lock path or the scoring path. It takes about 40 minutes.

**Setup:** the deployed URL, two email addresses you can read (one becomes an
admin, one stays a plain player), and a weekend whose sessions are close
enough that you can watch a market lock.

Record the result of every step. A failure is either fixed before release or
written down as a known issue in the release notes.

---

## 1. Sign-in and onboarding

| # | Step | Expected |
|---|---|---|
| 1.1 | Open the site signed out | Landing page renders, nav shows Calendar and Leaderboard only |
| 1.2 | Sign in with the player email | Magic-link email arrives within a minute |
| 1.3 | Open the link | Lands on onboarding, asking for a display name |
| 1.4 | Save a display name | Lands on the home page, nav now shows My picks, Leagues and Stats |
| 1.5 | Open `/admin` as this user | 403 page, and no Admin link in the nav |
| 1.6 | Sign out, then open `/admin` | Redirected to sign-in with `?next=/en/admin` |

## 2. Admin bootstrap

| # | Step | Expected |
|---|---|---|
| 2.1 | Sign in with the admin email, promote it with `supabase/seed/admin.sql` | Admin link appears after a reload |
| 2.2 | Admin → Operations → Calendar sync → Run now | Finishes; the run lands in the ledger with trigger `manual` |
| 2.3 | Open the public calendar | Every weekend of the season, with sessions and multipliers |
| 2.4 | Open one weekend | Six markets on a sprint weekend, five otherwise |

## 3. Making calls

| # | Step | Expected |
|---|---|---|
| 3.1 | As the player, submit a pick on every open market of the next weekend | Each saves, with a confirmation |
| 3.2 | Change one pick and save again | The new value sticks; the last save is what counts |
| 3.3 | Reload the page | Picks are still there, pre-selected |
| 3.4 | Open My picks | Every pick listed under its weekend |
| 3.5 | As the admin, try to submit a pick | Refused: admins do not compete |

## 4. The lock

The one thing worth waiting for. Pick a market whose session starts soon, or
move its `locks_at` backwards by hand to simulate one.

| # | Step | Expected |
|---|---|---|
| 4.1 | Watch the countdown approach zero | Reaches zero without a reload |
| 4.2 | Try to save after the lock | Refused with "this market is locked" |
| 4.3 | Reload | The market shows as locked, the form is gone |
| 4.4 | Check another player's picks for that market | Now visible: picks become public at lock |

## 5. Results and scoring

| # | Step | Expected |
|---|---|---|
| 5.1 | Admin → the weekend → enter the safety-car result | Saved; "scores recomputed" |
| 5.2 | Confirm the first-retirement suggestion | Saved with source "from the sync" |
| 5.3 | Open the public leaderboard | The player's points reflect both, with the weekend multiplier applied |
| 5.4 | Keep the leaderboard open, resolve one more market from another browser | The table updates without a reload |
| 5.5 | Change a scoring rule, then press Rescore on that weekend | Its points change; other weekends do not |
| 5.6 | Edit a multiplier | Marked locked, and points do not move until you rescore |
| 5.7 | Void a market | Its points disappear from the board |

## 6. Leagues

| # | Step | Expected |
|---|---|---|
| 6.1 | Create a league as the player | Lands on the league page with a `GP-XXXXX` code |
| 6.2 | Copy the invite link, open it signed out in another browser | Sign-in, then onboarding, then back to the invite preview |
| 6.3 | Join from that second account | Lands on the league; the roster shows both |
| 6.4 | Check the league board | Only members, each counted from the weekend they joined |
| 6.5 | As the owner, rename and then remove the other member | Both take effect without a reload |
| 6.6 | As the owner, try to leave | Refused; delete is offered instead |
| 6.7 | Fill a free league to 10 and try an 11th | "This league is full", naming the cap |
| 6.8 | Admin → Leagues → Upgrade, then retry the 11th join | Accepted |

## 7. Plans

| # | Step | Expected |
|---|---|---|
| 7.1 | Open `/stats` as a free player with scored calls | Blurred preview, the upgrade note, and their real season total |
| 7.2 | Count sponsor slots on the header, a weekend page and the leaderboard | One in each |
| 7.3 | Flip the profile to `pro` by SQL, reload | Full statistics; the numbers agree with the leaderboard |
| 7.4 | Recheck the three pages | No sponsor slot anywhere |

## 8. Languages and formats

| # | Step | Expected |
|---|---|---|
| 8.1 | Switch to Spanish from a page carrying state, e.g. `?gp=<slug>` | Same page, same state, Spanish copy |
| 8.2 | Compare a session time and a multiplier in both languages | `Thu, Sep 17, 2026` / `×1.25` against `jue, 17 sept 2026` / `×1,25` |
| 8.3 | Check session times against the real session | Rendered in your own timezone |
| 8.4 | View the page source of a public page | `<html lang>` matches, canonical points at that locale, hreflang lists both |

## 9. Small screens

Run this section at 375px wide (an iPhone SE or mini), signed in as an admin so
the panel is reachable. On every page, the body must not scroll sideways: only
a table inside its own scroll container may.

| # | Step | Expected |
|---|---|---|
| 9.1 | Open the landing page, the calendar and a weekend | No horizontal page scroll; the nav collapses into the menu button |
| 9.2 | Submit a podium pick | The three driver selects stack, each full width |
| 9.3 | Open the leaderboard | Rank, player and points visible; the rest waits for a wider screen |
| 9.4 | Open `/stats` as Pro | Four metric tiles in two columns; the market table shows accuracy and points only |
| 9.5 | Open a league page | The invite code and its buttons wrap without clipping |
| 9.6 | Admin → Grands Prix | The multiplier, its reason and Save each take the full width |
| 9.7 | Admin → Drivers | Each driver's code, number and team stack; buttons are comfortable to tap |
| 9.8 | Admin → Operations | Run now and Pause sit side by side, full width |

## 10. Operations and safety

| # | Step | Expected |
|---|---|---|
| 10.1 | Pause the results sync in Operations | Marked paused |
| 10.2 | `curl` the cron route with the bearer secret | `204` with `x-skipped: disabled` |
| 10.3 | Resume it and call again | Runs, and the ledger records it |
| 10.4 | Call a cron route with no bearer token | `401` |
| 10.5 | Open `/sitemap.xml` and `/robots.txt` | Both locales listed; no signed-in route in the sitemap |
| 10.6 | Open an unknown URL, e.g. `/en/gp/not-a-race` | The 404 page, translated |

---

## Recording a run

Copy the table headings into the release notes with a date, the deployed
commit, and one line per failure: what broke, whether it was fixed, and the
commit or issue that covers it.
