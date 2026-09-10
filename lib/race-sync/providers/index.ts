import { createJolpicaProvider } from "@/lib/race-sync/providers/jolpica";
import type { RaceDataProvider } from "@/lib/race-sync/types";

// The provider the jobs use unless a caller injects another one. Swapping
// data sources means returning a different implementation here.
export function defaultProvider(): RaceDataProvider {
  return createJolpicaProvider();
}
