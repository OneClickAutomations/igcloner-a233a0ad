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
      affiliate_link_clicks: {
        Row: {
          clicked_at: string | null
          id: string
          provider: string
          source_location: string | null
          user_id: string | null
        }
        Insert: {
          clicked_at?: string | null
          id?: string
          provider: string
          source_location?: string | null
          user_id?: string | null
        }
        Update: {
          clicked_at?: string | null
          id?: string
          provider?: string
          source_location?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_link_clicks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analyses: {
        Row: {
          created_at: string | null
          dna_analysis: Json | null
          id: string
          instagram_url: string
          performance_score: number | null
          post_type: string | null
          scraped_data: Json | null
          source_account: string | null
          source_caption: string | null
          user_id: string
          viral_band: string | null
          viral_factors: Json | null
          viral_score: number | null
        }
        Insert: {
          created_at?: string | null
          dna_analysis?: Json | null
          id?: string
          instagram_url: string
          performance_score?: number | null
          post_type?: string | null
          scraped_data?: Json | null
          source_account?: string | null
          source_caption?: string | null
          user_id: string
          viral_band?: string | null
          viral_factors?: Json | null
          viral_score?: number | null
        }
        Update: {
          created_at?: string | null
          dna_analysis?: Json | null
          id?: string
          instagram_url?: string
          performance_score?: number | null
          post_type?: string | null
          scraped_data?: Json | null
          source_account?: string | null
          source_caption?: string | null
          user_id?: string
          viral_band?: string | null
          viral_factors?: Json | null
          viral_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_items: {
        Row: {
          caption: string | null
          created_at: string
          hook: string | null
          id: string
          niche: string | null
          post_type: string | null
          scheduled_for: string
          status: string
          updated_at: string
          user_id: string
          visual_idea: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          hook?: string | null
          id?: string
          niche?: string | null
          post_type?: string | null
          scheduled_for: string
          status?: string
          updated_at?: string
          user_id: string
          visual_idea?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          hook?: string | null
          id?: string
          niche?: string | null
          post_type?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_id?: string
          visual_idea?: string | null
        }
        Relationships: []
      }
      clones: {
        Row: {
          analysis_id: string
          angle: string | null
          angle_type: string | null
          caption: string | null
          created_at: string | null
          cta: string | null
          hook: string | null
          id: string
          story_structure: string | null
          user_id: string
          version_number: number
          visual_direction: string | null
        }
        Insert: {
          analysis_id: string
          angle?: string | null
          angle_type?: string | null
          caption?: string | null
          created_at?: string | null
          cta?: string | null
          hook?: string | null
          id?: string
          story_structure?: string | null
          user_id: string
          version_number: number
          visual_direction?: string | null
        }
        Update: {
          analysis_id?: string
          angle?: string | null
          angle_type?: string | null
          caption?: string | null
          created_at?: string | null
          cta?: string | null
          hook?: string | null
          id?: string
          story_structure?: string | null
          user_id?: string
          version_number?: number
          visual_direction?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clones_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      multiplied_content: {
        Row: {
          analysis_id: string
          content: string
          created_at: string | null
          format: string
          id: string
          user_id: string
        }
        Insert: {
          analysis_id: string
          content: string
          created_at?: string | null
          format: string
          id?: string
          user_id: string
        }
        Update: {
          analysis_id?: string
          content?: string
          created_at?: string | null
          format?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "multiplied_content_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "multiplied_content_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          analyses_limit: number | null
          analyses_used: number | null
          avatar_url: string | null
          country: string | null
          created_at: string | null
          default_niche: string | null
          full_name: string | null
          id: string
          language: string | null
          last_login_at: string | null
          plan: Database["public"]["Enums"]["plan_type"] | null
          role: Database["public"]["Enums"]["app_role"] | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          timezone: string | null
          updated_at: string | null
          workspace_name: string | null
        }
        Insert: {
          analyses_limit?: number | null
          analyses_used?: number | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          default_niche?: string | null
          full_name?: string | null
          id: string
          language?: string | null
          last_login_at?: string | null
          plan?: Database["public"]["Enums"]["plan_type"] | null
          role?: Database["public"]["Enums"]["app_role"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          timezone?: string | null
          updated_at?: string | null
          workspace_name?: string | null
        }
        Update: {
          analyses_limit?: number | null
          analyses_used?: number | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          default_niche?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          last_login_at?: string | null
          plan?: Database["public"]["Enums"]["plan_type"] | null
          role?: Database["public"]["Enums"]["app_role"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          timezone?: string | null
          updated_at?: string | null
          workspace_name?: string | null
        }
        Relationships: []
      }
      project_assets: {
        Row: {
          asset_type: string
          created_at: string
          filename: string | null
          id: string
          metadata: Json | null
          project_id: string
          source: string
          url: string
          user_id: string
        }
        Insert: {
          asset_type: string
          created_at?: string
          filename?: string | null
          id?: string
          metadata?: Json | null
          project_id: string
          source: string
          url: string
          user_id: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          filename?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string
          source?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          analysis_id: string | null
          created_at: string
          dna_analysis: Json | null
          exports: Json
          format: string
          id: string
          project_data: Json | null
          source_account: string | null
          source_thumbnail: string | null
          source_url: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          user_preferences: Json | null
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          dna_analysis?: Json | null
          exports?: Json
          format: string
          id?: string
          project_data?: Json | null
          source_account?: string | null
          source_thumbnail?: string | null
          source_url?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          user_preferences?: Json | null
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          dna_analysis?: Json | null
          exports?: Json
          format?: string
          id?: string
          project_data?: Json | null
          source_account?: string | null
          source_thumbnail?: string | null
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          user_preferences?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      publishing_settings: {
        Row: {
          auto_publish_enabled: boolean | null
          caption_preference: string | null
          default_cta: string | null
          default_platforms: string[] | null
          default_post_times: Json | null
          default_scheduling_mode: string | null
          hashtag_preference: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_publish_enabled?: boolean | null
          caption_preference?: string | null
          default_cta?: string | null
          default_platforms?: string[] | null
          default_post_times?: Json | null
          default_scheduling_mode?: string | null
          hashtag_preference?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_publish_enabled?: boolean | null
          caption_preference?: string | null
          default_cta?: string | null
          default_platforms?: string[] | null
          default_post_times?: Json | null
          default_scheduling_mode?: string | null
          hashtag_preference?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publishing_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      publishing_templates: {
        Row: {
          caption_template: string | null
          created_at: string | null
          hashtag_set: string[] | null
          id: string
          name: string
          platforms: string[] | null
          user_id: string
        }
        Insert: {
          caption_template?: string | null
          created_at?: string | null
          hashtag_set?: string[] | null
          id?: string
          name: string
          platforms?: string[] | null
          user_id: string
        }
        Update: {
          caption_template?: string | null
          created_at?: string | null
          hashtag_set?: string[] | null
          id?: string
          name?: string
          platforms?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publishing_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_projects: {
        Row: {
          analysis_id: string
          created_at: string | null
          id: string
          notes: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          analysis_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          analysis_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_projects_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_api_keys: {
        Row: {
          created_at: string | null
          encrypted_key: string
          id: string
          key_last_four: string | null
          last_validated_at: string | null
          last_validation_error: string | null
          metadata: Json | null
          provider: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_key: string
          id?: string
          key_last_four?: string | null
          last_validated_at?: string | null
          last_validation_error?: string | null
          metadata?: Json | null
          provider: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_key?: string
          id?: string
          key_last_four?: string | null
          last_validated_at?: string | null
          last_validation_error?: string | null
          metadata?: Json | null
          provider?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          default_caption_style: string | null
          default_language: string | null
          default_platform: string | null
          default_reel_style: string | null
          default_voice_id: string | null
          theme: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          default_caption_style?: string | null
          default_language?: string | null
          default_platform?: string | null
          default_reel_style?: string | null
          default_voice_id?: string | null
          theme?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          default_caption_style?: string | null
          default_language?: string | null
          default_platform?: string | null
          default_reel_style?: string | null
          default_voice_id?: string | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "user"
      plan_type: "free" | "creator" | "pro"
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
      plan_type: ["free", "creator", "pro"],
    },
  },
} as const
