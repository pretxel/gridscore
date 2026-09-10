import { describe, expect, it } from "vitest";
import {
  NO_RETIREMENT,
  parseResultForm,
  RESULT_CONTROL,
  resultToFormValues,
} from "@/lib/admin/market-result";
import {
  checkbox,
  driverCodeSchema,
  multiplierSchema,
  optionalInstant,
  optionalNumber,
  pointsSchema,
  toDatetimeLocal,
} from "@/lib/admin/parse";
import { MARKET_TYPES } from "@/lib/markets";

const VER = "11111111-1111-4111-8111-111111111111";
const NOR = "22222222-2222-4222-8222-222222222222";
const LEC = "33333333-3333-4333-8333-333333333333";

describe("parseResultForm", () => {
  it("covers every market type", () => {
    for (const type of MARKET_TYPES) expect(RESULT_CONTROL[type]).toBeTruthy();
  });

  it("builds single-driver results", () => {
    expect(parseResultForm("pole", { driver_id: VER })).toEqual({
      ok: true,
      pick: { driver_id: VER },
    });
    expect(parseResultForm("fastest_lap", { driver_id: ` ${NOR} ` })).toEqual({
      ok: true,
      pick: { driver_id: NOR },
    });
  });

  it("treats the none sentinel as a null retirement", () => {
    expect(parseResultForm("first_retirement", { driver_id: NO_RETIREMENT })).toEqual({
      ok: true,
      pick: { driver_id: null },
    });
    expect(parseResultForm("first_retirement", { driver_id: VER })).toEqual({
      ok: true,
      pick: { driver_id: VER },
    });
  });

  it("maps yes and no to booleans", () => {
    expect(parseResultForm("safety_car", { value: "yes" })).toEqual({
      ok: true,
      pick: { value: true },
    });
    expect(parseResultForm("safety_car", { value: "no" })).toEqual({
      ok: true,
      pick: { value: false },
    });
    expect(parseResultForm("safety_car", { value: "maybe" })).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("builds an ordered podium", () => {
    expect(parseResultForm("podium", { p1: VER, p2: NOR, p3: LEC })).toEqual({
      ok: true,
      pick: { p1: VER, p2: NOR, p3: LEC },
    });
  });

  it("rejects a podium with a repeated driver", () => {
    expect(parseResultForm("podium", { p1: VER, p2: VER, p3: LEC })).toEqual({
      ok: false,
      error: "duplicate",
    });
  });

  it("reports missing fields before invalid ones", () => {
    expect(parseResultForm("pole", {})).toEqual({ ok: false, error: "missing" });
    expect(parseResultForm("podium", { p1: VER, p2: NOR })).toEqual({
      ok: false,
      error: "missing",
    });
    expect(parseResultForm("safety_car", { value: "" })).toEqual({ ok: false, error: "missing" });
  });

  it("rejects a driver id that is not a uuid", () => {
    expect(parseResultForm("pole", { driver_id: "max" })).toEqual({ ok: false, error: "invalid" });
  });
});

describe("resultToFormValues", () => {
  it("round-trips every control back into the form", () => {
    expect(resultToFormValues("pole", { driver_id: VER })).toEqual({ driver_id: VER });
    expect(resultToFormValues("safety_car", { value: false })).toEqual({ value: "no" });
    expect(resultToFormValues("first_retirement", { driver_id: null })).toEqual({
      driver_id: NO_RETIREMENT,
    });
    expect(resultToFormValues("podium", { p1: VER, p2: NOR, p3: LEC })).toEqual({
      p1: VER,
      p2: NOR,
      p3: LEC,
    });
  });

  it("returns empty values for an unresolved market", () => {
    expect(resultToFormValues("pole", null)).toEqual({});
  });
});

describe("multiplierSchema", () => {
  it("accepts the seeded multipliers and rounds to two decimals", () => {
    expect(multiplierSchema.parse("1")).toBe(1);
    expect(multiplierSchema.parse("1.25")).toBe(1.25);
    expect(multiplierSchema.parse("1.005")).toBe(1.01);
    expect(multiplierSchema.parse("2")).toBe(2);
  });

  it("refuses anything below one", () => {
    expect(multiplierSchema.safeParse("0.9").success).toBe(false);
    expect(multiplierSchema.safeParse("-1").success).toBe(false);
    expect(multiplierSchema.safeParse("abc").success).toBe(false);
  });
});

describe("pointsSchema", () => {
  it("takes non-negative integers only", () => {
    expect(pointsSchema.parse("10")).toBe(10);
    expect(pointsSchema.parse("0")).toBe(0);
    expect(pointsSchema.safeParse("-1").success).toBe(false);
    expect(pointsSchema.safeParse("4.5").success).toBe(false);
  });
});

describe("driverCodeSchema", () => {
  it("uppercases a three-letter code", () => {
    expect(driverCodeSchema.parse("ver")).toBe("VER");
    expect(driverCodeSchema.parse(null)).toBeNull();
    expect(driverCodeSchema.safeParse("VERS").success).toBe(false);
  });
});

describe("form readers", () => {
  function form(entries: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(entries)) fd.set(k, v);
    return fd;
  }

  it("reads checkboxes by presence", () => {
    expect(checkbox(form({ has_sprint: "on" }), "has_sprint")).toBe(true);
    expect(checkbox(form({}), "has_sprint")).toBe(false);
  });

  it("clears an optional number when the field is blank", () => {
    expect(optionalNumber(form({ number: "33" }), "number")).toBe(33);
    expect(optionalNumber(form({ number: "" }), "number")).toBeNull();
    expect(optionalNumber(form({ number: "x" }), "number")).toBeUndefined();
  });

  it("reads datetime-local as UTC and round-trips it", () => {
    expect(optionalInstant(form({ race_at: "2026-05-24T13:00" }), "race_at")).toBe(
      "2026-05-24T13:00:00.000Z",
    );
    expect(optionalInstant(form({ race_at: "" }), "race_at")).toBeNull();
    expect(optionalInstant(form({ race_at: "not-a-date" }), "race_at")).toBeUndefined();
    expect(toDatetimeLocal("2026-05-24T13:00:00.000Z")).toBe("2026-05-24T13:00");
    expect(toDatetimeLocal(null)).toBe("");
  });
});
