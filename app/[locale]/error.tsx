"use client";

import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/lib/i18n";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");
  const raw = useLocale();
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative isolate mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30">
        <TriangleAlertIcon className="size-5" />
      </span>
      <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        {t("eyebrow")}
      </p>
      <h1
        className="mt-2 font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
        style={{ fontStretch: "condensed" }}
      >
        {t("headline")}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        {error.message || t("fallback")}
      </p>
      {error.digest ? (
        <p className="mt-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground/70">
          {t("ref", { digest: error.digest })}
        </p>
      ) : null}
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={reset}>{t("tryAgain")}</Button>
        <Link href={localePath(locale, "/")} className={buttonVariants({ variant: "outline" })}>
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
