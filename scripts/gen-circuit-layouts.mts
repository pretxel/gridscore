// Builds `lib/circuits/layouts.ts` — one SVG path per circuit, traced from
// OpenStreetMap.
//
//   pnpm gen:circuit-layouts          refresh circuits that have no layout yet
//   pnpm gen:circuit-layouts --all    re-fetch every circuit
//
// The data is © OpenStreetMap contributors, licensed ODbL. The rendered
// outline is a Produced Work, so the app credits OSM wherever it is shown.
//
// Run by hand, not in CI: Overpass is a shared community service and the
// layouts change about as often as a circuit gets rebuilt. Results are
// committed, so the app never calls Overpass at runtime.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const INPUT = path.join(ROOT, "data", "circuits.json");
const OUTPUT = path.join(ROOT, "lib", "circuits", "layouts.ts");
// Overpass answers differently depending on how loaded it is, so a good
// response is kept. Rebuilding then needs no network and gives the same
// result every time. Not committed: it is a few MB of raw geometry.
const CACHE = path.join(ROOT, "node_modules", ".cache", "osm-raceways");
// The main instance rate-limits hard; the mirrors are the community's
// documented alternatives. Tried in order, per request.
const ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];
// One request at a time with a pause between: Overpass asks for restraint and
// 23 circuits is not worth being rude over.
const PAUSE_MS = 4000;
// Overpass answers 429 when it is busy and 504 when a query outruns its
// budget. Both clear up on their own, so back off and ask again.
const RETRIES = 4;
const SEARCH_RADIUS_M = 2600;
export const VIEWBOX = 100;

// Traces that came back wrong and were rejected by eye against the real
// layout. OSM coverage is the limit, not the tracing: these circuits are
// mapped in pieces, or as ordinary streets, or not yet at all. They fall back
// to the generated loop, and a re-run will not quietly reintroduce them.
const EXCLUDED: Record<string, string> = {
  baku: "street circuit mapped as ordinary roads; the trace is one open line",
  madring: "new circuit, only partly mapped",
  miami: "chain doubles back through the infield and reads as a tangle",
  silverstone: "mapped with the runway and link roads; the chain scribbles",
  suzuka: "figure-of-eight crossover breaks the chain; comes back 1.2km long",
  interlagos: "chain crosses itself through the infield",
  sepang: "picks up the pit lane and crosses the main straight",
  yas_marina: "marina section is mapped in pieces; the lap comes back broken",
};

type Circuit = { key: string; name: string; lat: number; lon: number };
type LatLon = { lat: number; lon: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function query(lat: number, lon: number): string {
  // `highway=raceway` is how OSM tags a racing surface. Relations catch
  // circuits mapped as a route; ways catch the common case.
  return `[out:json][timeout:90];
(
  way(around:${SEARCH_RADIUS_M},${lat},${lon})["highway"="raceway"];
  relation(around:${SEARCH_RADIUS_M},${lat},${lon})["highway"="raceway"];
);
out geom;`;
}

async function fetchRaceways(circuit: Circuit): Promise<LatLon[][]> {
  const cacheFile = path.join(CACHE, `${circuit.key}.json`);
  if (fs.existsSync(cacheFile)) {
    process.stdout.write("cached ");
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const lines = await fetchOnce(circuit, attempt);
      fs.mkdirSync(CACHE, { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(lines));
      return lines;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /429|504|502|timeout|fetch failed/i.test(message);
      if (!retryable || attempt > RETRIES) throw error;
      const wait = PAUSE_MS * 2 ** attempt;
      process.stdout.write(`retry ${attempt} in ${Math.round(wait / 1000)}s… `);
      await sleep(wait);
    }
  }
}

async function fetchOnce(circuit: Circuit, attempt: number): Promise<LatLon[][]> {
  const endpoint = ENDPOINTS[(attempt - 1) % ENDPOINTS.length];
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Overpass asks callers to identify themselves.
      "User-Agent": "gridscore-circuit-layouts (https://github.com/pretxel/gridscore)",
    },
    body: new URLSearchParams({ data: query(circuit.lat, circuit.lon) }),
  });
  if (!res.ok) throw new Error(`overpass ${res.status} for ${circuit.key} (${endpoint})`);
  const body = (await res.json()) as {
    elements?: { type: string; geometry?: LatLon[]; members?: { geometry?: LatLon[] }[] }[];
  };
  const lines: LatLon[][] = [];
  for (const el of body.elements ?? []) {
    if (el.geometry && el.geometry.length > 1) lines.push(el.geometry);
    for (const member of el.members ?? []) {
      if (member.geometry && member.geometry.length > 1) lines.push(member.geometry);
    }
  }
  return lines;
}

// Metres between two points, good enough at circuit scale.
function distance(a: LatLon, b: LatLon): number {
  const mPerDegLat = 111_320;
  const mPerDegLon = mPerDegLat * Math.cos((a.lat * Math.PI) / 180);
  const dx = (a.lon - b.lon) * mPerDegLon;
  const dy = (a.lat - b.lat) * mPerDegLat;
  return Math.hypot(dx, dy);
}

function length(line: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += distance(line[i - 1], line[i]);
  return total;
}

// A circuit is usually mapped as several ways that meet end to end. Chain them
// greedily from the longest piece, joining whichever unused way starts or ends
// nearest the growing chain, until nothing is close enough. Pit lanes and
// service roads sit too far from the chain's ends to be picked up.
const JOIN_TOLERANCES_M = [20, 40, 80, 140];

// A Grand Prix lap. Used to choose between the chains the tolerances produce
// and to reject one that wandered onto public roads.
const MIN_LAP_M = 2400;
const MAX_LAP_M = 8000;
const TYPICAL_LAP_M = 5000;

// Try each tolerance and keep the chain that looks most like a racing lap: a
// tight tolerance leaves a street circuit in pieces, a loose one drags in the
// pit lane, and which is right differs per circuit.
// The gap left where the chain ran out. A closed lap leaves a small one; a
// half-mapped street circuit leaves a gap the size of the circuit. Judged
// against the lap length, because 200m is nothing on a 7km lap and most of
// the way round a 3km one.
// A lap that ends a few hundred metres from where it started is still a lap:
// OSM often leaves a gap at the start/finish line. A trace that ends half a
// circuit away is not, which is what a half-mapped street course looks like.
const MAX_GAP_M = 1500;
const MAX_GAP_FRACTION = 0.25;

function bestChain(lines: LatLon[][]): LatLon[] {
  let best: LatLon[] = [];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const tolerance of JOIN_TOLERANCES_M) {
    const chain = assemble(lines, tolerance);
    const metres = length(chain);
    if (chain.length < 20 || metres < MIN_LAP_M || metres > MAX_LAP_M) continue;
    // A lap ends where it began. Without this, a half-mapped street circuit
    // ships as a stray line.
    const gap = distance(chain[0], chain[chain.length - 1]);
    if (gap > MAX_GAP_M || gap > metres * MAX_GAP_FRACTION) continue;
    // Prefer the chain that closes most tightly, then the most lap-like length.
    const score = gap * 10 + Math.abs(metres - TYPICAL_LAP_M);
    if (score < bestScore) {
      bestScore = score;
      best = chain;
    }
  }
  return best;
}

function assemble(lines: LatLon[][], JOIN_TOLERANCE_M: number): LatLon[] {
  const pool = [...lines].sort((a, b) => length(b) - length(a));
  if (pool.length === 0) return [];
  let chain = pool.shift() as LatLon[];

  for (;;) {
    let bestIndex = -1;
    let bestDistance = JOIN_TOLERANCE_M;
    let mode: "append" | "appendReversed" | "prepend" | "prependReversed" = "append";
    const head = chain[0];
    const tail = chain[chain.length - 1];

    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];
      const start = candidate[0];
      const end = candidate[candidate.length - 1];
      const options = [
        { d: distance(tail, start), m: "append" as const },
        { d: distance(tail, end), m: "appendReversed" as const },
        { d: distance(head, end), m: "prepend" as const },
        { d: distance(head, start), m: "prependReversed" as const },
      ];
      for (const option of options) {
        if (option.d < bestDistance) {
          bestDistance = option.d;
          bestIndex = i;
          mode = option.m;
        }
      }
    }

    if (bestIndex === -1) break;
    const [piece] = pool.splice(bestIndex, 1);
    if (mode === "append") chain = chain.concat(piece.slice(1));
    else if (mode === "appendReversed") chain = chain.concat([...piece].reverse().slice(1));
    else if (mode === "prepend") chain = [...piece].slice(0, -1).concat(chain);
    else chain = [...piece].reverse().slice(0, -1).concat(chain);
  }
  return chain;
}

// Drop points closer together than `minGap`, so a 2000-point way becomes a
// path small enough to ship. Keeps the first and last point.
function simplify(line: LatLon[], minGap: number): LatLon[] {
  if (line.length < 3) return line;
  const out: LatLon[] = [line[0]];
  for (let i = 1; i < line.length - 1; i++) {
    if (distance(out[out.length - 1], line[i]) >= minGap) out.push(line[i]);
  }
  out.push(line[line.length - 1]);
  return out;
}

// Equirectangular projection centred on the circuit, scaled to fill the
// viewBox while keeping the layout's real proportions.
function toPath(line: LatLon[]): string {
  const latRef = line.reduce((sum, p) => sum + p.lat, 0) / line.length;
  const mPerDegLat = 111_320;
  const mPerDegLon = mPerDegLat * Math.cos((latRef * Math.PI) / 180);
  const points = line.map((p) => ({ x: p.lon * mPerDegLon, y: -p.lat * mPerDegLat }));

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  // A margin so the stroke is not clipped by the viewBox.
  const scale = (VIEWBOX - 12) / span;
  const offsetX = (VIEWBOX - (maxX - minX) * scale) / 2;
  const offsetY = (VIEWBOX - (maxY - minY) * scale) / 2;

  const round = (n: number) => Math.round(n * 10) / 10;
  const d = points
    .map((p, i) => {
      const x = round((p.x - minX) * scale + offsetX);
      const y = round((p.y - minY) * scale + offsetY);
      return `${i === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");

  // Every layout that survives the gate is already a closed lap.
  return `${d} Z`;
}

async function main(): Promise<void> {
  const refreshAll = process.argv.includes("--all");
  // Overpass is slow and this runs against a shared service, so a run can be
  // capped and repeated: `--limit 4` until every circuit is filled in.
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : Number.POSITIVE_INFINITY;
  const circuits: Circuit[] = JSON.parse(fs.readFileSync(INPUT, "utf8"));
  const existing: Record<string, string> = fs.existsSync(OUTPUT)
    ? ((await import(`file://${OUTPUT}`)) as { CIRCUIT_LAYOUTS: Record<string, string> })
        .CIRCUIT_LAYOUTS
    : {};

  const layouts: Record<string, string> = refreshAll ? {} : { ...existing };
  let fetched = 0;

  for (const key of Object.keys(layouts)) {
    if (EXCLUDED[key]) delete layouts[key];
  }

  for (const circuit of circuits) {
    if (EXCLUDED[circuit.key]) continue;
    if (!refreshAll && layouts[circuit.key]) continue;
    if (fetched >= limit) break;
    process.stdout.write(`${circuit.key.padEnd(18)} `);
    try {
      const cached = fs.existsSync(path.join(CACHE, `${circuit.key}.json`));
      if (fetched > 0 && !cached) await sleep(PAUSE_MS);
      const lines = await fetchRaceways(circuit);
      if (!cached) fetched++;
      const chain = bestChain(lines);
      const metres = length(chain);
      if (chain.length === 0) {
        console.log(`skipped (${lines.length} ways, no chain looked like a lap)`);
        continue;
      }
      layouts[circuit.key] = toPath(simplify(chain, 12));
      console.log(`ok (${Math.round(metres)}m, ${layouts[circuit.key].length} chars)`);
    } catch (error) {
      console.log(`failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Every layout that passes the gate is a lap, so close any that was traced
  // before the gate existed rather than leaving a hairline gap on screen.
  for (const key of Object.keys(layouts)) {
    if (!layouts[key].endsWith(" Z")) layouts[key] = `${layouts[key]} Z`;
  }

  const keys = Object.keys(layouts).sort();
  const body = keys.map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(layouts[key])},`);
  const file = `// Generated by scripts/gen-circuit-layouts.mts — do not edit by hand.
//
// Circuit outlines traced from OpenStreetMap.
// Map data © OpenStreetMap contributors, licensed ODbL (opendatacommons.org/licenses/odbl).
// The app credits OSM wherever these are drawn.
//
// Keyed by \`grands_prix.circuit_key\`. A circuit with no entry falls back to
// the generated loop in lib/circuit-trace.ts — either OSM has not mapped it as
// a closed racing lap, or its trace was rejected (see EXCLUDED in the script).

export const CIRCUIT_LAYOUTS: Record<string, string> = {
${body.join("\n")}
};

export const CIRCUIT_LAYOUT_VIEWBOX = ${VIEWBOX};

export function circuitLayout(key: string | null | undefined): string | null {
  if (!key) return null;
  return CIRCUIT_LAYOUTS[key] ?? null;
}
`;
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, file);
  // Format it here, or the committed file fails the pre-push check every time
  // this script runs.
  execFileSync(path.join(ROOT, "node_modules", ".bin", "biome"), ["check", "--write", OUTPUT], {
    stdio: "ignore",
  });
  console.log(`\n${keys.length} layouts written to ${path.relative(ROOT, OUTPUT)}`);
}

await main();
