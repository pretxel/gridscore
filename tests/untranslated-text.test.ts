import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findUntranslatedText } from "@/lib/i18n-scan";
import allowlistEntries from "./i18n-allowlist.json" with { type: "json" };

// Every rendered string must come from next-intl. The allowlist is deliberately
// tiny and each entry carries its own `why`.

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["app", "components"];
// `ui` holds the unstyled shadcn primitives: their copy is passed in by the
// caller, and the few built-in labels are aria strings, not page text.
const SKIP_DIRS = new Set(["node_modules", ".next", "ui"]);

const entries = allowlistEntries as { text: string; why: string }[];
const allowlist = entries.map((e) => e.text);

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith(".tsx")) {
      out.push(path.join(dir, entry.name));
    }
  }
}

describe("untranslated text", () => {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) walk(path.join(ROOT, dir), files);

  it("finds files to scan", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("no JSX text node renders prose outside next-intl", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const hits = findUntranslatedText(fs.readFileSync(file, "utf8"), allowlist);
      for (const hit of hits) offenders.push(`${path.relative(ROOT, file)}: ${hit}`);
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the allowlist short and justified", () => {
    expect(entries.length).toBeLessThanOrEqual(10);
    for (const entry of entries) {
      expect(entry.text.length, `${entry.text} is empty`).toBeGreaterThan(0);
      expect(entry.why.length, `${entry.text} has no justification`).toBeGreaterThan(30);
    }
  });
});

describe("findUntranslatedText", () => {
  it("flags literal prose", () => {
    expect(findUntranslatedText("<p>Season standings</p>")).toEqual(["Season standings"]);
  });

  it("ignores translated expressions and short codes", () => {
    expect(findUntranslatedText('<p>{t("headline")}</p>')).toEqual([]);
    expect(findUntranslatedText("<span>P1</span>")).toEqual([]);
    expect(findUntranslatedText("<span>·</span>")).toEqual([]);
  });

  it("ignores comments and string literals", () => {
    expect(findUntranslatedText("// renders the Season label\n<p>{value}</p>")).toEqual([]);
    expect(findUntranslatedText('<p className="text-season">{value}</p>')).toEqual([]);
  });

  it("ignores generics and ternaries that look like text nodes", () => {
    expect(findUntranslatedText("params: Promise<{ locale: string }>;")).toEqual([]);
    expect(findUntranslatedText("}) : rows.length === 0 ? (")).toEqual([]);
  });

  it("honours the allowlist", () => {
    expect(findUntranslatedText("<p>ridscore</p>", ["ridscore"])).toEqual([]);
  });
});
