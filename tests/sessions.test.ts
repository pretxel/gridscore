import { describe, expect, it } from "vitest";
import { SESSION_MINUTES, type SessionKey, sessionPhase, sessionsOf } from "@/lib/sessions";

const START = "2026-09-17T12:00:00.000Z";
const startMs = Date.parse(START);
const minutes = (n: number) => n * 60_000;

function at(key: SessionKey, now: number) {
  return sessionPhase({ key, at: START }, now);
}

describe("sessionPhase", () => {
  it("is upcoming right up to the start", () => {
    expect(at("race", startMs - 1)).toBe("upcoming");
  });

  it("goes live at the start and stays live for the session's length", () => {
    expect(at("race", startMs)).toBe("live");
    expect(at("race", startMs + minutes(SESSION_MINUTES.race) - 1)).toBe("live");
  });

  it("is past once the session's length has run out", () => {
    expect(at("race", startMs + minutes(SESSION_MINUTES.race))).toBe("past");
  });

  it("gives a practice hour rather than the race's longer window", () => {
    expect(at("fp1", startMs + minutes(90))).toBe("past");
    expect(at("race", startMs + minutes(90))).toBe("live");
  });

  it("treats an unparseable time as upcoming rather than live", () => {
    expect(sessionPhase({ key: "race", at: "not a date" }, startMs)).toBe("upcoming");
  });
});

describe("sessionsOf", () => {
  it("keeps only the sessions a weekend has, in time order", () => {
    const gp = {
      fp1_at: "2026-09-15T10:00:00.000Z",
      fp2_at: null,
      fp3_at: null,
      sprint_qualifying_at: null,
      sprint_at: null,
      qualifying_at: "2026-09-16T14:00:00.000Z",
      race_at: "2026-09-17T12:00:00.000Z",
    };
    // The row carries many more columns; only the session ones are read.
    expect(sessionsOf(gp as never).map((s) => s.key)).toEqual(["fp1", "qualifying", "race"]);
  });
});
