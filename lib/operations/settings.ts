import "server-only";
import type { OperationKind } from "@/lib/db";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { OPERATION_KINDS } from "./record-run";

// Per-job cron kill switch backed by public.operation_settings. An absent row
// means enabled. Only cron routes consult it; an admin "Run now" bypasses it.

export interface OperationSettingRow {
  kind: string;
  enabled: boolean;
}

export type SettingsReader = () => Promise<OperationSettingRow[]>;

const defaultReader: SettingsReader = async () => {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.from("operation_settings").select("kind, enabled");
  if (error) throw new Error(error.message);
  return data ?? [];
};

// Fails OPEN: a broken settings lookup must not silently halt scheduled work.
export async function getOperationSettings(
  reader: SettingsReader = defaultReader,
): Promise<Record<OperationKind, boolean>> {
  const settings = Object.fromEntries(OPERATION_KINDS.map((kind) => [kind, true])) as Record<
    OperationKind,
    boolean
  >;
  try {
    for (const row of await reader()) {
      if ((OPERATION_KINDS as readonly string[]).includes(row.kind)) {
        settings[row.kind as OperationKind] = row.enabled;
      }
    }
  } catch (err) {
    console.error("[operation-settings] read failed; treating all jobs as enabled:", err);
  }
  return settings;
}

export async function isOperationEnabled(
  kind: OperationKind,
  reader: SettingsReader = defaultReader,
): Promise<boolean> {
  const settings = await getOperationSettings(reader);
  return settings[kind];
}

// Throws on failure: a pause that did not stick must surface to the admin.
export async function setOperationEnabled(kind: OperationKind, enabled: boolean): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("operation_settings")
    .upsert({ kind, enabled, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
