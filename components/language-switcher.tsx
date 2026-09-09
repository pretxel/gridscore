"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { isLocale, LOCALE_LABELS, type Locale, SUPPORTED_LOCALES } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function useChangeLocale() {
  const current = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = React.useTransition();

  return React.useCallback(
    (next: Locale, onAfter?: () => void) => {
      if (!isLocale(next) || next === current) {
        onAfter?.();
        return;
      }
      document.cookie = `NEXT_LOCALE=${next}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
      const stripped = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
      const target = `/${next}${stripped === "/" ? "" : stripped}`;
      startTransition(() => {
        router.replace(target);
        router.refresh();
        onAfter?.();
      });
    },
    [current, pathname, router],
  );
}

export function LocaleList({
  className,
  onAfterChange,
}: {
  className?: string;
  onAfterChange?: () => void;
}) {
  const current = useLocale();
  const change = useChangeLocale();

  return (
    <ul className={cn("flex flex-col gap-0.5", className)}>
      {SUPPORTED_LOCALES.map((loc: Locale) => {
        const active = loc === current;
        return (
          <li key={loc} role="none">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => change(loc, onAfterChange)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <span
                aria-hidden
                className="w-7 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                {loc}
              </span>
              <span className="flex-1 font-medium">{LOCALE_LABELS[loc]}</span>
              {active ? <CheckIcon className="size-3.5 text-foreground" aria-hidden /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const current = useLocale();
  const t = useTranslations("languageSwitcher");
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const currentLocale: Locale = isLocale(current) ? current : "en";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={t("label")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        )}
      >
        <span className="text-foreground">{currentLocale}</span>
        <ChevronDownIcon
          aria-hidden
          className={cn("size-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div
          className="absolute right-0 z-40 mt-1.5 min-w-[10rem] rounded-md border border-border bg-popover p-1 shadow-md"
          role="menu"
        >
          <LocaleList onAfterChange={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
