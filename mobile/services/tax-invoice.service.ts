import { supabase } from '../lib/supabase';
import type { Row } from '../types/database';

export interface DriverTaxInvoice extends Row<'tax_invoices'> {
  drivers: {
    name: string;
    business_reg_number: string | null;
    representative_name: string | null;
  } | null;
}

export function taxInvoiceStatusLabel(status: string): string {
  switch (status) {
    case 'issued':
      return '발행 완료';
    case 'pending':
      return '발행 대기';
    case 'cancelled':
      return '취소';
    default:
      return status;
  }
}

export function taxInvoiceTypeLabel(invoiceType: string): string {
  switch (invoiceType) {
    case 'manual_reverse':
      return '수기 역발행';
    case 'withholding_3_3':
      return '3.3% 원천징수';
    case 'vat_invoice':
      return '부가세 계산서';
    default:
      return '세금계산서';
  }
}

export async function getDriverTaxInvoices(driverId: string): Promise<{
  data: DriverTaxInvoice[] | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('tax_invoices')
      .select(
        'id, settlement_id, driver_id, agency_id, year_month, supply_amount, tax_amount, total_amount, invoice_type, status, issued_at, pdf_url, drivers(name, business_reg_number, representative_name)',
      )
      .eq('driver_id', driverId)
      .order('issued_at', { ascending: false, nullsFirst: false });

    if (error) throw error;

    return {
      data: (data ?? []) as unknown as DriverTaxInvoice[],
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : '세금계산서 목록을 불러오지 못했습니다.',
    };
  }
}

export async function getDriverTaxInvoiceDetail(
  driverId: string,
  invoiceId: string,
): Promise<{ data: DriverTaxInvoice | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('tax_invoices')
      .select(
        'id, settlement_id, driver_id, agency_id, year_month, supply_amount, tax_amount, total_amount, invoice_type, status, issued_at, pdf_url, drivers(name, business_reg_number, representative_name)',
      )
      .eq('driver_id', driverId)
      .eq('id', invoiceId)
      .single();

    if (error) throw error;

    return {
      data: data as unknown as DriverTaxInvoice,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : '세금계산서 상세를 불러오지 못했습니다.',
    };
  }
}
