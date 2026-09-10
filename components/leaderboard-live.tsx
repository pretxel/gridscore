"use client";

import { useEffect, useState } from "react";
import {
  type LeaderboardLabels,
  LeaderboardTable,
  type LeaderboardTableRow,
} from "@/components/leaderboard-table";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

// Collapse the burst of score rows written when one market resolves into a
// single re-fetch.
const REFETCH_DEBOUNCE_MS = 750;

export type LeaderboardSource =
  | { kind: "overall" }
  | { kind: "grand_prix"; gpId: string }
  | { kind: "league"; leagueId: string };

function sourceKey(source: LeaderboardSource): string {
  switch (source.kind) {
    case "overall":
      return "overall";
    case "grand_prix":
      return `gp-${source.gpId}`;
    case "league":
      return `league-${source.leagueId}`;
  }
}

// Live wrapper around the standings table. Seeded by the SSR rows, it listens
// to Realtime changes on public.scores and re-fetches the same source the
// server used (the season view, the per-weekend or the per-league function). Ranks and
// tie-breaks stay a database concern. Any failure keeps the SSR rows.
export function LeaderboardLive({
  initialRows,
  source,
  currentUserId,
  labels,
  limit,
}: {
  initialRows: LeaderboardTableRow[];
  source: LeaderboardSource;
  currentUserId?: string | null;
  labels: LeaderboardLabels;
  limit: number;
}) {
  const [rows, setRows] = useState<LeaderboardTableRow[]>(initialRows);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const key = sourceKey(source);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function refetch() {
      const res =
        source.kind === "overall"
          ? await supabase
              .from("v_leaderboard_overall")
              .select("*")
              .order("rank", { ascending: true })
          : source.kind === "grand_prix"
            ? await supabase.rpc("leaderboard_for_grand_prix", { p_gp_id: source.gpId })
            : await supabase.rpc("leaderboard_for_league", { p_league_id: source.leagueId });
      if (cancelled || res.error || !res.data) return;
      setRows((res.data as LeaderboardTableRow[]).slice(0, limit));
    }

    function scheduleRefetch() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refetch, REFETCH_DEBOUNCE_MS);
    }

    const channel = supabase
      .channel(`leaderboard-${key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "scores" }, scheduleRefetch)
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [key, limit]);

  return <LeaderboardTable rows={rows} currentUserId={currentUserId} labels={labels} />;
}
