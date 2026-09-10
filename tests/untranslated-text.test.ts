import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import allowlistEntries from "./i18n-allowlist.json" with { type: "json" };

// Fails when a JSX text node carries prose that never went through next-intl.
// Only literal text between tags is inspected: `{t("key")}` and every other
// expression is code, and attribute values are out of scope (a `placeholder`
// or `aria-label` is caught by review, not by this scan).
//
// The allowlist is deliberately tiny and each entry carries its own `why`.

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["app", "components"];
const SKIP_DIRS = new Set(["node_modules", ".next", "ui"]);

// Three or more consecutive letters is prose; "P1", "×2", "·" and "—" are not.
const PROSE = /\p{L}{3,}/u;

// Characters that appear in TypeScript but never in the app's rendered copy.
// They are what tells `Promise<{ locale: string }>` or `) : rows.length === 0 ?`
// apart from a sentence: the `>` of a generic or a comparison also opens a
// "text node" as far as a regex is concerned. Copy that genuinely needs a
// parenthesis belongs in messages/*.json anyway.
const CODE_CHARS = /[;=()[\]]/;

const allowlist = (allowlistEntries as { text: string; why: string }[]).map((e) => e.text);

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

// Drops comments and every string literal so their contents are never mistaken
// for rendered text.
function stripNonMarkup(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

export function findUntranslatedText(source: string): string[] {
  const markup = stripNonMarkup(source);
  const found: string[] = [];
  // Text between a closing `>` and the next `<`, with no braces in between:
  // braces would mean the value came from an expression.
  for (const match of markup.matchAll(/>([^<>{}]+)</g)) {
    const text = match[1].replace(/\s+/g, " ").trim();
    if (!text || !PROSE.test(text)) continue;
    if (CODE_CHARS.test(text)) continue;
    if (allowlist.includes(text)) continue;
    found.push(text);
  }
  return found;
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
      const hits = findUntranslatedText(fs.readFileSync(file, "utf8"));
      for (const hit of hits) offenders.push(`${path.relative(ROOT, file)}: ${hit}`);
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the allowlist short and justified", () => {
    const entries = allowlistEntries as { text: string; why: string }[];
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
});
