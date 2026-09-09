import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";

// Phase 0 placeholder. Status tiles and quick links land with phase 6.
export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const t = await getTranslations("admin");

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="admin-reveal space-y-8">
        <AdminPageHeader
          eyebrow={t("dashboard.eyebrow")}
          title={t("dashboard.title")}
          description={t("dashboard.description")}
        />
        <p className="text-sm text-muted-foreground">{t("dashboard.comingSoon")}</p>
      </div>
    </main>
  );
}
