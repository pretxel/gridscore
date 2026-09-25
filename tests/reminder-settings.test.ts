import { beforeEach, describe, expect, it, vi } from "vitest";
import { signOptOutToken } from "@/lib/reminders/token";

const USER = "4b1c1b1e-6f55-4c1a-9a53-2f1f7a0f9c11";
const SECRET = "sign";

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  upserts: [] as { table: string; row: Record<string, unknown> }[],
  upsertError: null as { message: string } | null,
}));

function client() {
  return {
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => ({
      upsert: async (row: Record<string, unknown>) => {
        state.upserts.push({ table, row });
        return { error: state.upsertError };
      },
    }),
  };
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => client() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: () => client() }));
vi.mock("@/lib/env", () => ({ env: { reminderSigningSecret: "sign" } }));

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  state.user = { id: USER };
  state.upserts.length = 0;
  state.upsertError = null;
});

describe("saveReminderPreference", () => {
  it("saves the caller's own lead time and locale", async () => {
    const { saveReminderPreference } = await import("@/app/[locale]/(app)/settings/actions");
    expect(await saveReminderPreference(form({ lead: "2h", locale: "es" }))).toEqual({ ok: true });
    expect(state.upserts).toEqual([
      { table: "reminder_preferences", row: { user_id: USER, lead_time: "2h", locale: "es" } },
    ]);
  });

  it("rejects an unknown lead time or locale without writing", async () => {
    const { saveReminderPreference } = await import("@/app/[locale]/(app)/settings/actions");
    expect(await saveReminderPreference(form({ lead: "soon", locale: "en" }))).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(await saveReminderPreference(form({ lead: "off", locale: "fr" }))).toMatchObject({
      ok: false,
    });
    expect(state.upserts).toEqual([]);
  });

  it("refuses a signed-out caller", async () => {
    state.user = null;
    const { saveReminderPreference } = await import("@/app/[locale]/(app)/settings/actions");
    expect(await saveReminderPreference(form({ lead: "off", locale: "en" }))).toMatchObject({
      ok: false,
    });
    expect(state.upserts).toEqual([]);
  });
});

describe("one-click opt-out route", () => {
  const url = (token: string) =>
    `https://x.test/api/reminders/off?l=es&t=${encodeURIComponent(token)}`;

  it("POST with a valid token turns reminders off for that player", async () => {
    const { POST } = await import("@/app/api/reminders/off/route");
    const res = await POST(new Request(url(signOptOutToken(USER, SECRET)), { method: "POST" }));
    expect(res.status).toBe(200);
    expect(state.upserts).toEqual([
      { table: "reminder_preferences", row: { user_id: USER, lead_time: "off" } },
    ]);
  });

  it("POST with a tampered token changes nothing", async () => {
    const { POST } = await import("@/app/api/reminders/off/route");
    const res = await POST(new Request(url(signOptOutToken(USER, "other")), { method: "POST" }));
    expect(res.status).toBe(400);
    expect(state.upserts).toEqual([]);
  });

  it("GET only redirects to the confirmation page, in the player's locale", async () => {
    const { GET } = await import("@/app/api/reminders/off/route");
    const res = await GET(new Request(url("abc")));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://x.test/es/reminders/off?t=abc");
    expect(state.upserts).toEqual([]);
  });
});
