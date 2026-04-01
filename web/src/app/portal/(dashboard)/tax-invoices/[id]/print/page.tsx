'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface TaxInvoiceDetail {
  id: string;
  settlement_id: string | null;
  driver_id: string | null;
  agency_id: string;
  year_month: string;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  invoice_type: string;
  status: string;
  issued_at: string | null;
  memo: string | null;
  drivers: {
    name: string;
    business_reg_number: string | null;
    representative_name: string | null;
    business_address: string | null;
    business_type: string | null;
    business_category: string | null;
    email: string | null;
  } | null;
  agencies: {
    name: string;
    business_reg_number: string | null;
    representative_name: string | null;
    address: string | null;
    business_type: string | null;
    business_category: string | null;
  } | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) {
    const now = new Date();
    return `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
  }
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return `${y}년 ${Number(m)}월`;
}

export default function TaxInvoicePrintPage() {
  const params = useParams();
  const invoiceId = params.id as string;
  const [invoice, setInvoice] = useState<TaxInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase
        .from('tax_invoices')
        .select(`
          id, settlement_id, driver_id, agency_id, year_month,
          supply_amount, tax_amount, total_amount, invoice_type, status,
          issued_at, memo,
          drivers(name, business_reg_number, representative_name, business_address, business_type, business_category, email),
          agencies(name, business_reg_number, representative_name, address, business_type, business_category)
        `)
        .eq('id', invoiceId)
        .single();
      if (!error && data) {
        setInvoice(data as unknown as TaxInvoiceDetail);
      }
      setLoading(false);
    }
    load();
  }, [invoiceId]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-sm text-gray-500">불러오는 중...</div>;
  }

  if (!invoice) {
    return <div className="flex items-center justify-center h-screen text-sm text-gray-500">세금계산서를 찾을 수 없습니다</div>;
  }

  const isManualReverse = invoice.invoice_type === 'manual_reverse';
  const isWithholding = invoice.invoice_type === 'withholding_3_3';

  // For tax invoice: supplier = driver (사업자), buyer = agency
  // For manual reverse: supplier = agency, buyer = driver
  const supplier = isManualReverse
    ? {
        regNumber: invoice.agencies?.business_reg_number ?? '',
        name: invoice.agencies?.representative_name ?? '',
        companyName: invoice.agencies?.name ?? '',
        address: invoice.agencies?.address ?? '',
        businessType: invoice.agencies?.business_type ?? '',
        businessCategory: invoice.agencies?.business_category ?? '',
      }
    : {
        regNumber: invoice.drivers?.business_reg_number ?? '',
        name: invoice.drivers?.representative_name ?? invoice.drivers?.name ?? '',
        companyName: invoice.drivers?.name ?? '',
        address: invoice.drivers?.business_address ?? '',
        businessType: invoice.drivers?.business_type ?? '',
        businessCategory: invoice.drivers?.business_category ?? '',
      };

  const buyer = isManualReverse
    ? {
        regNumber: invoice.drivers?.business_reg_number ?? '',
        name: invoice.drivers?.representative_name ?? invoice.drivers?.name ?? '',
        companyName: invoice.drivers?.name ?? '',
        address: invoice.drivers?.business_address ?? '',
        businessType: invoice.drivers?.business_type ?? '',
        businessCategory: invoice.drivers?.business_category ?? '',
      }
    : {
        regNumber: invoice.agencies?.business_reg_number ?? '',
        name: invoice.agencies?.representative_name ?? '',
        companyName: invoice.agencies?.name ?? '',
        address: invoice.agencies?.address ?? '',
        businessType: invoice.agencies?.business_type ?? '',
        businessCategory: invoice.agencies?.business_category ?? '',
      };

  const cellCls = 'border border-gray-400 px-2 py-1.5 text-xs';
  const headerCls = 'border border-gray-400 px-2 py-1.5 text-xs font-semibold bg-gray-100 text-center';

  return (
    <div className="min-h-screen bg-white p-4 print:p-0">
      {/* Print button - hidden on print */}
      <div className="print:hidden mb-4 flex items-center justify-between max-w-[800px] mx-auto">
        <button
          onClick={() => window.history.back()}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          &larr; 돌아가기
        </button>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          인쇄하기
        </button>
      </div>

      {/* Tax Invoice Form */}
      <div className="max-w-[800px] mx-auto border-2 border-gray-800">
        {/* Title */}
        <div className="text-center py-3 border-b-2 border-gray-800 bg-gray-50">
          <h1 className="text-xl font-bold tracking-widest">
            {isWithholding ? '원천징수 영수증' : '세 금 계 산 서'}
          </h1>
          {isManualReverse && (
            <p className="text-xs text-gray-500 mt-0.5">(수기 역발행)</p>
          )}
        </div>

        {/* Info row */}
        <div className="grid grid-cols-2 border-b border-gray-800">
          {/* Supplier (공급자) */}
          <div className="border-r border-gray-800">
            <div className={`${headerCls} border-b border-gray-400 font-bold text-sm`}>
              공 급 자
            </div>
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className={`${headerCls} w-20`}>등록번호</td>
                  <td className={`${cellCls} font-mono tracking-wider`} colSpan={3}>{supplier.regNumber}</td>
                </tr>
                <tr>
                  <td className={`${headerCls} w-20`}>상호</td>
                  <td className={cellCls}>{supplier.companyName}</td>
                  <td className={`${headerCls} w-16`}>대표자</td>
                  <td className={cellCls}>{supplier.name}</td>
                </tr>
                <tr>
                  <td className={`${headerCls} w-20`}>주소</td>
                  <td className={cellCls} colSpan={3}>{supplier.address}</td>
                </tr>
                <tr>
                  <td className={`${headerCls} w-20`}>업종</td>
                  <td className={cellCls}>{supplier.businessType}</td>
                  <td className={`${headerCls} w-16`}>업태</td>
                  <td className={cellCls}>{supplier.businessCategory}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Buyer (공급받는자) */}
          <div>
            <div className={`${headerCls} border-b border-gray-400 font-bold text-sm`}>
              공 급 받 는 자
            </div>
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className={`${headerCls} w-20`}>등록번호</td>
                  <td className={`${cellCls} font-mono tracking-wider`} colSpan={3}>{buyer.regNumber}</td>
                </tr>
                <tr>
                  <td className={`${headerCls} w-20`}>상호</td>
                  <td className={cellCls}>{buyer.companyName}</td>
                  <td className={`${headerCls} w-16`}>대표자</td>
                  <td className={cellCls}>{buyer.name}</td>
                </tr>
                <tr>
                  <td className={`${headerCls} w-20`}>주소</td>
                  <td className={cellCls} colSpan={3}>{buyer.address}</td>
                </tr>
                <tr>
                  <td className={`${headerCls} w-20`}>업종</td>
                  <td className={cellCls}>{buyer.businessType}</td>
                  <td className={`${headerCls} w-16`}>업태</td>
                  <td className={cellCls}>{buyer.businessCategory}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Amount summary */}
        <table className="w-full border-collapse border-b border-gray-800">
          <thead>
            <tr>
              <th className={`${headerCls} w-24`}>작성일자</th>
              <th className={headerCls}>공급가액</th>
              <th className={headerCls}>{isWithholding ? '원천세액 (3.3%)' : '세액'}</th>
              <th className={headerCls}>합계금액</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${cellCls} text-center`}>{formatDate(invoice.issued_at)}</td>
              <td className={`${cellCls} text-right font-mono`}>
                {invoice.supply_amount.toLocaleString()}
              </td>
              <td className={`${cellCls} text-right font-mono`}>
                {invoice.tax_amount.toLocaleString()}
              </td>
              <td className={`${cellCls} text-right font-mono font-bold`}>
                {invoice.total_amount.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Detail rows */}
        <table className="w-full border-collapse border-b border-gray-800">
          <thead>
            <tr>
              <th className={`${headerCls} w-8`}>월</th>
              <th className={`${headerCls} w-8`}>일</th>
              <th className={headerCls}>품목</th>
              <th className={`${headerCls} w-16`}>수량</th>
              <th className={`${headerCls} w-20`}>단가</th>
              <th className={headerCls}>공급가액</th>
              <th className={headerCls}>세액</th>
              <th className={`${headerCls} w-20`}>비고</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${cellCls} text-center`}>{Number(invoice.year_month.split('-')[1])}</td>
              <td className={`${cellCls} text-center`}></td>
              <td className={cellCls}>
                {isWithholding ? '용역대금 (원천징수)' : `${formatYearMonth(invoice.year_month)} 운송용역`}
              </td>
              <td className={`${cellCls} text-center`}>1</td>
              <td className={`${cellCls} text-right font-mono`}>{invoice.supply_amount.toLocaleString()}</td>
              <td className={`${cellCls} text-right font-mono`}>{invoice.supply_amount.toLocaleString()}</td>
              <td className={`${cellCls} text-right font-mono`}>{invoice.tax_amount.toLocaleString()}</td>
              <td className={cellCls}>{invoice.memo ?? ''}</td>
            </tr>
            {/* Empty rows for standard form */}
            {[...Array(3)].map((_, i) => (
              <tr key={i}>
                <td className={cellCls}>&nbsp;</td>
                <td className={cellCls}></td>
                <td className={cellCls}></td>
                <td className={cellCls}></td>
                <td className={cellCls}></td>
                <td className={cellCls}></td>
                <td className={cellCls}></td>
                <td className={cellCls}></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals row */}
        <table className="w-full border-collapse border-b border-gray-800">
          <tbody>
            <tr>
              <td className={`${headerCls} w-24`}>합계</td>
              <td className={`${headerCls}`}>공급가액</td>
              <td className={`${cellCls} text-right font-mono font-bold`}>
                {invoice.supply_amount.toLocaleString()}
              </td>
              <td className={headerCls}>세액</td>
              <td className={`${cellCls} text-right font-mono font-bold`}>
                {invoice.tax_amount.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer notes */}
        <div className="p-4 text-xs text-gray-600 space-y-2">
          <p>위 금액을 {isManualReverse ? '청구' : isWithholding ? '영수' : '청구'} 합니다.</p>
          <p className="text-right">{formatDate(invoice.issued_at)}</p>
          <div className="flex justify-between pt-2">
            <span>공급자: {supplier.companyName} (인)</span>
            <span>공급받는자: {buyer.companyName}</span>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 0; }
          @page { size: A4; margin: 15mm; }
        }
      `}</style>
    </div>
  );
}
