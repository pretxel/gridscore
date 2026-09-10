import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { type Locale, SUPPORTED_LOCALES } from "@/lib/i18n";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type StaticRoute = {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
};

// Only public routes: everything behind the sign-in or admin gate is marked
// noindex by its own metadata and has nothing to offer a crawler.
const STATIC_ROUTES: StaticRoute[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/gp", changeFrequency: "daily", priority: 0.9 },
  { path: "/leaderboard", changeFrequency: "daily", priority: 0.8 },
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.5 },
  { path: "/sign-in", changeFrequency: "weekly", priority: 0.3 },
];

function urlFor(base: string, locale: Locale, path: string): string {
  const trimmed = path === "/" ? "" : path;
  return `${base}/${locale}${trimmed}`;
}

function languageAlternates(base: string, path: string): Record<string, string> {
  return Object.fromEntries(SUPPORTED_LOCALES.map((loc) => [loc, urlFor(base, loc, path)]));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl.replace(/\/$/, "");
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.flatMap((route) =>
    SUPPORTED_LOCALES.map((locale) => ({
      url: urlFor(base, locale, route.path),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: { languages: languageAlternates(base, route.path) },
    })),
  );

  let gpEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("grands_prix")
      .select("slug, updated_at, seasons!inner(status)")
      .eq("seasons.status", "active");
    gpEntries = (data ?? []).flatMap((gp) =>
      SUPPORTED_LOCALES.map((locale) => ({
        url: urlFor(base, locale, `/gp/${gp.slug}`),
        lastModified: gp.updated_at ? new Date(gp.updated_at) : now,
        changeFrequency: "daily" as const,
        priority: 0.7,
        alternates: { languages: languageAlternates(base, `/gp/${gp.slug}`) },
      })),
    );
  } catch {
    gpEntries = [];
  }

  return [...staticEntries, ...gpEntries];
}
