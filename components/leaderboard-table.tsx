import { cn } from "@/lib/utils";

export type LeaderboardTableRow = {
  user_id: string;
  display_name: string | null;
  total_points: number;
  podium_exact_all_hits: number;
  exact_hits: number;
  markets_scored: number;
  rank: number;
};

export type LeaderboardLabels = {
  rank: string;
  player: string;
  points: string;
  podiums: string;
  podiumsHint: string;
  exact: string;
  exactHint: string;
  scored: string;
  scoredHint: string;
  you: string;
  noName: string;
};

// Presentational standings table. Ranks, tie-breaks and admin exclusion come
// from the database; this never re-derives them.
export function LeaderboardTable({
  rows,
  currentUserId,
  labels,
  className,
}: {
  rows: LeaderboardTableRow[];
  currentUserId?: string | null;
  labels: LeaderboardLabels;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border bg-card", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <th scope="col" className="w-12 px-3 py-2.5 text-right font-medium">
              {labels.rank}
            </th>
            <th scope="col" className="px-3 py-2.5 text-left font-medium">
              {labels.player}
            </th>
            <th scope="col" className="w-16 px-3 py-2.5 text-right font-medium">
              {labels.points}
            </th>
            <th
              scope="col"
              className="hidden w-14 px-3 py-2.5 text-right font-medium sm:table-cell"
            >
              <abbr title={labels.podiumsHint} className="no-underline">
                {labels.podiums}
              </abbr>
            </th>
            <th
              scope="col"
              className="hidden w-16 px-3 py-2.5 text-right font-medium sm:table-cell"
            >
              <abbr title={labels.exactHint} className="no-underline">
                {labels.exact}
              </abbr>
            </th>
            <th
              scope="col"
              className="hidden w-16 px-3 py-2.5 text-right font-medium md:table-cell"
            >
              <abbr title={labels.scoredHint} className="no-underline">
                {labels.scored}
              </abbr>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const me = currentUserId != null && row.user_id === currentUserId;
            return (
              <tr
                key={row.user_id}
                className={cn(
                  "tabular-nums",
                  me && "bg-signal/10 ring-1 ring-inset ring-signal/40",
                  row.rank === 1 && "font-semibold",
                )}
              >
                <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                  {row.rank}
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className={cn("truncate", !row.display_name && "text-muted-foreground")}>
                      {row.display_name ?? labels.noName}
                    </span>
                    {me ? (
                      <span className="rounded-sm bg-signal px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-signal-foreground">
                        {labels.you}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold">
                  {row.total_points}
                </td>
                <td className="hidden px-3 py-2.5 text-right font-mono text-muted-foreground sm:table-cell">
                  {row.podium_exact_all_hits}
                </td>
                <td className="hidden px-3 py-2.5 text-right font-mono text-muted-foreground sm:table-cell">
                  {row.exact_hits}
                </td>
                <td className="hidden px-3 py-2.5 text-right font-mono text-muted-foreground md:table-cell">
                  {row.markets_scored}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
