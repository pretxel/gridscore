import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextScheduledRun, OPERATION_SCHEDULES } from "@/lib/operations/schedule";

const state = vi.hoisted(() => ({
  isAdmin: true,
  season: { id: "s1", year: 2026, slug: "2026" } as { id: string; year: number } | null,
  providerAvailable: true,
  calendarRuns: 0,
  resultRuns: 0,
  recorded: [] as { kind: string; trigger: string }[],
  settings: [] as { kind: string; enabled: boolean }[],
  revalidated: [] as string[],
}));

class RedirectError extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => state.revalidated.push(path),
}));
vi.mock("@/lib/admin/current-user", () => ({
  assertAdmin: async () => {
    if (!state.isAdmin) throw new Error("Admin only");
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: () => ({}) }));
vi.mock("@/lib/seasons", () => ({ getActiveSeason: async () => state.season }));
vi.mock("@/lib/race-sync/providers", () => ({
  defaultProvider: () => ({ name: "fake", available: () => state.providerAvailable }),
}));
vi.mock("@/lib/race-sync/store", () => ({
  createSupabaseCalendarStore: () => ({}),
  createSupabaseResultsStore: () => ({}),
}));
vi.mock("@/lib/race-sync/calendar", () => ({
  runCalendarSync: async () => {
    state.calendarRuns += 1;
    return { grandsPrix: 24, errors: 0 };
  },
}));
vi.mock("@/lib/race-sync/results", () => ({
  runResultsSync: async () => {
    state.resultRuns += 1;
    return { resolved: 2, errors: 0 };
  },
}));
vi.mock("@/lib/operations/record-run", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/operations/record-run")>();
  return {
    ...actual,
    recordRun: async (kind: string, trigger: string, fn: () => Promise<unknown>) => {
      state.recorded.push({ kind, trigger });
      return { summary: await fn(), status: "success", runId: "run-1" };
    },
  };
});
vi.mock("@/lib/operations/settings", () => ({
  setOperationEnabled: async (kind: string, enabled: boolean) => {
    state.settings.push({ kind, enabled });
  },
}));

async function capture(run: () => Promise<never>): Promise<URLSearchParams> {
  try {
    await run();
  } catch (err) {
    if (err instanceof RedirectError) return new URLSearchParams(err.url.split("?")[1] ?? "");
    throw err;
  }
  throw new Error("action did not redirect");
}

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  state.isAdmin = true;
  state.season = { id: "s1", year: 2026 };
  state.providerAvailable = true;
  state.calendarRuns = 0;
  state.resultRuns = 0;
  state.recorded = [];
  state.settings = [];
  state.revalidated = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("runNow", () => {
  it("runs the calendar sync and records it as manual", async () => {
    const { runNow } = await import("@/app/[locale]/(admin)/admin/operations/actions");
    const params = await capture(() => runNow(form({ locale: "en", kind: "sync_calendar" })));
    expect(params.get("ok")).toBe("ranNow");
    expect(state.calendarRuns).toBe(1);
    expect(state.resultRuns).toBe(0);
    expect(state.recorded).toEqual([{ kind: "sync_calendar", trigger: "manual" }]);
  });

  it("runs the results sync without the scheduled self-skip", async () => {
    const { runNow } = await import("@/app/[locale]/(admin)/admin/operations/actions");
    await capture(() => runNow(form({ locale: "en", kind: "sync_results" })));
    expect(state.resultRuns).toBe(1);
    expect(state.recorded).toEqual([{ kind: "sync_results", trigger: "manual" }]);
  });

  it("refuses an unknown job", async () => {
    const { runNow } = await import("@/app/[locale]/(admin)/admin/operations/actions");
    const params = await capture(() => runNow(form({ locale: "en", kind: "sync_everything" })));
    expect(params.get("error")).toBe("failed");
    expect(state.recorded).toHaveLength(0);
  });

  it("reports a missing season instead of calling the provider", async () => {
    state.season = null;
    const { runNow } = await import("@/app/[locale]/(admin)/admin/operations/actions");
    const params = await capture(() => runNow(form({ locale: "en", kind: "sync_calendar" })));
    expect(params.get("error")).toBe("failed");
    expect(params.get("detail")).toContain("no active season");
    expect(state.calendarRuns).toBe(0);
  });

  it("reports an unconfigured provider", async () => {
    state.providerAvailable = false;
    const { runNow } = await import("@/app/[locale]/(admin)/admin/operations/actions");
    const params = await capture(() => runNow(form({ locale: "en", kind: "sync_results" })));
    expect(params.get("error")).toBe("failed");
    expect(state.resultRuns).toBe(0);
  });

  it("is closed to non-admins", async () => {
    state.isAdmin = false;
    const { runNow } = await import("@/app/[locale]/(admin)/admin/operations/actions");
    const params = await capture(() => runNow(form({ locale: "en", kind: "sync_calendar" })));
    expect(params.get("error")).toBe("forbidden");
    expect(state.calendarRuns).toBe(0);
  });
});

describe("toggleOperation", () => {
  it("pauses and resumes the scheduled job", async () => {
    const { toggleOperation } = await import("@/app/[locale]/(admin)/admin/operations/actions");
    let params = await capture(() =>
      toggleOperation(form({ locale: "en", kind: "sync_results", enabled: "false" })),
    );
    expect(params.get("ok")).toBe("operationPaused");

    params = await capture(() =>
      toggleOperation(form({ locale: "en", kind: "sync_results", enabled: "true" })),
    );
    expect(params.get("ok")).toBe("operationResumed");
    expect(state.settings).toEqual([
      { kind: "sync_results", enabled: false },
      { kind: "sync_results", enabled: true },
    ]);
  });
});

describe("nextScheduledRun", () => {
  it("matches the cron expressions the deploy actually uses", () => {
    expect(OPERATION_SCHEDULES.sync_calendar.cron).toBe("0 6 * * *");
    expect(OPERATION_SCHEDULES.sync_results.cron).toBe("0 3 * * *");
  });

  it("returns today's slot when it has not passed yet", () => {
    const now = new Date("2026-05-24T01:30:00.000Z");
    expect(nextScheduledRun("sync_results", now).toISOString()).toBe("2026-05-24T03:00:00.000Z");
  });

  it("rolls over to tomorrow once the slot has passed", () => {
    const now = new Date("2026-05-24T07:00:00.000Z");
    expect(nextScheduledRun("sync_calendar", now).toISOString()).toBe("2026-05-25T06:00:00.000Z");
  });
});
