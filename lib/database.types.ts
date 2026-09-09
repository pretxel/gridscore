export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      drivers: {
        Row: {
          active: boolean;
          code: string | null;
          created_at: string;
          family_name: string;
          given_name: string;
          id: string;
          number: number | null;
          provider_key: string;
          season_id: string;
          team_id: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          code?: string | null;
          created_at?: string;
          family_name: string;
          given_name: string;
          id?: string;
          number?: number | null;
          provider_key: string;
          season_id: string;
          team_id?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          code?: string | null;
          created_at?: string;
          family_name?: string;
          given_name?: string;
          id?: string;
          number?: number | null;
          provider_key?: string;
          season_id?: string;
          team_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "drivers_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drivers_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      grands_prix: {
        Row: {
          circuit_key: string;
          circuit_name: string;
          country: string | null;
          created_at: string;
          fp1_at: string | null;
          fp2_at: string | null;
          fp3_at: string | null;
          has_sprint: boolean;
          id: string;
          locality: string | null;
          multiplier: number;
          multiplier_locked: boolean;
          multiplier_reason: string;
          name: string;
          provider_metadata: Json;
          qualifying_at: string | null;
          race_at: string;
          round: number;
          season_id: string;
          slug: string;
          sprint_at: string | null;
          sprint_qualifying_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          circuit_key: string;
          circuit_name: string;
          country?: string | null;
          created_at?: string;
          fp1_at?: string | null;
          fp2_at?: string | null;
          fp3_at?: string | null;
          has_sprint?: boolean;
          id?: string;
          locality?: string | null;
          multiplier?: number;
          multiplier_locked?: boolean;
          multiplier_reason?: string;
          name: string;
          provider_metadata?: Json;
          qualifying_at?: string | null;
          race_at: string;
          round: number;
          season_id: string;
          slug: string;
          sprint_at?: string | null;
          sprint_qualifying_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          circuit_key?: string;
          circuit_name?: string;
          country?: string | null;
          created_at?: string;
          fp1_at?: string | null;
          fp2_at?: string | null;
          fp3_at?: string | null;
          has_sprint?: boolean;
          id?: string;
          locality?: string | null;
          multiplier?: number;
          multiplier_locked?: boolean;
          multiplier_reason?: string;
          name?: string;
          provider_metadata?: Json;
          qualifying_at?: string | null;
          race_at?: string;
          round?: number;
          season_id?: string;
          slug?: string;
          sprint_at?: string | null;
          sprint_qualifying_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grands_prix_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      league_members: {
        Row: {
          invited_by_user_id: string | null;
          joined_at: string;
          league_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          invited_by_user_id?: string | null;
          joined_at?: string;
          league_id: string;
          role?: string;
          user_id: string;
        };
        Update: {
          invited_by_user_id?: string | null;
          joined_at?: string;
          league_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "league_members_invited_by_user_id_fkey";
            columns: ["invited_by_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "league_members_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "league_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      leagues: {
        Row: {
          created_at: string;
          id: string;
          join_code: string;
          name: string;
          owner_id: string;
          plan: string;
          season_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          join_code: string;
          name: string;
          owner_id: string;
          plan?: string;
          season_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          join_code?: string;
          name?: string;
          owner_id?: string;
          plan?: string;
          season_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leagues_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leagues_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      markets: {
        Row: {
          created_at: string;
          grand_prix_id: string;
          id: string;
          locks_at: string;
          resolution_source: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          result: Json | null;
          status: string;
          suggested_result: Json | null;
          type: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          grand_prix_id: string;
          id?: string;
          locks_at: string;
          resolution_source?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          result?: Json | null;
          status?: string;
          suggested_result?: Json | null;
          type: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          grand_prix_id?: string;
          id?: string;
          locks_at?: string;
          resolution_source?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          result?: Json | null;
          status?: string;
          suggested_result?: Json | null;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "markets_grand_prix_id_fkey";
            columns: ["grand_prix_id"];
            isOneToOne: false;
            referencedRelation: "grands_prix";
            referencedColumns: ["id"];
          },
        ];
      };
      operation_runs: {
        Row: {
          created_at: string;
          duration_ms: number | null;
          error: string | null;
          finished_at: string | null;
          id: string;
          kind: string;
          started_at: string;
          status: string;
          summary: Json;
          trigger: string;
        };
        Insert: {
          created_at?: string;
          duration_ms?: number | null;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          kind: string;
          started_at?: string;
          status: string;
          summary?: Json;
          trigger?: string;
        };
        Update: {
          created_at?: string;
          duration_ms?: number | null;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          kind?: string;
          started_at?: string;
          status?: string;
          summary?: Json;
          trigger?: string;
        };
        Relationships: [];
      };
      operation_settings: {
        Row: {
          enabled: boolean;
          kind: string;
          updated_at: string;
        };
        Insert: {
          enabled?: boolean;
          kind: string;
          updated_at?: string;
        };
        Update: {
          enabled?: boolean;
          kind?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      predictions: {
        Row: {
          id: string;
          market_id: string;
          pick: Json;
          submitted_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          market_id: string;
          pick: Json;
          submitted_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          market_id?: string;
          pick?: Json;
          submitted_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "predictions_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "predictions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          is_admin: boolean;
          plan: string;
          timezone: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          is_admin?: boolean;
          plan?: string;
          timezone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          is_admin?: boolean;
          plan?: string;
          timezone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      scores: {
        Row: {
          computed_at: string;
          hit_type: string;
          market_id: string;
          points: number;
          user_id: string;
        };
        Insert: {
          computed_at?: string;
          hit_type: string;
          market_id: string;
          points: number;
          user_id: string;
        };
        Update: {
          computed_at?: string;
          hit_type?: string;
          market_id?: string;
          points?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scores_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scores_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      scoring_rules: {
        Row: {
          created_at: string;
          id: string;
          market_type: string;
          points: number;
          rule_key: string;
          season_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          market_type: string;
          points: number;
          rule_key: string;
          season_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          market_type?: string;
          points?: number;
          rule_key?: string;
          season_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scoring_rules_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      seasons: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          providers: Json;
          slug: string;
          status: string;
          updated_at: string;
          year: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          providers?: Json;
          slug: string;
          status?: string;
          updated_at?: string;
          year: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          providers?: Json;
          slug?: string;
          status?: string;
          updated_at?: string;
          year?: number;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          color: string | null;
          created_at: string;
          id: string;
          name: string;
          provider_key: string;
          season_id: string;
          short_name: string;
          updated_at: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          provider_key: string;
          season_id: string;
          short_name: string;
          updated_at?: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          provider_key?: string;
          season_id?: string;
          short_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teams_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_leaderboard_overall: {
        Row: {
          display_name: string | null;
          exact_hits: number | null;
          first_submit: string | null;
          markets_scored: number | null;
          podium_exact_all_hits: number | null;
          rank: number | null;
          total_points: number | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "scores_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      active_season_id: { Args: never; Returns: string };
      compute_grand_prix_scores: { Args: { p_gp_id: string }; Returns: number };
      compute_market_scores: {
        Args: { p_market_id: string };
        Returns: undefined;
      };
      create_league: { Args: { p_name: string }; Returns: string };
      ensure_markets_for_grand_prix: {
        Args: { p_gp_id: string };
        Returns: undefined;
      };
      generate_join_code: { Args: never; Returns: string };
      is_admin: { Args: never; Returns: boolean };
      is_league_member: { Args: { p_league_id: string }; Returns: boolean };
      is_league_owner: { Args: { p_league_id: string }; Returns: boolean };
      join_league: {
        Args: { p_code: string; p_invited_by?: string };
        Returns: string;
      };
      leaderboard_for_grand_prix: {
        Args: { p_gp_id: string };
        Returns: {
          display_name: string;
          exact_hits: number;
          first_submit: string;
          markets_scored: number;
          podium_exact_all_hits: number;
          rank: number;
          total_points: number;
          user_id: string;
        }[];
      };
      leaderboard_for_league: {
        Args: { p_league_id: string };
        Returns: {
          display_name: string;
          exact_hits: number;
          first_submit: string;
          markets_scored: number;
          podium_exact_all_hits: number;
          rank: number;
          total_points: number;
          user_id: string;
        }[];
      };
      league_member_cap: { Args: { p_plan: string }; Returns: number };
      league_preview: {
        Args: { p_code: string };
        Returns: {
          id: string;
          member_count: number;
          name: string;
          plan: string;
        }[];
      };
      leave_league: { Args: { p_league_id: string }; Returns: undefined };
      lock_due_markets: { Args: never; Returns: number };
      market_locks_at: {
        Args: {
          p_gp: Database["public"]["Tables"]["grands_prix"]["Row"];
          p_type: string;
        };
        Returns: string;
      };
      remove_league_member: {
        Args: { p_league_id: string; p_user_id: string };
        Returns: undefined;
      };
      score_market_pick: {
        Args: {
          p_multiplier: number;
          p_pick: Json;
          p_result: Json;
          p_season_id: string;
          p_type: string;
        };
        Returns: {
          hit_type: string;
          points: number;
        }[];
      };
      scoring_rule_points: {
        Args: { p_market_type: string; p_rule_key: string; p_season_id: string };
        Returns: number;
      };
      validate_market_pick: {
        Args: { p_pick: Json; p_season_id: string; p_type: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
