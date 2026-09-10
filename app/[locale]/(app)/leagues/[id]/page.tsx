import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { InviteCode } from "@/components/invite-code";
import { LeaderboardLive } from "@/components/leaderboard-live";
import type { LeaderboardTableRow } from "@/components/leaderboard-table";
import { LocalTime } from "@/components/local-time";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { findOwnRow } from "@/lib/leaderboard-segment";
import { getLeague, getLeagueBoard } from "@/lib/leagues";
import { leagueMemberCap } from "@/lib/plans";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LeagueControls, RemoveMemberButton } from "./league-controls";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOARD_LIMIT = 200;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "leagues" });
  return { title: t("title"), robots: { index: false } };
}

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(localePath(locale, "/sign-in"));

  const [league, board, t, tl] = await Promise.all([
    getLeague(id, supabase),
    getLeagueBoard(id, supabase),
    getTranslations("leagues"),
    getTranslations("leaderboard"),
  ]);
  if (!league) notFound();
  const me = league.members.find((m) => m.user_id === user.id);
  // Admins can read any league; only members get a page.
  if (!me) notFound();

  const isOwner = league.owner_id === user.id;
  const cap = leagueMemberCap(league.plan);
  const full = cap !== null && league.members.length >= cap;
  const leaguesPath = localePath(locale, "/leagues");
  const joinPath = localePath(locale, `/leagues/join/${league.join_code}`);
  const rows = board.rows as LeaderboardTableRow[];
  const own = findOwnRow(rows, user.id);

  const labels = {
    rank: tl("headerRank"),
    player: tl("headerPlayer"),
    points: tl("headerPoints"),
    podiums: tl("headerPodiums"),
    podiumsHint: tl("headerPodiumsHint"),
    exact: tl("headerExact"),
    exactHint: tl("headerExactHint"),
    scored: tl("headerScored"),
    scoredHint: tl("headerScoredHint"),
    you: tl("you"),
    noName: tl("noName"),
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={leaguesPath}
        className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
      >
        ← {t("backToLeagues")}
      </Link>
      <header className="mt-3 mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("eyebrow")} · {isOwner ? t("roleOwner") : t("roleMember")}
            {league.plan === "pro" ? ` · ${t("planPro")}` : ""}
          </p>
          <h1
            className="mt-1 truncate font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
            style={{ fontStretch: "condensed" }}
          >
            {league.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {cap === null
              ? t("membersUnlimited", { count: league.members.length })
              : t("membersOfCap", { count: league.members.length, cap })}
            {full ? ` · ${t("full")}` : ""}
          </p>
        </div>
        <LeagueControls
          leagueId={league.id}
          name={league.name}
          isOwner={isOwner}
          leaguesPath={leaguesPath}
        />
      </header>

      <InviteCode
        code={league.join_code}
        joinPath={joinPath}
        className="mb-6"
        labels={{
          code: t("inviteCode"),
          copyCode: t("copyCode"),
          copyLink: t("copyLink"),
          share: t("share"),
          copied: t("copied"),
          shareTitle: t("shareTitle", { name: league.name }),
          shareText: t("shareText", { name: league.name }),
        }}
      />
      {full ? (
        <p className="mb-6 rounded-lg border border-signal/40 bg-signal/10 px-4 py-3 text-sm">
          {t("fullHint", { cap: cap ?? 0 })}
        </p>
      ) : null}

      <section aria-labelledby="league-board-title" className="mb-8">
        <h2 id="league-board-title" className="mb-3 font-heading text-lg font-semibold">
          {t("boardTitle")}
        </h2>
        {board.error ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {tl("loadFailedTitle")}
          </p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            {t("boardEmpty")}
          </div>
        ) : (
          <>
            <LeaderboardLive
              initialRows={rows.slice(0, BOARD_LIMIT)}
              source={{ kind: "league", leagueId: league.id }}
              currentUserId={user.id}
              labels={labels}
              limit={BOARD_LIMIT}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              {own
                ? `${tl("yourRank")}: #${own.rank} · ${own.total_points} ${tl("headerPoints").toLowerCase()}`
                : t("notRankedInLeague")}
            </p>
          </>
        )}
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {t("joinedCutoffHint")}
        </p>
      </section>

      <section aria-labelledby="league-members-title">
        <h2 id="league-members-title" className="mb-3 font-heading text-lg font-semibold">
          {t("membersTitle")}
        </h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {league.members.map((member) => {
            const name = member.display_name ?? tl("noName");
            return (
              <li
                key={member.user_id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <span className="truncate font-medium">{name}</span>
                  {member.user_id === user.id ? (
                    <span className="ml-2 rounded-sm bg-signal px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-signal-foreground">
                      {tl("you")}
                    </span>
                  ) : null}
                  {member.role === "owner" ? (
                    <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                      {t("roleOwner")}
                    </span>
                  ) : null}
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {t("joinedOn")} <LocalTime iso={member.joined_at} format="date" />
                  </p>
                </div>
                {isOwner && member.user_id !== user.id ? (
                  <RemoveMemberButton
                    leagueId={league.id}
                    userId={member.user_id}
                    displayName={name}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
