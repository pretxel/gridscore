import { beforeEach, describe, expect, it, vi } from "vitest";

const GP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MARKET = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SEASON = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const VER = "11111111-1111-4111-8111-111111111111";
const NOR = "22222222-2222-4222-8222-222222222222";
const LEC = "33333333-3333-4333-8333-333333333333";

// One record of everything the actions did, so each test can assert on the
// payload the database would have received.
const state = vi.hoisted(() => ({
  isAdmin: true,
  updates: [] as { table: string; patch: Record<string, unknown>; id?: string }[],
  upserts: [] as { table: string; row: Record<string, unknown> }[],
  rpcs: [] as { name: string; args: unknown }[],
  selected: null as unknown,
  selectError: null as { message: string } | null,
  updateError: null as { message: string } | null,
  revalidated: [] as string[],
  cookies: [] as { name: string; value: string }[],
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
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: (name: string, value: string) => state.cookies.push({ name, value }),
  }),
}));
vi.mock("@/lib/admin/current-user", () => ({
  assertAdmin: async () => {
    if (!state.isAdmin) throw new Error("Admin only");
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({}),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => makeClient(),
}));

function makeClient() {
  return {
    from(table: string) {
      const builder = {
        _patch: {} as Record<string, unknown>,
        update(patch: Record<string, unknown>) {
          builder._patch = patch;
          return builder;
        },
        upsert(row: Record<string, unknown>) {
          state.upserts.push({ table, row });
          return Promise.resolve({ error: state.updateError });
        },
        select() {
          return builder;
        },
        eq(_column: string, value: string) {
          if (Object.keys(builder._patch).length > 0) {
            state.updates.push({ table, patch: builder._patch, id: value });
            return Promise.resolve({ error: state.updateError });
          }
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({ data: state.selected, error: state.selectError });
        },
      };
      return builder;
    },
    rpc(name: string, args: unknown) {
      state.rpcs.push({ name, args });
      return Promise.resolve({ error: state.updateError });
    },
  };
}

// The actions signal completion by redirecting; this turns that back into the
// query string the admin page reads.
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
  state.updates = [];
  state.upserts = [];
  state.rpcs = [];
  state.selected = null;
  state.selectError = null;
  state.updateError = null;
  state.revalidated = [];
  state.cookies = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("admin authorization", () => {
  it("refuses every action when the caller is not an admin", async () => {
    state.isAdmin = false;
    const { setMultiplier } = await import("@/app/[locale]/(admin)/admin/grands-prix/actions");
    const params = await capture(() =>
      setMultiplier(
        form({ locale: "en", grand_prix_id: GP, multiplier: "2", multiplier_reason: "finale" }),
      ),
    );
    expect(params.get("error")).toBe("forbidden");
    expect(state.updates).toHaveLength(0);
  });

  it("does not leak the raw reason for a permission failure", async () => {
    state.isAdmin = false;
    const { saveMarketResult } = await import(
      "@/app/[locale]/(admin)/admin/grands-prix/[id]/actions"
    );
    const params = await capture(() =>
      saveMarketResult(
        form({
          locale: "en",
          grand_prix_id: GP,
          market_id: MARKET,
          market_type: "pole",
          driver_id: VER,
        }),
      ),
    );
    expect(params.get("detail")).toBeNull();
  });
});

describe("setMultiplier", () => {
  it("locks the multiplier so the calendar sync leaves it alone", async () => {
    const { setMultiplier } = await import("@/app/[locale]/(admin)/admin/grands-prix/actions");
    const params = await capture(() =>
      setMultiplier(
        form({ locale: "en", grand_prix_id: GP, multiplier: "1.5", multiplier_reason: "legend" }),
      ),
    );
    expect(params.get("ok")).toBe("multiplierSaved");
    expect(state.updates).toEqual([
      {
        table: "grands_prix",
        id: GP,
        patch: { multiplier: 1.5, multiplier_reason: "legend", multiplier_locked: true },
      },
    ]);
  });

  it("hands the multiplier back to the sync on unlock", async () => {
    const { unlockMultiplier } = await import("@/app/[locale]/(admin)/admin/grands-prix/actions");
    await capture(() => unlockMultiplier(form({ locale: "en", grand_prix_id: GP })));
    expect(state.updates[0].patch).toEqual({ multiplier_locked: false });
  });

  it("rejects a multiplier below one", async () => {
    const { setMultiplier } = await import("@/app/[locale]/(admin)/admin/grands-prix/actions");
    const params = await capture(() =>
      setMultiplier(
        form({ locale: "en", grand_prix_id: GP, multiplier: "0.5", multiplier_reason: "custom" }),
      ),
    );
    expect(params.get("error")).toBe("failed");
    expect(state.updates).toHaveLength(0);
  });
});

describe("recomputeGrandPrix", () => {
  it("calls the rescore RPC and refreshes the public boards", async () => {
    const { recomputeGrandPrix } = await import("@/app/[locale]/(admin)/admin/grands-prix/actions");
    const params = await capture(() =>
      recomputeGrandPrix(form({ locale: "en", grand_prix_id: GP })),
    );
    expect(params.get("ok")).toBe("recomputed");
    expect(state.rpcs).toEqual([{ name: "compute_grand_prix_scores", args: { p_gp_id: GP } }]);
    expect(state.revalidated).toContain("/en/leaderboard");
    expect(state.revalidated).toContain("/es/leaderboard");
  });
});

describe("saveMarketResult", () => {
  it("writes a single-driver result as resolved and manual", async () => {
    const { saveMarketResult } = await import(
      "@/app/[locale]/(admin)/admin/grands-prix/[id]/actions"
    );
    const params = await capture(() =>
      saveMarketResult(
        form({
          locale: "en",
          grand_prix_id: GP,
          market_id: MARKET,
          market_type: "pole",
          driver_id: VER,
        }),
      ),
    );
    expect(params.get("ok")).toBe("resultSaved");
    const update = state.updates[0];
    expect(update.table).toBe("markets");
    expect(update.patch.result).toEqual({ driver_id: VER });
    expect(update.patch.status).toBe("resolved");
    expect(update.patch.resolution_source).toBe("manual");
  });

  it("writes a safety car answer as a boolean", async () => {
    const { saveMarketResult } = await import(
      "@/app/[locale]/(admin)/admin/grands-prix/[id]/actions"
    );
    await capture(() =>
      saveMarketResult(
        form({
          locale: "en",
          grand_prix_id: GP,
          market_id: MARKET,
          market_type: "safety_car",
          value: "no",
        }),
      ),
    );
    expect(state.updates[0].patch.result).toEqual({ value: false });
  });

  it("writes an ordered podium", async () => {
    const { saveMarketResult } = await import(
      "@/app/[locale]/(admin)/admin/grands-prix/[id]/actions"
    );
    await capture(() =>
      saveMarketResult(
        form({
          locale: "en",
          grand_prix_id: GP,
          market_id: MARKET,
          market_type: "podium",
          p1: VER,
          p2: NOR,
          p3: LEC,
        }),
      ),
    );
    expect(state.updates[0].patch.result).toEqual({ p1: VER, p2: NOR, p3: LEC });
  });

  it("refuses a podium that repeats a driver", async () => {
    const { saveMarketResult } = await import(
      "@/app/[locale]/(admin)/admin/grands-prix/[id]/actions"
    );
    const params = await capture(() =>
      saveMarketResult(
        form({
          locale: "en",
          grand_prix_id: GP,
          market_id: MARKET,
          market_type: "podium",
          p1: VER,
          p2: VER,
          p3: LEC,
        }),
      ),
    );
    expect(params.get("error")).toBe("failed");
    expect(params.get("detail")).toContain("duplicate");
    expect(state.updates).toHaveLength(0);
  });

  it("refuses an unknown market type", async () => {
    const { saveMarketResult } = await import(
      "@/app/[locale]/(admin)/admin/grands-prix/[id]/actions"
    );
    const params = await capture(() =>
      saveMarketResult(
        form({
          locale: "en",
          grand_prix_id: GP,
          market_id: MARKET,
          market_type: "pit_stops",
          driver_id: VER,
        }),
      ),
    );
    expect(params.get("error")).toBe("failed");
    expect(state.updates).toHaveLength(0);
  });
});

describe("acceptSuggestion", () => {
  it("promotes the sync's suggestion and records it as provider-sourced", async () => {
    state.selected = { suggested_result: { driver_id: NOR } };
    const { acceptSuggestion } = await import(
      "@/app/[locale]/(admin)/admin/grands-prix/[id]/actions"
    );
    const params = await capture(() =>
      acceptSuggestion(form({ locale: "en", grand_prix_id: GP, market_id: MARKET })),
    );
    expect(params.get("ok")).toBe("suggestionAccepted");
    expect(state.updates[0].patch.result).toEqual({ driver_id: NOR });
    expect(state.updates[0].patch.resolution_source).toBe("provider");
  });

  it("fails when there is nothing to promote", async () => {
    state.selected = { suggested_result: null };
    const { acceptSuggestion } = await import(
      "@/app/[locale]/(admin)/admin/grands-prix/[id]/actions"
    );
    const params = await capture(() =>
      acceptSuggestion(form({ locale: "en", grand_prix_id: GP, market_id: MARKET })),
    );
    expect(params.get("error")).toBe("failed");
    expect(state.updates).toHaveLength(0);
  });
});

describe("voidMarket and reopenMarket", () => {
  it("voids without touching the result: the trigger clears it", async () => {
    const { voidMarket } = await import("@/app/[locale]/(admin)/admin/grands-prix/[id]/actions");
    await capture(() => voidMarket(form({ locale: "en", grand_prix_id: GP, market_id: MARKET })));
    expect(state.updates[0].patch).toEqual({ status: "void" });
  });

  it("reopening clears the result so the market can be scored again", async () => {
    const { reopenMarket } = await import("@/app/[locale]/(admin)/admin/grands-prix/[id]/actions");
    await capture(() => reopenMarket(form({ locale: "en", grand_prix_id: GP, market_id: MARKET })));
    expect(state.updates[0].patch).toEqual({
      status: "open",
      result: null,
      resolved_at: null,
      resolution_source: null,
    });
  });
});

describe("saveScoringRule", () => {
  it("upserts on the season, market and rule key", async () => {
    const { saveScoringRule } = await import("@/app/[locale]/(admin)/admin/scoring/actions");
    const params = await capture(() =>
      saveScoringRule(
        form({
          locale: "en",
          season_id: SEASON,
          market_type: "podium",
          rule_key: "exact_position",
          points: "12",
        }),
      ),
    );
    expect(params.get("ok")).toBe("ruleSaved");
    expect(state.upserts[0].row).toEqual({
      season_id: SEASON,
      market_type: "podium",
      rule_key: "exact_position",
      points: 12,
    });
  });

  it("refuses negative points", async () => {
    const { saveScoringRule } = await import("@/app/[locale]/(admin)/admin/scoring/actions");
    const params = await capture(() =>
      saveScoringRule(
        form({
          locale: "en",
          season_id: SEASON,
          market_type: "pole",
          rule_key: "exact",
          points: "-5",
        }),
      ),
    );
    expect(params.get("error")).toBe("failed");
    expect(state.upserts).toHaveLength(0);
  });
});

describe("setLeaguePlan", () => {
  it("is the only path that can lift a league's member cap", async () => {
    const { setLeaguePlan } = await import("@/app/[locale]/(admin)/admin/leagues/actions");
    const params = await capture(() =>
      setLeaguePlan(form({ locale: "en", league_id: GP, plan: "pro" })),
    );
    expect(params.get("ok")).toBe("leagueUpgraded");
    expect(state.updates[0]).toEqual({ table: "leagues", id: GP, patch: { plan: "pro" } });
  });

  it("rejects a plan that does not exist", async () => {
    const { setLeaguePlan } = await import("@/app/[locale]/(admin)/admin/leagues/actions");
    const params = await capture(() =>
      setLeaguePlan(form({ locale: "en", league_id: GP, plan: "platinum" })),
    );
    expect(params.get("error")).toBe("failed");
    expect(state.updates).toHaveLength(0);
  });
});

describe("saveDriver", () => {
  it("uppercases the code and clears an empty team", async () => {
    const { saveDriver } = await import("@/app/[locale]/(admin)/admin/drivers/actions");
    await capture(() =>
      saveDriver(form({ locale: "en", driver_id: VER, code: "ver", number: "1", team_id: "" })),
    );
    expect(state.updates[0].patch).toEqual({ code: "VER", number: 1, team_id: null });
  });

  it("clears the code and the number when the fields are blank", async () => {
    const { saveDriver } = await import("@/app/[locale]/(admin)/admin/drivers/actions");
    await capture(() =>
      saveDriver(form({ locale: "en", driver_id: VER, code: "", number: "", team_id: "" })),
    );
    expect(state.updates[0].patch).toEqual({ code: null, number: null, team_id: null });
  });
});
