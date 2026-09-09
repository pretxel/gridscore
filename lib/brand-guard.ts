// Trademark guard. The product must never name the championship, its governing
// body or its commercial rights holder: only generic words ("Grand Prix",
// "race", "season") and provider data (driver, team, circuit names).
//
// Patterns are deliberately narrow so ordinary words are not flagged:
//   - "F1" only as a standalone token (so ids like "f1a2" never match)
//   - "Formula 1" / "Formula One" / "Fórmula 1" in any case
//   - "FIA" / "FOM" only as uppercase standalone tokens
export const FORBIDDEN_BRAND_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "F1", pattern: /(?<![A-Za-z0-9_])F1(?![A-Za-z0-9_])/ },
  { label: "Formula 1 / Formula One", pattern: /f[oó]rmula[\s-]*(1|one)\b/i },
  { label: "FIA", pattern: /(?<![A-Za-z0-9_])FIA(?![A-Za-z0-9_])/ },
  { label: "FOM", pattern: /(?<![A-Za-z0-9_])FOM(?![A-Za-z0-9_])/ },
];

// Returns one entry per offending line: "<line>: [<label>] <trimmed line>".
export function findBrandLiterals(source: string): string[] {
  const hits: string[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    for (const { label, pattern } of FORBIDDEN_BRAND_PATTERNS) {
      if (pattern.test(line)) hits.push(`${i + 1}: [${label}] ${line.trim()}`);
    }
  }
  return hits;
}
