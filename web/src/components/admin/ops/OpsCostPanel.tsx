'use client'

const COSTS = [
  { item: 'Claude API', monthly: '₩120,000', note: '메인 추론엔진' },
  { item: 'Supabase Pro', monthly: '₩29,000', note: 'DB + pgvector + Auth' },
  { item: 'PortOne 인증', monthly: '₩15,000~', note: '본인인증 ~40원/건' },
  { item: 'Solapi SMS', monthly: '₩20,000~', note: '알림톡/SMS' },
  { item: 'CLOVA OCR', monthly: '₩10,000~', note: '문서 인식' },
  { item: 'Mac Mini (상각)', monthly: '₩50,000', note: '자체호스팅 전환 후' },
]

const TOTAL = '₩244,000~'

export default function OpsCostPanel() {
  return (
    <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
      <h3 className="mb-5 font-headline text-[16px] font-bold text-on-surface">월간 운영 비용 (예상)</h3>

      <div className="space-y-2">
        {COSTS.map((c) => (
          <div
            key={c.item}
            className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3"
          >
            <span className="font-body text-[13px] text-on-surface">{c.item}</span>
            <div className="flex items-center gap-4">
              <span className="font-body text-[11px] text-on-surface-variant">{c.note}</span>
              <span className="min-w-[80px] text-right font-data text-[13px] font-semibold text-primary">
                {c.monthly}
              </span>
            </div>
          </div>
        ))}

        <div className="mt-3 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-4">
          <span className="font-headline text-[14px] font-bold text-primary">월 예상 총액</span>
          <span className="font-data text-[18px] font-bold text-primary">{TOTAL}</span>
        </div>
      </div>
    </div>
  )
}
