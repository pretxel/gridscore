import { describe, expect, it } from "vitest";
import { CIRCUIT_LAYOUT_VIEWBOX, CIRCUIT_LAYOUTS, circuitLayout } from "@/lib/circuits/layouts";

describe("circuitLayout", () => {
  it("returns null for a circuit OpenStreetMap has not mapped as a lap", () => {
    expect(circuitLayout("not-a-circuit")).toBeNull();
    expect(circuitLayout(null)).toBeNull();
    expect(circuitLayout(undefined)).toBeNull();
    expect(circuitLayout("")).toBeNull();
  });

  it("returns the traced path for a circuit that has one", () => {
    const [key] = Object.keys(CIRCUIT_LAYOUTS);
    expect(circuitLayout(key)).toBe(CIRCUIT_LAYOUTS[key]);
  });
});

describe("the traced layouts", () => {
  const entries = Object.entries(CIRCUIT_LAYOUTS);

  it("ships the circuits that traced cleanly", () => {
    // Ten of the season's twenty-three. The rest are not mapped in
    // OpenStreetMap as a closed racing lap, or traced badly enough to reject;
    // both fall back to the generated loop.
    expect(entries.length).toBeGreaterThanOrEqual(10);
  });

  it("are closed paths of plain move and line commands", () => {
    for (const [key, d] of entries) {
      expect(d.startsWith("M"), key).toBe(true);
      expect(d.endsWith("Z"), key).toBe(true);
      expect(d, key).not.toContain("NaN");
      // Only M, L and Z: the generator emits no curves, so a stray command
      // would mean the file was hand-edited.
      expect(d.replace(/[-0-9. ]/g, ""), key).toMatch(/^ML*Z$/);
    }
  });

  it("stay inside the viewBox", () => {
    for (const [key, d] of entries) {
      const numbers = d.match(/-?\d+(\.\d+)?/g) ?? [];
      for (const raw of numbers) {
        const value = Number(raw);
        expect(value, `${key} has ${value}`).toBeGreaterThanOrEqual(0);
        expect(value, `${key} has ${value}`).toBeLessThanOrEqual(CIRCUIT_LAYOUT_VIEWBOX);
      }
    }
  });

  it("carry enough points to read as a circuit", () => {
    for (const [key, d] of entries) {
      expect((d.match(/L/g) ?? []).length, key).toBeGreaterThan(30);
    }
  });
});
