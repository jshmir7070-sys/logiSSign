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
    id: 'today',
    title: '오늘 가장 많이 쓰는 운영 순서',
    summary: '로지싸인 관리자는 고객사의 실제 업무를 대신 처리하기보다, 서비스가 원활히 사용되도록 상태를 확인하고 막히는 지점을 풀어주는 역할을 합니다.',
    steps: [
      {
        title: '고객사 결제 상태 확인',
        description: '결제 관리에서 최근 주문 상태와 입금 대기, 결제 실패 여부를 먼저 확인합니다.',
        href: '/admin/billing',
        cta: '결제 관리 열기',
      },
      {
        title: '고객사별 기사 연결 상태 점검',
        description: '고객사 관리에서 기사 수와 계정 연결 상태를 보고, 가입이 지연된 고객사를 확인합니다.',
        href: '/admin/agencies',
        cta: '고객사 관리 열기',
      },
      {
        title: '서버/오류 상황 확인',
        description: '서버 상태에서 DB, Storage, Auth, Sentry 이슈를 확인해 장애가 없는지 점검합니다.',
        href: '/admin/server',
        cta: '서버 상태 열기',
      },
    ],
  },
  {
    id: 'onboarding',
    title: '신규 고객사 온보딩 지원',
    summary: '신규 고객사가 처음 로지싸인을 사용할 때는 플랜, 결제, 기사 연결 순서로 확인하면 대부분 빠르게 정리됩니다.',
    steps: [
      {
        title: '고객사 생성과 기본 정보 확인',
        description: '고객사 관리에서 회사명, 플랜, 기사 수, 최근 활동 여부를 먼저 봅니다.',
        href: '/admin/agencies',
        cta: '고객사 목록 보기',
      },
      {
        title: '플랜/결제 활성 여부 확인',
        description: '플랜이 실제 주문 상태와 맞는지, 무료/유료 전환이 정상 반영됐는지 확인합니다.',
        href: '/admin/billing',
        cta: '결제 상태 점검',
      },
      {
        title: '운영 안내 제공',
        description: '고객사 담당자에게 기사 등록, 계약 발송, 정산 업로드 순서를 안내합니다.',
        href: '/admin/guide',
        cta: '이 가이드 다시 보기',
      },
    ],
  },
  {
    id: 'drivers',
    title: '기사 가입/연결 점검',
    summary: '기사 수가 늘지 않거나 계약/정산 발송이 막힐 때는 기사 계정 연결 상태를 먼저 확인하는 것이 좋습니다.',
    steps: [
      {
        title: '기사 목록과 연결 상태 확인',
        description: '기사 현황에서 계정 연결, 푸시 가능 여부, 기본 상태를 점검합니다.',
        href: '/admin/drivers',
        cta: '기사 현황 열기',
      },
      {
        title: '고객사별 기사 수 비교',
        description: '고객사 관리의 등록 기사 수와 실제 기사 현황이 크게 다른지 비교합니다.',
        href: '/admin/agencies',
        cta: '고객사와 함께 보기',
      },
    ],
  },
  {
    id: 'contracts-settlements',
    title: '계약 / 정산 / 세금계산서 지원 순서',
    summary: '관리자는 실제 계약서 작성이나 정산 계산을 대신하기보다, 고객사 업무 흐름이 끊기지 않도록 기준 메뉴를 안내하는 역할을 합니다.',
    steps: [
      {
        title: '계약서 작업은 고객사 포털에서 진행',
        description: '템플릿 만들기, 내 문서함, 문서/서류 전송은 고객사 포털의 계약서 관리 메뉴를 안내합니다.',
        href: '/admin/templates',
        cta: '기본 템플릿 점검',
      },
      {
        title: '정산 기준은 거래처/정산 기준 관리로 안내',
        description: '정산 규칙이라는 표현보다 거래처/정산 기준 관리 메뉴를 안내하는 것이 실제 화면과 맞습니다.',
        href: '/admin/agencies',
        cta: '고객사 운영 상태 확인',
      },
      {
        title: '세금계산서는 수기 역발행 보조 도구로 안내',
        description: '출력, 다운로드, 공급자 전송 중심으로 쓰는 기능이며 외부 전자발행 서비스가 아니라는 점을 함께 설명합니다.',
        href: '/admin/notices',
        cta: '운영 공지 점검',
      },
    ],
  },
  {
    id: 'incident',
    title: '오류/장애 대응 순서',
    summary: '장애가 의심될 때는 원인 추정보다 상태 확인 순서를 고정해 두는 것이 가장 빠릅니다.',
    steps: [
      {
        title: '서버 상태와 Sentry 먼저 확인',
        description: 'DB, Storage, Auth 상태와 최근 Sentry unresolved issue를 먼저 보고 범위를 좁힙니다.',
        href: '/admin/server',
        cta: '상태 페이지 열기',
      },
      {
        title: '감사 로그로 권한/보안 이슈 확인',
        description: '로그인, 권한 거부, 보안 이벤트가 함께 있었는지 감사 로그에서 확인합니다.',
        href: '/admin/audit-log',
        cta: '감사 로그 열기',
      },
      {
        title: '고객사별 영향 범위 확인',
        description: '특정 고객사만 문제인지, 전체 서비스 문제인지 고객사 관리와 기사 현황을 함께 봅니다.',
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
        <h1 className="mt-2 text-3xl font-headline font-bold text-on-surface font-korean">관리자 운영 가이드</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-on-surface-variant font-korean">
          로지싸인 관리자는 고객사의 계약, 정산, 기사 운영을 직접 수행하는 역할이 아니라 서비스가 안정적으로 사용되도록 지원하는 역할입니다.
          아래 순서대로 보면 고객사 문의, 결제 이슈, 기사 연결 문제, 장애 대응을 빠르게 정리할 수 있습니다.
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
          <section key={section.id} id={section.id} className="rounded-3xl bg-surface-container-lowest p-6 shadow-ambient">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Section</p>
                <h2 className="mt-1 text-xl font-headline font-bold text-on-surface font-korean">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant font-korean">{section.summary}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {section.steps.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-on-surface font-korean">{step.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-on-surface-variant font-korean">{step.description}</p>
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
