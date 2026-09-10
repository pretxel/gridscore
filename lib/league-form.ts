// Client-safe league form helpers: name rules, join-code normalisation and
// the mapping from database refusals to message keys. The database is the
// authority; this file only shapes input and picks the copy.
import { z } from "zod";

export const LEAGUE_NAME_MIN = 2;
export const LEAGUE_NAME_MAX = 40;

export const leagueNameSchema = z.string().trim().min(LEAGUE_NAME_MIN).max(LEAGUE_NAME_MAX);

// Same alphabet as generate_join_code(): no 0, O, 1, I, L.
export const JOIN_CODE_RE = /^GP-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/;

// Accepts what people paste: lowercase, stray spaces, the code alone, or
// the whole invite URL. Returns null when nothing code-shaped is left.
export function normalizeJoinCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  const fromUrl = value.match(/\/leagues\/join\/([^/?#]+)/i);
  if (fromUrl) value = fromUrl[1];
  value = decodeURIComponent(value).toUpperCase().replace(/\s+/g, "");
  if (!value.startsWith("GP-")) value = value.replace(/^GP/, "GP-");
  if (!value.startsWith("GP-")) value = `GP-${value}`;
  return JOIN_CODE_RE.test(value) ? value : null;
}

export type LeagueErrorKey =
  | "errorLeagueFull"
  | "errorInvalidCode"
  | "errorOwnerCannotLeave"
  | "errorNotOwner"
  | "errorNoSeason"
  | "errorName"
  | "errorNotSignedIn"
  | "errorGeneric";

// Maps the raise_exception text of the league RPCs (and RLS refusals) to a
// key in the `leagues` message namespace.
export function leagueErrorKey(error: { code?: string; message: string } | null): LeagueErrorKey {
  if (!error) return "errorGeneric";
  const m = error.message.toLowerCase();
  if (m.includes("league is full")) return "errorLeagueFull";
  if (m.includes("invalid join code")) return "errorInvalidCode";
  if (m.includes("owner cannot leave") || m.includes("owner cannot remove")) {
    return "errorOwnerCannotLeave";
  }
  if (m.includes("only the owner")) return "errorNotOwner";
  if (m.includes("season is not active") || m.includes("no active season")) return "errorNoSeason";
  if (m.includes("league name must be")) return "errorName";
  if (m.includes("not authenticated")) return "errorNotSignedIn";
  if (error.code === "42501" || m.includes("row-level security")) return "errorNotOwner";
  return "errorGeneric";
}
