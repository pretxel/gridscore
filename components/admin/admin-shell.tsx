import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AdminNav, type AdminNavItem } from "@/components/admin/admin-nav";
import { type Locale, localePath } from "@/lib/i18n";

const NAV = [
  { href: "/admin", key: "dashboard" },
  { href: "/admin/grands-prix", key: "grandsPrix" },
  { href: "/admin/drivers", key: "drivers" },
  { href: "/admin/scoring", key: "scoring" },
  { href: "/admin/leagues", key: "leagues" },
  { href: "/admin/operations", key: "operations" },
] as const;

// Persistent command bar for the admin "control room": section nav that marks
// the current route and scrolls horizontally on narrow viewports.
export async function AdminShell({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = await getTranslations("admin");
  const dashboardHref = localePath(locale, "/admin");
  const items: AdminNavItem[] = NAV.map((n) => ({
    href: localePath(locale, n.href),
    label: t(`nav.${n.key}`),
  }));

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-12 max-w-5xl items-center gap-4 px-4">
          <Link
            href={dashboardHref}
            className="flex shrink-0 items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span aria-hidden className="size-2 rounded-full bg-signal" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("nav.sectionLabel")}
            </span>
          </Link>
          <AdminNav items={items} dashboardHref={dashboardHref} label={t("nav.sectionLabel")} />
        </div>
      </header>
      {children}
    </div>
  );
}
