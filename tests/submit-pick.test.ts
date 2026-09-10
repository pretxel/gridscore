import { beforeEach, describe, expect, it, vi } from "vitest";

const DRIVER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const THIRD = "33333333-3333-4333-8333-333333333333";
const MARKET = "44444444-4444-4444-8444-444444444444";

const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  isAdmin: false,
  market: {
    id: "44444444-4444-4444-8444-444444444444",
    type: "pole",
    status: "open",
    locks_at: new Date(Date.now() + 3600_000).toISOString(),
  } as Record<string, unknown> | null,
  upsertError: null as { code?: string; message: string } | null,
  upserts: [] as unknown[],
  revalidated: [] as string[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => state.revalidated.push(p),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock("@/lib/admin/current-user", () => ({
  isCurrentUserAdmin: async () => state.isAdmin,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => {
      if (table === "markets") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: async () => ({ data: state.market, error: null }),
        };
        return chain;
      }
      if (table === "predictions") {
        return {
          upsert: async (payload: unknown) => {
            state.upserts.push(payload);
            return { error: state.upsertError };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

const { submitPick } = await import("@/app/[locale]/(public)/gp/[slug]/actions");

const valid = { marketId: MARKET, slug: "monaco", type: "pole", pick: { driver_id: DRIVER } };

describe("submitPick", () => {
  beforeEach(() => {
    state.user = { id: "user-1" };
    state.isAdmin = false;
    state.market = {
      id: MARKET,
      type: "pole",
      status: "open",
      locks_at: new Date(Date.now() + 3600_000).toISOString(),
    };
    state.upsertError = null;
    state.upserts.length = 0;
    state.revalidated.length = 0;
  });

  it("upserts a valid pick and revalidates the pages that show it", async () => {
    expect(await submitPick(valid)).toEqual({ ok: true });
    expect(state.upserts).toEqual([
      { user_id: "user-1", market_id: MARKET, pick: { driver_id: DRIVER } },
    ]);
    expect(state.revalidated).toEqual(
      expect.arrayContaining(["/en/gp/monaco", "/es/gp/monaco", "/en/my-picks", "/es/gp"]),
    );
  });

  it("rejects malformed envelopes and picks", async () => {
    expect(await submitPick({})).toEqual({ ok: false, error: "errorInvalid" });
    expect(await submitPick({ ...valid, type: "winner" })).toEqual({
      ok: false,
      error: "errorInvalid",
    });
    expect(await submitPick({ ...valid, pick: { driver: DRIVER } })).toEqual({
      ok: false,
      error: "errorInvalid",
    });
    expect(state.upserts).toEqual([]);
  });

  it("names duplicate podium drivers specifically", async () => {
    state.market = { ...state.market, type: "podium" };
    const res = await submitPick({
      ...valid,
      type: "podium",
      pick: { p1: DRIVER, p2: DRIVER, p3: THIRD },
    });
    expect(res).toEqual({ ok: false, error: "errorDuplicateDrivers" });
    expect(
      await submitPick({ ...valid, type: "podium", pick: { p1: DRIVER, p2: OTHER, p3: THIRD } }),
    ).toEqual({ ok: true });
  });

  it("refuses anonymous callers and admins", async () => {
    state.user = null;
    expect(await submitPick(valid)).toEqual({ ok: false, error: "errorNotSignedIn" });
    state.user = { id: "admin" };
    state.isAdmin = true;
    expect(await submitPick(valid)).toEqual({ ok: false, error: "errorAdmin" });
    expect(state.upserts).toEqual([]);
  });

  it("refuses a locked or missing market before touching the database", async () => {
    state.market = { ...state.market, locks_at: new Date(Date.now() - 1000).toISOString() };
    expect(await submitPick(valid)).toEqual({ ok: false, error: "errorLocked" });
    state.market = {
      ...state.market,
      locks_at: new Date(Date.now() + 1000).toISOString(),
      status: "locked",
    };
    expect(await submitPick(valid)).toEqual({ ok: false, error: "errorLocked" });
    state.market = null;
    expect(await submitPick(valid)).toEqual({ ok: false, error: "errorMarketNotFound" });
    expect(state.upserts).toEqual([]);
  });

  it("rejects a pick whose type does not match the market", async () => {
    state.market = { ...state.market, type: "podium" };
    expect(await submitPick(valid)).toEqual({ ok: false, error: "errorInvalid" });
  });

  it("maps database lock refusals to the locked message", async () => {
    state.upsertError = { code: "42501", message: "new row violates row-level security policy" };
    expect(await submitPick(valid)).toEqual({ ok: false, error: "errorLocked" });
    state.upsertError = { code: "P0001", message: "prediction locked" };
    expect(await submitPick(valid)).toEqual({ ok: false, error: "errorLocked" });
    state.upsertError = { code: "XX000", message: "disk on fire" };
    expect(await submitPick(valid)).toEqual({ ok: false, error: "errorGeneric" });
  });
});
