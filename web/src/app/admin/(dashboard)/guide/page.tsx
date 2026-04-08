import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '운영 가이드 | logiSSign',
};

type GuideStep = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

type GuideSection = {
  id: string;
  title: string;
  summary: string;
  steps: GuideStep[];
};

const guideSections: GuideSection[] = [
  {
    id: 'daily',
    title: '매일 확인하면 좋은 운영 순서',
    summary:
      '로지싸인 관리자는 고객사의 업무를 직접 대신 처리하기보다, 서비스가 안정적으로 사용되고 있는지 확인하고 빠르게 지원하는 역할에 집중합니다.',
    steps: [
      {
        title: '결제 상태부터 확인',
        description:
          '결제 관리에서 최근 주문, 입금 대기, 결제 실패 건을 먼저 보고 오늘 즉시 확인이 필요한 고객사가 있는지 파악합니다.',
        href: '/admin/billing',
        cta: '결제 관리 열기',
      },
      {
        title: '고객사와 기사 연결 상태 점검',
        description:
          '고객사 관리에서 기사 수, 가입 연결 상태, 최근 활동 여부를 확인해 온보딩이 막힌 고객사가 없는지 점검합니다.',
        href: '/admin/agencies',
        cta: '고객사 관리 열기',
      },
      {
        title: '서비스 상태와 오류 확인',
        description:
          '서버 상태 화면에서 DB, Storage, Auth, Sentry 이슈를 확인해 운영에 영향을 주는 장애가 없는지 점검합니다.',
        href: '/admin/server',
        cta: '서버 상태 열기',
      },
    ],
  },
  {
    id: 'onboarding',
    title: '신규 고객사 지원 순서',
    summary:
      '신규 고객사는 가입부터 플랜 선택, 기사 등록, 계약 및 정산 시작까지 순서대로 안내하면 가장 빠르게 정착합니다.',
    steps: [
      {
        title: '가입과 플랜 선택 완료 여부 확인',
        description:
          '고객사 계정 생성 이후 무료 시작인지 유료 플랜 결제인지 확인하고, 로그인까지 정상적으로 이어졌는지 봅니다.',
        href: '/admin/agencies',
        cta: '가입 고객사 확인',
      },
      {
        title: '결제 반영 여부 확인',
        description:
          '유료 플랜을 선택한 고객사는 주문 상태와 결제 수단이 정상 반영되었는지 결제 관리 화면에서 확인합니다.',
        href: '/admin/billing',
        cta: '결제 반영 확인',
      },
      {
        title: '초기 운영 동선 안내',
        description:
          '기사 등록, 템플릿 만들기, 내 문서함, 계약 발송, 정산 업로드 순서로 안내하면 첫 사용 진입이 가장 수월합니다.',
        href: '/admin/guide',
        cta: '이 가이드 다시 보기',
      },
    ],
  },
  {
    id: 'drivers',
    title: '기사 가입과 연결 확인',
    summary:
      '계약서나 정산서 발송 전에 기사 계정이 제대로 연결되어 있는지 먼저 확인하면 오발송과 지원 문의를 크게 줄일 수 있습니다.',
    steps: [
      {
        title: '기사 목록과 연결 상태 확인',
        description:
          '기사 현황에서 기사 계정 연결 여부, 푸시 토큰 보유 여부, 최근 활동 상태를 먼저 확인합니다.',
        href: '/admin/drivers',
        cta: '기사 현황 열기',
      },
      {
        title: '고객사별 기사 수 비교',
        description:
          '고객사 관리에서 등록 기사 수와 실제 기사 현황이 크게 차이나지 않는지 비교해 가입 누락 여부를 찾습니다.',
        href: '/admin/agencies',
        cta: '고객사별 기사 보기',
      },
    ],
  },
  {
    id: 'workflow',
    title: '계약 · 정산 · 세금계산서 안내 기준',
    summary:
      '운영 관리자는 고객사를 대신해 문서를 작성하기보다, 고객사가 스스로 작업할 수 있도록 정확한 메뉴와 흐름을 안내하는 역할에 맞춥니다.',
    steps: [
      {
        title: '계약은 계약서 관리 메뉴로 안내',
        description:
          '템플릿 만들기, 내 문서함, 문서/서류 전송은 고객사 포털의 계약서 관리 메뉴에서 직접 진행하도록 안내합니다.',
        href: '/admin/templates',
        cta: '템플릿 현황 보기',
      },
      {
        title: '정산 기준은 거래처/정산 기준 관리로 안내',
        description:
          '예전 정산 규칙 대신 거래처/정산 기준 관리 메뉴에서 수익 구조, 보험, 차감 기준을 관리하도록 설명합니다.',
        href: '/admin/agencies',
        cta: '고객사 설정 보기',
      },
      {
        title: '세금계산서는 수기 역발행 보조 도구로 설명',
        description:
          '세금계산서 메뉴는 출력, 다운로드, 공급자 전송 중심의 수기 역발행 보조 도구라는 점을 분명히 안내합니다.',
        href: '/admin/notices',
        cta: '운영 공지 보기',
      },
    ],
  },
  {
    id: 'incident',
    title: '장애와 문의 대응 순서',
    summary:
      '원인 추정보다 먼저 상태를 확인하고 영향 범위를 좁히는 방식으로 대응하면 지원 품질이 훨씬 안정적입니다.',
    steps: [
      {
        title: '서버 상태와 Sentry 먼저 확인',
        description:
          'DB, Storage, Auth 상태와 최근 Sentry 이슈를 먼저 확인해 시스템 문제인지 특정 고객사 문제인지 구분합니다.',
        href: '/admin/server',
        cta: '상태 화면 열기',
      },
      {
        title: '감사 로그에서 보안 이벤트 확인',
        description:
          '권한 오류, 인증 실패, 보안 이벤트가 함께 있었는지 감사 로그에서 확인합니다.',
        href: '/admin/audit-log',
        cta: '감사 로그 보기',
      },
      {
        title: '영향 고객사 범위 확인',
        description:
          '특정 고객사만 겪는 문제인지 전체 서비스 이슈인지 고객사 관리와 기사 현황을 함께 보며 범위를 정리합니다.',
        href: '/admin/agencies',
        cta: '영향 범위 확인',
      },
    ],
  },
];

const quickLinks = [
  { label: '고객사 관리', href: '/admin/agencies' },
  { label: '결제 관리', href: '/admin/billing' },
  { label: '기사 현황', href: '/admin/drivers' },
  { label: '서버 상태', href: '/admin/server' },
  { label: '감사 로그', href: '/admin/audit-log' },
  { label: '공지 관리', href: '/admin/notices' },
];

export default function AdminGuidePage() {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-surface-container-lowest p-8 shadow-ambient">
        <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Admin Guide</p>
        <h1 className="mt-2 text-3xl font-headline font-bold text-on-surface font-korean">
          관리자 운영 가이드
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-on-surface-variant font-korean">
          로지싸인 관리자는 고객사의 계약, 정산, 기사 운영을 직접 대신 처리하기보다 서비스가 안정적으로
          사용되도록 상태를 점검하고 필요한 지원을 제공하는 역할에 집중합니다. 아래 순서대로 보면 신규
          고객 온보딩, 결제 문의, 기사 연결 문제, 장애 대응을 빠르게 정리할 수 있습니다.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex h-10 items-center rounded-full border border-outline-variant/20 px-4 text-sm text-on-surface font-korean transition-colors hover:bg-surface-container-low"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6">
        {guideSections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="rounded-3xl bg-surface-container-lowest p-6 shadow-ambient"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Section</p>
                <h2 className="mt-1 text-xl font-headline font-bold text-on-surface font-korean">
                  {section.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant font-korean">
                  {section.summary}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {section.steps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-on-surface font-korean">{step.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-on-surface-variant font-korean">
                          {step.description}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={step.href}
                      className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-power-gradient px-4 text-sm font-semibold text-white font-korean"
                    >
                      {step.cta}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
