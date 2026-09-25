import { describe, expect, it } from "vitest";
import { formatLockTime, renderReminderEmail, resolveTimeZone } from "@/lib/reminders/email";
import { signOptOutToken, verifyOptOutToken } from "@/lib/reminders/token";

const base = {
  to: "player@example.test",
  siteUrl: "https://gridscore.example/",
  optOutUrl: "https://gridscore.example/en/reminders/off?t=abc",
  oneClickUrl: "https://gridscore.example/api/reminders/off?l=en&t=abc",
  markets: [
    {
      type: "podium" as const,
      locksAt: "2026-09-27T13:00:00Z",
      grandPrixSlug: "italy",
      grandPrixName: "Italian Grand Prix",
    },
    {
      type: "pole" as const,
      locksAt: "2026-09-26T14:00:00Z",
      grandPrixSlug: "italy",
      grandPrixName: "Italian Grand Prix",
    },
  ],
};

describe("renderReminderEmail", () => {
  it("lists every missing market in English by default, earliest lock first", () => {
    const email = renderReminderEmail({ ...base, locale: null, timezone: null });
    expect(email.subject).toBe("2 calls still open before the lock");
    expect(email.text.indexOf("Pole position")).toBeLessThan(email.text.indexOf("Podium"));
    expect(email.text).toContain("https://gridscore.example/en/gp/italy");
    expect(email.html).toContain('lang="en"');
    expect(email.text).toContain("UTC");
  });

  it("writes Spanish with lock times in the player's zone", () => {
    const email = renderReminderEmail({ ...base, locale: "es", timezone: "Europe/Madrid" });
    expect(email.subject).toBe("2 predicciones pendientes antes del cierre");
    expect(email.text).toContain("Pole position");
    expect(email.text).toContain("https://gridscore.example/es/gp/italy");
    // 14:00 UTC is 16:00 in Madrid (CEST).
    expect(email.text).toContain("16:00");
  });

  it("carries the one-click unsubscribe headers and link", () => {
    const email = renderReminderEmail({ ...base, locale: "en", timezone: null });
    expect(email.headers).toEqual({
      "List-Unsubscribe": `<${base.oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect(email.html).toContain(base.optOutUrl);
  });

  it("escapes names in the HTML", () => {
    const email = renderReminderEmail({
      ...base,
      locale: "en",
      timezone: null,
      markets: [{ ...base.markets[0], grandPrixName: "<b>GP</b>" }],
    });
    expect(email.html).toContain("&lt;b&gt;GP&lt;/b&gt;");
    expect(email.subject).toBe("1 call still open before the lock");
  });
});

describe("time zones", () => {
  it("falls back to UTC for an unknown zone", () => {
    expect(resolveTimeZone("Mars/Olympus")).toBe("UTC");
    expect(resolveTimeZone(null)).toBe("UTC");
    expect(resolveTimeZone("America/Mexico_City")).toBe("America/Mexico_City");
    expect(formatLockTime("2026-09-26T14:00:00Z", "en", "UTC")).toMatch(/0?2:00\sPM UTC/);
  });
});

describe("opt-out token", () => {
  const id = "4b1c1b1e-6f55-4c1a-9a53-2f1f7a0f9c11";
  const secret = "test-secret";

  it("round-trips the user id", () => {
    expect(verifyOptOutToken(signOptOutToken(id, secret), secret)).toBe(id);
  });

  it("rejects a tampered, foreign or malformed token", () => {
    const token = signOptOutToken(id, secret);
    const other = "0b1c1b1e-6f55-4c1a-9a53-2f1f7a0f9c11";
    const swapped = `${Buffer.from(other).toString("base64url")}.${token.split(".")[1]}`;
    expect(verifyOptOutToken(swapped, secret)).toBeNull();
    expect(verifyOptOutToken(token, "another-secret")).toBeNull();
    expect(verifyOptOutToken("garbage", secret)).toBeNull();
    expect(verifyOptOutToken(`${token}.x`, secret)).toBeNull();
    expect(verifyOptOutToken("", secret)).toBeNull();
  });
});
