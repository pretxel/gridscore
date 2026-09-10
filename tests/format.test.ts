import { describe, expect, it } from "vitest";
import { formatMultiplier, formatPoints, formatSessionTime, utcFallback } from "@/lib/format";

// A weekday, an hour and a minute that differ between UTC and Madrid, so a
// timezone bug cannot pass unnoticed.
const RACE = "2026-05-24T13:00:00.000Z";

describe("formatPoints", () => {
  it("groups thousands the way each locale expects", () => {
    expect(formatPoints("en", 1250)).toBe("1,250");
    expect(formatPoints("es", 1250)).toBe("1250");
    expect(formatPoints("en", 8)).toBe("8");
    expect(formatPoints("es", 8)).toBe("8");
  });
});

describe("formatMultiplier", () => {
  it("uses the locale's decimal separator and drops trailing zeros", () => {
    expect(formatMultiplier("en", 1.25)).toBe("1.25");
    expect(formatMultiplier("es", 1.25)).toBe("1,25");
    expect(formatMultiplier("en", 2)).toBe("2");
    expect(formatMultiplier("es", 2)).toBe("2");
  });
});

describe("formatSessionTime", () => {
  it("renders the instant in the given timezone", () => {
    // Madrid is two hours ahead of UTC in May.
    expect(formatSessionTime(RACE, "es", "time", "UTC")).toBe("13:00");
    expect(formatSessionTime(RACE, "es", "time", "Europe/Madrid")).toBe("15:00");
  });

  it("uses each locale's clock convention", () => {
    expect(formatSessionTime(RACE, "en", "time", "UTC")).toBe("01:00 PM");
    expect(formatSessionTime(RACE, "es", "time", "UTC")).toBe("13:00");
  });

  it("uses each locale's month and weekday names", () => {
    expect(formatSessionTime(RACE, "en", "date", "UTC")).toContain("May");
    expect(formatSessionTime(RACE, "es", "date", "UTC")).toContain("may");
  });

  it("returns the raw value for an unparseable instant", () => {
    expect(formatSessionTime("not-a-date", "en")).toBe("not-a-date");
  });
});

describe("utcFallback", () => {
  it("is identical in every locale and zone", () => {
    expect(utcFallback(RACE, "datetime")).toBe("2026-05-24 13:00 UTC");
    expect(utcFallback(RACE, "date")).toBe("2026-05-24 UTC");
    expect(utcFallback(RACE, "time")).toBe("13:00 UTC");
  });

  it("returns the raw value for an unparseable instant", () => {
    expect(utcFallback("nope")).toBe("nope");
  });
});
