// Scanner behind `tests/untranslated-text.test.ts`: finds JSX text nodes that
// carry prose which never went through next-intl. It lives here rather than in
// the test file because Biome's `noExportsInTest` forbids exports from a test
// module, and the same choice was already made for `lib/brand-guard.ts`.
//
// Only literal text between tags is inspected: `{t("key")}` and every other
// expression is code, and attribute values are out of scope (a `placeholder`
// or `aria-label` is caught by review, not by this scan).

// Three or more consecutive letters is prose; "P1", "×2", "·" and "—" are not.
const PROSE = /\p{L}{3,}/u;

// Characters that appear in TypeScript but never in the app's rendered copy.
// They are what tells `Promise<{ locale: string }>` or `) : rows.length === 0 ?`
// apart from a sentence: the `>` of a generic or a comparison also opens a
// "text node" as far as a regex is concerned. Copy that genuinely needs a
// parenthesis belongs in messages/*.json anyway.
const CODE_CHARS = /[;=()[\]]/;

// Drops comments and every string literal so their contents are never mistaken
// for rendered text.
function stripNonMarkup(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

export function findUntranslatedText(source: string, allowlist: readonly string[] = []): string[] {
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
