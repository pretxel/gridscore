import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  enabled: true,
  mailerAvailable: true,
  signingSecret: "sign" as string | null,
  runs: [] as { kind: string; trigger: string }[],
}));

vi.mock("@/lib/env", () => ({
  env: {
    siteUrl: "http://localhost:3000",
    cronSecret: "test-secret",
    get reminderSigningSecret() {
      return state.signingSecret;
    },
  },
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: () => ({}) }));
vi.mock("@/lib/operations/settings", () => ({ isOperationEnabled: async () => state.enabled }));
vi.mock("@/lib/email/resend", () => ({
  resendMailer: () => ({ available: () => state.mailerAvailable, send: vi.fn() }),
}));
vi.mock("@/lib/reminders/store", () => ({ createSupabaseReminderStore: () => ({}) }));
vi.mock("@/lib/reminders/run", () => ({
  runReminders: async () => ({ players: 1, sent: 1, markets: 2, failed: 0, errors: 0 }),
}));
vi.mock("@/lib/operations/record-run", () => ({
  recordRun: async (kind: string, trigger: string, fn: () => Promise<unknown>) => {
    state.runs.push({ kind, trigger });
    return { summary: await fn() };
  },
}));

const req = (headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/cron/send-reminders", { headers });
const auth = { authorization: "Bearer test-secret" };

describe("send-reminders route", () => {
  beforeEach(() => {
    state.enabled = true;
    state.mailerAvailable = true;
    state.signingSecret = "sign";
    state.runs.length = 0;
  });

  it("refuses a call without the cron secret and sends nothing", async () => {
    const { GET } = await import("@/app/api/cron/send-reminders/route");
    expect((await GET(req())).status).toBe(401);
    expect(state.runs).toEqual([]);
  });

  it("skips while the job is disabled", async () => {
    state.enabled = false;
    const { GET } = await import("@/app/api/cron/send-reminders/route");
    const res = await GET(req(auth));
    expect(res.headers.get("x-skipped")).toBe("disabled");
    expect(state.runs).toEqual([]);
  });

  it("skips without Resend or the signing secret", async () => {
    const { GET } = await import("@/app/api/cron/send-reminders/route");
    state.mailerAvailable = false;
    expect((await GET(req(auth))).headers.get("x-skipped")).toBe("missing-env");
    state.mailerAvailable = true;
    state.signingSecret = null;
    expect((await GET(req(auth))).headers.get("x-skipped")).toBe("missing-env");
    expect(state.runs).toEqual([]);
  });

  it("runs, records the run and returns the summary", async () => {
    const { GET } = await import("@/app/api/cron/send-reminders/route");
    const res = await GET(req(auth));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ sent: 1, markets: 2 });
    expect(state.runs).toEqual([{ kind: "send_reminders", trigger: "cron" }]);
  });
});
