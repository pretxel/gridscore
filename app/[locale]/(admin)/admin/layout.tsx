import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(
      `${localePath(locale, "/sign-in")}?next=${encodeURIComponent(localePath(locale, "/admin"))}`,
    );

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    const t = await getTranslations("admin");
    return (
      <main className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="text-2xl font-bold">{t("forbiddenTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("forbiddenBody")}</p>
        <Link href={localePath(locale, "/")} className="mt-6 inline-block text-sm underline">
          {t("goHome")}
        </Link>
      </main>
    );
  }

  return <AdminShell locale={locale}>{children}</AdminShell>;
}
