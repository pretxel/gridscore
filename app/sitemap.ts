import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { type Locale, SUPPORTED_LOCALES } from "@/lib/i18n";

type StaticRoute = {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
};

// Public routes only. Per-Grand-Prix entries are appended in phase 3 once the
// calendar exists.
const STATIC_ROUTES: StaticRoute[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/sign-in", changeFrequency: "weekly", priority: 0.3 },
];

function urlFor(base: string, locale: Locale, path: string): string {
  const trimmed = path === "/" ? "" : path;
  return `${base}/${locale}${trimmed}`;
}

function languageAlternates(base: string, path: string): Record<string, string> {
  return Object.fromEntries(SUPPORTED_LOCALES.map((loc) => [loc, urlFor(base, loc, path)]));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.siteUrl.replace(/\/$/, "");
  const now = new Date();

  return STATIC_ROUTES.flatMap((route) =>
    SUPPORTED_LOCALES.map((locale) => ({
      url: urlFor(base, locale, route.path),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: { languages: languageAlternates(base, route.path) },
    })),
  );
}
