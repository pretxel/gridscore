// Friendly aliases on top of the generated `Database` types. Regenerating
// `lib/database.types.ts` never touches this file; narrow CHECK-constrained
// columns here so app code keeps precise unions.

import type { Tables } from "@/lib/database.types";

export type { Database } from "@/lib/database.types";

export type Plan = "free" | "pro";

type Narrow<T, K extends keyof T, V> = Omit<T, K> & { [P in K]: V };

export type ProfileRow = Narrow<Tables<"profiles">, "plan", Plan>;
