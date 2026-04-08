'use client'

export default function OpsArchitecturePanel() {
  return (
    <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
      <h3 className="mb-6 font-headline text-[16px] font-bold text-on-surface">시스템 아키텍처</h3>

      <div className="space-y-5">
        {/* Data Sources */}
        <div>
          <p className="mb-2 text-center font-body text-[11px] font-medium text-on-surface-variant">데이터 소스</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['로지사인 SaaS', '헬프미 앱', 'Supabase DB', '외부 API'].map((s) => (
              <span
                key={s}
                className="rounded-lg bg-[#A78BFA]/10 border border-[#A78BFA]/20 px-4 py-2 font-body text-[11px] font-medium text-[#A78BFA]"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          <span
            className="material-symbols-outlined text-[24px] text-on-surface-variant/40"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}
          >
            arrow_downward
          </span>
        </div>

        {/* Processing Layer */}
        <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4 text-center">
          <p className="mb-3 font-body text-[12px] font-semibold text-primary">데이터 수집 & 처리 파이프라인</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['Cron 집계', '이벤트 스트림', '로그 수집', '임베딩 생성', '이상탐지'].map((s) => (
              <span
                key={s}
                className="rounded-md bg-surface-container-low px-3 py-1 font-body text-[10px] text-on-surface"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          <span
            className="material-symbols-outlined text-[24px] text-on-surface-variant/40"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}
          >
            arrow_downward
          </span>
        </div>

        {/* AI Core */}
        <div className="rounded-xl border border-tertiary/20 bg-tertiary/[0.06] p-4 text-center">
          <p className="mb-3 font-body text-[12px] font-semibold text-tertiary">AI 코어 엔진</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['Claude API', 'RAG (pgvector)', 'XGBoost 이상탐지', '자체호스팅 (Qwen/Llama)', 'bge-m3 임베딩'].map(
              (s) => (
                <span
                  key={s}
                  className="rounded-md bg-surface-container-low px-3 py-1 font-body text-[10px] text-on-surface"
                >
                  {s}
                </span>
              ),
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <span
            className="material-symbols-outlined text-[24px] text-on-surface-variant/40"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}
          >
            arrow_downward
          </span>
        </div>

        {/* Output Layer */}
        <div>
          <p className="mb-2 text-center font-body text-[11px] font-medium text-on-surface-variant">출력 레이어</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { label: '부서별 에이전트', color: '#6366F1' },
              { label: '자동 리포팅', color: '#10B981' },
              { label: 'Self-Healing', color: '#EF4444' },
              { label: '챗봇', color: '#3B82F6' },
              { label: '대시보드', color: '#F59E0B' },
            ].map((s) => (
              <span
                key={s.label}
                className="rounded-lg border px-4 py-2 font-body text-[11px] font-medium"
                style={{
                  color: s.color,
                  backgroundColor: `${s.color}10`,
                  borderColor: `${s.color}30`,
                }}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
