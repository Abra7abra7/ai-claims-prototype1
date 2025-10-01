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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      analysis_types: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          is_active: boolean
          name: string
          system_prompt: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          id?: string
          is_active?: boolean
          name: string
          system_prompt: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          system_prompt?: string
          updated_at?: string
        }
        Relationships: []
      }
      claims: {
        Row: {
          claim_number: string
          claim_type: string
          client_name: string
          created_at: string | null
          created_by: string
          id: string
          policy_number: string
          status: Database["public"]["Enums"]["claim_status"] | null
          updated_at: string | null
        }
        Insert: {
          claim_number: string
          claim_type: string
          client_name: string
          created_at?: string | null
          created_by: string
          id?: string
          policy_number: string
          status?: Database["public"]["Enums"]["claim_status"] | null
          updated_at?: string | null
        }
        Update: {
          claim_number?: string
          claim_type?: string
          client_name?: string
          created_at?: string | null
          created_by?: string
          id?: string
          policy_number?: string
          status?: Database["public"]["Enums"]["claim_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          claim_id: string
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          status: Database["public"]["Enums"]["processing_status"] | null
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          claim_id: string
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          status?: Database["public"]["Enums"]["processing_status"] | null
          updated_at?: string | null
          uploaded_by: string
        }
        Update: {
          claim_id?: string
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          status?: Database["public"]["Enums"]["processing_status"] | null
          updated_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_context: {
        Row: {
          content: string
          context_type: string
          created_at: string | null
          id: string
          is_active: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          context_type: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          context_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      insurance_knowledge_base: {
        Row: {
          categories: string[] | null
          chunk_index: number
          chunk_text: string
          content: string
          created_at: string
          created_by: string
          embedding: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          policy_types: string[] | null
          source_document: string | null
          title: string
          updated_at: string
        }
        Insert: {
          categories?: string[] | null
          chunk_index: number
          chunk_text: string
          content: string
          created_at?: string
          created_by: string
          embedding?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          policy_types?: string[] | null
          source_document?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          categories?: string[] | null
          chunk_index?: number
          chunk_text?: string
          content?: string
          created_at?: string
          created_by?: string
          embedding?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          policy_types?: string[] | null
          source_document?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      processed_documents: {
        Row: {
          anonymized_text: string | null
          cleaned_text: string | null
          created_at: string | null
          document_id: string
          id: string
          ocr_text: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_text: string | null
          updated_at: string | null
        }
        Insert: {
          anonymized_text?: string | null
          cleaned_text?: string | null
          created_at?: string | null
          document_id: string
          id?: string
          ocr_text?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_text?: string | null
          updated_at?: string | null
        }
        Update: {
          anonymized_text?: string | null
          cleaned_text?: string | null
          created_at?: string | null
          document_id?: string
          id?: string
          ocr_text?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_text?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processed_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          analysis_type_id: string | null
          analysis_type_name: string | null
          claim_id: string
          created_at: string | null
          document_id: string
          exclusions_analysis: string | null
          generated_by: string
          id: string
          justification: string | null
          recommendation: string
          relevance_analysis: string | null
          summary: string
        }
        Insert: {
          analysis_type_id?: string | null
          analysis_type_name?: string | null
          claim_id: string
          created_at?: string | null
          document_id: string
          exclusions_analysis?: string | null
          generated_by: string
          id?: string
          justification?: string | null
          recommendation: string
          relevance_analysis?: string | null
          summary: string
        }
        Update: {
          analysis_type_id?: string | null
          analysis_type_name?: string | null
          claim_id?: string
          created_at?: string | null
          document_id?: string
          exclusions_analysis?: string | null
          generated_by?: string
          id?: string
          justification?: string | null
          recommendation?: string
          relevance_analysis?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_analysis_type_id_fkey"
            columns: ["analysis_type_id"]
            isOneToOne: false
            referencedRelation: "analysis_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      search_insurance_knowledge: {
        Args: {
          filter_categories?: string[]
          filter_policy_types?: string[]
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          categories: string[]
          chunk_text: string
          id: string
          metadata: Json
          policy_types: string[]
          similarity: number
          title: string
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "likvidator"
      claim_status: "new" | "in_progress" | "completed" | "rejected"
      processing_status:
        | "uploaded"
        | "ocr_processing"
        | "ocr_complete"
        | "anonymizing"
        | "anonymized"
        | "ready_for_review"
        | "approved"
        | "report_generated"
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
      app_role: ["admin", "likvidator"],
      claim_status: ["new", "in_progress", "completed", "rejected"],
      processing_status: [
        "uploaded",
        "ocr_processing",
        "ocr_complete",
        "anonymizing",
        "anonymized",
        "ready_for_review",
        "approved",
        "report_generated",
      ],
    },
  },
} as const
