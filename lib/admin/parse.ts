// Input rules for the admin forms, mirroring the CHECK constraints in
// `supabase/migrations/20260910100000_core.sql`. Pure and unit-tested; the
// database still enforces every one of them.

import { z } from "zod";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import { MARKET_TYPES } from "@/lib/markets";
import { roundHalfUp } from "@/lib/scoring";

export const uuidSchema = z.string().uuid();

// grands_prix.multiplier is numeric(4,2) with a `>= 1` check, so 1.00–99.99
// fits the column. Two decimals, half-up, keeps SQL and TS scoring identical.
export const MULTIPLIER_MIN = 1;
export const MULTIPLIER_MAX = 99.99;

export const MULTIPLIER_REASONS = ["normal", "sprint", "legend", "finale", "custom"] as const;
export type MultiplierReason = (typeof MULTIPLIER_REASONS)[number];

export const multiplierSchema = z.coerce
  .number()
  .min(MULTIPLIER_MIN)
  .max(MULTIPLIER_MAX)
  // Same half-up rule the scorer uses, so 1.005 lands on 1.01 rather than on
  // whichever side binary floating point happens to fall.
  .transform((n) => roundHalfUp(n * 100) / 100);

export const multiplierReasonSchema = z.enum(MULTIPLIER_REASONS);

// scoring_rules.points is a non-negative integer.
export const pointsSchema = z.coerce.number().int().min(0).max(1000);

export const scoringRuleKeySchema = z.enum([
  "exact",
  "exact_position",
  "in_podium",
  "all_exact_bonus",
]);

export const marketTypeSchema = z.enum(MARKET_TYPES);

export const planSchema = z.enum(["free", "pro"]);

// drivers.code is a 3-letter uppercase code; empty means "no code".
export const driverCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/)
  .nullable();

export const driverNumberSchema = z.coerce.number().int().min(0).max(99).nullable();

// Reads one field out of a FormData without leaking `File` values into the
// string paths.
export function field(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === "string" ? value : null;
}

export function trimmed(form: FormData, name: string): string {
  return (field(form, name) ?? "").trim();
}

// Every admin form carries the locale in a hidden field so the action knows
// which localized page to redirect back to.
export function localeFromForm(form: FormData): Locale {
  const raw = trimmed(form, "locale");
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

// Checkbox semantics: present means on, absent means off.
export function checkbox(form: FormData, name: string): boolean {
  return form.get(name) != null;
}

// An empty text input means "clear this optional column", not "0".
export function optionalNumber(form: FormData, name: string): number | null | undefined {
  const raw = trimmed(form, name);
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// `datetime-local` gives a value without a zone; the admin enters UTC, which
// is what every session column stores.
export function optionalInstant(form: FormData, name: string): string | null | undefined {
  const raw = trimmed(form, name);
  if (raw === "") return null;
  const iso = raw.length === 16 ? `${raw}:00Z` : raw.endsWith("Z") ? raw : `${raw}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

// Renders an instant back into the `datetime-local` format (UTC, no seconds).
export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}
