import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_LABELS,
  localeAlternates,
  localePath,
  SUPPORTED_LOCALES,
} from "@/lib/i18n";

const MESSAGES_DIR = path.resolve(__dirname, "..", "messages");

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object") {
      out.push(...flattenKeys(v, next));
    } else {
      out.push(next);
    }
  }
  return out.sort();
}

describe("i18n constants", () => {
  it("DEFAULT_LOCALE is in SUPPORTED_LOCALES", () => {
    expect(SUPPORTED_LOCALES as readonly string[]).toContain(DEFAULT_LOCALE);
  });

  it("every supported locale has a human-readable label", () => {
    for (const loc of SUPPORTED_LOCALES) {
      expect(LOCALE_LABELS[loc]).toBeTruthy();
    }
  });

  it("isLocale narrows correctly", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("es")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });

  it("localePath prefixes correctly", () => {
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("es", "/leaderboard")).toBe("/es/leaderboard");
    expect(localePath("en", "leaderboard")).toBe("/en/leaderboard");
  });
});

describe("message bundles", () => {
  it("a JSON file exists for every supported locale", () => {
    for (const loc of SUPPORTED_LOCALES) {
      const file = path.join(MESSAGES_DIR, `${loc}.json`);
      expect(fs.existsSync(file), `missing ${file}`).toBe(true);
    }
  });

  it("all supported locales share the exact same key set", () => {
    const keysByLocale = SUPPORTED_LOCALES.map((loc) => ({
      loc,
      keys: flattenKeys(
        JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, `${loc}.json`), "utf8")),
      ),
    }));

    const reference = keysByLocale[0]?.keys;
    for (const { loc, keys } of keysByLocale.slice(1)) {
      expect(keys, `${loc} keys differ from ${keysByLocale[0]?.loc}`).toEqual(reference);
    }
  });

  it("no message value is empty", () => {
    for (const loc of SUPPORTED_LOCALES) {
      const bundle = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, `${loc}.json`), "utf8"));
      const empty = flattenKeys(bundle).filter((key) => {
        const value = key.split(".").reduce<unknown>((acc, part) => {
          if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
          return undefined;
        }, bundle);
        return typeof value !== "string" || value.trim().length === 0;
      });
      expect(empty, `${loc} has empty values`).toEqual([]);
    }
  });
});

describe("localeAlternates", () => {
  it("points the canonical at the current locale and lists every translation", () => {
    const alternates = localeAlternates("es", "/leaderboard");
    expect(alternates.canonical).toBe("/es/leaderboard");
    expect(alternates.languages).toEqual({
      en: "/en/leaderboard",
      es: "/es/leaderboard",
      "x-default": "/en/leaderboard",
    });
  });

  it("handles the home route", () => {
    expect(localeAlternates("en", "/").canonical).toBe("/en");
  });

  it("covers every supported locale", () => {
    const { languages } = localeAlternates("en", "/gp");
    for (const loc of SUPPORTED_LOCALES) {
      expect(languages[loc], `missing hreflang for ${loc}`).toBeTruthy();
    }
  });
});
