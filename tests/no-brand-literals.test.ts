import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { findBrandLiterals } from "@/lib/brand-guard";

const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["app", "components", "lib", "messages", "public", "hooks"];
const SCAN_FILES = ["README.md"];
const TEXT_EXT = /\.(tsx?|jsx?|mjs|json|md|css|svg|txt|webmanifest|html)$/;

// Files that legitimately mention the provider's URL path (the Jolpica API is
// hosted under an /ergast/f1 prefix we do not control). Each entry must be a
// repo-relative path; keep this list as short as possible.
const ALLOWLIST = new Set<string>([
  "lib/env.ts",
  "lib/brand-guard.ts",
  "lib/race-sync/providers/jolpica.ts",
]);

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, out);
    } else if (TEXT_EXT.test(entry)) {
      out.push(full);
    }
  }
}

function collectFiles(): string[] {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) walk(join(ROOT, dir), files);
  for (const file of SCAN_FILES) {
    try {
      statSync(join(ROOT, file));
      files.push(join(ROOT, file));
    } catch {
      // optional file
    }
  }
  return files;
}

describe("no championship brand literals in product code, copy or assets", () => {
  const files = collectFiles();

  it("scans at least the message bundles", () => {
    expect(files.some((f) => f.endsWith("messages/en.json"))).toBe(true);
  });

  for (const file of files) {
    const rel = relative(ROOT, file);
    if (ALLOWLIST.has(rel)) continue;
    it(rel, () => {
      const hits = findBrandLiterals(readFileSync(file, "utf8"));
      expect(hits).toEqual([]);
    });
  }
});

describe("findBrandLiterals", () => {
  it("flags each forbidden form", () => {
    expect(findBrandLiterals("Welcome to F1 predictions")).toHaveLength(1);
    expect(findBrandLiterals("formula one fans")).toHaveLength(1);
    expect(findBrandLiterals("Fórmula 1")).toHaveLength(1);
    expect(findBrandLiterals("the FIA said")).toHaveLength(1);
  });

  it("ignores generic and data words", () => {
    expect(findBrandLiterals("Grand Prix calendar, circuit codes, fia-like ids f1a2")).toEqual([]);
    expect(findBrandLiterals("Monaco Grand Prix")).toEqual([]);
  });
});
