import Link from 'next/link';

export default function SettlementRulesRedirect() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">
          거래처/정산 기준 관리 안내
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant font-korean">
          예전 정산 규칙 설정은 지금부터 거래처/정산 기준 관리 메뉴로 통합했습니다. 거래처별 수익 구조,
          보험 기준, 차감 항목, 기사 카테고리별 계산 규칙을 한 곳에서 관리할 수 있습니다.
        </p>
      </div>

      <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
        <h2 className="text-base font-headline font-bold text-on-surface font-korean">
          이 메뉴에서 확인하는 항목
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-on-surface font-korean">거래처별 수익 구조</p>
            <p className="mt-1 text-xs text-on-surface-variant font-korean">
              배송, 반품, 집하, 인센티브 같은 수익 항목과 계산 방식을 거래처별로 정리합니다.
            </p>
          </div>
          <div className="rounded-xl bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-on-surface font-korean">차감 및 보험 기준</p>
            <p className="mt-1 text-xs text-on-surface-variant font-korean">
              고용보험, 산재보험, 사고비, 차량비, 대출금 차감 같은 정산 기준을 함께 설정합니다.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/portal/principals"
            className="inline-flex h-11 items-center rounded-xl bg-power-gradient px-5 text-sm font-semibold text-white font-korean"
          >
            거래처/정산 기준 관리 열기
          </Link>
          <Link
            href="/portal/settlements/generate"
            className="inline-flex h-11 items-center rounded-xl border border-outline-variant/20 px-5 text-sm text-on-surface font-korean"
          >
            정산 생성 화면 보기
          </Link>
        </div>
      </div>
    </div>
  );
}
