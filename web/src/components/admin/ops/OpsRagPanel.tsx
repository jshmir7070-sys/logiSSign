'use client'

const RAG_COLLECTIONS = [
  { name: '고객 FAQ', docs: 342, lastSync: '10분 전', status: 'active' as const },
  { name: '물류 법규', docs: 128, lastSync: '1시간 전', status: 'active' as const },
  { name: '정산 규정', docs: 89, lastSync: '30분 전', status: 'active' as const },
  { name: '계약서 양식', docs: 56, lastSync: '2시간 전', status: 'active' as const },
  { name: '운영 매뉴얼', docs: 203, lastSync: '15분 전', status: 'active' as const },
  { name: '마케팅 자료', docs: 167, lastSync: '45분 전', status: 'syncing' as const },
]

export default function OpsRagPanel() {
  return (
    <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
      <h3 className="mb-5 font-headline text-[16px] font-bold text-on-surface">RAG 지식 베이스 현황</h3>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {RAG_COLLECTIONS.map((collection) => (
          <div
            key={collection.name}
            className="rounded-xl border border-outline-variant/15 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-headline text-[13px] font-semibold text-on-surface">{collection.name}</span>
              <div
                className={`h-2 w-2 rounded-full ${
                  collection.status === 'active' ? 'bg-tertiary' : 'bg-amber-500'
                }`}
              />
            </div>
            <p className="font-data text-[20px] font-bold text-primary">{collection.docs}</p>
            <p className="mt-1 font-body text-[10px] text-on-surface-variant">
              문서 | 동기화: {collection.lastSync}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4">
        <p className="font-body text-[11px] text-primary">
          <span
            className="material-symbols-outlined mr-1 align-middle text-[14px]"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 14" }}
          >
            database
          </span>
          Supabase pgvector | 총 985개 문서 임베딩 완료 | bge-m3 모델 | 평균 검색 응답 120ms
        </p>
      </div>
    </div>
  )
}
