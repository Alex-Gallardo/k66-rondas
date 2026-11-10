export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
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
      areas: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          id: string;
          name: string;
          parent_id: string | null;
          site_id: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          parent_id?: string | null;
          site_id: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          parent_id?: string | null;
          site_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "areas_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "areas_site_id_parent_id_fkey";
            columns: ["site_id", "parent_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["site_id", "id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_id: string | null;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
          occurred_at: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
          occurred_at?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      checkpoints: {
        Row: {
          active: boolean;
          area_id: string;
          code: string;
          created_at: string;
          description: string | null;
          id: string;
          installed_at: string | null;
          last_verified_at: string | null;
          name: string;
        };
        Insert: {
          active?: boolean;
          area_id: string;
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          installed_at?: string | null;
          last_verified_at?: string | null;
          name: string;
        };
        Update: {
          active?: boolean;
          area_id?: string;
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          installed_at?: string | null;
          last_verified_at?: string | null;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "checkpoints_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
        ];
      };
      gate_assignments: {
        Row: {
          active: boolean;
          assigned_at: string;
          gate_id: string;
          id: string;
          profile_id: string;
        };
        Insert: {
          active?: boolean;
          assigned_at?: string;
          gate_id: string;
          id?: string;
          profile_id: string;
        };
        Update: {
          active?: boolean;
          assigned_at?: string;
          gate_id?: string;
          id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gate_assignments_gate_id_fkey";
            columns: ["gate_id"];
            isOneToOne: false;
            referencedRelation: "gates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gate_assignments_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      gates: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          id: string;
          name: string;
          site_id: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          site_id: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          site_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gates_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      patrol_expected_points: {
        Row: {
          area_name_snapshot: string;
          checkpoint_id: string;
          checkpoint_name_snapshot: string;
          id: string;
          patrol_id: string;
          position: number;
          required: boolean;
        };
        Insert: {
          area_name_snapshot: string;
          checkpoint_id: string;
          checkpoint_name_snapshot: string;
          id?: string;
          patrol_id: string;
          position: number;
          required: boolean;
        };
        Update: {
          area_name_snapshot?: string;
          checkpoint_id?: string;
          checkpoint_name_snapshot?: string;
          id?: string;
          patrol_id?: string;
          position?: number;
          required?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "patrol_expected_points_checkpoint_id_fkey";
            columns: ["checkpoint_id"];
            isOneToOne: false;
            referencedRelation: "checkpoints";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patrol_expected_points_patrol_id_fkey";
            columns: ["patrol_id"];
            isOneToOne: false;
            referencedRelation: "patrols";
            referencedColumns: ["id"];
          },
        ];
      };
      patrol_templates: {
        Row: {
          active: boolean;
          created_at: string;
          gate_id: string;
          id: string;
          is_default: boolean;
          name: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          gate_id: string;
          id?: string;
          is_default?: boolean;
          name: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          gate_id?: string;
          id?: string;
          is_default?: boolean;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patrol_templates_gate_id_fkey";
            columns: ["gate_id"];
            isOneToOne: false;
            referencedRelation: "gates";
            referencedColumns: ["id"];
          },
        ];
      };
      patrols: {
        Row: {
          closure_reason: string | null;
          ended_at: string | null;
          gate_id: string;
          guard_id: string;
          id: string;
          shift_id: string;
          started_at: string;
          status: string;
          template_id: string;
        };
        Insert: {
          closure_reason?: string | null;
          ended_at?: string | null;
          gate_id: string;
          guard_id: string;
          id?: string;
          shift_id: string;
          started_at?: string;
          status?: string;
          template_id: string;
        };
        Update: {
          closure_reason?: string | null;
          ended_at?: string | null;
          gate_id?: string;
          guard_id?: string;
          id?: string;
          shift_id?: string;
          started_at?: string;
          status?: string;
          template_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patrols_gate_id_fkey";
            columns: ["gate_id"];
            isOneToOne: false;
            referencedRelation: "gates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patrols_guard_id_fkey";
            columns: ["guard_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patrols_shift_id_fkey";
            columns: ["shift_id"];
            isOneToOne: false;
            referencedRelation: "shifts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patrols_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "patrol_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          active: boolean;
          created_at: string;
          employee_code: string;
          full_name: string;
          id: string;
          must_change_password: boolean;
          role: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          employee_code: string;
          full_name: string;
          id: string;
          must_change_password?: boolean;
          role?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          employee_code?: string;
          full_name?: string;
          id?: string;
          must_change_password?: boolean;
          role?: string;
        };
        Relationships: [];
      };
      qr_codes: {
        Row: {
          checkpoint_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          legacy_code: string | null;
          public_code: string;
          revoked_at: string | null;
          version: number;
        };
        Insert: {
          checkpoint_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          legacy_code?: string | null;
          public_code: string;
          revoked_at?: string | null;
          version: number;
        };
        Update: {
          checkpoint_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          legacy_code?: string | null;
          public_code?: string;
          revoked_at?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "qr_codes_checkpoint_id_fkey";
            columns: ["checkpoint_id"];
            isOneToOne: false;
            referencedRelation: "checkpoints";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_codes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      shifts: {
        Row: {
          ended_at: string | null;
          gate_id: string;
          gate_name_snapshot: string;
          guard_id: string;
          id: string;
          started_at: string;
        };
        Insert: {
          ended_at?: string | null;
          gate_id: string;
          gate_name_snapshot: string;
          guard_id: string;
          id?: string;
          started_at?: string;
        };
        Update: {
          ended_at?: string | null;
          gate_id?: string;
          gate_name_snapshot?: string;
          guard_id?: string;
          id?: string;
          started_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shifts_gate_id_fkey";
            columns: ["gate_id"];
            isOneToOne: false;
            referencedRelation: "gates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shifts_guard_id_fkey";
            columns: ["guard_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      site_settings: {
        Row: {
          geo_enabled: boolean;
          idle_logout_minutes: number;
          photo_retention_days: number;
          site_id: string;
          updated_at: string;
        };
        Insert: {
          geo_enabled?: boolean;
          idle_logout_minutes?: number;
          photo_retention_days?: number;
          site_id: string;
          updated_at?: string;
        };
        Update: {
          geo_enabled?: boolean;
          idle_logout_minutes?: number;
          photo_retention_days?: number;
          site_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_settings_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: true;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      sites: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          id: string;
          name: string;
          timezone: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          timezone?: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      template_points: {
        Row: {
          checkpoint_id: string;
          id: string;
          position: number;
          required: boolean;
          template_id: string;
        };
        Insert: {
          checkpoint_id: string;
          id?: string;
          position: number;
          required?: boolean;
          template_id: string;
        };
        Update: {
          checkpoint_id?: string;
          id?: string;
          position?: number;
          required?: boolean;
          template_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "template_points_checkpoint_id_fkey";
            columns: ["checkpoint_id"];
            isOneToOne: false;
            referencedRelation: "checkpoints";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "template_points_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "patrol_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      visit_photos: {
        Row: {
          bytes: number;
          id: string;
          mime_type: string;
          storage_path: string;
          uploaded_at: string;
          uploaded_by: string;
          visit_id: string;
        };
        Insert: {
          bytes: number;
          id?: string;
          mime_type: string;
          storage_path: string;
          uploaded_at?: string;
          uploaded_by: string;
          visit_id: string;
        };
        Update: {
          bytes?: number;
          id?: string;
          mime_type?: string;
          storage_path?: string;
          uploaded_at?: string;
          uploaded_by?: string;
          visit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visit_photos_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visit_photos_visit_id_fkey";
            columns: ["visit_id"];
            isOneToOne: true;
            referencedRelation: "visits";
            referencedColumns: ["id"];
          },
        ];
      };
      visits: {
        Row: {
          accuracy_m: number | null;
          area_name_snapshot: string;
          checkpoint_id: string;
          checkpoint_name_snapshot: string;
          gate_id: string;
          geo_captured_at: string | null;
          geo_status: string;
          guard_id: string;
          id: string;
          idempotency_key: string;
          latitude: number | null;
          longitude: number | null;
          note: string | null;
          note_updated_at: string | null;
          patrol_id: string;
          qr_code_id: string | null;
          recorded_at: string;
        };
        Insert: {
          accuracy_m?: number | null;
          area_name_snapshot: string;
          checkpoint_id: string;
          checkpoint_name_snapshot: string;
          gate_id: string;
          geo_captured_at?: string | null;
          geo_status?: string;
          guard_id: string;
          id?: string;
          idempotency_key: string;
          latitude?: number | null;
          longitude?: number | null;
          note?: string | null;
          note_updated_at?: string | null;
          patrol_id: string;
          qr_code_id?: string | null;
          recorded_at?: string;
        };
        Update: {
          accuracy_m?: number | null;
          area_name_snapshot?: string;
          checkpoint_id?: string;
          checkpoint_name_snapshot?: string;
          gate_id?: string;
          geo_captured_at?: string | null;
          geo_status?: string;
          guard_id?: string;
          id?: string;
          idempotency_key?: string;
          latitude?: number | null;
          longitude?: number | null;
          note?: string | null;
          note_updated_at?: string | null;
          patrol_id?: string;
          qr_code_id?: string | null;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visits_checkpoint_id_fkey";
            columns: ["checkpoint_id"];
            isOneToOne: false;
            referencedRelation: "checkpoints";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_gate_id_fkey";
            columns: ["gate_id"];
            isOneToOne: false;
            referencedRelation: "gates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_guard_id_fkey";
            columns: ["guard_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_patrol_id_fkey";
            columns: ["patrol_id"];
            isOneToOne: false;
            referencedRelation: "patrols";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_qr_code_id_fkey";
            columns: ["qr_code_id"];
            isOneToOne: false;
            referencedRelation: "qr_codes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      close_guard_patrol: {
        Args: { p_actor_id: string; p_patrol_id: string; p_reason?: string };
        Returns: string;
      };
      close_guard_shift: {
        Args: { p_actor_id: string; p_shift_id: string };
        Returns: string;
      };
      create_checkpoint_with_qr: {
        Args: {
          p_actor_id: string;
          p_area_id: string;
          p_code: string;
          p_description: string;
          p_name: string;
          p_public_code: string;
        };
        Returns: string;
      };
      create_profile_with_gates: {
        Args: {
          p_actor_id: string;
          p_employee_code: string;
          p_full_name: string;
          p_gate_ids: string[];
          p_role: string;
          p_user_id: string;
        };
        Returns: string;
      };
      open_guard_shift: {
        Args: { p_actor_id: string; p_gate_id: string };
        Returns: string;
      };
      record_visit: {
        Args: {
          p_actor_id: string;
          p_geo: Json;
          p_idempotency_key: string;
          p_qr_code: string;
        };
        Returns: Json;
      };
      rotate_checkpoint_qr: {
        Args: {
          p_actor_id: string;
          p_checkpoint_id: string;
          p_public_code: string;
          p_reason: string;
        };
        Returns: number;
      };
      save_patrol_template: {
        Args: {
          p_actor_id: string;
          p_gate_id: string;
          p_is_default: boolean;
          p_name: string;
          p_points: Json;
          p_template_id: string;
        };
        Returns: string;
      };
      start_patrol_with_snapshot: {
        Args: { p_actor_id: string; p_shift_id: string; p_template_id: string };
        Returns: string;
      };
      update_profile_with_gates: {
        Args: {
          p_active: boolean;
          p_actor_id: string;
          p_full_name: string;
          p_gate_ids: string[];
          p_role: string;
          p_user_id: string;
        };
        Returns: string;
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

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
