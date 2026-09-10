import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

// The upgrade prompt. There is no payment provider yet, so it deliberately
// renders no button: it states what Pro adds and says how to get it today
// (ask an operator, who flips the plan from the admin panel). Wiring a
// checkout later means replacing the closing line, nothing else.
export async function UpgradeCta({
  feature,
  className,
}: {
  feature: "premiumStats" | "sponsorFree" | "leagues";
  className?: string;
}) {
  const t = await getTranslations("upgrade");

  return (
    <aside
      className={cn("rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-sm", className)}
      aria-labelledby="upgrade-title"
    >
      <p
        id="upgrade-title"
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
      >
        {t("eyebrow")}
      </p>
      <p className="mt-1 font-medium">{t(`reason.${feature}`)}</p>
      <ul className="mt-2 grid gap-0.5 text-xs text-muted-foreground">
        <li>{t("benefitStats")}</li>
        <li>{t("benefitSponsorFree")}</li>
        <li>{t("benefitLeagues")}</li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">{t("howTo")}</p>
    </aside>
  );
}
