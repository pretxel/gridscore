"use client";

import { useEffect, useState } from "react";

export function LocalTime({
  iso,
  format = "datetime",
}: {
  iso: string;
  format?: "datetime" | "time" | "date";
}) {
  const [text, setText] = useState<string>(() => isoFallback(iso, format));

  useEffect(() => {
    // One-shot client-side reformat: the server renders the deterministic UTC
    // fallback (avoids hydration mismatch), then we swap in the visitor's
    // locale/timezone after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(formatLocal(iso, format));
  }, [iso, format]);

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}

function isoFallback(iso: string, format: "datetime" | "time" | "date") {
  const d = new Date(iso);
  if (format === "date") return `${d.toISOString().slice(0, 10)} UTC`;
  if (format === "time") return `${d.toISOString().slice(11, 16)} UTC`;
  return `${d.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

function formatLocal(iso: string, format: "datetime" | "time" | "date") {
  const d = new Date(iso);
  if (format === "date") {
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  if (format === "time") {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
