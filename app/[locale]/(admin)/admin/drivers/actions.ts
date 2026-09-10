"use server";

import {
  driverCodeSchema,
  driverNumberSchema,
  field,
  localeFromForm,
  optionalNumber,
  trimmed,
  uuidSchema,
} from "@/lib/admin/parse";
import { runAdminAction } from "@/lib/admin/run-action";
import { localePath } from "@/lib/i18n";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const REVALIDATE = ["/admin/drivers", "/gp"];

// Corrects what the provider imported: a display code, a car number or the
// team a driver moved to. Names stay as provider data.
export async function saveDriver(form: FormData): Promise<never> {
  const locale = localeFromForm(form);
  return runAdminAction(localePath(locale, "/admin/drivers"), REVALIDATE, async () => {
    const id = uuidSchema.parse(trimmed(form, "driver_id"));

    const rawCode = trimmed(form, "code");
    const code = rawCode === "" ? null : driverCodeSchema.parse(rawCode);
    const rawNumber = optionalNumber(form, "number");
    if (rawNumber === undefined) throw new Error("invalid car number");
    const number = driverNumberSchema.parse(rawNumber);
    const rawTeam = trimmed(form, "team_id");
    const teamId = rawTeam === "" ? null : uuidSchema.parse(rawTeam);

    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from("drivers")
      .update({ code, number, team_id: teamId })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return "driverSaved";
  });
}

// Inactive drivers stay pickable in historic weekends but drop out of the
// selects for markets that are still open.
export async function toggleDriverActive(form: FormData): Promise<never> {
  const locale = localeFromForm(form);
  return runAdminAction(localePath(locale, "/admin/drivers"), REVALIDATE, async () => {
    const id = uuidSchema.parse(trimmed(form, "driver_id"));
    const active = field(form, "active") === "true";
    const admin = createAdminSupabaseClient();
    const { error } = await admin.from("drivers").update({ active }).eq("id", id);
    if (error) throw new Error(error.message);
    return active ? "driverActivated" : "driverDeactivated";
  });
}

// Short name and colour drive the driver badges; the full name stays provider
// data.
export async function saveTeam(form: FormData): Promise<never> {
  const locale = localeFromForm(form);
  return runAdminAction(localePath(locale, "/admin/drivers"), REVALIDATE, async () => {
    const id = uuidSchema.parse(trimmed(form, "team_id"));
    const shortName = trimmed(form, "short_name");
    if (shortName.length < 1 || shortName.length > 24) throw new Error("invalid short name");
    const rawColor = trimmed(form, "color");
    if (rawColor !== "" && !/^#[0-9a-fA-F]{6}$/.test(rawColor)) throw new Error("invalid colour");

    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from("teams")
      .update({ short_name: shortName, color: rawColor === "" ? null : rawColor.toUpperCase() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return "teamSaved";
  });
}
