import { describe, expect, it } from "vitest";
import { TRACE_VIEWBOX, tracePath, tracePoints } from "@/lib/circuit-trace";

describe("tracePoints", () => {
  it("is deterministic for a circuit", () => {
    expect(tracePoints("monza")).toEqual(tracePoints("monza"));
  });

  it("gives each circuit its own shape", () => {
    expect(tracePoints("monza")).not.toEqual(tracePoints("suzuka"));
    expect(tracePoints("albert_park")).not.toEqual(tracePoints("shanghai"));
  });

  it("stays inside the viewBox with room for the stroke", () => {
    for (const seed of ["monza", "suzuka", "albert_park", "shanghai", "", "x"]) {
      for (const point of tracePoints(seed)) {
        expect(point.x, `${seed} x`).toBeGreaterThan(-12);
        expect(point.x, `${seed} x`).toBeLessThan(TRACE_VIEWBOX + 12);
        expect(point.y, `${seed} y`).toBeGreaterThan(-12);
        expect(point.y, `${seed} y`).toBeLessThan(TRACE_VIEWBOX + 12);
      }
    }
  });

  it("returns the requested number of points", () => {
    expect(tracePoints("monza", 12)).toHaveLength(12);
  });
});

describe("tracePath", () => {
  it("is a closed path of cubic curves", () => {
    const d = tracePath("monza");
    expect(d.startsWith("M ")).toBe(true);
    expect(d.endsWith(" Z")).toBe(true);
    expect(d.split(" C ").length - 1).toBe(13);
  });

  it("emits no NaN for any seed, including an empty one", () => {
    for (const seed of ["", "a", "albert_park", "circuit-with-a-very-long-key"]) {
      expect(tracePath(seed), seed).not.toContain("NaN");
    }
  });

  it("is stable across calls", () => {
    expect(tracePath("suzuka")).toBe(tracePath("suzuka"));
  });
});
