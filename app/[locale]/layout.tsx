import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteFooter, SiteNav } from "@/components/site-nav";
import { DEFAULT_LOCALE, isLocale, type Locale, SUPPORTED_LOCALES } from "@/lib/i18n";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
};
const ALT_LOCALES: Record<Locale, string[]> = {
  en: ["es_ES"],
  es: ["en_US"],
};

// Localized site-wide title/description/og/twitter. Metadata is shallow-merged
// and nested objects are overwritten by the deepest segment, so og/twitter are
// re-specified in full here rather than inheriting the root's English defaults.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: "siteMeta" });
  const title = t("title");
  const description = t("description");
  return {
    title: { default: title, template: "%s · gridscore" },
    description,
    openGraph: {
      type: "website",
      locale: OG_LOCALE[locale],
      alternateLocale: ALT_LOCALES[locale],
      siteName: "gridscore",
      title,
      description,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      <SiteNav />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </NextIntlClientProvider>
  );
}
