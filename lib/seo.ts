import type { Metadata } from "next";
import { type Locale, localeAlternates, localePath } from "@/lib/i18n";
import { OG_SIZE } from "@/lib/og/size";

export const SITE_NAME = "gridscore";

export const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
};

// Every other locale's og:locale, for og:locale:alternate.
export function ogAlternateLocales(locale: Locale): string[] {
  return Object.entries(OG_LOCALE)
    .filter(([loc]) => loc !== locale)
    .map(([, og]) => og);
}

// Metadata for one indexable page: title, description, canonical + hreflang,
// and the Open Graph / Twitter fields restated in full. Next replaces nested
// metadata objects wholesale per segment, so a page that only set `title`
// would otherwise share the site-wide og:title and og:description.
//
// `absoluteTitle` skips the "· gridscore" template, for the home page whose
// title already leads with the brand. `ownImage` is for a segment that draws
// its own opengraph-image file, which an explicit image here would override.
export function pageMetadata(
  locale: Locale,
  path: string,
  {
    title,
    description,
    absoluteTitle = false,
    ownImage = false,
  }: { title: string; description: string; absoluteTitle?: boolean; ownImage?: boolean },
): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: localeAlternates(locale, path),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: OG_LOCALE[locale],
      alternateLocale: ogAlternateLocales(locale),
      url: localePath(locale, path),
      title: fullTitle,
      description,
      // Restated because a segment that sets `openGraph` drops the image its
      // parent's opengraph-image file would have given it.
      ...(ownImage
        ? {}
        : {
            images: [{ url: localePath(locale, "/opengraph-image"), ...OG_SIZE, alt: SITE_NAME }],
          }),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  };
}
