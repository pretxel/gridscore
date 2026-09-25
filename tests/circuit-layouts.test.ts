import { describe, expect, it } from "vitest";
import circuits from "@/data/circuits.json";
import {
  CIRCUIT_LAYOUT_SOURCES,
  CIRCUIT_LAYOUT_VIEWBOX,
  CIRCUIT_LAYOUTS,
  circuitLayout,
} from "@/lib/circuits/layouts";

describe("circuitLayout", () => {
  it("returns null for a circuit with no traced layout", () => {
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

  it("ships a real layout for every circuit on the calendar", () => {
    for (const { key } of circuits) {
      expect(CIRCUIT_LAYOUTS[key], key).toBeDefined();
    }
  });

  it("names the source of every layout, so the footer can credit it", () => {
    expect(Object.keys(CIRCUIT_LAYOUT_SOURCES).sort()).toEqual(Object.keys(CIRCUIT_LAYOUTS).sort());
    for (const source of Object.values(CIRCUIT_LAYOUT_SOURCES)) {
      expect(["osm", "geojson"]).toContain(source);
    }
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
