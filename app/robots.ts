import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { SUPPORTED_LOCALES } from "@/lib/i18n";

// Routes that require a session, or that exist only to redirect. Every app
// route carries a locale prefix (`/en/admin`, `/es/admin`), so each entry is
// expanded per locale — an unprefixed "/admin" would match nothing.
const PRIVATE_PATHS = ["/admin", "/my-picks", "/leagues", "/stats", "/onboarding", "/sign-out"];

export default function robots(): MetadataRoute.Robots {
  const disallow = SUPPORTED_LOCALES.flatMap((locale) =>
    PRIVATE_PATHS.flatMap((path) => [`/${locale}${path}`, `/${locale}${path}/`]),
  );

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // `/auth/*` is locale-less: it is the magic-link callback.
        disallow: [...disallow, "/auth/"],
      },
    ],
    sitemap: `${env.siteUrl}/sitemap.xml`,
    host: env.siteUrl,
  };
}
