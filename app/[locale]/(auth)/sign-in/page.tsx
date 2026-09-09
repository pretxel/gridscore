import { FlagIcon, TimerIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/lib/i18n";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SignInForm } from "./sign-in-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "signIn" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: "/sign-in" },
    robots: { index: false, follow: true },
  };
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const { next } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(next ?? localePath(locale, "/"));
  }

  const t = await getTranslations("signIn");

  return (
    <main className="relative isolate min-h-[calc(100vh-9rem)] overflow-hidden">
      <div
        aria-hidden
        className="bg-kerb-stripes absolute -right-32 -top-32 h-[36rem] w-[36rem] -rotate-12 opacity-[0.08] dark:opacity-[0.16]"
        style={{
          maskImage: "radial-gradient(closest-side at 50% 50%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(closest-side at 50% 50%, black 30%, transparent 75%)",
        }}
      />
      <div className="bg-grain pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid max-w-5xl gap-12 px-4 py-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <section className="hidden flex-col gap-6 lg:flex">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("welcomeEyebrow")}
          </p>
          <h1
            className="font-heading text-5xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl"
            style={{ fontStretch: "condensed" }}
          >
            <span className="block">{t("headlineLine1")}</span>
            <span className="block text-signal">{t("headlineLine2")}</span>
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{t("lede")}</p>

          <ul className="mt-2 grid gap-3">
            {[
              { Icon: TimerIcon, title: t("bullet1Title"), copy: t("bullet1Copy") },
              { Icon: FlagIcon, title: t("bullet2Title"), copy: t("bullet2Copy") },
              { Icon: UsersIcon, title: t("bullet3Title"), copy: t("bullet3Copy") },
            ].map((b) => (
              <li
                key={b.title}
                className="flex items-start gap-3 rounded-lg border border-border bg-card/60 p-3 backdrop-blur"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-signal/10 text-signal ring-1 ring-signal/20">
                  <b.Icon className="size-4" />
                </span>
                <div>
                  <div className="font-heading text-sm font-semibold tracking-tight">{b.title}</div>
                  <div className="text-xs text-muted-foreground">{b.copy}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="w-full max-w-md justify-self-center lg:justify-self-end">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.25)] dark:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.55)] sm:p-8">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="grid size-7 place-items-center rounded-md bg-signal text-signal-foreground"
              >
                <span className="font-mono text-[10px] font-bold leading-none">GP</span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                {t("cardEyebrow")}
              </span>
            </div>
            <h2
              className="mt-4 font-heading text-3xl font-semibold tracking-tight"
              style={{ fontStretch: "condensed" }}
            >
              {t("cardHeadline")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("cardLede")}</p>

            <div className="mt-6">
              <SignInForm next={next} />
            </div>

            <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
              {t("newHere")}{" "}
              <Link
                href={localePath(locale, "/how-it-works")}
                className="font-medium text-foreground underline-offset-4 hover:text-signal hover:underline"
              >
                {t("howItWorks")}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
