"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type AdminNavItem = { href: string; label: string };

// Dashboard is a prefix of every other section, so it matches exactly; the
// other sections stay active on their nested routes (e.g. a competition editor
// keeps "Competitions" lit).
function isActive(pathname: string | null, href: string, exact: boolean) {
  if (!pathname) return false;
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({
  items,
  dashboardHref,
  label,
}: {
  items: AdminNavItem[];
  dashboardHref: string;
  label: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
      {items.map((item) => {
        const active = isActive(pathname, item.href, item.href === dashboardHref);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
