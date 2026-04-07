'use client';

import Link from 'next/link';

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold mb-2">이용약관</h1>
        <p className="text-sm text-gray-500 mb-10">시행일: 2025년 4월 1일 | 최종 수정일: 2025년 4월 1일</p>

        <div className="space-y-10 text-[15px] leading-relaxed text-gray-300">

          {/* 제1조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제1조 (목적)</h2>
            <p>
              이 약관은 로지에스사인(이하 &ldquo;회사&rdquo;)이 운영하는 택배 대리점 정산·전자계약 자동화 플랫폼 logiSSign(이하 &ldquo;서비스&rdquo;)의
              이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          {/* 제2조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제2조 (정의)</h2>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li>&ldquo;서비스&rdquo;란 회사가 제공하는 웹·모바일 기반의 택배 대리점 정산 자동화, 전자계약, 교육 관리 등 일체의 서비스를 의미합니다.</li>
              <li>&ldquo;이용자&rdquo;란 본 약관에 따라 회사와 이용계약을 체결하고, 회사가 제공하는 서비스를 이용하는 자를 말합니다.</li>
              <li>&ldquo;대리점&rdquo;이란 택배·배송 사업을 영위하며 본 서비스를 통해 기사와의 정산 및 계약을 관리하는 사업자를 의미합니다.</li>
              <li>&ldquo;기사&rdquo;란 대리점에 소속되어 배송 업무를 수행하고, 본 서비스를 통해 정산 내역 확인 및 전자서명을 수행하는 자를 말합니다.</li>
              <li>&ldquo;계정&rdquo;이란 이용자의 식별과 서비스 이용을 위해 이용자가 등록한 이메일, 비밀번호 등의 정보를 말합니다.</li>
            </ol>
          </section>

          {/* 제3조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제3조 (약관의 효력 및 변경)</h2>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li>본 약관은 서비스 화면에 게시하거나 기타 방법으로 이용자에게 공지함으로써 효력을 발생합니다.</li>
              <li>회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며, 개정 시 적용일자 및 개정사유를 명시하여 현행 약관과 함께 서비스 내 공지사항에 최소 7일 전 게시합니다.</li>
              <li>이용자가 개정약관의 적용에 동의하지 않는 경우, 이용계약을 해지할 수 있습니다. 공지 후 7일 이내에 이의를 제기하지 않은 경우 동의한 것으로 간주합니다.</li>
            </ol>
          </section>

          {/* 제4조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제4조 (이용계약의 체결)</h2>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li>이용계약은 이용자가 약관의 내용에 동의한 후 회원가입 신청을 하고, 회사가 이를 승낙함으로써 체결됩니다.</li>
              <li>회사는 다음 각 호에 해당하는 경우 이용신청을 승낙하지 않을 수 있습니다.
                <ul className="list-disc list-inside pl-5 mt-1 space-y-1 text-gray-400">
                  <li>타인의 명의를 이용한 경우</li>
                  <li>허위 정보를 기재한 경우</li>
                  <li>기술적으로 서비스 제공이 불가능한 경우</li>
                  <li>기타 회사가 정한 이용신청 요건을 충족하지 못한 경우</li>
                </ul>
              </li>
            </ol>
          </section>

          {/* 제5조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제5조 (서비스의 내용)</h2>
            <p className="mb-3">회사는 다음과 같은 서비스를 제공합니다.</p>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li><strong className="text-white">정산 자동화</strong>: 운송사 엑셀 데이터 업로드를 통한 기사별 정산 자동 계산, 공제·인센티브 관리</li>
              <li><strong className="text-white">전자계약</strong>: 위수탁계약서, 근로계약서 등의 전자서명 및 계약 관리</li>
              <li><strong className="text-white">기사 포털</strong>: 기사 본인의 정산 내역 조회, 계약서 확인 및 서명</li>
              <li><strong className="text-white">교육 관리</strong>: 안전교육 등 법정 교육 이수 현황 관리</li>
              <li><strong className="text-white">관리자 대시보드</strong>: 대리점 운영 현황 통합 관리</li>
              <li>기타 회사가 추가 개발하여 제공하는 서비스</li>
            </ol>
          </section>

          {/* 제6조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제6조 (서비스의 이용)</h2>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li>서비스는 연중무휴 24시간 제공을 원칙으로 합니다. 다만, 시스템 점검·교체 및 고장, 통신 장애, 천재지변 등 불가항력적 사유가 발생한 경우 서비스 제공을 일시 중단할 수 있습니다.</li>
              <li>회사는 서비스 개선을 위해 사전 공지 후 서비스의 전부 또는 일부를 변경할 수 있습니다.</li>
              <li>무료 체험 기간(14일)이 종료된 후에는 유료 요금제에 가입해야 서비스를 계속 이용할 수 있습니다.</li>
            </ol>
          </section>

          {/* 제7조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제7조 (요금 및 결제)</h2>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li>서비스 이용 요금은 서비스 내 요금제 페이지에 게시된 바에 따릅니다.</li>
              <li>회사는 요금을 변경할 수 있으며, 변경 시 최소 30일 전 이용자에게 공지합니다.</li>
              <li>이용자가 결제한 요금에 대한 환불은 회사의 환불 정책에 따릅니다.</li>
              <li>결제일에 결제가 이루어지지 않을 경우, 회사는 서비스 이용을 제한할 수 있습니다.</li>
            </ol>
          </section>

          {/* 제8조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제8조 (이용자의 의무)</h2>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li>이용자는 관계 법령, 본 약관의 규정, 이용안내 및 서비스와 관련하여 공지한 사항을 준수하여야 합니다.</li>
              <li>이용자는 다음 행위를 하여서는 안 됩니다.
                <ul className="list-disc list-inside pl-5 mt-1 space-y-1 text-gray-400">
                  <li>타인의 정보를 도용하거나 허위 정보를 등록하는 행위</li>
                  <li>서비스를 이용하여 얻은 정보를 회사의 동의 없이 영리 목적으로 이용하거나 제3자에게 제공하는 행위</li>
                  <li>서비스의 운영을 방해하거나 안정성을 해치는 행위</li>
                  <li>회사의 지식재산권을 침해하는 행위</li>
                  <li>기타 관련 법령에 위반되는 행위</li>
                </ul>
              </li>
              <li>이용자는 자신의 계정 및 비밀번호를 안전하게 관리해야 하며, 이를 제3자에게 양도하거나 대여할 수 없습니다.</li>
            </ol>
          </section>

          {/* 제9조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제9조 (회사의 의무)</h2>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li>회사는 관련 법령과 본 약관이 금지하는 행위를 하지 않으며, 안정적인 서비스 제공을 위해 최선을 다합니다.</li>
              <li>회사는 이용자의 개인정보를 보호하기 위해 개인정보처리방침을 수립하고 이를 준수합니다.</li>
              <li>회사는 서비스 장애 발생 시 신속하게 복구하기 위해 노력합니다.</li>
            </ol>
          </section>

          {/* 제10조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제10조 (전자서명의 효력)</h2>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li>본 서비스를 통해 수행된 전자서명은 「전자서명법」에 따른 전자서명으로서, 서명자의 의사표시로 인정됩니다.</li>
              <li>이용자는 전자서명 전 계약서 내용을 충분히 확인할 의무가 있으며, 서명 완료 후 계약 내용에 대한 이의를 제기하기 어려울 수 있습니다.</li>
              <li>전자서명된 계약서는 PDF 형태로 보관되며, 서명 일시·IP 주소 등 인증 정보가 함께 기록됩니다.</li>
            </ol>
          </section>

          {/* 제11조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제11조 (데이터의 관리)</h2>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li>이용자가 서비스에 업로드한 정산 데이터, 계약서, 기사 정보 등의 데이터에 대한 소유권은 이용자에게 있습니다.</li>
              <li>회사는 서비스 제공 및 개선 목적 외에는 이용자의 데이터를 이용하지 않습니다.</li>
              <li>이용계약 해지 시 이용자의 데이터는 관련 법령에 따른 보존 기간이 경과한 후 파기합니다.</li>
            </ol>
          </section>

          {/* 제12조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제12조 (계약 해지 및 이용 제한)</h2>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li>이용자는 언제든지 서비스 내 설정 메뉴를 통해 이용계약의 해지를 신청할 수 있습니다.</li>
              <li>회사는 이용자가 본 약관을 위반한 경우 사전 통지 후 서비스 이용을 제한하거나 이용계약을 해지할 수 있습니다.</li>
              <li>해지 시 환불은 잔여 이용 기간에 비례하여 산정하며, 이미 경과한 기간에 대한 요금은 환불하지 않습니다.</li>
            </ol>
          </section>

          {/* 제13조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제13조 (면책사항)</h2>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li>회사는 천재지변, 전쟁, 테러, 정부 규제, 통신 장애 등 불가항력으로 인해 서비스를 제공할 수 없는 경우 책임을 지지 않습니다.</li>
              <li>회사는 이용자의 귀책사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.</li>
              <li>회사는 이용자가 서비스에 입력한 데이터의 정확성에 대해 보증하지 않으며, 정산 결과의 최종 확인 책임은 이용자에게 있습니다.</li>
            </ol>
          </section>

          {/* 제14조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제14조 (손해배상)</h2>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li>회사 또는 이용자가 본 약관을 위반하여 상대방에게 손해를 입힌 경우, 귀책사유가 있는 당사자가 배상 책임을 집니다.</li>
              <li>회사의 손해배상 범위는 이용자가 납부한 최근 3개월간의 서비스 이용 요금을 한도로 합니다.</li>
            </ol>
          </section>

          {/* 제15조 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제15조 (분쟁 해결)</h2>
            <ol className="list-decimal list-inside space-y-2 pl-1">
              <li>본 약관과 관련된 분쟁은 대한민국 법률에 따라 해석하고, 관할 법원은 회사 본점 소재지를 관할하는 법원으로 합니다.</li>
              <li>회사와 이용자 간 분쟁이 발생한 경우, 양 당사자는 원만한 해결을 위해 성실히 협의합니다.</li>
            </ol>
          </section>

          {/* 부칙 */}
          <section className="border-t border-white/10 pt-8">
            <h2 className="text-xl font-semibold text-white mb-3">부칙</h2>
            <p>본 약관은 2025년 4월 1일부터 시행합니다.</p>
          </section>

        </div>
      </main>

      {/* ───── Footer ───── */}
      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-xs text-gray-400 space-y-1 mb-4 leading-relaxed">
            <p>상호: 라이트 | 대표자: 주상하 | 사업자등록번호: 819-16-01461</p>
            <p>주소: 경기도 시흥시 목감남서로5, 406호 | 전화: 010-5695-8838 | 이메일: jshmir77@naver.com</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <p>&copy; 2026 logiSSign. All rights reserved.</p>
            <div className="flex gap-6">
              <span className="text-gray-900 font-medium">이용약관</span>
              <Link href="/privacy" className="hover:text-gray-700 transition-colors">개인정보처리방침</Link>
              <Link href="/refund" className="hover:text-gray-700 transition-colors">환불정책</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
