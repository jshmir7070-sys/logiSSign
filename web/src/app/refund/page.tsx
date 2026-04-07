import Link from 'next/link';
import Image from 'next/image';
import PublicFooter from '@/components/shared/PublicFooter';

export const metadata = {
  title: '환불정책 | logiSSign',
  description: 'logiSSign 서비스 환불 및 교환 정책 안내',
};

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image src="/logo-light.png" alt="logiSSign" width={136} height={28} className="h-7 w-auto object-contain" />
          </Link>
          <Link href="/portal/login" className="text-sm text-gray-500 hover:text-gray-900">로그인</Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">환불 및 교환 정책</h1>
        <p className="text-sm text-gray-400 mb-10">시행일: 2026년 4월 1일</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">1. 환불 가능 조건</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>구독형 플랜: 결제일로부터 <strong>7일 이내</strong> 서비스 미이용 시 전액 환불</li>
              <li>포인트 충전: 충전 후 <strong>미사용 포인트</strong>에 한해 환불 가능</li>
              <li>연간/2년 일시불 결제: 결제일로부터 <strong>14일 이내</strong> 전액 환불, 14일 초과 시 이용 기간 차감 후 잔여분 환불</li>
              <li>서비스 장애로 인한 미이용: 장애 기간에 해당하는 금액 환불 또는 이용 기간 연장</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">2. 환불 불가 조건</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>이미 사용(차감)된 포인트</li>
              <li>계약서 전송, 정산서 생성 등 이미 소비된 서비스</li>
              <li>무료 체험 기간 중 제공된 보너스 포인트</li>
              <li>결제일로부터 7일(월간) / 14일(연간) 경과 후 단순 변심에 의한 환불</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">3. 환불 처리 절차</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>환불 신청: 설정 → 구독/결제 → 환불 요청 또는 이메일(jshmir77@naver.com)로 접수</li>
              <li>환불 심사: 신청일로부터 <strong>3영업일 이내</strong> 환불 가능 여부 안내</li>
              <li>환불 처리: 승인 후 <strong>5~7영업일 이내</strong> 원결제 수단으로 환불</li>
              <li>카드 결제 취소 시 카드사 사정에 따라 최대 <strong>14영업일</strong> 소요될 수 있음</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">4. 플랜 변경 (업그레이드/다운그레이드)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>업그레이드:</strong> 즉시 적용, 기존 플랜 잔여 기간은 일할 계산하여 차감</li>
              <li><strong>다운그레이드:</strong> 현재 결제 기간 종료 후 다음 결제 시점부터 적용</li>
              <li><strong>구독 해지:</strong> 현재 결제 기간 종료까지 서비스 이용 가능, 이후 Free 플랜 전환</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">5. 교환 정책</h2>
            <p>logiSSign은 SaaS(소프트웨어 서비스)로, 물리적 상품의 교환은 해당되지 않습니다. 플랜 변경(업그레이드/다운그레이드)으로 대체됩니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">6. 문의</h2>
            <div className="bg-gray-50 rounded-xl p-5 space-y-1">
              <p><strong>이메일:</strong> jshmir77@naver.com</p>
              <p><strong>전화:</strong> 010-5695-8838</p>
              <p><strong>운영시간:</strong> 평일 09:00 ~ 18:00 (공휴일 제외)</p>
            </div>
          </section>

        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
