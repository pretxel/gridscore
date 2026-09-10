import { readFileSync } from "node:fs";
import { join } from "node:path";

// Recorded Jolpica responses (tests/fixtures/jolpica/*.json), captured from
// the live API on 2026-09-10. Season-agnostic mappers are exercised against
// 2025 (complete) and 2026 (in progress) payloads.
export function jolpicaFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "jolpica", name), "utf8"));
}

// A fetch stub serving fixtures by URL path suffix. Unknown paths 404.
export function fixtureFetch(
  routes: Record<
    string,
    string | { status: number; body?: unknown; headers?: Record<string, string> }
  >,
  calls: string[] = [],
) {
  return async (input: string): Promise<Response> => {
    calls.push(input);
    const path = new URL(input).pathname + new URL(input).search;
    const hit = Object.entries(routes).find(([suffix]) => path.endsWith(suffix));
    if (!hit) return new Response("not found", { status: 404, statusText: "Not Found" });
    const value = hit[1];
    if (typeof value === "string") {
      return new Response(JSON.stringify(jolpicaFixture(value)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(value.body == null ? null : JSON.stringify(value.body), {
      status: value.status,
      headers: value.headers,
    });
  };
}
