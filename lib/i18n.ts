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

// Human-readable label per locale, rendered in the switcher. Native names on
// purpose so a visitor can find their language without reading the current one.
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
};
