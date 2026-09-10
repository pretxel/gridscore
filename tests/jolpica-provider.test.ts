import { describe, expect, it } from "vitest";
import {
  createJolpicaProvider,
  mapClassification,
  mapRace,
  sessionInstant,
  teamMapFromStandings,
} from "@/lib/race-sync/providers/jolpica";
import { fixtureFetch, jolpicaFixture } from "./helpers/fixtures";

const BASE = "https://jolpica.test/ergast/f1";

function provider(routes: Parameters<typeof fixtureFetch>[0], calls: string[] = []) {
  return createJolpicaProvider({
    baseUrl: BASE,
    fetch: fixtureFetch(routes, calls),
    minIntervalMs: 0,
    sleep: async () => {},
  });
}

describe("sessionInstant", () => {
  it("combines date and time into a UTC instant", () => {
    expect(sessionInstant({ date: "2026-03-08", time: "04:00:00Z" })).toBe(
      "2026-03-08T04:00:00.000Z",
    );
  });
  it("treats a missing time as midnight UTC and a missing session as null", () => {
    expect(sessionInstant({ date: "2026-03-08" })).toBe("2026-03-08T00:00:00.000Z");
    expect(sessionInstant(undefined)).toBeNull();
  });
});

describe("mapRace", () => {
  const races = (jolpicaFixture("races-2025.json") as any).MRData.RaceTable.Races;

  it("maps a sprint weekend with every session", () => {
    const gp = mapRace(races[1]);
    expect(gp.round).toBe(2);
    expect(gp.circuitKey).toBe("shanghai");
    expect(gp.country).toBe("China");
    expect(gp.race).toBe("2025-03-23T07:00:00.000Z");
    expect(gp.qualifying).toBe("2025-03-22T07:00:00.000Z");
    expect(gp.sprint).toBe("2025-03-22T03:00:00.000Z");
    expect(gp.sprintQualifying).toBe("2025-03-21T07:30:00.000Z");
    expect(gp.fp1).toBe("2025-03-21T03:30:00.000Z");
    expect(gp.fp2).toBeNull();
    expect(gp.raw).toBe(races[1]);
  });

  it("maps a conventional weekend with three practices and no sprint", () => {
    const gp = mapRace(races[0]);
    expect(gp.sprint).toBeNull();
    expect(gp.fp3).not.toBeNull();
  });
});

describe("mapClassification", () => {
  const rows = (jolpicaFixture("results-2025-1.json") as any).MRData.RaceTable.Races[0].Results;

  it("keeps positions for classified cars and nulls them for retirements", () => {
    const winner = mapClassification(rows[0]);
    expect(winner).toMatchObject({ position: 1, positionText: "1", driverKey: "norris", laps: 57 });
    expect(winner.fastestLapRank).toBe(1);
    const retired = rows.map(mapClassification).filter((r: any) => r.positionText === "R");
    expect(retired.length).toBeGreaterThan(0);
    for (const r of retired) expect(r.position).toBeNull();
  });
});

describe("teamMapFromStandings", () => {
  it("uses the last listed constructor as the current team", () => {
    const lists = (jolpicaFixture("driverstandings-2025.json") as any).MRData.StandingsTable
      .StandingsLists[0].DriverStandings;
    const map = teamMapFromStandings(lists);
    expect(map.get("norris")).toBe("mclaren");
    expect(
      teamMapFromStandings([
        {
          Driver: { driverId: "x" },
          Constructors: [{ constructorId: "old" }, { constructorId: "new" }],
        },
      ]).get("x"),
    ).toBe("new");
  });
});

describe("createJolpicaProvider", () => {
  it("fetches the calendar", async () => {
    const p = provider({ "/2026/races.json?limit=100": "races-2026.json" });
    const cal = await p.fetchCalendar(2026);
    expect(cal).toHaveLength(23);
    expect(cal.filter((gp) => gp.sprint).map((gp) => gp.round)).toEqual([2, 4, 5, 9, 12, 17]);
  });

  it("fetches drivers with their team from the standings", async () => {
    const p = provider({
      "/2025/drivers.json?limit=100": "drivers-2025.json",
      "/2025/driverstandings.json?limit=100": "driverstandings-2025.json",
    });
    const drivers = await p.fetchDrivers(2025);
    const norris = drivers.find((d) => d.key === "norris");
    expect(norris).toMatchObject({ code: "NOR", number: 1, teamKey: "mclaren" });
  });

  it("fetches teams", async () => {
    const p = provider({ "/2025/constructors.json?limit=100": "constructors-2025.json" });
    const teams = await p.fetchTeams(2025);
    expect(teams).toHaveLength(10);
    expect(teams.find((t) => t.key === "mclaren")?.name).toBe("McLaren");
  });

  it("returns null when a session has not been run, rows otherwise", async () => {
    const p = provider({
      "/2025/1/sprint.json?limit=100": "sprint-2025-1-none.json",
      "/2025/2/sprint.json?limit=100": "sprint-2025-2.json",
      "/2025/1/qualifying.json?limit=100": "qualifying-2025-1.json",
      "/2025/1/results.json?limit=100": "results-2025-1.json",
    });
    expect(await p.fetchSprintResults(2025, 1)).toBeNull();
    const sprint = await p.fetchSprintResults(2025, 2);
    expect(sprint?.find((r) => r.position === 1)?.driverKey).toBe("hamilton");
    const quali = await p.fetchQualifying(2025, 1);
    expect(quali?.find((q) => q.position === 1)?.driverKey).toBe("norris");
    const race = await p.fetchRaceResults(2025, 1);
    expect(race?.find((r) => r.position === 1)?.driverKey).toBe("norris");
  });

  it("retries once after a 429 honouring Retry-After", async () => {
    let attempts = 0;
    const slept: number[] = [];
    const p = createJolpicaProvider({
      baseUrl: BASE,
      minIntervalMs: 0,
      sleep: async (ms) => {
        slept.push(ms);
      },
      fetch: async () => {
        attempts++;
        if (attempts === 1) {
          return new Response(null, { status: 429, headers: { "retry-after": "2" } });
        }
        return new Response(JSON.stringify(jolpicaFixture("constructors-2025.json")), {
          status: 200,
        });
      },
    });
    const teams = await p.fetchTeams(2025);
    expect(teams).toHaveLength(10);
    expect(attempts).toBe(2);
    expect(slept).toContain(2000);
  });

  it("throws on a non-OK response", async () => {
    const p = provider({});
    await expect(p.fetchTeams(2025)).rejects.toThrow(/404/);
  });

  it("spaces consecutive requests by the minimum interval", async () => {
    let clock = 0;
    const slept: number[] = [];
    const p = createJolpicaProvider({
      baseUrl: BASE,
      minIntervalMs: 300,
      now: () => clock,
      sleep: async (ms) => {
        slept.push(ms);
        clock += ms;
      },
      fetch: fixtureFetch({
        "/2025/drivers.json?limit=100": "drivers-2025.json",
        "/2025/driverstandings.json?limit=100": "driverstandings-2025.json",
      }),
    });
    await p.fetchDrivers(2025);
    expect(slept).toEqual([300]);
  });
});
