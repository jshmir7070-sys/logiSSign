'use client';

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {/* ───── Header ───── */}
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="bg-blue-600 rounded-lg p-1.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            </span>
            logi<span className="text-blue-400">S</span>Sign
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">&larr; 홈으로</Link>
        </div>
      </header>

      {/* ───── Content ───── */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">개인정보처리방침</h1>
        <p className="text-sm text-gray-500 mb-10">시행일: 2025년 4월 1일 | 최종 수정일: 2025년 4월 1일</p>

        <div className="space-y-10 text-[15px] leading-relaxed text-gray-300">

          <section>
            <p>
              로지에스사인(이하 &ldquo;회사&rdquo;)은 「개인정보 보호법」 등 관련 법령에 따라 이용자의 개인정보를 보호하고,
              이와 관련된 고충을 신속하게 처리하기 위해 다음과 같이 개인정보처리방침을 수립·공개합니다.
            </p>
          </section>

          {/* 제1조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제1조 (수집하는 개인정보의 항목 및 수집 방법)</h2>

            <h3 className="text-base font-medium text-blue-400 mb-2 mt-4">1. 수집 항목</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-white/10 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-white/5">
                    <th className="px-4 py-3 text-left font-medium text-white border-b border-white/10">구분</th>
                    <th className="px-4 py-3 text-left font-medium text-white border-b border-white/10">수집 항목</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">회원가입 (필수)</td>
                    <td className="px-4 py-3">이메일 주소, 비밀번호(암호화), 대리점명, 대표자명, 사업자등록번호, 연락처(휴대전화번호)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">기사 등록 (필수)</td>
                    <td className="px-4 py-3">기사명, 사번, 연락처(휴대전화번호), 은행명, 계좌번호</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">전자서명 (필수)</td>
                    <td className="px-4 py-3">서명 이미지, 서명 일시, IP 주소, 기기 정보(User-Agent)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">정산 처리 (필수)</td>
                    <td className="px-4 py-3">배송 건수, 단가, 공제 내역, 인센티브, 정산 금액 등 업무 데이터</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">결제 (선택)</td>
                    <td className="px-4 py-3">결제 수단 정보 (PG사를 통해 처리되며, 회사는 카드번호를 직접 저장하지 않습니다)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">자동 수집</td>
                    <td className="px-4 py-3">접속 로그, 접속 IP, 브라우저 종류, 서비스 이용 기록, 쿠키</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-base font-medium text-blue-400 mb-2 mt-6">2. 수집 방법</h3>
            <p>회원가입, 서비스 이용 과정에서 이용자가 직접 입력하거나, 서비스 이용 중 자동으로 생성·수집됩니다.</p>
          </section>

          {/* 제2조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제2조 (개인정보의 수집·이용 목적)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-white/10 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-white/5">
                    <th className="px-4 py-3 text-left font-medium text-white border-b border-white/10">목적</th>
                    <th className="px-4 py-3 text-left font-medium text-white border-b border-white/10">상세 내용</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">서비스 제공</td>
                    <td className="px-4 py-3">정산 자동화, 전자계약 체결·보관, 기사 포털 운영, 교육 이수 관리</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">회원 관리</td>
                    <td className="px-4 py-3">본인 확인, 계정 관리, 부정 이용 방지, 서비스 이용 안내</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">요금 결제</td>
                    <td className="px-4 py-3">유료 서비스 이용에 따른 요금 청구 및 정산</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">고객 지원</td>
                    <td className="px-4 py-3">문의 응대, 불만 처리, 서비스 관련 공지사항 전달</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">서비스 개선</td>
                    <td className="px-4 py-3">이용 통계 분석, 신규 기능 개발, 서비스 품질 향상</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">법적 의무 이행</td>
                    <td className="px-4 py-3">전자서명 관련 법적 기록 보존, 세금 관련 증빙</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 제3조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제3조 (개인정보의 보유 및 이용 기간)</h2>
            <p className="mb-4">회사는 원칙적으로 개인정보 수집·이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 다만, 관련 법령에 따라 보존할 필요가 있는 경우 아래와 같이 보관합니다.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-white/10 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-white/5">
                    <th className="px-4 py-3 text-left font-medium text-white border-b border-white/10">보존 항목</th>
                    <th className="px-4 py-3 text-left font-medium text-white border-b border-white/10">보존 기간</th>
                    <th className="px-4 py-3 text-left font-medium text-white border-b border-white/10">근거 법령</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="px-4 py-3">계약 또는 청약철회 등에 관한 기록</td>
                    <td className="px-4 py-3 text-gray-400">5년</td>
                    <td className="px-4 py-3 text-gray-400">전자상거래법</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">대금결제 및 재화 등의 공급에 관한 기록</td>
                    <td className="px-4 py-3 text-gray-400">5년</td>
                    <td className="px-4 py-3 text-gray-400">전자상거래법</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">소비자 불만 또는 분쟁 처리에 관한 기록</td>
                    <td className="px-4 py-3 text-gray-400">3년</td>
                    <td className="px-4 py-3 text-gray-400">전자상거래법</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">로그인 기록</td>
                    <td className="px-4 py-3 text-gray-400">3개월</td>
                    <td className="px-4 py-3 text-gray-400">통신비밀보호법</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">전자서명 기록 (서명 이미지, 인증 정보)</td>
                    <td className="px-4 py-3 text-gray-400">10년</td>
                    <td className="px-4 py-3 text-gray-400">전자서명법</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 제4조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제4조 (개인정보의 제3자 제공)</h2>
            <p className="mb-3">회사는 원칙적으로 이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다.</p>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령에 의거하거나, 수사·조사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
              <li>서비스 제공을 위해 필요한 경우로서 아래 위탁 업체에 한정
                <ul className="list-disc list-inside pl-5 mt-1 space-y-1 text-gray-400">
                  <li>결제 처리: PG사 (카드번호 등 결제 정보는 PG사에서 직접 처리)</li>
                  <li>문자(SMS) 발송: 솔라피(Solapi)</li>
                  <li>클라우드 인프라: Supabase (데이터베이스 호스팅)</li>
                </ul>
              </li>
            </ol>
          </section>

          {/* 제5조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제5조 (개인정보처리의 위탁)</h2>
            <p className="mb-4">회사는 서비스 운영을 위해 아래와 같이 개인정보 처리 업무를 위탁하고 있습니다.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-white/10 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-white/5">
                    <th className="px-4 py-3 text-left font-medium text-white border-b border-white/10">수탁자</th>
                    <th className="px-4 py-3 text-left font-medium text-white border-b border-white/10">위탁 업무</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="px-4 py-3">Supabase Inc.</td>
                    <td className="px-4 py-3">데이터베이스 호스팅 및 인증 서비스</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Vercel Inc.</td>
                    <td className="px-4 py-3">웹 애플리케이션 호스팅</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">솔라피(Solapi)</td>
                    <td className="px-4 py-3">SMS/알림톡 발송</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 제6조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제6조 (개인정보의 파기 절차 및 방법)</h2>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li><strong className="text-white">파기 절차</strong>: 이용 목적이 달성된 개인정보는 별도의 DB로 옮겨져 내부 방침 및 관련 법령에 따라 일정 기간 보관 후 파기됩니다.</li>
              <li><strong className="text-white">파기 방법</strong>: 전자적 파일 형태는 복원이 불가능한 방법으로 영구 삭제하며, 종이에 출력된 개인정보는 분쇄 또는 소각합니다.</li>
            </ol>
          </section>

          {/* 제7조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제7조 (이용자 및 법정대리인의 권리와 행사 방법)</h2>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li>이용자는 언제든지 자신의 개인정보에 대해 열람, 수정, 삭제, 처리정지를 요청할 수 있습니다.</li>
              <li>위 요청은 서비스 내 설정 메뉴 또는 고객센터(이메일: support@logissign.com)를 통해 할 수 있으며, 회사는 지체 없이 조치합니다.</li>
              <li>이용자가 개인정보의 오류에 대한 정정을 요청한 경우, 정정이 완료될 때까지 해당 정보를 이용하거나 제공하지 않습니다.</li>
              <li>만 14세 미만 아동의 개인정보는 수집하지 않습니다.</li>
            </ol>
          </section>

          {/* 제8조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제8조 (개인정보의 안전성 확보 조치)</h2>
            <p className="mb-3">회사는 이용자의 개인정보를 안전하게 관리하기 위해 다음과 같은 조치를 취하고 있습니다.</p>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li><strong className="text-white">암호화</strong>: 비밀번호는 단방향 암호화(bcrypt)하여 저장하며, 전송 구간은 SSL/TLS로 암호화합니다.</li>
              <li><strong className="text-white">접근 통제</strong>: 개인정보에 대한 접근 권한을 최소한의 인원으로 제한하고, 접근 기록을 관리합니다.</li>
              <li><strong className="text-white">보안 프로그램</strong>: 해킹이나 악성코드 등에 대비한 보안 시스템을 운영합니다.</li>
              <li><strong className="text-white">Row Level Security</strong>: 데이터베이스 수준에서 이용자별 데이터 접근을 분리합니다.</li>
              <li><strong className="text-white">정기 점검</strong>: 개인정보 취급 관련 시스템을 정기적으로 점검합니다.</li>
            </ol>
          </section>

          {/* 제9조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제9조 (쿠키의 운영 및 거부)</h2>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li>회사는 이용자의 편의를 위해 쿠키를 사용합니다. 쿠키는 로그인 상태 유지, 서비스 이용 환경 설정 등의 목적으로 사용됩니다.</li>
              <li>이용자는 웹 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으며, 이 경우 일부 서비스 이용에 제한이 있을 수 있습니다.</li>
            </ol>
          </section>

          {/* 제10조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제10조 (개인정보 보호책임자)</h2>
            <p className="mb-3">회사는 개인정보 처리에 관한 업무를 총괄하는 개인정보 보호책임자를 다음과 같이 지정합니다.</p>
            <div className="bg-white/5 rounded-xl p-5 space-y-2">
              <p><strong className="text-white">개인정보 보호책임자</strong></p>
              <p>성명: 정상하</p>
              <p>직위: 대표</p>
              <p>연락처: support@logissign.com</p>
            </div>
            <p className="mt-4 text-gray-400">
              이용자는 서비스 이용 중 발생하는 모든 개인정보 보호 관련 문의, 불만, 피해 구제 등을 개인정보 보호책임자에게 신고할 수 있습니다.
            </p>
          </section>

          {/* 제11조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제11조 (권익 침해 구제 방법)</h2>
            <p className="mb-3">개인정보 침해에 대한 피해 구제 및 상담은 아래 기관에 문의하실 수 있습니다.</p>
            <div className="space-y-3">
              <div className="bg-white/5 rounded-xl p-4">
                <p className="font-medium text-white">개인정보 침해신고센터 (한국인터넷진흥원)</p>
                <p className="text-gray-400 text-sm mt-1">전화: (국번없이) 118 | 웹사이트: privacy.kisa.or.kr</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="font-medium text-white">개인정보 분쟁조정위원회</p>
                <p className="text-gray-400 text-sm mt-1">전화: (국번없이) 1833-6972 | 웹사이트: www.kopico.go.kr</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="font-medium text-white">대검찰청 사이버수사과</p>
                <p className="text-gray-400 text-sm mt-1">전화: (국번없이) 1301 | 웹사이트: www.spo.go.kr</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="font-medium text-white">경찰청 사이버수사국</p>
                <p className="text-gray-400 text-sm mt-1">전화: (국번없이) 182 | 웹사이트: ecrm.police.go.kr</p>
              </div>
            </div>
          </section>

          {/* 부칙 */}
          <section className="border-t border-white/10 pt-8">
            <h2 className="text-xl font-semibold text-white mb-3">부칙</h2>
            <p>본 개인정보처리방침은 2025년 4월 1일부터 시행합니다.</p>
          </section>

        </div>
      </main>

      {/* ───── Footer ───── */}
      <footer className="border-t border-white/10 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>&copy; 2025 logiSSign. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-gray-300 transition-colors">이용약관</Link>
            <span className="text-white font-medium">개인정보처리방침</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
