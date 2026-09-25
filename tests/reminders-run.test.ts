import { describe, expect, it } from "vitest";
import type { EmailMessage, Mailer } from "@/lib/email/mailer";
import { type ReminderCandidate, type ReminderStore, runReminders } from "@/lib/reminders/run";
import { verifyOptOutToken } from "@/lib/reminders/token";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

function row(
  user: string,
  market: string,
  over: Partial<ReminderCandidate> = {},
): ReminderCandidate {
  return {
    user_id: user,
    email: `${user.slice(0, 4)}@example.test`,
    locale: "en",
    timezone: null,
    market_id: market,
    market_type: "pole",
    locks_at: "2026-09-26T14:00:00Z",
    grand_prix_slug: "italy",
    grand_prix_name: "Italian Grand Prix",
    ...over,
  };
}

// A store that behaves like reminder_candidates(): a recorded market drops out.
function fakeStore(rows: ReminderCandidate[]) {
  const sent = new Set<string>();
  const store: ReminderStore & { sent: Set<string> } = {
    sent,
    async candidates() {
      return rows.filter((r) => !sent.has(`${r.user_id}:${r.market_id}`));
    },
    async recordSent(userId, marketIds) {
      for (const id of marketIds) sent.add(`${userId}:${id}`);
    },
  };
  return store;
}

function fakeMailer(fail: (m: EmailMessage) => boolean = () => false) {
  const outbox: EmailMessage[] = [];
  const mailer: Mailer & { outbox: EmailMessage[] } = {
    outbox,
    available: () => true,
    async send(message) {
      if (fail(message)) return { ok: false, error: "rejected" };
      outbox.push(message);
      return { ok: true, id: `id-${outbox.length}` };
    },
  };
  return mailer;
}

const opts = { siteUrl: "https://gridscore.example", signingSecret: "s", pauseMs: 0 };

describe("runReminders", () => {
  it("sends one email per player listing every due market", async () => {
    const store = fakeStore([
      row(U1, "m-pole"),
      row(U1, "m-podium", { market_type: "podium" }),
      row(U2, "m-pole"),
    ]);
    const mailer = fakeMailer();
    const summary = await runReminders({ store, mailer, ...opts });
    expect(summary).toEqual({ players: 2, sent: 2, markets: 3, failed: 0, errors: 0 });
    const first = mailer.outbox.find((m) => m.to.startsWith("1111"));
    expect(first?.text).toContain("Pole position");
    expect(first?.text).toContain("Podium");
  });

  it("sends nothing when no player is due", async () => {
    const mailer = fakeMailer();
    const summary = await runReminders({ store: fakeStore([]), mailer, ...opts });
    expect(summary.sent).toBe(0);
    expect(mailer.outbox).toEqual([]);
  });

  it("never mails the same market twice across runs", async () => {
    const store = fakeStore([row(U1, "m-pole")]);
    const mailer = fakeMailer();
    await runReminders({ store, mailer, ...opts });
    await runReminders({ store, mailer, ...opts });
    expect(mailer.outbox).toHaveLength(1);
  });

  it("records nothing when the provider rejects, so the next run retries", async () => {
    const store = fakeStore([row(U1, "m-pole")]);
    let reject = true;
    const mailer = fakeMailer(() => reject);
    const failed = await runReminders({ store, mailer, ...opts });
    expect(failed).toMatchObject({ sent: 0, failed: 1 });
    expect(store.sent.size).toBe(0);
    reject = false;
    const retried = await runReminders({ store, mailer, ...opts });
    expect(retried).toMatchObject({ sent: 1, failed: 0 });
  });

  it("links a working opt-out for the player in their locale", async () => {
    const mailer = fakeMailer();
    await runReminders({ store: fakeStore([row(U1, "m", { locale: "es" })]), mailer, ...opts });
    const oneClick = new URL(mailer.outbox[0].headers?.["List-Unsubscribe"].slice(1, -1) ?? "");
    expect(oneClick.pathname).toBe("/api/reminders/off");
    expect(oneClick.searchParams.get("l")).toBe("es");
    expect(verifyOptOutToken(oneClick.searchParams.get("t") ?? "", "s")).toBe(U1);
    const page = mailer.outbox[0].text.match(/https:\/\/\S+\/es\/reminders\/off\?t=\S+/)?.[0];
    expect(page).toBeDefined();
  });
});
