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
      analytics_snapshots: {
        Row: {
          fetched_at: string | null
          followers_count: number | null
          id: string
          impressions: number | null
          platform: string
          profile_views: number | null
          raw_response: Json | null
          reach: number | null
          snapshot_date: string
          user_id: string
        }
        Insert: {
          fetched_at?: string | null
          followers_count?: number | null
          id?: string
          impressions?: number | null
          platform: string
          profile_views?: number | null
          raw_response?: Json | null
          reach?: number | null
          snapshot_date?: string
          user_id: string
        }
        Update: {
          fetched_at?: string | null
          followers_count?: number | null
          id?: string
          impressions?: number | null
          platform?: string
          profile_views?: number | null
          raw_response?: Json | null
          reach?: number | null
          snapshot_date?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_items: {
        Row: {
          ai_notes: string | null
          audience: string | null
          campaign_id: string | null
          caption: string | null
          confidence: number | null
          created_at: string
          cta: string | null
          hashtags: string[] | null
          hook: string | null
          id: string
          niche: string | null
          objective: string | null
          platforms: string[] | null
          post_type: string | null
          priority: string | null
          research_report_id: string | null
          scheduled_for: string
          status: string
          title: string | null
          updated_at: string
          user_id: string
          visual_idea: string | null
        }
        Insert: {
          ai_notes?: string | null
          audience?: string | null
          campaign_id?: string | null
          caption?: string | null
          confidence?: number | null
          created_at?: string
          cta?: string | null
          hashtags?: string[] | null
          hook?: string | null
          id?: string
          niche?: string | null
          objective?: string | null
          platforms?: string[] | null
          post_type?: string | null
          priority?: string | null
          research_report_id?: string | null
          scheduled_for: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
          visual_idea?: string | null
        }
        Update: {
          ai_notes?: string | null
          audience?: string | null
          campaign_id?: string | null
          caption?: string | null
          confidence?: number | null
          created_at?: string
          cta?: string | null
          hashtags?: string[] | null
          hook?: string | null
          id?: string
          niche?: string | null
          objective?: string | null
          platforms?: string[] | null
          post_type?: string | null
          priority?: string | null
          research_report_id?: string | null
          scheduled_for?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          visual_idea?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_items_research_report_id_fkey"
            columns: ["research_report_id"]
            isOneToOne: false
            referencedRelation: "research_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          ai_summary: string | null
          audience: string | null
          business_type: string | null
          content_mix: Json
          created_at: string
          duration_days: number
          goal: string | null
          id: string
          name: string
          platforms: string[]
          research_report_id: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          audience?: string | null
          business_type?: string | null
          content_mix?: Json
          created_at?: string
          duration_days?: number
          goal?: string | null
          id?: string
          name: string
          platforms?: string[]
          research_report_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          audience?: string | null
          business_type?: string | null
          content_mix?: Json
          created_at?: string
          duration_days?: number
          goal?: string | null
          id?: string
          name?: string
          platforms?: string[]
          research_report_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_research_report_id_fkey"
            columns: ["research_report_id"]
            isOneToOne: false
            referencedRelation: "research_reports"
            referencedColumns: ["id"]
          },
        ]
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
      competitor_watchlist: {
        Row: {
          created_at: string
          display_name: string | null
          handle: string
          id: string
          last_report_id: string | null
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          handle: string
          id?: string
          last_report_id?: string | null
          platform?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          handle?: string
          id?: string
          last_report_id?: string | null
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_watchlist_last_report_id_fkey"
            columns: ["last_report_id"]
            isOneToOne: false
            referencedRelation: "research_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ideas: {
        Row: {
          audience_interest_score: number | null
          business_value_score: number | null
          competition_score: number | null
          confidence_score: number | null
          created_at: string
          cta: string | null
          description: string | null
          difficulty_score: number | null
          format: string | null
          hashtags: Json | null
          hook: string | null
          id: string
          platform: string | null
          production_time_score: number | null
          research_report_id: string | null
          saved_to_planner: boolean
          title: string
          updated_at: string
          user_id: string
          virality_score: number | null
        }
        Insert: {
          audience_interest_score?: number | null
          business_value_score?: number | null
          competition_score?: number | null
          confidence_score?: number | null
          created_at?: string
          cta?: string | null
          description?: string | null
          difficulty_score?: number | null
          format?: string | null
          hashtags?: Json | null
          hook?: string | null
          id?: string
          platform?: string | null
          production_time_score?: number | null
          research_report_id?: string | null
          saved_to_planner?: boolean
          title: string
          updated_at?: string
          user_id: string
          virality_score?: number | null
        }
        Update: {
          audience_interest_score?: number | null
          business_value_score?: number | null
          competition_score?: number | null
          confidence_score?: number | null
          created_at?: string
          cta?: string | null
          description?: string | null
          difficulty_score?: number | null
          format?: string | null
          hashtags?: Json | null
          hook?: string | null
          id?: string
          platform?: string | null
          production_time_score?: number | null
          research_report_id?: string | null
          saved_to_planner?: boolean
          title?: string
          updated_at?: string
          user_id?: string
          virality_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_ideas_research_report_id_fkey"
            columns: ["research_report_id"]
            isOneToOne: false
            referencedRelation: "research_reports"
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
      post_analytics: {
        Row: {
          comments: number | null
          engagement_rate: number | null
          id: string
          impressions: number | null
          last_fetched_at: string | null
          likes: number | null
          platform: string
          platform_post_id: string | null
          publishing_result_id: string | null
          raw_response: Json | null
          reach: number | null
          saves: number | null
          shares: number | null
          user_id: string
        }
        Insert: {
          comments?: number | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          last_fetched_at?: string | null
          likes?: number | null
          platform: string
          platform_post_id?: string | null
          publishing_result_id?: string | null
          raw_response?: Json | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          user_id: string
        }
        Update: {
          comments?: number | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          last_fetched_at?: string | null
          likes?: number | null
          platform?: string
          platform_post_id?: string | null
          publishing_result_id?: string | null
          raw_response?: Json | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          user_id?: string
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
      publishing_jobs: {
        Row: {
          caption_per_platform: Json
          content_type: string
          created_at: string | null
          facebook_page_id: string | null
          hashtags_per_platform: Json | null
          id: string
          last_error_message: string | null
          linkedin_org_urn: string | null
          max_retries: number | null
          media_urls: string[] | null
          pinterest_board_id: string | null
          platforms: string[]
          project_id: string | null
          published_at: string | null
          retry_count: number | null
          scheduled_at: string | null
          status: string
          title: string | null
          updated_at: string | null
          upload_post_job_id: string | null
          upload_post_request_id: string | null
          user_id: string
        }
        Insert: {
          caption_per_platform?: Json
          content_type: string
          created_at?: string | null
          facebook_page_id?: string | null
          hashtags_per_platform?: Json | null
          id?: string
          last_error_message?: string | null
          linkedin_org_urn?: string | null
          max_retries?: number | null
          media_urls?: string[] | null
          pinterest_board_id?: string | null
          platforms: string[]
          project_id?: string | null
          published_at?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string | null
          upload_post_job_id?: string | null
          upload_post_request_id?: string | null
          user_id: string
        }
        Update: {
          caption_per_platform?: Json
          content_type?: string
          created_at?: string | null
          facebook_page_id?: string | null
          hashtags_per_platform?: Json | null
          id?: string
          last_error_message?: string | null
          linkedin_org_urn?: string | null
          max_retries?: number | null
          media_urls?: string[] | null
          pinterest_board_id?: string | null
          platforms?: string[]
          project_id?: string | null
          published_at?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string | null
          upload_post_job_id?: string | null
          upload_post_request_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publishing_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      publishing_results: {
        Row: {
          attempted_at: string | null
          completed_at: string | null
          created_at: string | null
          error_code: string | null
          error_is_retryable: boolean | null
          error_message: string | null
          id: string
          job_id: string
          platform: string
          platform_post_id: string | null
          post_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempted_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_code?: string | null
          error_is_retryable?: boolean | null
          error_message?: string | null
          id?: string
          job_id: string
          platform: string
          platform_post_id?: string | null
          post_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempted_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_code?: string | null
          error_is_retryable?: boolean | null
          error_message?: string | null
          id?: string
          job_id?: string
          platform?: string
          platform_post_id?: string | null
          post_url?: string | null
          status?: string
          user_id?: string
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
      research_reports: {
        Row: {
          created_at: string
          dna_report: Json | null
          error_message: string | null
          id: string
          is_saved: boolean
          mode: string
          opportunity_score: number | null
          raw_data: Json | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dna_report?: Json | null
          error_message?: string | null
          id?: string
          is_saved?: boolean
          mode: string
          opportunity_score?: number | null
          raw_data?: Json | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dna_report?: Json | null
          error_message?: string | null
          id?: string
          is_saved?: boolean
          mode?: string
          opportunity_score?: number | null
          raw_data?: Json | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      social_accounts: {
        Row: {
          connected_at: string | null
          connection_method: string
          created_at: string | null
          disconnected_at: string | null
          facebook_page_id: string | null
          facebook_page_name: string | null
          id: string
          is_connected: boolean | null
          last_validated_at: string | null
          last_validation_status: string | null
          linkedin_org_name: string | null
          linkedin_org_urn: string | null
          pinterest_default_board_id: string | null
          pinterest_default_board_name: string | null
          platform: string
          profile_display_name: string | null
          updated_at: string | null
          upload_post_username: string
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          connection_method?: string
          created_at?: string | null
          disconnected_at?: string | null
          facebook_page_id?: string | null
          facebook_page_name?: string | null
          id?: string
          is_connected?: boolean | null
          last_validated_at?: string | null
          last_validation_status?: string | null
          linkedin_org_name?: string | null
          linkedin_org_urn?: string | null
          pinterest_default_board_id?: string | null
          pinterest_default_board_name?: string | null
          platform: string
          profile_display_name?: string | null
          updated_at?: string | null
          upload_post_username: string
          user_id: string
        }
        Update: {
          connected_at?: string | null
          connection_method?: string
          created_at?: string | null
          disconnected_at?: string | null
          facebook_page_id?: string | null
          facebook_page_name?: string | null
          id?: string
          is_connected?: boolean | null
          last_validated_at?: string | null
          last_validation_status?: string | null
          linkedin_org_name?: string | null
          linkedin_org_urn?: string | null
          pinterest_default_board_id?: string | null
          pinterest_default_board_name?: string | null
          platform?: string
          profile_display_name?: string | null
          updated_at?: string | null
          upload_post_username?: string
          user_id?: string
        }
        Relationships: []
      }
      upload_post_profiles: {
        Row: {
          connect_page_visited: boolean | null
          created_at: string | null
          id: string
          last_jwt_expires_at: string | null
          last_jwt_generated_at: string | null
          profile_created_at_provider: string | null
          updated_at: string | null
          upload_post_username: string
          user_id: string
        }
        Insert: {
          connect_page_visited?: boolean | null
          created_at?: string | null
          id?: string
          last_jwt_expires_at?: string | null
          last_jwt_generated_at?: string | null
          profile_created_at_provider?: string | null
          updated_at?: string | null
          upload_post_username: string
          user_id: string
        }
        Update: {
          connect_page_visited?: boolean | null
          created_at?: string | null
          id?: string
          last_jwt_expires_at?: string | null
          last_jwt_generated_at?: string | null
          profile_created_at_provider?: string | null
          updated_at?: string | null
          upload_post_username?: string
          user_id?: string
        }
        Relationships: []
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
      webhook_events: {
        Row: {
          event_type: string
          id: string
          job_id: string | null
          processed: boolean | null
          processed_at: string | null
          processing_error: string | null
          provider_event_id: string | null
          raw_payload: Json
          received_at: string | null
        }
        Insert: {
          event_type: string
          id?: string
          job_id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          provider_event_id?: string | null
          raw_payload: Json
          received_at?: string | null
        }
        Update: {
          event_type?: string
          id?: string
          job_id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          provider_event_id?: string | null
          raw_payload?: Json
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
