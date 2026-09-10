// Serializable driver shape and label helpers shared by server pages and
// client forms. No DB access, no `server-only`.

export type DriverOption = {
  id: string;
  code: string | null;
  number: number | null;
  givenName: string;
  familyName: string;
  teamName: string | null;
  teamColor: string | null;
  active: boolean;
};

export function driverLabel(d: Pick<DriverOption, "code" | "givenName" | "familyName">): string {
  return d.code ? `${d.code} · ${d.givenName} ${d.familyName}` : `${d.givenName} ${d.familyName}`;
}
