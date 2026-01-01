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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      card_history: {
        Row: {
          action: string
          card_id: string
          created_at: string
          id: string
          new_clue: string | null
          new_difficulty: number | null
          new_is_active: boolean | null
          new_word: string | null
          old_clue: string | null
          old_difficulty: number | null
          old_is_active: boolean | null
          old_word: string | null
          user_id: string
        }
        Insert: {
          action: string
          card_id: string
          created_at?: string
          id?: string
          new_clue?: string | null
          new_difficulty?: number | null
          new_is_active?: boolean | null
          new_word?: string | null
          old_clue?: string | null
          old_difficulty?: number | null
          old_is_active?: boolean | null
          old_word?: string | null
          user_id: string
        }
        Update: {
          action?: string
          card_id?: string
          created_at?: string
          id?: string
          new_clue?: string | null
          new_difficulty?: number | null
          new_is_active?: boolean | null
          new_word?: string | null
          old_clue?: string | null
          old_difficulty?: number | null
          old_is_active?: boolean | null
          old_word?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_history_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_reports: {
        Row: {
          card_id: string
          created_at: string
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_reports_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          clue: string
          created_at: string
          created_by: string
          difficulty: number | null
          id: string
          is_active: boolean
          pack_id: string
          word: string
        }
        Insert: {
          clue: string
          created_at?: string
          created_by: string
          difficulty?: number | null
          id?: string
          is_active?: boolean
          pack_id: string
          word: string
        }
        Update: {
          clue?: string
          created_at?: string
          created_by?: string
          difficulty?: number | null
          id?: string
          is_active?: boolean
          pack_id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          card_id: string | null
          clue_text: string | null
          created_at: string
          deceived_clue_text: string | null
          deceived_topo_player_id: string | null
          deceived_word_text: string | null
          first_speaker_player_id: string | null
          host_guest_id: string | null
          host_user_id: string | null
          id: string
          join_code: string | null
          max_players: number | null
          mode: string
          pack_id: string | null
          selected_pack_ids: string[] | null
          status: string
          topo_count: number
          word_id: string | null
          word_text: string | null
        }
        Insert: {
          card_id?: string | null
          clue_text?: string | null
          created_at?: string
          deceived_clue_text?: string | null
          deceived_topo_player_id?: string | null
          deceived_word_text?: string | null
          first_speaker_player_id?: string | null
          host_guest_id?: string | null
          host_user_id?: string | null
          id?: string
          join_code?: string | null
          max_players?: number | null
          mode: string
          pack_id?: string | null
          selected_pack_ids?: string[] | null
          status?: string
          topo_count?: number
          word_id?: string | null
          word_text?: string | null
        }
        Update: {
          card_id?: string | null
          clue_text?: string | null
          created_at?: string
          deceived_clue_text?: string | null
          deceived_topo_player_id?: string | null
          deceived_word_text?: string | null
          first_speaker_player_id?: string | null
          host_guest_id?: string | null
          host_user_id?: string | null
          id?: string
          join_code?: string | null
          max_players?: number | null
          mode?: string
          pack_id?: string | null
          selected_pack_ids?: string[] | null
          status?: string
          topo_count?: number
          word_id?: string | null
          word_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_sessions_deceived_topo_player_id_fkey"
            columns: ["deceived_topo_player_id"]
            isOneToOne: false
            referencedRelation: "session_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_sessions_first_speaker_player_id_fkey"
            columns: ["first_speaker_player_id"]
            isOneToOne: false
            referencedRelation: "session_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_sessions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_sessions_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      packs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          master_category: string | null
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          master_category?: string | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          master_category?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_key: string | null
          can_submit_words: boolean
          created_at: string
          display_name: string | null
          gender: string | null
          id: string
          photo_url: string | null
          preferred_pack_ids: string[] | null
        }
        Insert: {
          avatar_key?: string | null
          can_submit_words?: boolean
          created_at?: string
          display_name?: string | null
          gender?: string | null
          id: string
          photo_url?: string | null
          preferred_pack_ids?: string[] | null
        }
        Update: {
          avatar_key?: string | null
          can_submit_words?: boolean
          created_at?: string
          display_name?: string | null
          gender?: string | null
          id?: string
          photo_url?: string | null
          preferred_pack_ids?: string[] | null
        }
        Relationships: []
      }
      session_players: {
        Row: {
          avatar_key: string | null
          created_at: string
          display_name: string
          gender: string | null
          guest_id: string | null
          has_revealed: boolean | null
          id: string
          photo_url: string | null
          role: string | null
          session_id: string
          turn_order: number | null
          user_id: string | null
        }
        Insert: {
          avatar_key?: string | null
          created_at?: string
          display_name: string
          gender?: string | null
          guest_id?: string | null
          has_revealed?: boolean | null
          id?: string
          photo_url?: string | null
          role?: string | null
          session_id: string
          turn_order?: number | null
          user_id?: string | null
        }
        Update: {
          avatar_key?: string | null
          created_at?: string
          display_name?: string
          gender?: string | null
          guest_id?: string | null
          has_revealed?: boolean | null
          id?: string
          photo_url?: string | null
          role?: string | null
          session_id?: string
          turn_order?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      words: {
        Row: {
          clue: string
          created_at: string
          id: string
          is_active: boolean | null
          pack: string
          word: string
        }
        Insert: {
          clue: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          pack?: string
          word: string
        }
        Update: {
          clue?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          pack?: string
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      card_used_in_sessions: { Args: { card_id: string }; Returns: boolean }
      generate_join_code: { Args: never; Returns: string }
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
    },
  },
} as const
