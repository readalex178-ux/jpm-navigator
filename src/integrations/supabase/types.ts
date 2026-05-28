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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      conversations: {
        Row: {
          created_at: string
          external_thread_id: string | null
          id: string
          last_synced_at: string | null
          platform: string
          prospect_id: string
          read_at: string | null
          sentiment: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_thread_id?: string | null
          id?: string
          last_synced_at?: string | null
          platform?: string
          prospect_id: string
          read_at?: string | null
          sentiment?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_thread_id?: string | null
          id?: string
          last_synced_at?: string | null
          platform?: string
          prospect_id?: string
          read_at?: string | null
          sentiment?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          provider: string
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          provider: string
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          provider?: string
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kpi_entries: {
        Row: {
          active_convos: number
          booked: number
          by_platform: Json
          calendars_sent: number
          connections_accepted: number
          connections_sent: number
          created_at: string
          date: string
          hours: number
          id: string
          replies: number
          shows: number
          updated_at: string
          user_id: string
          vn_sent: number
        }
        Insert: {
          active_convos?: number
          booked?: number
          by_platform?: Json
          calendars_sent?: number
          connections_accepted?: number
          connections_sent?: number
          created_at?: string
          date: string
          hours?: number
          id?: string
          replies?: number
          shows?: number
          updated_at?: string
          user_id: string
          vn_sent?: number
        }
        Update: {
          active_convos?: number
          booked?: number
          by_platform?: Json
          calendars_sent?: number
          connections_accepted?: number
          connections_sent?: number
          created_at?: string
          date?: string
          hours?: number
          id?: string
          replies?: number
          shows?: number
          updated_at?: string
          user_id?: string
          vn_sent?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          prospect_id: string
          read_at: string | null
          sender: Database["public"]["Enums"]["message_sender"]
          sent_at: string
          sentiment: string | null
          transcript: string | null
          user_id: string
          variation_name: string | null
        }
        Insert: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          prospect_id: string
          read_at?: string | null
          sender: Database["public"]["Enums"]["message_sender"]
          sent_at?: string
          sentiment?: string | null
          transcript?: string | null
          user_id: string
          variation_name?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          prospect_id?: string
          read_at?: string | null
          sender?: Database["public"]["Enums"]["message_sender"]
          sent_at?: string
          sentiment?: string | null
          transcript?: string | null
          user_id?: string
          variation_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          goals: Json
          id: string
          notification_prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          goals?: Json
          id?: string
          notification_prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          goals?: Json
          id?: string
          notification_prefs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prospect_analyses: {
        Row: {
          confidence: number | null
          created_at: string
          draft_message: string | null
          id: string
          next_move: string | null
          prospect_id: string
          reasoning: string | null
          stage_at_time: string
          suggested_activity_type: string | null
          suggested_stage: string | null
          user_id: string
          verdict_line: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          draft_message?: string | null
          id?: string
          next_move?: string | null
          prospect_id: string
          reasoning?: string | null
          stage_at_time: string
          suggested_activity_type?: string | null
          suggested_stage?: string | null
          user_id: string
          verdict_line: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          draft_message?: string | null
          id?: string
          next_move?: string | null
          prospect_id?: string
          reasoning?: string | null
          stage_at_time?: string
          suggested_activity_type?: string | null
          suggested_stage?: string | null
          user_id?: string
          verdict_line?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_analyses_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          bant: Json
          bio: string | null
          created_at: string
          follow_up_at: string | null
          follow_up_reason: string | null
          ghl_claimed: boolean
          ghl_remind_at: string | null
          handle: string | null
          id: string
          intent_level: string | null
          last_touch_at: string
          lead_type: string
          name: string
          niche: string | null
          notes: string | null
          pinned: boolean
          platform: string
          profile_url: string | null
          qual_score: number
          signals: Json
          stage: string
          stage_entered_at: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bant?: Json
          bio?: string | null
          created_at?: string
          follow_up_at?: string | null
          follow_up_reason?: string | null
          ghl_claimed?: boolean
          ghl_remind_at?: string | null
          handle?: string | null
          id?: string
          intent_level?: string | null
          last_touch_at?: string
          lead_type?: string
          name: string
          niche?: string | null
          notes?: string | null
          pinned?: boolean
          platform?: string
          profile_url?: string | null
          qual_score?: number
          signals?: Json
          stage?: string
          stage_entered_at?: string
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bant?: Json
          bio?: string | null
          created_at?: string
          follow_up_at?: string | null
          follow_up_reason?: string | null
          ghl_claimed?: boolean
          ghl_remind_at?: string | null
          handle?: string | null
          id?: string
          intent_level?: string | null
          last_touch_at?: string
          lead_type?: string
          name?: string
          niche?: string | null
          notes?: string | null
          pinned?: boolean
          platform?: string
          profile_url?: string | null
          qual_score?: number
          signals?: Json
          stage?: string
          stage_entered_at?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scripts: {
        Row: {
          category: string | null
          content: string
          created_at: string
          date: string | null
          id: string
          name: string
          niche: string | null
          outcome: string | null
          prospect_id: string | null
          prospect_name: string | null
          scenario: string | null
          updated_at: string
          used: boolean
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          date?: string | null
          id?: string
          name: string
          niche?: string | null
          outcome?: string | null
          prospect_id?: string | null
          prospect_name?: string | null
          scenario?: string | null
          updated_at?: string
          used?: boolean
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          date?: string | null
          id?: string
          name?: string
          niche?: string | null
          outcome?: string | null
          prospect_id?: string | null
          prospect_name?: string | null
          scenario?: string | null
          updated_at?: string
          used?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scripts_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          persona: string | null
          scenario: string
          score: number | null
          transcript: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          persona?: string | null
          scenario: string
          score?: number | null
          transcript?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          persona?: string | null
          scenario?: string
          score?: number | null
          transcript?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      dm_platform:
        | "instagram"
        | "tiktok"
        | "twitter"
        | "facebook"
        | "linkedin"
        | "other"
      message_kind: "text" | "vn" | "email" | "comment" | "call" | "note" | "dm"
      message_sender: "me" | "them"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user"],
      dm_platform: [
        "instagram",
        "tiktok",
        "twitter",
        "facebook",
        "linkedin",
        "other",
      ],
      message_kind: ["text", "vn", "email", "comment", "call", "note", "dm"],
      message_sender: ["me", "them"],
    },
  },
} as const
