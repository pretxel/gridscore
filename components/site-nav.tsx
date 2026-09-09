import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logotype } from "@/components/logotype";
import { MobileNav, NavLinks } from "@/components/site-nav-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/lib/i18n";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function SiteNav() {
  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("nav");
  const tCommon = await getTranslations("common");
  const rawLocale = await getLocale();
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const lp = (path: string) => localePath(locale, path);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let displayName: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("is_admin, display_name")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = data?.is_admin ?? false;
    displayName = data?.display_name ?? null;
  }

  const links = [
    { href: lp("/gp"), label: t("calendar") },
    { href: lp("/leaderboard"), label: t("leaderboard") },
    ...(user ? [{ href: lp("/my-picks"), label: t("myPicks") }] : []),
    ...(user ? [{ href: lp("/leagues"), label: t("leagues") }] : []),
    ...(isAdmin ? [{ href: lp("/admin"), label: t("admin") }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href={lp("/")} className="group/brand flex items-center" aria-label="gridscore">
          <Logotype size="xs" className="text-foreground" />
        </Link>

        <NavLinks links={links} className="hidden md:flex" />

        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          <ThemeToggle />
          {user ? (
            <UserMenu
              displayName={displayName}
              email={user.email ?? ""}
              signOutPath={lp("/sign-out")}
            />
          ) : (
            <Link
              href={lp("/sign-in")}
              className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}
            >
              {tCommon("signIn")}
            </Link>
          )}
          <MobileNav
            links={links}
            signedIn={!!user}
            signInHref={lp("/sign-in")}
            className="md:hidden"
          />
        </div>
      </nav>
    </header>
  );
}

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const rawLocale = await getLocale();
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  return (
    <footer className="mt-auto border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Logotype size="xs" className="text-foreground" />
          <span className="font-mono uppercase tracking-[0.2em]">{t("tagline")}</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={localePath(locale, "/how-it-works")}
            className="hover:text-foreground hover:underline"
          >
            {t("howItWorks")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
