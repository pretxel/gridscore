import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { listMyLeagues } from "@/lib/leagues";
import { leagueMemberCap } from "@/lib/plans";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LeagueForms } from "./league-forms";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "leagues" });
  return { title: t("title"), description: t("description"), robots: { index: false } };
}

export default async function LeaguesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const t = await getTranslations("leagues");

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(localePath(locale, "/sign-in"));

  const leagues = await listMyLeagues(user.id, supabase);
  const leaguesPath = localePath(locale, "/leagues");

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-6 border-b border-border pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1
          className="mt-1 font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
          style={{ fontStretch: "condensed" }}
        >
          {t("headline")}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("lede")}</p>
      </header>

      {leagues.length === 0 ? (
        <div className="mb-6 rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <ul className="mb-8 grid gap-3 sm:grid-cols-2">
          {leagues.map((league) => {
            const cap = leagueMemberCap(league.plan);
            return (
              <li key={league.id}>
                <Link
                  href={`${leaguesPath}/${league.id}`}
                  className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-signal/60 hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="truncate font-heading text-lg font-semibold tracking-tight">
                      {league.name}
                    </h2>
                    <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                      {league.role === "owner" ? t("roleOwner") : t("roleMember")}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    {cap === null
                      ? t("membersUnlimited", { count: league.member_count })
                      : t("membersOfCap", { count: league.member_count, cap })}
                    {league.plan === "pro" ? ` · ${t("planPro")}` : ""}
                  </p>
                  <p className="mt-1 font-mono text-xs tracking-[0.14em] text-muted-foreground">
                    {league.join_code}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <LeagueForms leaguesPath={leaguesPath} />
    </main>
  );
}
