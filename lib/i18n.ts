export const SUPPORTED_LOCALES = ["en", "es"] as const;
export const DEFAULT_LOCALE: Locale = "en";

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function localePath(locale: Locale, path: string): string {
  const trimmed = path.startsWith("/") ? path : `/${path}`;
  if (trimmed === "/") return `/${locale}`;
  return `/${locale}${trimmed}`;
}

// hreflang set for one route: the canonical is this locale's URL, and every
// supported locale is listed so search engines pair the translations instead
// of treating them as duplicates. `x-default` points at the default locale.
export function localeAlternates(
  locale: Locale,
  path: string,
): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = Object.fromEntries(
    SUPPORTED_LOCALES.map((loc) => [loc, localePath(loc, path)]),
  );
  languages["x-default"] = localePath(DEFAULT_LOCALE, path);
  return { canonical: localePath(locale, path), languages };
}

// Human-readable label per locale, rendered in the switcher. Native names on
// purpose so a visitor can find their language without reading the current one.
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
};
