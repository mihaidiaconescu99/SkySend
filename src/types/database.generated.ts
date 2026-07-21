export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string | null
          country: string | null
          county: string | null
          created_at: string
          formatted_address: string
          id: string
          is_saved: boolean
          label: string | null
          last_used_at: string
          latitude: number
          longitude: number
          postal_code: string | null
          profile_id: string | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          city?: string | null
          country?: string | null
          county?: string | null
          created_at?: string
          formatted_address: string
          id?: string
          is_saved?: boolean
          label?: string | null
          last_used_at?: string
          latitude: number
          longitude: number
          postal_code?: string | null
          profile_id?: string | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          city?: string | null
          country?: string | null
          county?: string | null
          created_at?: string
          formatted_address?: string
          id?: string
          is_saved?: boolean
          label?: string | null
          last_used_at?: string
          latitude?: number
          longitude?: number
          postal_code?: string | null
          profile_id?: string | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "addresses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_access_requests: {
        Row: {
          assignment_id: string | null
          cancelled_at: string | null
          created_at: string
          decided_at: string | null
          id: string
          reason: string
          requested_duration_minutes: number
          requester_profile_id: string
          review_note: string | null
          reviewed_by_profile_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          reason: string
          requested_duration_minutes: number
          requester_profile_id: string
          review_note?: string | null
          reviewed_by_profile_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          reason?: string
          requested_duration_minutes?: number
          requester_profile_id?: string
          review_note?: string | null
          reviewed_by_profile_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_access_requests_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "staff_access_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_access_requests_requester_profile_id_fkey"
            columns: ["requester_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_access_requests_reviewed_by_profile_id_fkey"
            columns: ["reviewed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_mfa_credentials: {
        Row: {
          confirmed_at: string | null
          created_at: string
          encrypted_secret: string
          encryption_iv: string
          encryption_tag: string
          failed_attempts: number
          id: string
          last_used_step: number | null
          locked_until: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          encrypted_secret: string
          encryption_iv: string
          encryption_tag: string
          failed_attempts?: number
          id?: string
          last_used_step?: number | null
          locked_until?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          encrypted_secret?: string
          encryption_iv?: string
          encryption_tag?: string
          failed_attempts?: number
          id?: string
          last_used_step?: number | null
          locked_until?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_mfa_credentials_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          credential_id: string
          id: string
          used_at: string | null
        }
        Insert: {
          code_hash: string
          created_at?: string
          credential_id: string
          id?: string
          used_at?: string | null
        }
        Update: {
          code_hash?: string
          created_at?: string
          credential_id?: string
          id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_mfa_recovery_codes_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "admin_mfa_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_conversations: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string
          expires_at: string
          id: string
          last_message_at: string
          mode: string
          profile_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          last_message_at?: string
          mode?: string
          profile_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          last_message_at?: string
          mode?: string
          profile_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_conversations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          author_profile_id: string | null
          author_type: string
          body: string
          conversation_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_profile_id?: string | null
          author_type: string
          body: string
          conversation_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_profile_id?: string | null
          author_type?: string
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_profile_id: string | null
          actor_role: string
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          occurred_at: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          actor_role: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          occurred_at?: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          actor_role?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_message_emails: {
        Row: {
          body_html: string | null
          body_text: string | null
          contact_message_id: string
          created_at: string
          delivery_status: string
          direction: string
          id: string
          in_reply_to: string | null
          internet_message_id: string | null
          recipient_email: string
          resend_email_id: string | null
          sender_email: string
          sent_by_profile_id: string | null
          subject: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          contact_message_id: string
          created_at?: string
          delivery_status?: string
          direction: string
          id?: string
          in_reply_to?: string | null
          internet_message_id?: string | null
          recipient_email: string
          resend_email_id?: string | null
          sender_email: string
          sent_by_profile_id?: string | null
          subject: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          contact_message_id?: string
          created_at?: string
          delivery_status?: string
          direction?: string
          id?: string
          in_reply_to?: string | null
          internet_message_id?: string | null
          recipient_email?: string
          resend_email_id?: string | null
          sender_email?: string
          sent_by_profile_id?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_message_emails_contact_message_id_fkey"
            columns: ["contact_message_id"]
            isOneToOne: false
            referencedRelation: "contact_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_message_emails_sent_by_profile_id_fkey"
            columns: ["sent_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          body: string
          category: string | null
          closed_at: string | null
          created_at: string
          id: string
          internal_note: string | null
          last_message_at: string
          read_at: string | null
          replied_at: string | null
          sender_email: string
          sender_name: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          internal_note?: string | null
          last_message_at?: string
          read_at?: string | null
          replied_at?: string | null
          sender_email: string
          sender_name?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          internal_note?: string | null
          last_message_at?: string
          read_at?: string | null
          replied_at?: string | null
          sender_email?: string
          sender_name?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_drafts: {
        Row: {
          created_at: string
          current_step: string
          id: string
          payload: Json
          profile_id: string
          status: string
          submitted_order_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_step?: string
          id?: string
          payload?: Json
          profile_id: string
          status?: string
          submitted_order_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_step?: string
          id?: string
          payload?: Json
          profile_id?: string
          status?: string
          submitted_order_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_drafts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_drafts_submitted_order_id_fkey"
            columns: ["submitted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      file_attachments: {
        Row: {
          assistant_message_id: string | null
          contact_email_id: string | null
          content_type: string
          created_at: string
          evaluation_message_id: string | null
          expires_at: string
          id: string
          original_name: string
          r2_object_key: string
          size_bytes: number
          uploaded_by_profile_id: string | null
        }
        Insert: {
          assistant_message_id?: string | null
          contact_email_id?: string | null
          content_type: string
          created_at?: string
          evaluation_message_id?: string | null
          expires_at?: string
          id?: string
          original_name: string
          r2_object_key: string
          size_bytes: number
          uploaded_by_profile_id?: string | null
        }
        Update: {
          assistant_message_id?: string | null
          contact_email_id?: string | null
          content_type?: string
          created_at?: string
          evaluation_message_id?: string | null
          expires_at?: string
          id?: string
          original_name?: string
          r2_object_key?: string
          size_bytes?: number
          uploaded_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_attachments_assistant_message_id_fkey"
            columns: ["assistant_message_id"]
            isOneToOne: false
            referencedRelation: "assistant_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_attachments_contact_email_id_fkey"
            columns: ["contact_email_id"]
            isOneToOne: false
            referencedRelation: "contact_message_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_attachments_evaluation_message_id_fkey"
            columns: ["evaluation_message_id"]
            isOneToOne: false
            referencedRelation: "parcel_evaluation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_attachments_uploaded_by_profile_id_fkey"
            columns: ["uploaded_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_ai_images: {
        Row: {
          content_type: string
          created_at: string
          delivery_draft_id: string
          expires_at: string
          id: string
          normalized_content_type: string | null
          normalized_size_bytes: number | null
          original_name: string
          r2_normalized_key: string | null
          r2_original_key: string
          size_bytes: number
          slot: number
          status: string
          updated_at: string
          uploaded_by_profile_id: string | null
        }
        Insert: {
          content_type: string
          created_at?: string
          delivery_draft_id: string
          expires_at?: string
          id?: string
          normalized_content_type?: string | null
          normalized_size_bytes?: number | null
          original_name: string
          r2_normalized_key?: string | null
          r2_original_key: string
          size_bytes: number
          slot: number
          status?: string
          updated_at?: string
          uploaded_by_profile_id?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          delivery_draft_id?: string
          expires_at?: string
          id?: string
          normalized_content_type?: string | null
          normalized_size_bytes?: number | null
          original_name?: string
          r2_normalized_key?: string | null
          r2_original_key?: string
          size_bytes?: number
          slot?: number
          status?: string
          updated_at?: string
          uploaded_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcel_ai_images_delivery_draft_id_fkey"
            columns: ["delivery_draft_id"]
            isOneToOne: false
            referencedRelation: "delivery_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_ai_images_uploaded_by_profile_id_fkey"
            columns: ["uploaded_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json
          mission_id: string
          occurred_at: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json
          mission_id: string
          occurred_at?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          mission_id?: string
          occurred_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          completed_at: string | null
          created_at: string
          current_status: string
          drone_telemetry_snapshot: Json
          dropoff_pin: string | null
          dropoff_pin_attempts: number
          dropoff_pin_verified_at: string | null
          fallback_reason: string | null
          failed_at: string | null
          failure_code: string | null
          id: string
          order_id: string
          pickup_pin: string | null
          pickup_pin_attempts: number
          pickup_pin_verified_at: string | null
          runtime_state: Json
          state_version: number
          step_expires_at: string | null
          step_started_at: string | null
          started_at: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_status?: string
          drone_telemetry_snapshot?: Json
          dropoff_pin?: string | null
          dropoff_pin_attempts?: number
          dropoff_pin_verified_at?: string | null
          fallback_reason?: string | null
          failed_at?: string | null
          failure_code?: string | null
          id?: string
          order_id: string
          pickup_pin?: string | null
          pickup_pin_attempts?: number
          pickup_pin_verified_at?: string | null
          runtime_state?: Json
          state_version?: number
          step_expires_at?: string | null
          step_started_at?: string | null
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_status?: string
          drone_telemetry_snapshot?: Json
          dropoff_pin?: string | null
          dropoff_pin_attempts?: number
          dropoff_pin_verified_at?: string | null
          fallback_reason?: string | null
          failed_at?: string | null
          failure_code?: string | null
          id?: string
          order_id?: string
          pickup_pin?: string | null
          pickup_pin_attempts?: number
          pickup_pin_verified_at?: string | null
          runtime_state?: Json
          state_version?: number
          step_expires_at?: string | null
          step_started_at?: string | null
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tracking_links: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          order_id: string
          revoked_at: string | null
          scope: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id: string
          revoked_at?: string | null
          scope: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string
          revoked_at?: string | null
          scope?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_tracking_links_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          message: string
          metadata: Json
          profile_id: string | null
          read: boolean
          read_at: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          profile_id?: string | null
          read?: boolean
          read_at?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          profile_id?: string | null
          read?: boolean
          read_at?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_settings: {
        Row: {
          base_price_minor: number
          confirmation_timer_minutes: number
          created_at: string
          hub_latitude: number
          hub_longitude: number
          id: string
          is_active: boolean
          is_singleton: boolean | null
          last_saved_at: string
          last_saved_by: string | null
          loading_timer_minutes: number
          price_per_km_minor: number
          service_radius_km: number
          unloading_timer_minutes: number
          updated_at: string
        }
        Insert: {
          base_price_minor?: number
          confirmation_timer_minutes?: number
          created_at?: string
          hub_latitude?: number
          hub_longitude?: number
          id?: string
          is_active?: boolean
          is_singleton?: boolean | null
          last_saved_at?: string
          last_saved_by?: string | null
          loading_timer_minutes?: number
          price_per_km_minor?: number
          service_radius_km?: number
          unloading_timer_minutes?: number
          updated_at?: string
        }
        Update: {
          base_price_minor?: number
          confirmation_timer_minutes?: number
          created_at?: string
          hub_latitude?: number
          hub_longitude?: number
          id?: string
          is_active?: boolean
          is_singleton?: boolean | null
          last_saved_at?: string
          last_saved_by?: string | null
          loading_timer_minutes?: number
          price_per_km_minor?: number
          service_radius_km?: number
          unloading_timer_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_settings_last_saved_by_fkey"
            columns: ["last_saved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          currency: string
          delivery_configuration_id: string
          dispatch_timing: string
          drone_class: string
          dropoff_address_id: string
          eta_max_minutes: number | null
          eta_min_minutes: number | null
          fulfillment_status: string | null
          handoff_points_snapshot: Json | null
          id: string
          local_order_id: string
          notes: string | null
          parcel_id: string
          payment_status: string
          pickup_address_id: string
          pricing_snapshot: Json
          public_tracking_code: string
          public_code_access_mode: string
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          recipient_tracking_token: string
          refund_status: string | null
          scheduled_at: string | null
          selected_dropoff_handoff_point: Json | null
          selected_pickup_handoff_point: Json | null
          sender_profile_id: string
          status: string
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          total_amount_minor: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          delivery_configuration_id: string
          dispatch_timing?: string
          drone_class: string
          dropoff_address_id: string
          eta_max_minutes?: number | null
          eta_min_minutes?: number | null
          fulfillment_status?: string | null
          handoff_points_snapshot?: Json | null
          id?: string
          local_order_id: string
          notes?: string | null
          parcel_id: string
          payment_status?: string
          pickup_address_id: string
          pricing_snapshot: Json
          public_tracking_code: string
          public_code_access_mode?: string
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_tracking_token: string
          refund_status?: string | null
          scheduled_at?: string | null
          selected_dropoff_handoff_point?: Json | null
          selected_pickup_handoff_point?: Json | null
          sender_profile_id: string
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          total_amount_minor: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          delivery_configuration_id?: string
          dispatch_timing?: string
          drone_class?: string
          dropoff_address_id?: string
          eta_max_minutes?: number | null
          eta_min_minutes?: number | null
          fulfillment_status?: string | null
          handoff_points_snapshot?: Json | null
          id?: string
          local_order_id?: string
          notes?: string | null
          parcel_id?: string
          payment_status?: string
          pickup_address_id?: string
          pricing_snapshot?: Json
          public_tracking_code?: string
          public_code_access_mode?: string
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_tracking_token?: string
          refund_status?: string | null
          scheduled_at?: string | null
          selected_dropoff_handoff_point?: Json | null
          selected_pickup_handoff_point?: Json | null
          sender_profile_id?: string
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          total_amount_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_dropoff_address_id_fkey"
            columns: ["dropoff_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pickup_address_id_fkey"
            columns: ["pickup_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_evaluation_messages: {
        Row: {
          author_profile_id: string | null
          author_type: string
          body: string
          created_at: string
          evaluation_id: string
          id: string
          message_kind: string
          reply_to_message_id: string | null
        }
        Insert: {
          author_profile_id?: string | null
          author_type: string
          body?: string
          created_at?: string
          evaluation_id: string
          id?: string
          message_kind?: string
          reply_to_message_id?: string | null
        }
        Update: {
          author_profile_id?: string | null
          author_type?: string
          body?: string
          created_at?: string
          evaluation_id?: string
          id?: string
          message_kind?: string
          reply_to_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcel_evaluation_messages_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_evaluation_messages_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "parcel_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_evaluation_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "parcel_evaluation_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_evaluations: {
        Row: {
          assigned_at: string | null
          assigned_operator_profile_id: string | null
          cancelled_at: string | null
          client_applied_at: string | null
          client_final_view_id: string | null
          client_profile_id: string
          created_at: string
          delivery_draft_id: string
          estimate_trace: Json | null
          finalized_at: string | null
          height_cm: number | null
          id: string
          initial_description: string
          length_cm: number | null
          parcel_snapshot: Json
          status: string
          updated_at: string
          warnings: string[]
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_operator_profile_id?: string | null
          cancelled_at?: string | null
          client_applied_at?: string | null
          client_final_view_id?: string | null
          client_profile_id: string
          created_at?: string
          delivery_draft_id: string
          estimate_trace?: Json | null
          finalized_at?: string | null
          height_cm?: number | null
          id?: string
          initial_description: string
          length_cm?: number | null
          parcel_snapshot?: Json
          status?: string
          updated_at?: string
          warnings?: string[]
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          assigned_at?: string | null
          assigned_operator_profile_id?: string | null
          cancelled_at?: string | null
          client_applied_at?: string | null
          client_final_view_id?: string | null
          client_profile_id?: string
          created_at?: string
          delivery_draft_id?: string
          estimate_trace?: Json | null
          finalized_at?: string | null
          height_cm?: number | null
          id?: string
          initial_description?: string
          length_cm?: number | null
          parcel_snapshot?: Json
          status?: string
          updated_at?: string
          warnings?: string[]
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parcel_evaluations_assigned_operator_profile_id_fkey"
            columns: ["assigned_operator_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_evaluations_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_evaluations_delivery_draft_id_fkey"
            columns: ["delivery_draft_id"]
            isOneToOne: false
            referencedRelation: "delivery_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      parcels: {
        Row: {
          approximate_size: string | null
          contents_description: string
          created_at: string
          declared_dimensions_cm: Json | null
          declared_weight_kg: number | null
          estimated_weight_range: string | null
          fragility_level: string
          id: string
          packaging_type: string | null
          security_module: string
          thermal_protection: string
        }
        Insert: {
          approximate_size?: string | null
          contents_description: string
          created_at?: string
          declared_dimensions_cm?: Json | null
          declared_weight_kg?: number | null
          estimated_weight_range?: string | null
          fragility_level?: string
          id?: string
          packaging_type?: string | null
          security_module?: string
          thermal_protection?: string
        }
        Update: {
          approximate_size?: string | null
          contents_description?: string
          created_at?: string
          declared_dimensions_cm?: Json | null
          declared_weight_kg?: number | null
          estimated_weight_range?: string | null
          fragility_level?: string
          id?: string
          packaging_type?: string | null
          security_module?: string
          thermal_protection?: string
        }
        Relationships: []
      }
      payment_records: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          order_id: string
          profile_id: string
          status: string
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          type: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          order_id: string
          profile_id: string
          status: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          type: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          order_id?: string
          profile_id?: string
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          clerk_user_id: string
          created_at: string
          email: string
          full_name: string | null
          id: string
          notification_preferences: Json
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          clerk_user_id: string
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          notification_preferences?: Json
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          clerk_user_id?: string
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          notification_preferences?: Json
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_access_assignments: {
        Row: {
          access_kind: string
          activated_at: string | null
          created_at: string
          expires_at: string | null
          external_sync_error: string | null
          fallback_role: string
          granted_by_profile_id: string | null
          id: string
          profile_id: string
          reason: string
          revoked_at: string | null
          revoked_by_profile_id: string | null
          revoked_reason: string | null
          role: string
          source: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          access_kind: string
          activated_at?: string | null
          created_at?: string
          expires_at?: string | null
          external_sync_error?: string | null
          fallback_role?: string
          granted_by_profile_id?: string | null
          id?: string
          profile_id: string
          reason: string
          revoked_at?: string | null
          revoked_by_profile_id?: string | null
          revoked_reason?: string | null
          role: string
          source?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          access_kind?: string
          activated_at?: string | null
          created_at?: string
          expires_at?: string | null
          external_sync_error?: string | null
          fallback_role?: string
          granted_by_profile_id?: string | null
          id?: string
          profile_id?: string
          reason?: string
          revoked_at?: string | null
          revoked_by_profile_id?: string | null
          revoked_reason?: string | null
          role?: string
          source?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_access_assignments_granted_by_profile_id_fkey"
            columns: ["granted_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_access_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_access_assignments_revoked_by_profile_id_fkey"
            columns: ["revoked_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_access_sync_jobs: {
        Row: {
          assignment_id: string | null
          attempts: number
          available_at: string
          completed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          operation: string
          payload: Json
          profile_id: string
          status: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          attempts?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          operation: string
          payload?: Json
          profile_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          attempts?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          operation?: string
          payload?: Json
          profile_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_access_sync_jobs_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "staff_access_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_access_sync_jobs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          ai_summary: string | null
          assigned_at: string | null
          assigned_operator_profile_id: string | null
          category: string
          client_profile_id: string | null
          closed_at: string | null
          closed_by_profile_id: string | null
          conversation_id: string
          created_at: string
          id: string
          linked_order_id: string | null
          priority: string
          resolved_at: string | null
          source: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          assigned_at?: string | null
          assigned_operator_profile_id?: string | null
          category?: string
          client_profile_id?: string | null
          closed_at?: string | null
          closed_by_profile_id?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          linked_order_id?: string | null
          priority?: string
          resolved_at?: string | null
          source: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          assigned_at?: string | null
          assigned_operator_profile_id?: string | null
          category?: string
          client_profile_id?: string | null
          closed_at?: string | null
          closed_by_profile_id?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          linked_order_id?: string | null
          priority?: string
          resolved_at?: string | null
          source?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_operator_profile_id_fkey"
            columns: ["assigned_operator_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_closed_by_profile_id_fkey"
            columns: ["closed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_profile_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      ensure_profile_exists: {
        Args: { p_clerk_user_id: string; p_email: string; p_full_name?: string }
        Returns: string
      }
      refresh_profile_staff_role: {
        Args: { p_profile_id: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
