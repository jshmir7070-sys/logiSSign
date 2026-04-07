'use client';

import Link from 'next/link';

const sections = [
  {
    title: '1. 수집하는 개인정보 항목',
    body: [
      '회원가입 및 서비스 이용 과정에서 회사명, 대표자명, 담당자 연락처, 이메일, 사업자등록번호, 기사 이름, 기사 연락처, 주소, 계좌정보, 차량정보, 전자서명 정보, 접속 로그, IP 주소, 기기 정보가 수집될 수 있습니다.',
      '본인확인 과정에서는 이름, 휴대전화번호, 생년월일, 본인확인 결과값이 처리될 수 있으며, 민감한 식별값은 서비스 제공에 필요한 범위로만 최소화하여 처리합니다.',
    ],
  },
  {
    title: '2. 개인정보 이용 목적',
    body: [
      '회원 식별, 계약 생성 및 전자서명 처리, 기사 초대 및 문서 전송, 정산서 생성, 결제 및 요금제 운영, 고객 문의 대응, 서비스 보안과 품질 개선을 위해 개인정보를 이용합니다.',
    ],
  },
  {
    title: '3. 보유 및 이용 기간',
    body: [
      '개인정보는 수집·이용 목적이 달성되면 지체 없이 파기합니다.',
      '다만 전자상거래법, 전자서명법, 통신비밀보호법 등 관련 법령에 따라 계약 및 서명 기록, 접속 로그, 결제 관련 정보는 법정 보관기간 동안 보관될 수 있습니다.',
    ],
  },
  {
    title: '4. 제3자 제공',
    body: [
      '회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만 법령상 의무가 있는 경우 또는 이용자가 사전에 동의한 경우는 예외로 합니다.',
    ],
  },
  {
    title: '5. 개인정보 처리위탁 및 국외이전',
    body: [
      '회사는 서비스 운영을 위해 아래 사업자에게 개인정보 처리 업무 일부를 위탁하거나 국외 클라우드 서비스를 이용할 수 있습니다.',
      'Supabase Inc. - 인증, 데이터베이스, 파일 저장소 운영',
      'Vercel Inc. - 웹 애플리케이션 호스팅 및 배포',
      'PortOne Corp. - 결제 및 본인확인 연동',
      'Solapi Corp. - 문자메시지 발송',
      'Expo / Expo Push Service - 모바일 푸시 알림',
      'Sentry - 오류 추적 및 장애 분석',
      'OpenAI - 문서 분석 및 템플릿 생성 등 AI 기능 제공',
    ],
  },
  {
    title: '6. 이용자 권리',
    body: [
      '이용자는 언제든지 자신의 개인정보에 대한 열람, 정정, 삭제, 처리정지, 동의철회를 요청할 수 있습니다.',
      '관련 요청은 서비스 내 문의 또는 support@logissign.com 으로 접수할 수 있습니다.',
    ],
  },
  {
    title: '7. 안전성 확보조치',
    body: [
      '회사는 접근권한 관리, 인증 및 권한 분리, 전송구간 암호화, 로그 모니터링, 민감정보 최소화, 보관기간 관리 등 개인정보 보호를 위한 기술적·관리적 조치를 적용합니다.',
    ],
  },
  {
    title: '8. 쿠키 및 로그',
    body: [
      '회사는 로그인 유지, 보안 점검, 사용성 개선을 위해 쿠키와 접속 로그를 사용할 수 있습니다. 이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있습니다.',
    ],
  },
  {
    title: '9. 개인정보 보호책임자',
    body: [
      '문의 이메일: support@logissign.com',
      '개인정보 관련 문의는 위 연락처로 접수할 수 있으며, 회사는 관련 요청에 지체 없이 대응합니다.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="bg-blue-600 rounded-lg p-1.5">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </span>
            logi<span className="text-blue-400">S</span>Sign
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
            &larr; 홈으로
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">개인정보처리방침</h1>
        <p className="text-sm text-gray-500 mb-10">시행일: 2026년 4월 6일</p>

        <div className="space-y-10 text-[15px] leading-relaxed text-gray-300">
          <section>
            <p>
              로지사인은 개인정보 보호법 등 관련 법령을 준수하며, 이용자의 개인정보를 안전하게 보호하기 위해
              본 개인정보처리방침을 공개합니다. 본 방침은 서비스 운영, 전자계약, 문서 전송, 결제, 본인확인,
              알림 발송 등 현재 제공 중인 기능을 기준으로 작성되었습니다.
            </p>
          </section>

          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-white mb-3">{section.title}</h2>
              <div className="space-y-2">
                {section.body.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-xs text-gray-400 space-y-1 mb-4 leading-relaxed">
            <p>상호: 라이트 | 대표자: 주상하 | 사업자등록번호: 819-16-01461 | 통신판매업신고: 2026-경기시흥-0821</p>
            <p>주소: 경기도 시흥시 목감남서로5, 406호 | 전화: 010-5695-8838 | 이메일: jshmir77@naver.com</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <p>&copy; 2026 logiSSign. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="/terms" className="hover:text-gray-700 transition-colors">이용약관</Link>
              <span className="text-gray-900 font-medium">개인정보처리방침</span>
              <Link href="/refund" className="hover:text-gray-700 transition-colors">환불정책</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
