import type { Mailer } from "@/lib/email/mailer";
import { isLocale, localePath } from "@/lib/i18n";
import type { MarketType } from "@/lib/markets";
import { type ReminderMarket, renderReminderEmail } from "./email";
import { signOptOutToken } from "./token";

// The hourly reminder job, free of Next and Supabase so it can be tested with
// a fake store and mailer. One email per player per run, listing every market
// they are due a reminder for. A market is recorded as reminded only after the
// provider accepts the email, so a failed send is retried by the next run
// while the market is still open.

export type ReminderCandidate = {
  user_id: string;
  email: string;
  locale: string | null;
  timezone: string | null;
  market_id: string;
  market_type: string;
  locks_at: string;
  grand_prix_slug: string;
  grand_prix_name: string;
};

export interface ReminderStore {
  candidates(now: Date): Promise<ReminderCandidate[]>;
  recordSent(userId: string, marketIds: string[]): Promise<void>;
}

export type ReminderSummary = {
  players: number;
  sent: number;
  markets: number;
  failed: number;
  errors: number;
};

export async function runReminders({
  store,
  mailer,
  siteUrl,
  signingSecret,
  now = new Date(),
  // Resend's default rate limit is a couple of requests a second.
  pauseMs = 600,
}: {
  store: ReminderStore;
  mailer: Mailer;
  siteUrl: string;
  signingSecret: string;
  now?: Date;
  pauseMs?: number;
}): Promise<ReminderSummary> {
  const rows = await store.candidates(now);
  const byPlayer = new Map<string, ReminderCandidate[]>();
  for (const row of rows) {
    const list = byPlayer.get(row.user_id) ?? [];
    list.push(row);
    byPlayer.set(row.user_id, list);
  }

  const summary: ReminderSummary = {
    players: byPlayer.size,
    sent: 0,
    markets: 0,
    failed: 0,
    errors: 0,
  };
  const base = siteUrl.replace(/\/$/, "");
  let first = true;

  for (const [userId, list] of byPlayer) {
    if (!first && pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs));
    first = false;

    const { email, locale, timezone } = list[0];
    const pathLocale = locale && isLocale(locale) ? locale : "en";
    const token = signOptOutToken(userId, signingSecret);
    const message = renderReminderEmail({
      to: email,
      locale,
      timezone,
      siteUrl: base,
      optOutUrl: `${base}${localePath(pathLocale, "/reminders/off")}?t=${encodeURIComponent(token)}`,
      oneClickUrl: `${base}/api/reminders/off?l=${pathLocale}&t=${encodeURIComponent(token)}`,
      markets: list.map(
        (row): ReminderMarket => ({
          type: row.market_type as MarketType,
          locksAt: row.locks_at,
          grandPrixSlug: row.grand_prix_slug,
          grandPrixName: row.grand_prix_name,
        }),
      ),
    });

    const result = await mailer.send(message);
    if (!result.ok) {
      console.error(`[reminders] send failed for ${userId}: ${result.error}`);
      summary.failed++;
      continue;
    }
    summary.sent++;
    summary.markets += list.length;
    try {
      await store.recordSent(
        userId,
        list.map((row) => row.market_id),
      );
    } catch (err) {
      // The email went out; the next run may repeat it. Better than a miss.
      console.error(`[reminders] could not record sends for ${userId}:`, err);
      summary.errors++;
    }
  }
  return summary;
}
