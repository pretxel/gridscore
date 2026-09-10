import { MARKET_LOCK_SESSION, MARKET_TYPES, type MarketType } from "@/lib/markets";
import { rulePoints, type ScoringRules } from "@/lib/scoring";

export type ExplainerLabels = {
  market: string;
  locksAt: string;
  points: string;
  typeLabel: (type: MarketType) => string;
  lockLabel: (session: "qualifying" | "sprint" | "race") => string;
  podiumExact: string;
  podiumIn: string;
  podiumBonus: string;
  exact: string;
};

// Points table rendered from scoring_rules: no numbers live in this file.
export function ScoringExplainer({
  rules,
  labels,
}: {
  rules: ScoringRules;
  labels: ExplainerLabels;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              {labels.market}
            </th>
            <th scope="col" className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">
              {labels.locksAt}
            </th>
            <th scope="col" className="w-20 px-4 py-2.5 text-right font-medium">
              {labels.points}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {MARKET_TYPES.map((type) => {
            const lock = labels.lockLabel(MARKET_LOCK_SESSION[type]);
            if (type === "podium") {
              const lines = [
                [labels.podiumExact, rulePoints(rules, "podium", "exact_position")],
                [labels.podiumIn, rulePoints(rules, "podium", "in_podium")],
                [labels.podiumBonus, rulePoints(rules, "podium", "all_exact_bonus")],
              ] as const;
              return lines.map(([line, pts], i) => (
                <tr key={`podium-${i}`}>
                  <td className="px-4 py-2.5">
                    {i === 0 ? <span className="font-medium">{labels.typeLabel(type)}</span> : null}
                    <span
                      className={i === 0 ? "ml-2 text-muted-foreground" : "text-muted-foreground"}
                    >
                      {line}
                    </span>
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">
                    {i === 0 ? lock : ""}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                    {i === 2 ? `+${pts}` : pts}
                  </td>
                </tr>
              ));
            }
            return (
              <tr key={type}>
                <td className="px-4 py-2.5">
                  <span className="font-medium">{labels.typeLabel(type)}</span>
                  <span className="ml-2 text-muted-foreground">{labels.exact}</span>
                </td>
                <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">{lock}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                  {rulePoints(rules, type, "exact")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
