import { ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: "siteMeta" });
  return { title: t("title"), description: t("description") };
}

// Landing placeholder for phase 0. The calendar, next-session countdown and
// leader strip arrive with phases 3 and 4.
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="bg-kerb-stripes absolute -right-32 -top-32 h-[36rem] w-[36rem] -rotate-12 opacity-[0.08] dark:opacity-[0.16]"
        style={{
          maskImage: "radial-gradient(closest-side at 50% 50%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(closest-side at 50% 50%, black 30%, transparent 75%)",
        }}
      />
      <div className="bg-grain pointer-events-none absolute inset-0" />
      <section className="relative mx-auto flex max-w-4xl flex-col gap-6 px-4 py-20 sm:py-28">
        <p className="rise font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1
          className="rise font-heading text-4xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl"
          style={{ animationDelay: "60ms", fontStretch: "condensed" }}
        >
          {t("headline")}
        </h1>
        <p
          className="rise max-w-xl text-base leading-relaxed text-muted-foreground"
          style={{ animationDelay: "120ms" }}
        >
          {t("lede")}
        </p>
        <div className="rise flex flex-wrap gap-3" style={{ animationDelay: "180ms" }}>
          <Link
            href={localePath(locale, user ? "/gp" : "/sign-in")}
            className={cn(buttonVariants({ size: "lg" }), "gap-2")}
          >
            {user ? t("ctaCalendar") : t("ctaSignIn")}
            <ArrowRightIcon />
          </Link>
        </div>
        <p
          className="rise font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground/80"
          style={{ animationDelay: "240ms" }}
        >
          {t("comingSoon")}
        </p>
      </section>
    </main>
  );
}
