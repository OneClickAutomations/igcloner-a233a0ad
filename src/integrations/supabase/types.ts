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
          created_at: string | null
          default_niche: string | null
          full_name: string | null
          id: string
          plan: Database["public"]["Enums"]["plan_type"] | null
          role: Database["public"]["Enums"]["app_role"] | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          analyses_limit?: number | null
          analyses_used?: number | null
          avatar_url?: string | null
          created_at?: string | null
          default_niche?: string | null
          full_name?: string | null
          id: string
          plan?: Database["public"]["Enums"]["plan_type"] | null
          role?: Database["public"]["Enums"]["app_role"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          analyses_limit?: number | null
          analyses_used?: number | null
          avatar_url?: string | null
          created_at?: string | null
          default_niche?: string | null
          full_name?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_type"] | null
          role?: Database["public"]["Enums"]["app_role"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
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
      upload_post_profiles: {
        Row: {
          id: string
          user_id: string
          upload_post_username: string
          profile_created_at_provider: string | null
          last_jwt_generated_at: string | null
          last_jwt_expires_at: string | null
          connect_page_visited: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          upload_post_username: string
          profile_created_at_provider?: string | null
          last_jwt_generated_at?: string | null
          last_jwt_expires_at?: string | null
          connect_page_visited?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          upload_post_username?: string
          profile_created_at_provider?: string | null
          last_jwt_generated_at?: string | null
          last_jwt_expires_at?: string | null
          connect_page_visited?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          id: string
          user_id: string
          platform: string
          upload_post_username: string
          profile_display_name: string | null
          connection_method: string
          is_connected: boolean | null
          facebook_page_id: string | null
          facebook_page_name: string | null
          linkedin_org_urn: string | null
          linkedin_org_name: string | null
          pinterest_default_board_id: string | null
          pinterest_default_board_name: string | null
          last_validated_at: string | null
          last_validation_status: string | null
          connected_at: string | null
          disconnected_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          platform: string
          upload_post_username: string
          profile_display_name?: string | null
          connection_method?: string
          is_connected?: boolean | null
          facebook_page_id?: string | null
          facebook_page_name?: string | null
          linkedin_org_urn?: string | null
          linkedin_org_name?: string | null
          pinterest_default_board_id?: string | null
          pinterest_default_board_name?: string | null
          last_validated_at?: string | null
          last_validation_status?: string | null
          connected_at?: string | null
          disconnected_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          platform?: string
          upload_post_username?: string
          profile_display_name?: string | null
          connection_method?: string
          is_connected?: boolean | null
          facebook_page_id?: string | null
          facebook_page_name?: string | null
          linkedin_org_urn?: string | null
          linkedin_org_name?: string | null
          pinterest_default_board_id?: string | null
          pinterest_default_board_name?: string | null
          last_validated_at?: string | null
          last_validation_status?: string | null
          connected_at?: string | null
          disconnected_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      publishing_jobs: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          content_type: string
          title: string | null
          caption_per_platform: Json
          hashtags_per_platform: Json | null
          media_urls: string[] | null
          platforms: string[]
          status: string
          scheduled_at: string | null
          upload_post_request_id: string | null
          upload_post_job_id: string | null
          retry_count: number | null
          max_retries: number | null
          last_error_message: string | null
          facebook_page_id: string | null
          linkedin_org_urn: string | null
          pinterest_board_id: string | null
          created_at: string | null
          updated_at: string | null
          published_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          project_id?: string | null
          content_type: string
          title?: string | null
          caption_per_platform?: Json
          hashtags_per_platform?: Json | null
          media_urls?: string[] | null
          platforms: string[]
          status?: string
          scheduled_at?: string | null
          upload_post_request_id?: string | null
          upload_post_job_id?: string | null
          retry_count?: number | null
          max_retries?: number | null
          last_error_message?: string | null
          facebook_page_id?: string | null
          linkedin_org_urn?: string | null
          pinterest_board_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          published_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string | null
          content_type?: string
          title?: string | null
          caption_per_platform?: Json
          hashtags_per_platform?: Json | null
          media_urls?: string[] | null
          platforms?: string[]
          status?: string
          scheduled_at?: string | null
          upload_post_request_id?: string | null
          upload_post_job_id?: string | null
          retry_count?: number | null
          max_retries?: number | null
          last_error_message?: string | null
          facebook_page_id?: string | null
          linkedin_org_urn?: string | null
          pinterest_board_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          published_at?: string | null
        }
        Relationships: []
      }
      publishing_results: {
        Row: {
          id: string
          job_id: string
          user_id: string
          platform: string
          status: string
          post_url: string | null
          platform_post_id: string | null
          error_code: string | null
          error_message: string | null
          error_is_retryable: boolean | null
          attempted_at: string | null
          completed_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          job_id: string
          user_id: string
          platform: string
          status?: string
          post_url?: string | null
          platform_post_id?: string | null
          error_code?: string | null
          error_message?: string | null
          error_is_retryable?: boolean | null
          attempted_at?: string | null
          completed_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          job_id?: string
          user_id?: string
          platform?: string
          status?: string
          post_url?: string | null
          platform_post_id?: string | null
          error_code?: string | null
          error_message?: string | null
          error_is_retryable?: boolean | null
          attempted_at?: string | null
          completed_at?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publishing_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "publishing_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_snapshots: {
        Row: {
          id: string
          user_id: string
          platform: string
          snapshot_date: string
          followers_count: number | null
          impressions: number | null
          reach: number | null
          profile_views: number | null
          raw_response: Json | null
          fetched_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          platform: string
          snapshot_date?: string
          followers_count?: number | null
          impressions?: number | null
          reach?: number | null
          profile_views?: number | null
          raw_response?: Json | null
          fetched_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          platform?: string
          snapshot_date?: string
          followers_count?: number | null
          impressions?: number | null
          reach?: number | null
          profile_views?: number | null
          raw_response?: Json | null
          fetched_at?: string | null
        }
        Relationships: []
      }
      post_analytics: {
        Row: {
          id: string
          publishing_result_id: string | null
          user_id: string
          platform: string
          platform_post_id: string | null
          likes: number | null
          comments: number | null
          shares: number | null
          saves: number | null
          impressions: number | null
          reach: number | null
          engagement_rate: number | null
          last_fetched_at: string | null
          raw_response: Json | null
        }
        Insert: {
          id?: string
          publishing_result_id?: string | null
          user_id: string
          platform: string
          platform_post_id?: string | null
          likes?: number | null
          comments?: number | null
          shares?: number | null
          saves?: number | null
          impressions?: number | null
          reach?: number | null
          engagement_rate?: number | null
          last_fetched_at?: string | null
          raw_response?: Json | null
        }
        Update: {
          id?: string
          publishing_result_id?: string | null
          user_id?: string
          platform?: string
          platform_post_id?: string | null
          likes?: number | null
          comments?: number | null
          shares?: number | null
          saves?: number | null
          impressions?: number | null
          reach?: number | null
          engagement_rate?: number | null
          last_fetched_at?: string | null
          raw_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "post_analytics_publishing_result_id_fkey"
            columns: ["publishing_result_id"]
            isOneToOne: false
            referencedRelation: "publishing_results"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          id: string
          provider_event_id: string | null
          event_type: string
          job_id: string | null
          raw_payload: Json
          processed: boolean | null
          processed_at: string | null
          processing_error: string | null
          received_at: string | null
        }
        Insert: {
          id?: string
          provider_event_id?: string | null
          event_type: string
          job_id?: string | null
          raw_payload: Json
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string | null
        }
        Update: {
          id?: string
          provider_event_id?: string | null
          event_type?: string
          job_id?: string | null
          raw_payload?: Json
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "publishing_jobs"
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
