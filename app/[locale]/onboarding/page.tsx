import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { setDisplayName } from "./actions";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "onboarding" });
  return { title: t("title") };
}

// Lives outside the (app) group on purpose: the (app) layout redirects here
// when the display name is missing, so nesting it there would loop.
export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(localePath(locale, "/sign-in"));

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.display_name) redirect(localePath(locale, "/"));

  const t = await getTranslations("onboarding");

  return (
    <main className="relative isolate mx-auto flex min-h-[80vh] max-w-lg flex-col justify-center px-6 py-12">
      <div
        aria-hidden
        className="bg-kerb-stripes absolute -right-40 -top-20 h-[28rem] w-[28rem] -rotate-12 opacity-[0.08] dark:opacity-[0.16]"
        style={{
          maskImage: "radial-gradient(closest-side at 50% 50%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(closest-side at 50% 50%, black 30%, transparent 75%)",
        }}
      />
      <div className="relative">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1
          className="mt-1 font-heading text-4xl font-semibold tracking-tight"
          style={{ fontStretch: "condensed" }}
        >
          {t("headline")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("lede")}</p>

        <form
          action={setDisplayName}
          className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <input type="hidden" name="locale" value={locale} />
          <div className="space-y-1.5">
            <Label
              htmlFor="display_name"
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
            >
              {t("label")}
            </Label>
            <Input
              id="display_name"
              name="display_name"
              required
              minLength={2}
              maxLength={32}
              placeholder={t("placeholder")}
              className="h-11 text-base"
            />
          </div>
          <Button
            type="submit"
            className="h-11 w-full gap-2 text-sm font-semibold uppercase tracking-[0.14em]"
          >
            {t("submit")}
          </Button>
        </form>
      </div>
    </main>
  );
}
