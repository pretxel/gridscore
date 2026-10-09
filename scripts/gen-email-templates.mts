// Renders the five Supabase Auth emails from lib/email/templates.ts through the
// shared shell into supabase/templates/. Run with `pnpm gen:email-templates`;
// tests/email-templates.test.ts fails when a committed template is stale.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSupabaseTemplate, SUPABASE_TEMPLATE_NAMES } from "../lib/email/templates.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const name of SUPABASE_TEMPLATE_NAMES) {
  const target = join(root, "supabase", "templates", `${name}.html`);
  writeFileSync(target, renderSupabaseTemplate(name));
  console.log(`wrote ${target}`);
}
