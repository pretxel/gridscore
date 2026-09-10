"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { formatSessionTime, type TimeFormat, utcFallback } from "@/lib/format";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";

// Renders one instant twice: the server emits the deterministic UTC string so
// hydration cannot mismatch, then the client swaps in the active locale's
// formatting in the viewer's own timezone.
export function LocalTime({ iso, format = "datetime" }: { iso: string; format?: TimeFormat }) {
  const raw = useLocale();
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const [text, setText] = useState<string>(() => utcFallback(iso, format));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(formatSessionTime(iso, locale, format));
  }, [iso, format, locale]);

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
