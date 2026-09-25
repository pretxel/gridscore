import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, type Locale, localeAlternates, localePath } from "@/lib/i18n";
import { DEFAULT_REMINDER_LEAD, isReminderLead } from "@/lib/reminders/preferences";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ReminderForm } from "./reminder-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: "settings" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates(locale, "/settings"),
    robots: { index: false },
  };
}

// Account settings. The display name is edited from the user menu; this page
// holds the lock reminder preference.
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const t = await getTranslations("settings");

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(localePath(locale, "/sign-in"));

  const { data: pref } = await supabase
    .from("reminder_preferences")
    .select("lead_time")
    .eq("user_id", user.id)
    .maybeSingle();
  const lead = isReminderLead(pref?.lead_time) ? pref.lead_time : DEFAULT_REMINDER_LEAD;

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <header className="mb-8 border-b border-border pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1
          className="mt-1 font-heading text-4xl font-semibold tracking-tight"
          style={{ fontStretch: "condensed" }}
        >
          {t("headline")}
        </h1>
      </header>
      <section aria-labelledby="reminders-title">
        <h2 id="reminders-title" className="font-heading text-lg font-semibold tracking-tight">
          {t("remindersTitle")}
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">{t("remindersLede")}</p>
        <ReminderForm initial={lead} locale={locale} />
      </section>
    </main>
  );
}
