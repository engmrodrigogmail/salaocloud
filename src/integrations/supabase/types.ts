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
      appointments: {
        Row: {
          client_email: string | null
          client_id: string | null
          client_name: string
          client_phone: string
          created_at: string
          duration_minutes: number
          establishment_id: string
          id: string
          notes: string | null
          price: number
          professional_id: string
          scheduled_at: string
          service_id: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          client_email?: string | null
          client_id?: string | null
          client_name: string
          client_phone: string
          created_at?: string
          duration_minutes: number
          establishment_id: string
          id?: string
          notes?: string | null
          price: number
          professional_id: string
          scheduled_at: string
          service_id: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          duration_minutes?: number
          establishment_id?: string
          id?: string
          notes?: string | null
          price?: number
          professional_id?: string
          scheduled_at?: string
          service_id?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      client_loyalty_points: {
        Row: {
          client_id: string
          created_at: string
          id: string
          loyalty_program_id: string
          points_balance: number
          total_points_earned: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          loyalty_program_id: string
          points_balance?: number
          total_points_earned?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          loyalty_program_id?: string
          points_balance?: number
          total_points_earned?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_loyalty_points_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_loyalty_points_loyalty_program_id_fkey"
            columns: ["loyalty_program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          cpf: string | null
          created_at: string
          email: string | null
          establishment_id: string
          id: string
          name: string
          notes: string | null
          phone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          establishment_id: string
          id?: string
          name: string
          notes?: string | null
          phone: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          establishment_id?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usage: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          coupon_id: string
          id: string
          used_at: string
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          coupon_id: string
          id?: string
          used_at?: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          coupon_id?: string
          id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "discount_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_coupons: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          description: string | null
          discount_type: string
          discount_value: number
          establishment_id: string
          id: string
          is_active: boolean
          max_uses: number | null
          min_purchase_value: number | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value: number
          establishment_id: string
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_purchase_value?: number | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          establishment_id?: string
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_purchase_value?: number | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_coupons_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      establishments: {
        Row: {
          address: string | null
          cancellation_policy: string | null
          city: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          show_catalog: boolean
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["establishment_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          trial_ends_at: string | null
          updated_at: string
          working_hours: Json | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          cancellation_policy?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          show_catalog?: boolean
          slug: string
          state?: string | null
          status?: Database["public"]["Enums"]["establishment_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          trial_ends_at?: string | null
          updated_at?: string
          working_hours?: Json | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          cancellation_policy?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          show_catalog?: boolean
          slug?: string
          state?: string | null
          status?: Database["public"]["Enums"]["establishment_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          trial_ends_at?: string | null
          updated_at?: string
          working_hours?: Json | null
          zip_code?: string | null
        }
        Relationships: []
      }
      loyalty_programs: {
        Row: {
          created_at: string
          description: string | null
          establishment_id: string
          id: string
          is_active: boolean
          name: string
          points_per_currency: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          establishment_id: string
          id?: string
          is_active?: boolean
          name: string
          points_per_currency?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          establishment_id?: string
          id?: string
          is_active?: boolean
          name?: string
          points_per_currency?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          loyalty_program_id: string
          name: string
          points_required: number
          reward_type: string
          reward_value: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          loyalty_program_id: string
          name: string
          points_required: number
          reward_type?: string
          reward_value: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          loyalty_program_id?: string
          name?: string
          points_required?: number
          reward_type?: string
          reward_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_loyalty_program_id_fkey"
            columns: ["loyalty_program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_coupon_redemptions: {
        Row: {
          applied_to_plan: string | null
          coupon_id: string
          discount_amount: number | null
          establishment_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          redeemed_at: string
        }
        Insert: {
          applied_to_plan?: string | null
          coupon_id: string
          discount_amount?: number | null
          establishment_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          redeemed_at?: string
        }
        Update: {
          applied_to_plan?: string | null
          coupon_id?: string
          discount_amount?: number | null
          establishment_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "platform_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_coupon_redemptions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_coupons: {
        Row: {
          applicable_features: string[] | null
          applicable_plans: string[] | null
          applies_to: string
          code: string
          created_at: string
          created_by: string | null
          current_redemptions: number
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_redemptions: number | null
          min_months: number | null
          name: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          applicable_features?: string[] | null
          applicable_plans?: string[] | null
          applies_to?: string
          code: string
          created_at?: string
          created_by?: string | null
          current_redemptions?: number
          description?: string | null
          discount_type?: string
          discount_value: number
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_months?: number | null
          name: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          applicable_features?: string[] | null
          applicable_plans?: string[] | null
          applies_to?: string
          code?: string
          created_at?: string
          created_by?: string | null
          current_redemptions?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_months?: number | null
          name?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      professional_blocked_times: {
        Row: {
          created_at: string
          end_time: string
          id: string
          professional_id: string
          reason: string | null
          start_time: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          professional_id: string
          reason?: string | null
          start_time: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          professional_id?: string
          reason?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_blocked_times_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_services: {
        Row: {
          id: string
          professional_id: string
          service_id: string
        }
        Insert: {
          id?: string
          professional_id: string
          service_id: string
        }
        Update: {
          id?: string
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          avatar_url: string | null
          commission_percentage: number | null
          created_at: string
          email: string | null
          establishment_id: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          specialties: string[] | null
          updated_at: string
          user_id: string | null
          working_hours: Json | null
        }
        Insert: {
          avatar_url?: string | null
          commission_percentage?: number | null
          created_at?: string
          email?: string | null
          establishment_id: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          specialties?: string[] | null
          updated_at?: string
          user_id?: string | null
          working_hours?: Json | null
        }
        Update: {
          avatar_url?: string | null
          commission_percentage?: number | null
          created_at?: string
          email?: string | null
          establishment_id?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          specialties?: string[] | null
          updated_at?: string
          user_id?: string | null
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          applicable_services: string[] | null
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          end_date: string
          establishment_id: string
          id: string
          is_active: boolean
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          applicable_services?: string[] | null
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value: number
          end_date: string
          establishment_id: string
          id?: string
          is_active?: boolean
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          applicable_services?: string[] | null
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string
          establishment_id?: string
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          establishment_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          establishment_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          establishment_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          establishment_id: string
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          establishment_id: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          establishment_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          badge: string | null
          created_at: string
          description: string | null
          display_order: number
          features: string[]
          id: string
          is_active: boolean
          is_highlighted: boolean
          name: string
          price_monthly: number
          price_yearly: number | null
          slug: string
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          badge?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          features?: string[]
          id?: string
          is_active?: boolean
          is_highlighted?: boolean
          name: string
          price_monthly?: number
          price_yearly?: number | null
          slug: string
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          badge?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          features?: string[]
          id?: string
          is_active?: boolean
          is_highlighted?: boolean
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          slug?: string
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          updated_at?: string
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
      format_cpf: { Args: { cpf_raw: string }; Returns: string }
      get_user_establishment_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "establishment" | "client"
      appointment_status: "pending" | "confirmed" | "completed" | "cancelled"
      establishment_status: "pending" | "active" | "suspended"
      subscription_plan: "basic" | "professional" | "premium" | "trial"
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
      app_role: ["super_admin", "establishment", "client"],
      appointment_status: ["pending", "confirmed", "completed", "cancelled"],
      establishment_status: ["pending", "active", "suspended"],
      subscription_plan: ["basic", "professional", "premium", "trial"],
    },
  },
} as const
