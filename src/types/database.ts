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
      alerts: {
        Row: {
          branch_id: string
          chain_id: string
          id: string
          opened_at: string
          product_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["alert_status"]
        }
        Insert: {
          branch_id: string
          chain_id: string
          id?: string
          opened_at?: string
          product_id: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
        }
        Update: {
          branch_id?: string
          chain_id?: string
          id?: string
          opened_at?: string
          product_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
        }
        Relationships: [
          {
            foreignKeyName: "alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_profile_id: string | null
          chain_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          chain_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          chain_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          chain_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          chain_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          chain_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
        ]
      }
      chains: {
        Row: {
          created_at: string
          id: string
          name: string
          timezone: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          timezone?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          timezone?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          balance: number
          branch_id: string
          chain_id: string
          id: string
          initialized_at: string | null
          min_qty: number
          product_id: string
          updated_at: string
          version: number
        }
        Insert: {
          balance?: number
          branch_id: string
          chain_id: string
          id?: string
          initialized_at?: string | null
          min_qty?: number
          product_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          balance?: number
          branch_id?: string
          chain_id?: string
          id?: string
          initialized_at?: string | null
          min_qty?: number
          product_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          branch_id: string | null
          chain_id: string
          created_at: string
          id: string
          operation_id: string
          product_id: string
          qty_delta: number
          reverses_movement_id: string | null
          transfer_id: string | null
          unit: Database["public"]["Enums"]["unit_kind"]
        }
        Insert: {
          branch_id?: string | null
          chain_id: string
          created_at?: string
          id?: string
          operation_id: string
          product_id: string
          qty_delta: number
          reverses_movement_id?: string | null
          transfer_id?: string | null
          unit: Database["public"]["Enums"]["unit_kind"]
        }
        Update: {
          branch_id?: string | null
          chain_id?: string
          created_at?: string
          id?: string
          operation_id?: string
          product_id?: string
          qty_delta?: number
          reverses_movement_id?: string | null
          transfer_id?: string | null
          unit?: Database["public"]["Enums"]["unit_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_reverses_movement_id_fkey"
            columns: ["reverses_movement_id"]
            isOneToOne: true
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      operations: {
        Row: {
          actor_profile_id: string
          chain_id: string
          created_at: string
          id: string
          idempotency_key: string
          reason: string | null
          reference: string | null
          request_hash: string
          result: Json | null
          type: Database["public"]["Enums"]["operation_type"]
        }
        Insert: {
          actor_profile_id: string
          chain_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          reason?: string | null
          reference?: string | null
          request_hash: string
          result?: Json | null
          type: Database["public"]["Enums"]["operation_type"]
        }
        Update: {
          actor_profile_id?: string
          chain_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          reason?: string | null
          reference?: string | null
          request_hash?: string
          result?: Json | null
          type?: Database["public"]["Enums"]["operation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "operations_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category: string | null
          chain_id: string
          created_at: string
          id: string
          is_active: boolean
          max_movement_qty: number
          name: string
          presentation: string | null
          presentation_qty: number | null
          sku: string
          unit: Database["public"]["Enums"]["unit_kind"]
          variant: string | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          chain_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_movement_qty?: number
          name: string
          presentation?: string | null
          presentation_qty?: number | null
          sku: string
          unit: Database["public"]["Enums"]["unit_kind"]
          variant?: string | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          chain_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_movement_qty?: number
          name?: string
          presentation?: string | null
          presentation_qty?: number | null
          sku?: string
          unit?: Database["public"]["Enums"]["unit_kind"]
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string | null
          branch_id: string | null
          chain_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          auth_user_id?: string | null
          branch_id?: string | null
          chain_id: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          auth_user_id?: string | null
          branch_id?: string | null
          chain_id?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          chain_id: string
          created_at: string
          created_by: string
          dispatched_at: string | null
          dispatched_by: string | null
          dispute_note: string | null
          disputed_at: string | null
          disputed_by: string | null
          from_branch_id: string
          id: string
          product_id: string
          qty: number
          received_at: string | null
          received_by: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_qty_lost: number | null
          resolved_qty_received: number | null
          resolved_qty_returned: number | null
          shipping_ref: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          to_branch_id: string
        }
        Insert: {
          chain_id: string
          created_at?: string
          created_by: string
          dispatched_at?: string | null
          dispatched_by?: string | null
          dispute_note?: string | null
          disputed_at?: string | null
          disputed_by?: string | null
          from_branch_id: string
          id?: string
          product_id: string
          qty: number
          received_at?: string | null
          received_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_qty_lost?: number | null
          resolved_qty_received?: number | null
          resolved_qty_returned?: number | null
          shipping_ref?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_branch_id: string
        }
        Update: {
          chain_id?: string
          created_at?: string
          created_by?: string
          dispatched_at?: string | null
          dispatched_by?: string | null
          dispute_note?: string | null
          disputed_at?: string | null
          disputed_by?: string | null
          from_branch_id?: string
          id?: string
          product_id?: string
          qty?: number
          received_at?: string | null
          received_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_qty_lost?: number | null
          resolved_qty_received?: number | null
          resolved_qty_returned?: number | null
          shipping_ref?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_branch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_dispatched_by_fkey"
            columns: ["dispatched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_dispatched_by_fkey"
            columns: ["dispatched_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_disputed_by_fkey"
            columns: ["disputed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_disputed_by_fkey"
            columns: ["disputed_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inventory_status: {
        Row: {
          balance: number | null
          below_min: boolean | null
          branch_active: boolean | null
          branch_code: string | null
          branch_id: string | null
          branch_name: string | null
          brand: string | null
          category: string | null
          chain_id: string | null
          id: string | null
          initialized_at: string | null
          min_qty: number | null
          product_active: boolean | null
          product_id: string | null
          product_name: string | null
          sku: string | null
          unit: Database["public"]["Enums"]["unit_kind"] | null
          updated_at: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_public: {
        Row: {
          branch_id: string | null
          chain_id: string | null
          full_name: string | null
          id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
        }
        Insert: {
          branch_id?: string | null
          chain_id?: string | null
          full_name?: string | null
          id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Update: {
          branch_id?: string | null
          chain_id?: string | null
          full_name?: string | null
          id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      import_csv_batch: { Args: { p_id: string; p_kind: string; p_rows: Json }; Returns: Json }
      submit_physical_count: { Args: { p_id: string; p_branch_id: string; p_product_id: string; p_observed_qty: number; p_note?: string | null }; Returns: Json }
      approve_physical_count: { Args: { p_count_id: string }; Returns: Json }
      reject_physical_count: { Args: { p_count_id: string; p_reason: string }; Returns: Json }
      list_physical_counts: { Args: { p_status?: string }; Returns: Json }
      dashboard_snapshot: { Args: { p_from: string; p_to: string }; Returns: Json }
      create_transfer: {
        Args: { p_id: string; p_product_id: string; p_from_branch_id: string; p_to_branch_id: string; p_qty: number; p_shipping_ref?: string | null }
        Returns: Database['public']['Tables']['transfers']['Row']
      }
      cancel_transfer: { Args: { p_transfer_id: string }; Returns: Database['public']['Tables']['transfers']['Row'] }
      dispatch_transfer: { Args: { p_key: string; p_transfer_id: string }; Returns: Json }
      receive_transfer: { Args: { p_key: string; p_transfer_id: string }; Returns: Json }
      report_transfer_difference: { Args: { p_transfer_id: string; p_note: string }; Returns: Database['public']['Tables']['transfers']['Row'] }
      resolve_transfer: {
        Args: { p_key: string; p_transfer_id: string; p_qty_received: number; p_qty_returned: number; p_qty_lost: number; p_note: string }
        Returns: Json
      }
      register_movement: {
        Args: {
          p_key: string
          p_type: Database["public"]["Enums"]["operation_type"]
          p_branch_id: string
          p_product_id: string
          p_qty: number
          p_reason?: string | null
          p_reference?: string | null
        }
        Returns: Json
      }
      reverse_movement: {
        Args: { p_key: string; p_movement_id: string; p_reason: string }
        Returns: Json
      }
      assert_active: {
        Args: never
        Returns: {
          auth_user_id: string | null
          branch_id: string | null
          chain_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assert_admin: {
        Args: never
        Returns: {
          auth_user_id: string | null
          branch_id: string | null
          chain_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assert_quantity_scale: {
        Args: {
          p_qty: number
          p_unit: Database["public"]["Enums"]["unit_kind"]
        }
        Returns: undefined
      }
      create_branch: {
        Args: { p_code: string; p_name: string }
        Returns: {
          chain_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "branches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_profile: {
        Args: {
          p_branch_id?: string
          p_email: string
          p_full_name: string
          p_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: {
          auth_user_id: string | null
          branch_id: string | null
          chain_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_branch_id: { Args: never; Returns: string }
      current_chain_id: { Args: never; Returns: string }
      current_profile_id: { Args: never; Returns: string }
      enable_product_in_branch: {
        Args: { p_branch_id: string; p_min_qty?: number; p_product_id: string }
        Returns: {
          balance: number
          branch_id: string
          chain_id: string
          id: string
          initialized_at: string | null
          min_qty: number
          product_id: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "inventory"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_admin: { Args: never; Returns: boolean }
      log_audit: {
        Args: {
          p_action: string
          p_actor: string
          p_chain: string
          p_entity_id: string
          p_entity_type: string
          p_new: Json
          p_old: Json
        }
        Returns: undefined
      }
      raise_error: {
        Args: { p_code: string; p_detail: string }
        Returns: undefined
      }
      recalc_alert: {
        Args: { p_branch_id: string; p_product_id: string }
        Returns: undefined
      }
      set_initial_balance: {
        Args: {
          p_branch_id: string
          p_key: string
          p_product_id: string
          p_qty: number
          p_reference?: string
        }
        Returns: Json
      }
      set_min_qty: {
        Args: { p_branch_id: string; p_min_qty: number; p_product_id: string }
        Returns: {
          balance: number
          branch_id: string
          chain_id: string
          id: string
          initialized_at: string | null
          min_qty: number
          product_id: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "inventory"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_branch: {
        Args: { p_id: string; p_is_active: boolean; p_name: string }
        Returns: {
          chain_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "branches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_profile: {
        Args: {
          p_branch_id?: string
          p_full_name: string
          p_id: string
          p_is_active?: boolean
          p_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: {
          auth_user_id: string | null
          branch_id: string | null
          chain_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_product: {
        Args: {
          p_brand?: string
          p_category?: string
          p_id?: string
          p_is_active?: boolean
          p_max_movement_qty?: number
          p_name: string
          p_presentation?: string
          p_presentation_qty?: number
          p_sku: string
          p_unit: Database["public"]["Enums"]["unit_kind"]
          p_variant?: string
        }
        Returns: {
          brand: string | null
          category: string | null
          chain_id: string
          created_at: string
          id: string
          is_active: boolean
          max_movement_qty: number
          name: string
          presentation: string | null
          presentation_qty: number | null
          sku: string
          unit: Database["public"]["Enums"]["unit_kind"]
          variant: string | null
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      alert_status: "open" | "resolved"
      operation_type:
        | "initial"
        | "purchase"
        | "consumption"
        | "sale"
        | "shrinkage"
        | "adjustment"
        | "reversal"
        | "dispatch"
        | "receipt"
        | "resolution"
      transfer_status:
        | "draft"
        | "dispatched"
        | "received"
        | "disputed"
        | "resolved"
        | "cancelled"
      unit_kind: "unit" | "ml" | "g"
      user_role: "admin" | "operator"
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
      alert_status: ["open", "resolved"],
      operation_type: [
        "initial",
        "purchase",
        "consumption",
        "sale",
        "shrinkage",
        "adjustment",
        "reversal",
        "dispatch",
        "receipt",
        "resolution",
      ],
      transfer_status: [
        "draft",
        "dispatched",
        "received",
        "disputed",
        "resolved",
        "cancelled",
      ],
      unit_kind: ["unit", "ml", "g"],
      user_role: ["admin", "operator"],
    },
  },
} as const
