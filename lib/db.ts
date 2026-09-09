// Friendly aliases on top of the generated `Database` types. Regenerating
// `lib/database.types.ts` never touches this file; narrow CHECK-constrained
// columns here so app code keeps precise unions.

import type { Database, Tables } from "@/lib/database.types";
import type { MarketStatus, MarketType } from "@/lib/markets";

export type { Database } from "@/lib/database.types";

export type Plan = "free" | "pro";
export type SeasonStatus = "upcoming" | "active" | "finished" | "manage";
export type GrandPrixStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type MultiplierReason = "normal" | "sprint" | "legend" | "finale" | "custom";
export type ResolutionSource = "provider" | "manual";
export type HitType = "exact" | "podium_exact_all" | "podium_partial" | "miss";
export type LeagueRole = "owner" | "member";
export type OperationKind = "sync_calendar" | "sync_results";
export type OperationTrigger = "cron" | "manual";
export type OperationStatus = "success" | "partial" | "error";
export type ScoringRuleKey = "exact" | "exact_position" | "in_podium" | "all_exact_bonus";

type Narrow<T, K extends keyof T, V> = Omit<T, K> & { [P in K]: V };

export type ProfileRow = Narrow<Tables<"profiles">, "plan", Plan>;
export type SeasonRow = Narrow<Tables<"seasons">, "status", SeasonStatus>;
export type TeamRow = Tables<"teams">;
export type DriverRow = Tables<"drivers">;
export type GrandPrixRow = Narrow<
  Narrow<Tables<"grands_prix">, "status", GrandPrixStatus>,
  "multiplier_reason",
  MultiplierReason
>;
export type MarketRow = Narrow<
  Narrow<Narrow<Tables<"markets">, "type", MarketType>, "status", MarketStatus>,
  "resolution_source",
  ResolutionSource | null
>;
export type PredictionRow = Tables<"predictions">;
export type ScoringRuleRow = Narrow<
  Narrow<Tables<"scoring_rules">, "market_type", MarketType>,
  "rule_key",
  ScoringRuleKey
>;
export type ScoreRow = Narrow<Tables<"scores">, "hit_type", HitType>;
export type LeagueRow = Narrow<Tables<"leagues">, "plan", Plan>;
export type LeagueMemberRow = Narrow<Tables<"league_members">, "role", LeagueRole>;
export type OperationRunRow = Narrow<
  Narrow<Narrow<Tables<"operation_runs">, "kind", OperationKind>, "trigger", OperationTrigger>,
  "status",
  OperationStatus
>;
export type OperationSettingRow = Narrow<Tables<"operation_settings">, "kind", OperationKind>;

// One row of any leaderboard surface: the view and the two functions share
// this exact shape.
export type LeaderboardRow = Tables<"v_leaderboard_overall">;
export type GrandPrixBoardRow =
  Database["public"]["Functions"]["leaderboard_for_grand_prix"]["Returns"][number];
export type LeagueBoardRow =
  Database["public"]["Functions"]["leaderboard_for_league"]["Returns"][number];
