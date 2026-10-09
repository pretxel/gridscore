import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  REQUIRED_PLACEHOLDERS,
  renderSupabaseTemplate,
  SUPABASE_TEMPLATE_NAMES,
} from "@/lib/email/templates";

// supabase/templates/ is generated from the shared shell. If someone edits the
// source without regenerating, or edits the HTML by hand, this fails.
describe("supabase/templates", () => {
  for (const name of SUPABASE_TEMPLATE_NAMES) {
    describe(name, () => {
      const committed = readFileSync(
        join(__dirname, "..", "supabase", "templates", `${name}.html`),
        "utf8",
      );

      it("matches the generator (run `pnpm gen:email-templates` if not)", () => {
        expect(committed, "stale: run `pnpm gen:email-templates`").toBe(
          renderSupabaseTemplate(name),
        );
      });

      it("carries its placeholders verbatim", () => {
        for (const placeholder of REQUIRED_PLACEHOLDERS[name]) {
          expect(committed).toContain(placeholder);
        }
      });

      it("is bilingual and uses the shared shell", () => {
        expect(committed).toContain('<html lang="en">');
        expect(committed).toContain('width="10%" height="8"');
        expect(committed).toContain(">gridscore</td>");
        expect(committed).not.toMatch(/<img|<link|@import|url\(/i);
      });
    });
  }
});
