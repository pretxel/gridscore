import { getTranslations } from "next-intl/server";
import { UpgradeCta } from "@/components/upgrade-cta";

// What a free reader sees: the real shape of the page with the numbers
// blurred out. It shows the headline total, which they already have on the
// leaderboard, and hides the per-market breakdown behind the upgrade.
export async function StatsLocked({ totalPoints }: { totalPoints: number }) {
  const t = await getTranslations("stats");
  const tm = await getTranslations("markets");

  return (
    <div className="grid gap-4">
      <UpgradeCta feature="premiumStats" />

      <div className="relative overflow-hidden rounded-xl border border-border bg-card">
        <div aria-hidden className="select-none blur-[5px]" data-testid="stats-preview">
          <div className="grid grid-cols-3 gap-3 border-b border-border p-4">
            {["accuracy", "streak", "vsField"].map((key) => (
              <div key={key}>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {t(`metric.${key}` as never)}
                </p>
                <p className="font-mono text-2xl font-semibold tabular-nums">88%</p>
              </div>
            ))}
          </div>
          <ul className="divide-y divide-border">
            {(["pole", "podium", "fastest_lap"] as const).map((type) => (
              <li key={type} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{tm(`type.${type}`)}</span>
                <span className="font-mono tabular-nums">00%</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/40">
          <p className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium">
            {t("lockedBadge")}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{t("lockedTotal", { points: totalPoints })}</p>
    </div>
  );
}
