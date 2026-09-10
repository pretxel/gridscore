import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminActionFeedback, feedbackFrom } from "@/components/admin/action-feedback";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { FormSection } from "@/components/admin/form-section";
import { SubmitButton } from "@/components/admin/submit-button";
import { LocalTime } from "@/components/local-time";
import { getManagedSeason } from "@/lib/admin/managed-season";
import { listLeagues } from "@/lib/admin/queries";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import { leagueMemberCap } from "@/lib/plans";
import { setLeaguePlan } from "./actions";

export default async function AdminLeaguesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const feedback = feedbackFrom(await searchParams);
  const t = await getTranslations("admin");

  const managed = await getManagedSeason();
  if (!managed) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <AdminPageHeader eyebrow={t("nav.leagues")} title={t("leagues.title")} />
        <EmptyState title={t("grandsPrix.noSeason")} className="mt-8" />
      </main>
    );
  }

  const leagues = await listLeagues(managed.season.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="admin-reveal space-y-6">
        <AdminPageHeader
          eyebrow={t("nav.leagues")}
          title={t("leagues.title")}
          description={t("leagues.description", { season: managed.season.name })}
        />

        <AdminActionFeedback {...feedback} />

        {leagues.length === 0 ? (
          <EmptyState title={t("leagues.emptyTitle")} description={t("leagues.emptyBody")} />
        ) : (
          <FormSection
            title={t("leagues.tableTitle")}
            description={t("leagues.tableBody", { count: leagues.length })}
          >
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {leagues.map((league) => {
                const cap = leagueMemberCap(league.plan);
                const full = cap !== null && league.memberCount >= cap;
                return (
                  <li
                    key={league.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{league.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {league.join_code} · {t("leagues.owner")}{" "}
                        {league.ownerName ?? t("leagues.noName")} ·{" "}
                        {cap === null
                          ? t("leagues.membersUnlimited", { count: league.memberCount })
                          : t("leagues.membersOfCap", { count: league.memberCount, cap })}
                        {full ? ` · ${t("leagues.full")}` : ""} ·{" "}
                        <LocalTime iso={league.created_at} format="date" />
                      </p>
                    </div>
                    <form action={setLeaguePlan} className="flex items-center gap-2">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="league_id" value={league.id} />
                      <input
                        type="hidden"
                        name="plan"
                        value={league.plan === "pro" ? "free" : "pro"}
                      />
                      <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                        {league.plan === "pro" ? t("leagues.planPro") : t("leagues.planFree")}
                      </span>
                      <SubmitButton size="sm" variant="outline">
                        {league.plan === "pro" ? t("leagues.downgrade") : t("leagues.upgrade")}
                      </SubmitButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          </FormSection>
        )}
      </div>
    </main>
  );
}
