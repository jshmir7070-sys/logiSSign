// =============================================================
// Precision Velocity — Database Types
// Auto-derived from supabase/schema.sql
// Shared between web/ and mobile/
// =============================================================

// Enum types matching SQL CHECK constraints
export type AgencyPlan = 'free' | 'basic' | 'standard' | 'enterprise';
export type AgencyStatus = 'active' | 'suspended' | 'cancelled';
export type DriverStatus = 'active' | 'inactive';
export type DriverTaxType = 'individual' | 'business' | 'vat_invoice' | 'withholding_3_3' | 'manual_reverse' | 'none';
export type DocumentType = 'license' | 'bankbook' | 'insurance' | 'id_card' | 'other';
export type PackageType = 'normal' | 'large' | 'frozen' | string;  // 커스텀 품목명도 허용 (배송, 반품, 집하 등)
export type SettlementStatus = 'draft' | 'sent' | 'confirmed';
export type InvoiceType = 'tax' | 'cash_receipt' | 'none';
export type InvoiceStatus = 'pending' | 'issued' | 'cancelled';
export type ContractStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'expired';
export type NoticeCreatedByType = 'provider' | 'agency';
export type NoticeTargetType = 'all' | 'agency';
export type NoticeCategory = 'notice' | 'guide' | 'update' | 'etc';
export type NoticeStatus = 'draft' | 'published';
export type SubscriptionStatus = 'active' | 'overdue' | 'cancelled';
export type RateType = 'fixed' | 'percentage';
export type DeductionType = 'fixed' | 'percentage' | 'per_unit';

// 추가 타입 (contract_amendments, driver_contract_periods 등)
export type AmendmentType = 'rate_change' | 'insurance_change' | 'deduction_change' | 'area_change' | 'renewal' | 'general_change';
export type AmendmentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
export type PeriodStatus = 'active' | 'upcoming' | 'expired' | 'cancelled';
export type IntegrityCheckResult = 'pass' | 'fail';
export type VerificationLogAction = 'verify_request' | 'verify_success' | 'verify_fail';

export interface Database {
  public: {
    Tables: {
      providers: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['providers']['Insert']>;
        Relationships: [];
      };
      agencies: {
        Row: {
          id: string;
          provider_id: string | null;
          name: string;
          business_number: string | null;
          owner_name: string | null;
          phone: string | null;
          address: string | null;
          plan: AgencyPlan;
          monthly_fee: number;
          status: AgencyStatus;
          invite_code: string | null;
          excel_config: Record<string, unknown> | null;
          field_config: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider_id?: string | null;
          name: string;
          business_number?: string | null;
          owner_name?: string | null;
          phone?: string | null;
          address?: string | null;
          plan?: AgencyPlan;
          monthly_fee?: number;
          status?: AgencyStatus;
          invite_code?: string | null;
          excel_config?: Record<string, unknown> | null;
          field_config?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['agencies']['Insert']>;
        Relationships: [];
      };
      drivers: {
        Row: {
          id: string;
          agency_id: string | null;
          user_id: string | null;
          name: string;
          phone: string;
          email: string | null;
          birth_date: string | null;
          address: string | null;
          vehicle_number: string | null;
          license_number: string | null;
          employee_code: string | null;
          delivery_area: string | null;
          is_business_owner: boolean;
          vat_included: boolean;
          tax_type: DriverTaxType;
          business_reg_number: string | null;
          representative_name: string | null;
          business_address: string | null;
          business_type: string | null;
          business_category: string | null;
          custom_values: Record<string, unknown> | null;
          fresh_incentive_pct: number;
          extra_incentive_pct: number;
          push_token: string | null;
          status: DriverStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          agency_id?: string | null;
          user_id?: string | null;
          name: string;
          phone: string;
          email?: string | null;
          birth_date?: string | null;
          address?: string | null;
          vehicle_number?: string | null;
          license_number?: string | null;
          employee_code?: string | null;
          delivery_area?: string | null;
          is_business_owner?: boolean;
          vat_included?: boolean;
          tax_type?: DriverTaxType;
          business_reg_number?: string | null;
          representative_name?: string | null;
          business_address?: string | null;
          business_type?: string | null;
          business_category?: string | null;
          custom_values?: Record<string, unknown> | null;
          fresh_incentive_pct?: number;
          extra_incentive_pct?: number;
          push_token?: string | null;
          status?: DriverStatus;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['drivers']['Insert']>;
        Relationships: [];
      };
      driver_documents: {
        Row: {
          id: string;
          driver_id: string | null;
          type: DocumentType;
          file_url: string | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          driver_id?: string | null;
          type: DocumentType;
          file_url?: string | null;
          uploaded_at?: string;
        };
        Update: Partial<Database['public']['Tables']['driver_documents']['Insert']>;
        Relationships: [];
      };
      principals: {
        Row: {
          id: string;
          agency_id: string | null;
          name: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          agency_id?: string | null;
          name: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['principals']['Insert']>;
        Relationships: [];
      };
      settlement_rules: {
        Row: {
          id: string;
          principal_id: string | null;
          package_type: PackageType;
          base_unit_price: number;
          rate_type: RateType;
          created_at: string;
        };
        Insert: {
          id?: string;
          principal_id?: string | null;
          package_type: PackageType;
          base_unit_price: number;
          rate_type?: RateType;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['settlement_rules']['Insert']>;
        Relationships: [];
      };
      driver_rates: {
        Row: {
          id: string;
          driver_id: string | null;
          principal_id: string | null;
          package_type: PackageType;
          unit_price: number;
          rate_type: RateType;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          driver_id?: string | null;
          principal_id?: string | null;
          package_type: PackageType;
          unit_price: number;
          rate_type?: RateType;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['driver_rates']['Insert']>;
        Relationships: [];
      };
      driver_route_rates: {
        Row: {
          id: string;
          driver_id: string | null;
          principal_id: string | null;
          route_code: string;
          route_name: string | null;
          unit_price: number;
          delivery_rate: number | null;
          return_rate: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          driver_id?: string | null;
          principal_id?: string | null;
          route_code: string;
          route_name?: string | null;
          unit_price: number;
          delivery_rate?: number | null;
          return_rate?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['driver_route_rates']['Insert']>;
        Relationships: [];
      };
      deduction_items: {
        Row: {
          id: string;
          principal_id: string | null;
          name: string;
          amount: number;
          is_active: boolean;
          rate_type: DeductionType;
          rate_value: number;
          unit_label: string;
        };
        Insert: {
          id?: string;
          principal_id?: string | null;
          name: string;
          amount: number;
          is_active?: boolean;
          rate_type?: DeductionType;
          rate_value?: number;
          unit_label?: string;
        };
        Update: Partial<Database['public']['Tables']['deduction_items']['Insert']>;
        Relationships: [];
      };
      driver_deductions: {
        Row: {
          id: string;
          driver_id: string | null;
          principal_id: string | null;
          name: string;
          amount: number;
          deduction_type: DeductionType;
          unit_label: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          driver_id?: string | null;
          principal_id?: string | null;
          name: string;
          amount: number;
          deduction_type?: DeductionType;
          unit_label?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['driver_deductions']['Insert']>;
        Relationships: [];
      };
      incentive_rules: {
        Row: {
          id: string;
          principal_id: string | null;
          min_count: number;
          max_count: number | null;
          bonus_per_unit: number;
        };
        Insert: {
          id?: string;
          principal_id?: string | null;
          min_count: number;
          max_count?: number | null;
          bonus_per_unit: number;
        };
        Update: Partial<Database['public']['Tables']['incentive_rules']['Insert']>;
        Relationships: [];
      };
      driver_incentives: {
        Row: {
          id: string;
          driver_id: string | null;
          principal_id: string | null;
          min_count: number;
          max_count: number | null;
          bonus_per_unit: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          driver_id?: string | null;
          principal_id?: string | null;
          min_count: number;
          max_count?: number | null;
          bonus_per_unit: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['driver_incentives']['Insert']>;
        Relationships: [];
      };
      settlements: {
        Row: {
          id: string;
          agency_id: string | null;
          driver_id: string | null;
          principal_id: string | null;
          year_month: string;
          delivery_count: number;
          delivery_amount: number;
          return_count: number;
          return_amount: number;
          pickup_count: number;
          pickup_amount: number;
          fresh_incentive: number;
          extra_incentive: number;
          base_amount: number;
          gross_total: number;
          incentive_amount: number;
          total_amount: number;
          total_deduction: number;
          vat_amount: number;
          net_amount: number;
          rate_mode: string;
          rate_percentage: number;
          is_business_owner: boolean;
          vat_included: boolean;
          route_details: Record<string, unknown> | null;
          deduction_detail: Record<string, number> | null;
          status: SettlementStatus;
          pdf_url: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          agency_id?: string | null;
          driver_id?: string | null;
          principal_id?: string | null;
          year_month: string;
          delivery_count?: number;
          delivery_amount?: number;
          return_count?: number;
          return_amount?: number;
          pickup_count?: number;
          pickup_amount?: number;
          fresh_incentive?: number;
          extra_incentive?: number;
          base_amount?: number;
          gross_total?: number;
          incentive_amount?: number;
          total_amount?: number;
          total_deduction?: number;
          vat_amount?: number;
          net_amount?: number;
          rate_mode?: string;
          rate_percentage?: number;
          is_business_owner?: boolean;
          vat_included?: boolean;
          route_details?: Record<string, unknown> | null;
          deduction_detail?: Record<string, number> | null;
          status?: SettlementStatus;
          pdf_url?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['settlements']['Insert']>;
        Relationships: [];
      };
      tax_invoices: {
        Row: {
          id: string;
          settlement_id: string | null;
          driver_id: string | null;
          agency_id: string | null;
          year_month: string;
          supply_amount: number;
          tax_amount: number;
          total_amount: number;
          invoice_type: InvoiceType;
          status: InvoiceStatus;
          issued_at: string | null;
          pdf_url: string | null;
        };
        Insert: {
          id?: string;
          settlement_id?: string | null;
          driver_id?: string | null;
          agency_id?: string | null;
          year_month: string;
          supply_amount: number;
          tax_amount: number;
          total_amount: number;
          invoice_type?: InvoiceType;
          status?: InvoiceStatus;
          issued_at?: string | null;
          pdf_url?: string | null;
        };
        Update: Partial<Database['public']['Tables']['tax_invoices']['Insert']>;
        Relationships: [];
      };
      contract_templates: {
        Row: {
          id: string;
          agency_id: string | null;
          principal_id: string | null;
          title: string;
          content: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          agency_id?: string | null;
          principal_id?: string | null;
          title: string;
          content: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['contract_templates']['Insert']>;
        Relationships: [];
      };
      contracts: {
        Row: {
          id: string;
          template_id: string | null;
          agency_id: string | null;
          driver_id: string | null;
          title: string;
          content: string;
          content_hash: string;
          sign_token: string | null;
          token_expires_at: string | null;
          status: ContractStatus;
          sent_at: string | null;
          signed_at: string | null;
          signed_pdf_url: string | null;
          signed_pdf_hash: string | null;
          document_number: string | null;
          verification_code: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id?: string | null;
          agency_id?: string | null;
          driver_id?: string | null;
          title: string;
          content: string;
          content_hash: string;
          sign_token?: string | null;
          token_expires_at?: string | null;
          status?: ContractStatus;
          sent_at?: string | null;
          signed_at?: string | null;
          signed_pdf_url?: string | null;
          signed_pdf_hash?: string | null;
          document_number?: string | null;
          verification_code?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['contracts']['Insert']>;
        Relationships: [];
      };
      contract_signatures: {
        Row: {
          id: string;
          contract_id: string | null;
          driver_id: string | null;
          phone_verified: string;
          otp_session_id: string | null;
          identity_verified_at: string | null;
          signature_image_base64: string | null;
          signed_pdf_hash: string | null;
          signer_ip: string | null;
          signer_user_agent: string | null;
          signed_at: string | null;
          tsa_timestamp: string | null;
          audit_log: Record<string, unknown>[] | null;
          audit_certificate_url: string | null;
          consent_contract: boolean;
          consent_privacy_collect: boolean;
          consent_privacy_id: boolean;
          consent_privacy_3rd: boolean;
          consent_privacy_3rd_id: boolean;
        };
        Insert: {
          id?: string;
          contract_id?: string | null;
          driver_id?: string | null;
          phone_verified: string;
          otp_session_id?: string | null;
          identity_verified_at?: string | null;
          signature_image_base64?: string | null;
          signed_pdf_hash?: string | null;
          signer_ip?: string | null;
          signer_user_agent?: string | null;
          signed_at?: string | null;
          tsa_timestamp?: string | null;
          audit_log?: Record<string, unknown> | Record<string, unknown>[] | null;
          audit_certificate_url?: string | null;
          consent_contract?: boolean;
          consent_privacy_collect?: boolean;
          consent_privacy_id?: boolean;
          consent_privacy_3rd?: boolean;
          consent_privacy_3rd_id?: boolean;
        };
        Update: Partial<Database['public']['Tables']['contract_signatures']['Insert']>;
        Relationships: [];
      };
      notices: {
        Row: {
          id: string;
          created_by_type: NoticeCreatedByType | null;
          provider_id: string | null;
          agency_id: string | null;
          target_type: NoticeTargetType;
          title: string;
          content: string;
          category: NoticeCategory | null;
          attachment_url: string | null;
          appstore_url: string | null;
          playstore_url: string | null;
          status: NoticeStatus;
          published_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          created_by_type?: NoticeCreatedByType | null;
          provider_id?: string | null;
          agency_id?: string | null;
          target_type?: NoticeTargetType;
          title: string;
          content: string;
          category?: NoticeCategory | null;
          attachment_url?: string | null;
          appstore_url?: string | null;
          playstore_url?: string | null;
          status?: NoticeStatus;
          published_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notices']['Insert']>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          agency_id: string | null;
          plan: string;
          amount: number;
          billing_date: number;
          status: SubscriptionStatus;
          last_paid_at: string | null;
          next_billing_at: string | null;
        };
        Insert: {
          id?: string;
          agency_id?: string | null;
          plan: string;
          amount: number;
          billing_date?: number;
          status?: SubscriptionStatus;
          last_paid_at?: string | null;
          next_billing_at?: string | null;
          billing_cycle?: string;
          base_monthly_amount?: number;
          discount_rate?: number;
          total_amount?: number;
          contract_months?: number;
          started_at?: string | null;
          expires_at?: string | null;
          payment_method?: string | null;
        };
        Update: {
          id?: string;
          agency_id?: string | null;
          plan?: string;
          amount?: number;
          billing_date?: number;
          status?: SubscriptionStatus;
          last_paid_at?: string | null;
          next_billing_at?: string | null;
          billing_cycle?: string;
          base_monthly_amount?: number;
          discount_rate?: number;
          total_amount?: number;
          contract_months?: number;
          started_at?: string | null;
          expires_at?: string | null;
          payment_method?: string | null;
        };
      };
      payment_history: {
        Row: {
          id: string;
          subscription_id: string;
          agency_id: string;
          amount: number;
          billing_cycle: string;
          status: string;
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscription_id: string;
          agency_id: string;
          amount: number;
          billing_cycle?: string;
          status?: string;
          paid_at?: string | null;
        };
        Update: {
          id?: string;
          subscription_id?: string;
          agency_id?: string;
          amount?: number;
          billing_cycle?: string;
          status?: string;
          paid_at?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      ContractStatus: ContractStatus;
      AmendmentType: AmendmentType;
      AmendmentStatus: AmendmentStatus;
      SubscriptionStatus: SubscriptionStatus;
      NoticeTargetType: NoticeTargetType;
      NoticeStatus: NoticeStatus;
      NoticeCategory: NoticeCategory;
      NoticeCreatedByType: NoticeCreatedByType;
    };
  };
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];