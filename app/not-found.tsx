import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";

// Fallback for paths outside the [locale] tree. The proxy has already resolved
// a locale by the time a request reaches here, so the copy is still
// translated; app/[locale]/not-found.tsx handles misses inside the tree and
// can also offer the calendar.
export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        {t("eyebrow")}
      </p>
      <h1
        className="mt-2 font-heading text-6xl font-semibold leading-none tracking-tight sm:text-7xl"
        style={{ fontStretch: "condensed" }}
      >
        {t("code")}
      </h1>
      <p className="mt-4 max-w-sm text-sm text-muted-foreground">{t("body")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonVariants()}>
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
