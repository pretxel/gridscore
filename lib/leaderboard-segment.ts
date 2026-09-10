// URL-driven leaderboard segment: `?gp=<slug>` shows one weekend, anything
// else the season. Unknown slugs fall back to the season instead of erroring.

export type LeaderboardSegment = { kind: "overall" } | { kind: "grand_prix"; slug: string };

export function parseGrandPrixParam(
  raw: string | string[] | undefined,
  knownSlugs: readonly string[],
): LeaderboardSegment {
  if (!raw) return { kind: "overall" };
  const known = new Set(knownSlugs);
  for (const value of Array.isArray(raw) ? raw : [raw]) {
    const slug = value.trim();
    if (known.has(slug)) return { kind: "grand_prix", slug };
  }
  return { kind: "overall" };
}

// Rank of the signed-in user, or null when they have no scored call yet.
export function findOwnRow<T extends { user_id: string }>(
  rows: T[],
  userId: string | null,
): T | null {
  if (!userId) return null;
  return rows.find((r) => r.user_id === userId) ?? null;
}
