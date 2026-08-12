export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      attachments: {
        Row: {
          amount: number | null;
          category: string | null;
          created_at: string;
          doc_date: string | null;
          entity_id: string;
          entity_type: string;
          file_name: string;
          id: string;
          mime_type: string | null;
          note: string | null;
          size_bytes: number | null;
          storage_path: string;
          user_id: string;
        };
        Insert: {
          amount?: number | null;
          category?: string | null;
          created_at?: string;
          doc_date?: string | null;
          entity_id: string;
          entity_type: string;
          file_name: string;
          id?: string;
          mime_type?: string | null;
          note?: string | null;
          size_bytes?: number | null;
          storage_path: string;
          user_id: string;
        };
        Update: {
          amount?: number | null;
          category?: string | null;
          created_at?: string;
          doc_date?: string | null;
          entity_id?: string;
          entity_type?: string;
          file_name?: string;
          id?: string;
          mime_type?: string | null;
          note?: string | null;
          size_bytes?: number | null;
          storage_path?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: string;
          metadata: Json | null;
          user_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: string;
          metadata?: Json | null;
          user_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: string;
          metadata?: Json | null;
          user_id?: string;
        };
        Relationships: [];
      };
      backup_meta: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          path: string;
          size_bytes: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind?: string;
          path: string;
          size_bytes?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          path?: string;
          size_bytes?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      budgets: {
        Row: {
          amount: number;
          category_id: string | null;
          created_at: string;
          currency_id: string;
          id: string;
          period: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          category_id?: string | null;
          created_at?: string;
          currency_id: string;
          id?: string;
          period?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          category_id?: string | null;
          created_at?: string;
          currency_id?: string;
          id?: string;
          period?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      channel_settings: {
        Row: {
          created_at: string;
          signature_name: string | null;
          sms_enabled: boolean;
          sms_from: string | null;
          telegram_chat_id: string | null;
          telegram_enabled: boolean;
          telegram_link_code: string | null;
          updated_at: string;
          user_id: string;
          whatsapp_auto: boolean;
          whatsapp_enabled: boolean;
          whatsapp_from: string | null;
        };
        Insert: {
          created_at?: string;
          signature_name?: string | null;
          sms_enabled?: boolean;
          sms_from?: string | null;
          telegram_chat_id?: string | null;
          telegram_enabled?: boolean;
          telegram_link_code?: string | null;
          updated_at?: string;
          user_id: string;
          whatsapp_auto?: boolean;
          whatsapp_enabled?: boolean;
          whatsapp_from?: string | null;
        };
        Update: {
          created_at?: string;
          signature_name?: string | null;
          sms_enabled?: boolean;
          sms_from?: string | null;
          telegram_chat_id?: string | null;
          telegram_enabled?: boolean;
          telegram_link_code?: string | null;
          updated_at?: string;
          user_id?: string;
          whatsapp_auto?: boolean;
          whatsapp_enabled?: boolean;
          whatsapp_from?: string | null;
        };
        Relationships: [];
      };
      company_profile: {
        Row: {
          address: string | null;
          created_at: string;
          email: string | null;
          logo_path: string | null;
          name: string | null;
          notes: string | null;
          phone: string | null;
          tax_number: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          logo_path?: string | null;
          name?: string | null;
          notes?: string | null;
          phone?: string | null;
          tax_number?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          logo_path?: string | null;
          name?: string | null;
          notes?: string | null;
          phone?: string | null;
          tax_number?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      currencies: {
        Row: {
          created_at: string;
          id: string;
          is_base: boolean;
          name: string;
          symbol: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_base?: boolean;
          name: string;
          symbol?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_base?: boolean;
          name?: string;
          symbol?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      customer_ratings: {
        Row: {
          computed_at: string;
          id: string;
          person_id: string;
          rating: string;
          reason: string | null;
          score: number;
          user_id: string;
        };
        Insert: {
          computed_at?: string;
          id?: string;
          person_id: string;
          rating: string;
          reason?: string | null;
          score: number;
          user_id: string;
        };
        Update: {
          computed_at?: string;
          id?: string;
          person_id?: string;
          rating?: string;
          reason?: string | null;
          score?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_ratings_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: true;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_categories: {
        Row: {
          color: string;
          created_at: string;
          icon: string;
          id: string;
          is_default: boolean;
          name: string;
          sort_order: number;
          user_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          icon?: string;
          id?: string;
          is_default?: boolean;
          name: string;
          sort_order?: number;
          user_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          icon?: string;
          id?: string;
          is_default?: boolean;
          name?: string;
          sort_order?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          amount: number;
          category_id: string | null;
          created_at: string;
          currency_id: string;
          expense_date: string;
          id: string;
          note: string | null;
          rate_at_tx: number | null;
          receipt_path: string | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          category_id?: string | null;
          created_at?: string;
          currency_id: string;
          expense_date?: string;
          id?: string;
          note?: string | null;
          rate_at_tx?: number | null;
          receipt_path?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          category_id?: string | null;
          created_at?: string;
          currency_id?: string;
          expense_date?: string;
          id?: string;
          note?: string | null;
          rate_at_tx?: number | null;
          receipt_path?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      followup_policies: {
        Row: {
          auto_send: boolean;
          created_at: string;
          daily_digest: boolean;
          days_before: number;
          max_reminders: number;
          overdue_every_days: number;
          quiet_end: number;
          quiet_start: number;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auto_send?: boolean;
          created_at?: string;
          daily_digest?: boolean;
          days_before?: number;
          max_reminders?: number;
          overdue_every_days?: number;
          quiet_end?: number;
          quiet_start?: number;
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auto_send?: boolean;
          created_at?: string;
          daily_digest?: boolean;
          days_before?: number;
          max_reminders?: number;
          overdue_every_days?: number;
          quiet_end?: number;
          quiet_start?: number;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      message_log: {
        Row: {
          body: string;
          channel: string;
          created_at: string;
          destination: string | null;
          id: string;
          kind: string;
          outbox_id: string | null;
          person_id: string | null;
          provider_ref: string | null;
          sent_at: string;
          user_id: string;
        };
        Insert: {
          body: string;
          channel: string;
          created_at?: string;
          destination?: string | null;
          id?: string;
          kind: string;
          outbox_id?: string | null;
          person_id?: string | null;
          provider_ref?: string | null;
          sent_at?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          channel?: string;
          created_at?: string;
          destination?: string | null;
          id?: string;
          kind?: string;
          outbox_id?: string | null;
          person_id?: string | null;
          provider_ref?: string | null;
          sent_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_log_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      message_templates: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          is_active: boolean;
          kind: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          kind: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          kind?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      opening_balances: {
        Row: {
          amount: number;
          created_at: string;
          currency_id: string;
          direction: string;
          id: string;
          note: string | null;
          opening_date: string;
          person_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          currency_id: string;
          direction?: string;
          id?: string;
          note?: string | null;
          opening_date?: string;
          person_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency_id?: string;
          direction?: string;
          id?: string;
          note?: string | null;
          opening_date?: string;
          person_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opening_balances_currency_id_fkey";
            columns: ["currency_id"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opening_balances_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      outbox: {
        Row: {
          attempts: number;
          body: string;
          channel: string;
          created_at: string;
          dedupe_key: string;
          destination: string | null;
          id: string;
          kind: string;
          last_error: string | null;
          person_id: string | null;
          scheduled_at: string;
          sent_at: string | null;
          status: string;
          transaction_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          body: string;
          channel?: string;
          created_at?: string;
          dedupe_key: string;
          destination?: string | null;
          id?: string;
          kind?: string;
          last_error?: string | null;
          person_id?: string | null;
          scheduled_at?: string;
          sent_at?: string | null;
          status?: string;
          transaction_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          attempts?: number;
          body?: string;
          channel?: string;
          created_at?: string;
          dedupe_key?: string;
          destination?: string | null;
          id?: string;
          kind?: string;
          last_error?: string | null;
          person_id?: string | null;
          scheduled_at?: string;
          sent_at?: string | null;
          status?: string;
          transaction_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "outbox_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outbox_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_allocations: {
        Row: {
          amount: number;
          created_at: string;
          currency_id: string;
          debt_tx_id: string;
          id: string;
          payment_tx_id: string;
          person_id: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency_id: string;
          debt_tx_id: string;
          id?: string;
          payment_tx_id: string;
          person_id: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency_id?: string;
          debt_tx_id?: string;
          id?: string;
          payment_tx_id?: string;
          person_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_allocations_currency_id_fkey";
            columns: ["currency_id"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_debt_tx_id_fkey";
            columns: ["debt_tx_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_payment_tx_id_fkey";
            columns: ["payment_tx_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_promises: {
        Row: {
          amount: number;
          created_at: string;
          currency_id: string;
          id: string;
          kept_at: string | null;
          note: string | null;
          person_id: string;
          promised_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          currency_id: string;
          id?: string;
          kept_at?: string | null;
          note?: string | null;
          person_id: string;
          promised_date: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency_id?: string;
          id?: string;
          kept_at?: string | null;
          note?: string | null;
          person_id?: string;
          promised_date?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_promises_currency_id_fkey";
            columns: ["currency_id"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_promises_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      people: {
        Row: {
          avatar_color: string | null;
          created_at: string;
          credit_limit: number | null;
          id: string;
          is_archived: boolean;
          name: string;
          notes: string | null;
          phone: string | null;
          type: string;
          user_id: string;
        };
        Insert: {
          avatar_color?: string | null;
          created_at?: string;
          credit_limit?: number | null;
          id?: string;
          is_archived?: boolean;
          name: string;
          notes?: string | null;
          phone?: string | null;
          type?: string;
          user_id: string;
        };
        Update: {
          avatar_color?: string | null;
          created_at?: string;
          credit_limit?: number | null;
          id?: string;
          is_archived?: boolean;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      person_accounts: {
        Row: {
          created_at: string;
          currency_id: string;
          id: string;
          person_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          currency_id: string;
          id?: string;
          person_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          currency_id?: string;
          id?: string;
          person_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "person_accounts_currency_id_fkey";
            columns: ["currency_id"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "person_accounts_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          backup_frequency: string;
          created_at: string;
          display_name: string | null;
          id: string;
          last_seen_reminder_at: string | null;
          notif_subscription: Json | null;
          onboarded: boolean;
          pin_hash: string | null;
          theme: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          backup_frequency?: string;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          last_seen_reminder_at?: string | null;
          notif_subscription?: Json | null;
          onboarded?: boolean;
          pin_hash?: string | null;
          theme?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          backup_frequency?: string;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          last_seen_reminder_at?: string | null;
          notif_subscription?: Json | null;
          onboarded?: boolean;
          pin_hash?: string | null;
          theme?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      recurring_rules: {
        Row: {
          amount: number;
          category_id: string | null;
          created_at: string;
          currency_id: string;
          day_of_month: number | null;
          direction: string | null;
          frequency: string;
          id: string;
          is_active: boolean;
          kind: string;
          last_run: string | null;
          next_run: string;
          note: string | null;
          person_id: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          category_id?: string | null;
          created_at?: string;
          currency_id: string;
          day_of_month?: number | null;
          direction?: string | null;
          frequency?: string;
          id?: string;
          is_active?: boolean;
          kind: string;
          last_run?: string | null;
          next_run?: string;
          note?: string | null;
          person_id?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          category_id?: string | null;
          created_at?: string;
          currency_id?: string;
          day_of_month?: number | null;
          direction?: string | null;
          frequency?: string;
          id?: string;
          is_active?: boolean;
          kind?: string;
          last_run?: string | null;
          next_run?: string;
          note?: string | null;
          person_id?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          created_at: string;
          due_date: string;
          id: string;
          is_done: boolean;
          note: string | null;
          person_id: string | null;
          repeat: string;
          snoozed_until: string | null;
          title: string;
          transaction_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          due_date: string;
          id?: string;
          is_done?: boolean;
          note?: string | null;
          person_id?: string | null;
          repeat?: string;
          snoozed_until?: string | null;
          title: string;
          transaction_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          due_date?: string;
          id?: string;
          is_done?: boolean;
          note?: string | null;
          person_id?: string | null;
          repeat?: string;
          snoozed_until?: string | null;
          title?: string;
          transaction_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminders_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          amount: number;
          created_at: string;
          currency_id: string;
          details: string | null;
          direction: string;
          due_date: string | null;
          id: string;
          is_paid: boolean;
          person_id: string;
          transaction_date: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency_id: string;
          details?: string | null;
          direction: string;
          due_date?: string | null;
          id?: string;
          is_paid?: boolean;
          person_id: string;
          transaction_date?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency_id?: string;
          details?: string | null;
          direction?: string;
          due_date?: string | null;
          id?: string;
          is_paid?: boolean;
          person_id?: string;
          transaction_date?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_currency_id_fkey";
            columns: ["currency_id"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      seed_followup_defaults: { Args: { _user_id: string }; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
