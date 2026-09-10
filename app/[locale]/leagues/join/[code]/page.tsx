import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { normalizeJoinCode } from "@/lib/league-form";
import { getLeaguePreview, isMemberOf } from "@/lib/leagues";
import { resolveOnboardingRedirect } from "@/lib/onboarding/gate";
import { leagueIsFull, leagueMemberCap } from "@/lib/plans";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { JoinConfirm } from "./join-confirm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "leagueInvite" });
  return { title: t("title"), robots: { index: false } };
}

// Lives outside the (app) group so an invite link can carry its own return
// path through sign-in and onboarding instead of landing on the home page.
export default async function JoinLeaguePage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale: raw, code: rawCode } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const t = await getTranslations("leagueInvite");
  const code = normalizeJoinCode(rawCode);
  const selfPath = localePath(locale, `/leagues/join/${code ?? rawCode}`);
  const leaguesPath = localePath(locale, "/leagues");

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`${localePath(locale, "/sign-in")}?next=${encodeURIComponent(selfPath)}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const onboarding = resolveOnboardingRedirect({ displayName: profile?.display_name ?? null });
  if (onboarding) {
    redirect(`${localePath(locale, onboarding)}?next=${encodeURIComponent(selfPath)}`);
  }

  const preview = code ? await getLeaguePreview(code, supabase) : null;
  if (preview && (await isMemberOf(preview.id, supabase))) {
    redirect(`${leaguesPath}/${preview.id}`);
  }
  const cap = preview ? leagueMemberCap(preview.plan) : null;
  const full = preview ? leagueIsFull(preview.plan, preview.member_count) : false;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        {t("eyebrow")}
      </p>
      {preview && code ? (
        <>
          <h1
            className="mt-1 font-heading text-4xl font-semibold tracking-tight"
            style={{ fontStretch: "condensed" }}
          >
            {preview.name}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {cap === null
              ? t("membersUnlimited", { count: preview.member_count })
              : t("membersOfCap", { count: preview.member_count, cap })}
            {" · "}
            <span className="font-mono tracking-[0.12em]">{code}</span>
          </p>
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
            {full ? (
              <p role="alert" className="mb-4 text-sm">
                {t("full", { cap: cap ?? 0 })}
              </p>
            ) : (
              <p className="mb-4 text-sm text-muted-foreground">{t("lede")}</p>
            )}
            <JoinConfirm code={code} leaguesPath={leaguesPath} disabled={full} />
          </div>
        </>
      ) : (
        <>
          <h1
            className="mt-1 font-heading text-4xl font-semibold tracking-tight"
            style={{ fontStretch: "condensed" }}
          >
            {t("invalidTitle")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("invalidBody")}</p>
        </>
      )}
      <Link
        href={leaguesPath}
        className={cn(buttonVariants({ variant: "ghost" }), "mt-4 self-start")}
      >
        {t("backToLeagues")}
      </Link>
    </main>
  );
}
