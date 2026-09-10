import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAdmin } from "./helpers/fake-admin";

const CRON_SECRET = "test-secret";

const state = vi.hoisted(() => ({
  admin: null as ReturnType<typeof import("./helpers/fake-admin").fakeAdmin> | null,
  enabled: true,
  season: { id: "season-1", year: 2026, slug: "2026", status: "active" } as unknown,
  calendarSummary: { provider: "jolpica", grandsPrix: 23, errors: 0 },
  resultsSummary: { provider: "jolpica", resolved: 2, errors: 0 },
  runs: [] as { kind: string; trigger: string; status: string }[],
}));

vi.mock("@/lib/env", () => ({
  env: {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon",
    siteUrl: "http://localhost:3000",
    cronSecret: CRON_SECRET,
    jolpicaBaseUrl: "https://jolpica.test/ergast/f1",
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => state.admin?.client,
}));
vi.mock("@/lib/operations/settings", () => ({
  isOperationEnabled: async () => state.enabled,
}));
vi.mock("@/lib/seasons", () => ({
  getActiveSeason: async () => state.season,
}));
vi.mock("@/lib/race-sync/calendar", () => ({
  runCalendarSync: async () => state.calendarSummary,
}));
vi.mock("@/lib/race-sync/results", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/race-sync/results")>();
  return { ...actual, runResultsSync: async () => state.resultsSummary };
});
vi.mock("@/lib/operations/record-run", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/operations/record-run")>();
  return {
    ...actual,
    recordRun: (kind: string, trigger: string, fn: () => Promise<unknown>) =>
      actual.recordRun(kind as never, trigger as never, fn, async (record) => {
        state.runs.push({ kind: record.kind, trigger: record.trigger, status: record.status });
        return "run-1";
      }),
  };
});

function req(path: string, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, { headers });
}
const auth = { authorization: `Bearer ${CRON_SECRET}` };

describe("cron routes", () => {
  beforeEach(() => {
    state.admin = fakeAdmin({});
    state.enabled = true;
    state.season = { id: "season-1", year: 2026, slug: "2026", status: "active" };
    state.runs.length = 0;
  });
  afterEach(() => vi.restoreAllMocks());

  it("sync-calendar: 401 without the secret", async () => {
    const { GET } = await import("@/app/api/cron/sync-calendar/route");
    expect((await GET(req("/api/cron/sync-calendar"))).status).toBe(401);
    expect(
      (await GET(req("/api/cron/sync-calendar", { authorization: "Bearer wrong" }))).status,
    ).toBe(401);
  });

  it("sync-calendar: 204 x-skipped when the job is disabled", async () => {
    state.enabled = false;
    const { GET } = await import("@/app/api/cron/sync-calendar/route");
    const res = await GET(req("/api/cron/sync-calendar", auth));
    expect(res.status).toBe(204);
    expect(res.headers.get("x-skipped")).toBe("disabled");
    expect(state.runs).toEqual([]);
  });

  it("sync-calendar: 204 when no season is active", async () => {
    state.season = null;
    const { GET } = await import("@/app/api/cron/sync-calendar/route");
    const res = await GET(req("/api/cron/sync-calendar", auth));
    expect(res.headers.get("x-skipped")).toBe("no-active-season");
  });

  it("sync-calendar: runs, records the run and returns the summary", async () => {
    const { GET } = await import("@/app/api/cron/sync-calendar/route");
    const res = await GET(req("/api/cron/sync-calendar", auth));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(state.calendarSummary);
    expect(state.runs).toEqual([{ kind: "sync_calendar", trigger: "cron", status: "success" }]);
  });

  it("sync-results: 204 nothing-due when no market locked recently", async () => {
    state.admin = fakeAdmin({ markets: [] });
    const { GET } = await import("@/app/api/cron/sync-results/route");
    const res = await GET(req("/api/cron/sync-results", auth));
    expect(res.status).toBe(204);
    expect(res.headers.get("x-skipped")).toBe("nothing-due");
    expect(state.runs).toEqual([]);
  });

  it("sync-results: runs when a market locked inside the window", async () => {
    state.admin = fakeAdmin({
      markets: [{ locks_at: new Date(Date.now() - 3600_000).toISOString(), status: "locked" }],
    });
    const { GET } = await import("@/app/api/cron/sync-results/route");
    const res = await GET(req("/api/cron/sync-results", auth));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(state.resultsSummary);
    expect(state.runs).toEqual([{ kind: "sync_results", trigger: "cron", status: "success" }]);
  });

  it("sync-results: ?force=1 bypasses the staleness check", async () => {
    state.admin = fakeAdmin({ markets: [] });
    const { GET } = await import("@/app/api/cron/sync-results/route");
    const res = await GET(req("/api/cron/sync-results?force=1", auth));
    expect(res.status).toBe(200);
  });

  it("records partial status when the summary reports errors", async () => {
    state.calendarSummary = { provider: "jolpica", grandsPrix: 22, errors: 1 };
    const { GET } = await import("@/app/api/cron/sync-calendar/route");
    await GET(req("/api/cron/sync-calendar", auth));
    expect(state.runs[0]?.status).toBe("partial");
    state.calendarSummary = { provider: "jolpica", grandsPrix: 23, errors: 0 };
  });
});
