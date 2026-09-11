// A track-shaped outline for a Grand Prix card, generated from the circuit's
// own key so each weekend gets its own recognisable squiggle that never
// changes between renders.
//
// Deliberately NOT a real circuit layout. Published track maps are copyrighted
// artwork, and the project rule forbids shipping the championship's assets, so
// this draws an original closed loop instead. It is decorative: nothing in the
// UI claims it is the actual course.
//
// Pure and deterministic, so it can be unit-tested and rendered on the server.

// FNV-1a: small, fast, and stable across runs, unlike a hash that depends on
// engine internals.
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: one line, good enough spread for shape variation.
function rng(seedValue: number): () => number {
  let a = seedValue;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TRACE_VIEWBOX = 100;

export type TracePoint = { x: number; y: number };

// Points around an ellipse with a wandering radius: the result reads as a
// circuit rather than a blob because consecutive radii stay correlated.
export function tracePoints(seed: string, count = 13): TracePoint[] {
  const random = rng(hash(seed));
  const centre = TRACE_VIEWBOX / 2;
  const baseRadius = TRACE_VIEWBOX * 0.34;
  // A per-circuit stretch so some loops are long and thin, others compact.
  const stretchX = 1 + random() * 0.5;
  const stretchY = 0.7 + random() * 0.4;
  const startAngle = random() * Math.PI * 2;

  // One stretch of the lap runs long and smooth: every circuit has a straight.
  const straightAt = Math.floor(random() * count);
  const points: TracePoint[] = [];
  let radius = baseRadius;
  for (let i = 0; i < count; i++) {
    // Drift the radius a little each step, then pull it back towards the base
    // so the loop cannot spiral away from the viewBox.
    const onStraight = i === straightAt || i === (straightAt + 1) % count;
    radius += (random() - 0.5) * baseRadius * (onStraight ? 0.08 : 0.85);
    radius += (baseRadius - radius) * 0.32;
    const angle = startAngle + (i / count) * Math.PI * 2;
    points.push({
      x: centre + Math.cos(angle) * radius * stretchX,
      y: centre + Math.sin(angle) * radius * stretchY,
    });
  }
  return points;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

// Closed Catmull-Rom through the points, converted to cubic béziers: smooth
// corners without the cusps a naive spline gives on a closed loop.
export function tracePath(seed: string, count = 13): string {
  const points = tracePoints(seed, count);
  const n = points.length;
  const at = (i: number) => points[((i % n) + n) % n];

  let d = `M ${round(points[0].x)} ${round(points[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 11;
    const c1y = p1.y + (p2.y - p0.y) / 11;
    const c2x = p2.x - (p3.x - p1.x) / 11;
    const c2y = p2.y - (p3.y - p1.y) / 11;
    d += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(p2.x)} ${round(p2.y)}`;
  }
  return `${d} Z`;
}
