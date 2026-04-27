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
      ai_assistant_conversations: {
        Row: {
          channel: string
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          escalated_at: string | null
          establishment_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          channel?: string
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          escalated_at?: string | null
          establishment_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          escalated_at?: string | null
          establishment_id?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistant_conversations_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assistant_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_type: string
          metadata: Json | null
          sender_type: string
          voice_transcription: string | null
          voice_url: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          sender_type: string
          voice_transcription?: string | null
          voice_url?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          sender_type?: string
          voice_transcription?: string | null
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assistant_usage: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          message_count: number
          month_year: string
          updated_at: string
          voice_messages_count: number
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          message_count?: number
          month_year: string
          updated_at?: string
          voice_messages_count?: number
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          message_count?: number
          month_year?: string
          updated_at?: string
          voice_messages_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_usage_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assistant_waitlist: {
        Row: {
          client_id: string | null
          client_name: string
          client_phone: string
          created_at: string
          establishment_id: string
          id: string
          notified_at: string | null
          preferred_date: string
          preferred_time_end: string | null
          preferred_time_start: string | null
          professional_id: string | null
          service_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_name: string
          client_phone: string
          created_at?: string
          establishment_id: string
          id?: string
          notified_at?: string | null
          preferred_date: string
          preferred_time_end?: string | null
          preferred_time_start?: string | null
          professional_id?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          establishment_id?: string
          id?: string
          notified_at?: string | null
          preferred_date?: string
          preferred_time_end?: string | null
          preferred_time_start?: string | null
          professional_id?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_waitlist_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistant_waitlist_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistant_waitlist_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistant_waitlist_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversation_feedback: {
        Row: {
          conversation_id: string
          created_at: string
          created_by: string | null
          feedback_type: string
          feedback_value: string | null
          id: string
          message_id: string | null
          notes: string | null
          outcome: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          created_by?: string | null
          feedback_type: string
          feedback_value?: string | null
          id?: string
          message_id?: string | null
          notes?: string | null
          outcome?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          feedback_type?: string
          feedback_value?: string | null
          id?: string
          message_id?: string | null
          notes?: string | null
          outcome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_assistant_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversation_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ai_assistant_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reminders: {
        Row: {
          appointment_id: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          message_id: string | null
          reminder_type: string
          responded_at: string | null
          response: string | null
          sent_at: string | null
        }
        Insert: {
          appointment_id: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          reminder_type: string
          responded_at?: string | null
          response?: string | null
          sent_at?: string | null
        }
        Update: {
          appointment_id?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          reminder_type?: string
          responded_at?: string | null
          response?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cancelled_reason: string | null
          cancelled_via_whatsapp: boolean | null
          client_email: string | null
          client_id: string | null
          client_name: string
          client_phone: string
          confirmed_at: string | null
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
          cancelled_reason?: string | null
          cancelled_via_whatsapp?: boolean | null
          client_email?: string | null
          client_id?: string | null
          client_name: string
          client_phone: string
          confirmed_at?: string | null
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
          cancelled_reason?: string | null
          cancelled_via_whatsapp?: boolean | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          client_phone?: string
          confirmed_at?: string | null
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
      broadcast_campaigns: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          establishment_id: string
          failed_count: number
          id: string
          image_url: string | null
          message: string
          sent_at: string | null
          sent_count: number
          status: string
          title: string
          total_recipients: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          establishment_id: string
          failed_count?: number
          id?: string
          image_url?: string | null
          message: string
          sent_at?: string | null
          sent_count?: number
          status?: string
          title: string
          total_recipients?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          establishment_id?: string
          failed_count?: number
          id?: string
          image_url?: string | null
          message?: string
          sent_at?: string | null
          sent_count?: number
          status?: string
          title?: string
          total_recipients?: number
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_campaigns_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_logs: {
        Row: {
          campaign_id: string
          client_id: string | null
          client_name: string
          client_phone: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          client_id?: string | null
          client_name: string
          client_phone: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          client_id?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "broadcast_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          establishment_id: string
          id: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          establishment_id: string
          id?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          establishment_id?: string
          id?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_subscriptions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          status: string
          updated_at: string
          visitor_email: string | null
          visitor_id: string
          visitor_name: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          visitor_email?: string | null
          visitor_id: string
          visitor_name?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          visitor_email?: string | null
          visitor_id?: string
          visitor_name?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_from_user: boolean
          message: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_from_user?: boolean
          message: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_from_user?: boolean
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_ai_preferences: {
        Row: {
          cancellation_count: number | null
          client_id: string | null
          client_phone: string
          created_at: string
          detected_patterns: Json | null
          establishment_id: string
          favorite_professional_id: string | null
          favorite_professional_name: string | null
          favorite_services: Json | null
          id: string
          last_booking_at: string | null
          pattern_confidence: number | null
          preferred_day_of_week: number[] | null
          preferred_time_end: string | null
          preferred_time_slot: string | null
          preferred_time_start: string | null
          prefers_earliest_available: boolean | null
          professional_booking_count: number | null
          total_bookings: number | null
          updated_at: string
        }
        Insert: {
          cancellation_count?: number | null
          client_id?: string | null
          client_phone: string
          created_at?: string
          detected_patterns?: Json | null
          establishment_id: string
          favorite_professional_id?: string | null
          favorite_professional_name?: string | null
          favorite_services?: Json | null
          id?: string
          last_booking_at?: string | null
          pattern_confidence?: number | null
          preferred_day_of_week?: number[] | null
          preferred_time_end?: string | null
          preferred_time_slot?: string | null
          preferred_time_start?: string | null
          prefers_earliest_available?: boolean | null
          professional_booking_count?: number | null
          total_bookings?: number | null
          updated_at?: string
        }
        Update: {
          cancellation_count?: number | null
          client_id?: string | null
          client_phone?: string
          created_at?: string
          detected_patterns?: Json | null
          establishment_id?: string
          favorite_professional_id?: string | null
          favorite_professional_name?: string | null
          favorite_services?: Json | null
          id?: string
          last_booking_at?: string | null
          pattern_confidence?: number | null
          preferred_day_of_week?: number[] | null
          preferred_time_end?: string | null
          preferred_time_slot?: string | null
          preferred_time_start?: string | null
          prefers_earliest_available?: boolean | null
          professional_booking_count?: number | null
          total_bookings?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_ai_preferences_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_ai_preferences_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_ai_preferences_favorite_professional_id_fkey"
            columns: ["favorite_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
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
          global_identity_email: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          shared_history_consent: boolean
          terms_accepted_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          establishment_id: string
          global_identity_email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          shared_history_consent?: boolean
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          establishment_id?: string
          global_identity_email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          shared_history_consent?: boolean
          terms_accepted_at?: string | null
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
      commission_audit_log: {
        Row: {
          action: string
          commission_id: string
          created_at: string
          id: string
          justification: string | null
          new_values: Json | null
          old_values: Json | null
          user_id: string
        }
        Insert: {
          action: string
          commission_id: string
          created_at?: string
          id?: string
          justification?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          commission_id?: string
          created_at?: string
          id?: string
          justification?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_audit_log_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "professional_commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          applicable_product_ids: string[] | null
          applicable_service_ids: string[] | null
          applies_to: string
          challenge_end_date: string | null
          challenge_start_date: string | null
          challenge_target: number | null
          client_ids: string[] | null
          commission_type: string
          commission_value: number
          created_at: string
          days_of_week: number[] | null
          description: string | null
          establishment_id: string
          id: string
          is_active: boolean
          is_challenge: boolean
          name: string
          priority: number | null
          product_brand: string | null
          time_end: string | null
          time_start: string | null
          updated_at: string
        }
        Insert: {
          applicable_product_ids?: string[] | null
          applicable_service_ids?: string[] | null
          applies_to?: string
          challenge_end_date?: string | null
          challenge_start_date?: string | null
          challenge_target?: number | null
          client_ids?: string[] | null
          commission_type?: string
          commission_value?: number
          created_at?: string
          days_of_week?: number[] | null
          description?: string | null
          establishment_id: string
          id?: string
          is_active?: boolean
          is_challenge?: boolean
          name: string
          priority?: number | null
          product_brand?: string | null
          time_end?: string | null
          time_start?: string | null
          updated_at?: string
        }
        Update: {
          applicable_product_ids?: string[] | null
          applicable_service_ids?: string[] | null
          applies_to?: string
          challenge_end_date?: string | null
          challenge_start_date?: string | null
          challenge_target?: number | null
          client_ids?: string[] | null
          commission_type?: string
          commission_value?: number
          created_at?: string
          days_of_week?: number[] | null
          description?: string | null
          establishment_id?: string
          id?: string
          is_active?: boolean
          is_challenge?: boolean
          name?: string
          priority?: number | null
          product_brand?: string | null
          time_end?: string | null
          time_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_establishment_id_fkey"
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
          applicable_product_ids: string[] | null
          applicable_service_ids: string[] | null
          calculate_commission_after_discount: boolean
          code: string
          created_at: string
          current_uses: number
          description: string | null
          discount_target: string
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
          applicable_product_ids?: string[] | null
          applicable_service_ids?: string[] | null
          calculate_commission_after_discount?: boolean
          code: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_target?: string
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
          applicable_product_ids?: string[] | null
          applicable_service_ids?: string[] | null
          calculate_commission_after_discount?: boolean
          code?: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_target?: string
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      establishment_ai_assistant: {
        Row: {
          assistant_name: string
          availability_mode: string
          created_at: string
          custom_instructions: string | null
          escalation_whatsapp: string | null
          establishment_id: string
          id: string
          is_enabled: boolean
          language_style: string
          offline_message: string | null
          updated_at: string
          welcome_message: string | null
          working_hours: Json | null
        }
        Insert: {
          assistant_name?: string
          availability_mode?: string
          created_at?: string
          custom_instructions?: string | null
          escalation_whatsapp?: string | null
          establishment_id: string
          id?: string
          is_enabled?: boolean
          language_style?: string
          offline_message?: string | null
          updated_at?: string
          welcome_message?: string | null
          working_hours?: Json | null
        }
        Update: {
          assistant_name?: string
          availability_mode?: string
          created_at?: string
          custom_instructions?: string | null
          escalation_whatsapp?: string | null
          establishment_id?: string
          id?: string
          is_enabled?: boolean
          language_style?: string
          offline_message?: string | null
          updated_at?: string
          welcome_message?: string | null
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "establishment_ai_assistant_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_ai_learnings: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          confidence_score: number | null
          context_tags: string[] | null
          created_at: string
          establishment_id: string
          failure_count: number | null
          id: string
          ideal_response: string | null
          is_active: boolean | null
          learning_type: string
          source_conversation_id: string | null
          success_count: number | null
          trigger_pattern: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          confidence_score?: number | null
          context_tags?: string[] | null
          created_at?: string
          establishment_id: string
          failure_count?: number | null
          id?: string
          ideal_response?: string | null
          is_active?: boolean | null
          learning_type?: string
          source_conversation_id?: string | null
          success_count?: number | null
          trigger_pattern?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          confidence_score?: number | null
          context_tags?: string[] | null
          created_at?: string
          establishment_id?: string
          failure_count?: number | null
          id?: string
          ideal_response?: string | null
          is_active?: boolean | null
          learning_type?: string
          source_conversation_id?: string | null
          success_count?: number | null
          trigger_pattern?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_ai_learnings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_ai_learnings_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_ai_subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          establishment_id: string
          id: string
          status: string
          stripe_subscription_id: string | null
          trial_messages_used: number
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          establishment_id: string
          id?: string
          status?: string
          stripe_subscription_id?: string | null
          trial_messages_used?: number
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          establishment_id?: string
          id?: string
          status?: string
          stripe_subscription_id?: string | null
          trial_messages_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_ai_subscriptions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_closures: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          end_time: string | null
          establishment_id: string
          id: string
          is_recurring: boolean | null
          reason: string | null
          start_date: string
          start_time: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          end_time?: string | null
          establishment_id: string
          id?: string
          is_recurring?: boolean | null
          reason?: string | null
          start_date: string
          start_time?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          end_time?: string | null
          establishment_id?: string
          id?: string
          is_recurring?: boolean | null
          reason?: string | null
          start_date?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "establishment_closures_establishment_id_fkey"
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
          agenda_expand_hours: number | null
          agenda_slot_interval: number | null
          brand_accent_color: string | null
          brand_primary_color: string | null
          brand_secondary_color: string | null
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
          show_prices: boolean
          show_professional_names: boolean
          show_service_duration: boolean
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
          agenda_expand_hours?: number | null
          agenda_slot_interval?: number | null
          brand_accent_color?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
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
          show_prices?: boolean
          show_professional_names?: boolean
          show_service_duration?: boolean
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
          agenda_expand_hours?: number | null
          agenda_slot_interval?: number | null
          brand_accent_color?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
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
          show_prices?: boolean
          show_professional_names?: boolean
          show_service_duration?: boolean
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
      payment_methods: {
        Row: {
          allows_installments: boolean
          created_at: string
          display_order: number | null
          establishment_id: string
          has_interest: boolean | null
          id: string
          interest_rate: number | null
          is_active: boolean
          max_installments: number | null
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          allows_installments?: boolean
          created_at?: string
          display_order?: number | null
          establishment_id: string
          has_interest?: boolean | null
          id?: string
          interest_rate?: number | null
          is_active?: boolean
          max_installments?: number | null
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          allows_installments?: boolean
          created_at?: string
          display_order?: number | null
          establishment_id?: string
          has_interest?: boolean | null
          id?: string
          interest_rate?: number | null
          is_active?: boolean
          max_installments?: number | null
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_ai_addon: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_monthly: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          trial_message_limit: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_monthly?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          trial_message_limit?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_monthly?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          trial_message_limit?: number
          updated_at?: string
        }
        Relationships: []
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
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      product_units: {
        Row: {
          abbreviation: string
          created_at: string
          establishment_id: string
          id: string
          name: string
        }
        Insert: {
          abbreviation: string
          created_at?: string
          establishment_id: string
          id?: string
          name: string
        }
        Update: {
          abbreviation?: string
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_units_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          establishment_id: string
          id: string
          is_active: boolean
          name: string
          price: number
          stock_quantity: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          establishment_id: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          stock_quantity?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          establishment_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          stock_quantity?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
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
      professional_commissions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          commission_amount: number
          commission_rule_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          establishment_id: string
          id: string
          is_manual: boolean | null
          justification: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          professional_id: string
          reference_value: number
          status: string
          tab_id: string | null
          tab_item_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          commission_amount?: number
          commission_rule_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          establishment_id: string
          id?: string
          is_manual?: boolean | null
          justification?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          professional_id: string
          reference_value?: number
          status?: string
          tab_id?: string | null
          tab_item_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          commission_amount?: number
          commission_rule_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          establishment_id?: string
          id?: string
          is_manual?: boolean | null
          justification?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          professional_id?: string
          reference_value?: number
          status?: string
          tab_id?: string | null
          tab_item_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_commissions_commission_rule_id_fkey"
            columns: ["commission_rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_commissions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_commissions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_commissions_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "tabs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_commissions_tab_item_id_fkey"
            columns: ["tab_item_id"]
            isOneToOne: false
            referencedRelation: "tab_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_commissions_tab_item_id_fkey"
            columns: ["tab_item_id"]
            isOneToOne: false
            referencedRelation: "vw_shared_client_history"
            referencedColumns: ["tab_item_id"]
          },
        ]
      }
      professional_services: {
        Row: {
          commission_type: string
          commission_value: number
          id: string
          is_leasing: boolean | null
          leasing_type: string | null
          leasing_value: number | null
          professional_id: string
          service_id: string
        }
        Insert: {
          commission_type?: string
          commission_value?: number
          id?: string
          is_leasing?: boolean | null
          leasing_type?: string | null
          leasing_value?: number | null
          professional_id: string
          service_id: string
        }
        Update: {
          commission_type?: string
          commission_value?: number
          id?: string
          is_leasing?: boolean | null
          leasing_type?: string | null
          leasing_value?: number | null
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
          created_at: string
          email: string | null
          establishment_id: string
          id: string
          is_active: boolean
          leasing_base_date: string | null
          leasing_type: string | null
          leasing_value: number | null
          name: string
          phone: string | null
          specialties: string[] | null
          updated_at: string
          user_id: string | null
          working_hours: Json | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          establishment_id: string
          id?: string
          is_active?: boolean
          leasing_base_date?: string | null
          leasing_type?: string | null
          leasing_value?: number | null
          name: string
          phone?: string | null
          specialties?: string[] | null
          updated_at?: string
          user_id?: string | null
          working_hours?: Json | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          establishment_id?: string
          id?: string
          is_active?: boolean
          leasing_base_date?: string | null
          leasing_type?: string | null
          leasing_value?: number | null
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
          limits: Json | null
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
          limits?: Json | null
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
          limits?: Json | null
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tab_items: {
        Row: {
          added_by: string | null
          created_at: string
          description: string | null
          id: string
          item_type: string
          name: string
          product_id: string | null
          professional_id: string | null
          quantity: number
          service_id: string | null
          tab_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          item_type?: string
          name: string
          product_id?: string | null
          professional_id?: string | null
          quantity?: number
          service_id?: string | null
          tab_id: string
          total_price: number
          unit_price: number
        }
        Update: {
          added_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          item_type?: string
          name?: string
          product_id?: string | null
          professional_id?: string | null
          quantity?: number
          service_id?: string | null
          tab_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "tab_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tab_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tab_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tab_items_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      tab_payments: {
        Row: {
          amount: number
          created_at: string
          has_interest: boolean | null
          id: string
          installments: number | null
          interest_amount: number | null
          notes: string | null
          payment_method_id: string | null
          payment_method_name: string
          tab_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          has_interest?: boolean | null
          id?: string
          installments?: number | null
          interest_amount?: number | null
          notes?: string | null
          payment_method_id?: string | null
          payment_method_name: string
          tab_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          has_interest?: boolean | null
          id?: string
          installments?: number | null
          interest_amount?: number | null
          notes?: string | null
          payment_method_id?: string | null
          payment_method_name?: string
          tab_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tab_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tab_payments_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      tabs: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          client_name: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          discount_amount: number | null
          discount_type: string | null
          establishment_id: string
          id: string
          notes: string | null
          opened_at: string
          professional_id: string | null
          recognized_at: string | null
          recognized_by: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          client_name: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          establishment_id: string
          id?: string
          notes?: string | null
          opened_at?: string
          professional_id?: string | null
          recognized_at?: string | null
          recognized_by?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          client_name?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          establishment_id?: string
          id?: string
          notes?: string | null
          opened_at?: string
          professional_id?: string | null
          recognized_at?: string | null
          recognized_by?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabs_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
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
    }
    Views: {
      vw_shared_client_history: {
        Row: {
          closed_at: string | null
          duration_minutes: number | null
          establishment_id: string | null
          global_identity_email: string | null
          service_name: string | null
          tab_item_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tabs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      format_cpf: { Args: { cpf_raw: string }; Returns: string }
      get_client_appointments:
        | {
            Args: { _client_id: string; _email: string }
            Returns: {
              client_id: string
              client_name: string
              client_phone: string
              created_at: string
              duration_minutes: number
              establishment_id: string
              id: string
              notes: string
              price: number
              professional_id: string
              professional_name: string
              scheduled_at: string
              service_id: string
              service_name: string
              status: string
              updated_at: string
            }[]
          }
        | {
            Args: { _client_id: string; _email?: string; _phone?: string }
            Returns: {
              client_id: string
              client_name: string
              client_phone: string
              created_at: string
              duration_minutes: number
              establishment_id: string
              id: string
              notes: string
              price: number
              professional_id: string
              professional_name: string
              scheduled_at: string
              service_id: string
              service_name: string
              status: string
              updated_at: string
            }[]
          }
      get_professional_establishment_id: {
        Args: { _user_id: string }
        Returns: string
      }
      get_user_establishment_id: { Args: { _user_id: string }; Returns: string }
      get_user_professional_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "super_admin" | "establishment" | "client" | "professional"
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
      app_role: ["super_admin", "establishment", "client", "professional"],
      appointment_status: ["pending", "confirmed", "completed", "cancelled"],
      establishment_status: ["pending", "active", "suspended"],
      subscription_plan: ["basic", "professional", "premium", "trial"],
    },
  },
} as const
