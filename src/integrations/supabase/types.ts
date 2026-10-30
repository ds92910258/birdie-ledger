export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      game_scores: {
        Row: {
          created_at: string
          game_id: string
          id: string
          over_par: number
          payment_entry_id: string | null
          penalty: number | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          over_par: number
          payment_entry_id?: string | null
          penalty?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          over_par?: number
          payment_entry_id?: string | null
          penalty?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_scores_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_scores_payment_entry_id_fkey"
            columns: ["payment_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          memo: string | null
          played_on: string
          venue: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          memo?: string | null
          played_on: string
          venue: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          memo?: string | null
          played_on?: string
          venue?: string
        }
        Relationships: []
      }
      ledger_categories: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["ledger_kind"]
          label: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["ledger_kind"]
          label: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["ledger_kind"]
          label?: string
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["ledger_category"]
          created_at: string
          created_by: string | null
          custom_category: string | null
          entry_date: string
          id: string
          kind: Database["public"]["Enums"]["ledger_kind"]
          memo: string | null
          score_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["ledger_category"]
          created_at?: string
          created_by?: string | null
          custom_category?: string | null
          entry_date: string
          id?: string
          kind: Database["public"]["Enums"]["ledger_kind"]
          memo?: string | null
          score_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["ledger_category"]
          created_at?: string
          created_by?: string | null
          custom_category?: string | null
          entry_date?: string
          id?: string
          kind?: Database["public"]["Enums"]["ledger_kind"]
          memo?: string | null
          score_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_score_fk"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "game_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      member_contacts: {
        Row: {
          phone: string
          user_id: string
        }
        Insert: {
          phone: string
          user_id: string
        }
        Update: {
          phone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_bootstrap: {
        Row: {
          id: number
          token_hash: string
          used_at: string | null
        }
        Insert: {
          id: number
          token_hash: string
          used_at?: string | null
        }
        Update: {
          id?: number
          token_hash?: string
          used_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["member_status"]
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id: string
          name: string
          status?: Database["public"]["Enums"]["member_status"]
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["member_status"]
        }
        Relationships: []
      }
      signup_limits: {
        Row: {
          attempts: number
          key: string
          window_started: string
        }
        Insert: {
          attempts?: number
          key: string
          window_started?: string
        }
        Update: {
          attempts?: number
          key?: string
          window_started?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_add_entry: {
        Args: {
          _amount: number
          _category: Database["public"]["Enums"]["ledger_category"]
          _date: string
          _kind: Database["public"]["Enums"]["ledger_kind"]
          _memo: string
        }
        Returns: string
      }
      admin_list_members: {
        Args: never
        Returns: {
          created_at: string
          id: string
          is_admin: boolean
          name: string
          phone: string
          status: Database["public"]["Enums"]["member_status"]
        }[]
      }
      admin_mark_paid: {
        Args: { _amount: number; _received: string; _score_id: string }
        Returns: string
      }
      admin_record_entry: {
        Args: {
          _amount: number
          _category: Database["public"]["Enums"]["ledger_category"]
          _custom_category_id?: string
          _date: string
          _kind: Database["public"]["Enums"]["ledger_kind"]
          _memo: string
        }
        Returns: string
      }
      admin_set_member_status: {
        Args: {
          _status: Database["public"]["Enums"]["member_status"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_void_entry: {
        Args: { _entry_id: string; _reason: string }
        Returns: undefined
      }
      allow_signup_request: { Args: { _key: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin"
      ledger_category: "penalty" | "food" | "coffee" | "other"
      ledger_kind: "income" | "expense"
      member_status: "pending" | "approved" | "rejected" | "revoked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
      ledger_category: ["penalty", "food", "coffee", "other"],
      ledger_kind: ["income", "expense"],
      member_status: ["pending", "approved", "rejected", "revoked"],
    },
  },
} as const

