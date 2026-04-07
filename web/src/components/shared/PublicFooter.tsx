import Link from 'next/link';
import Image from 'next/image';

/**
 * 공개 페이지 공통 푸터 — PG 심사 필수 사업자 정보 포함
 * 
 * 필수 노출: 상호, 대표자명, 사업자등록번호, 사업장 주소, 대표 유선번호, 이메일
 */
export default function PublicFooter({ dark = false }: { dark?: boolean }) {
  const bg = dark ? 'bg-[#0a0f1e]' : 'bg-gray-50';
  const border = dark ? 'border-white/5' : 'border-gray-200';
  const textMain = dark ? 'text-gray-400' : 'text-gray-500';
  const textSub = dark ? 'text-gray-500' : 'text-gray-400';
  const linkColor = dark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700';

  return (
    <footer className={`${bg} border-t ${border} py-10`}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          {/* 사업자 정보 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Image src="/logo-light.png" alt="logiSSign" width={120} height={24} className="h-6 w-auto object-contain opacity-70" />
            </div>
            <div className={`text-xs ${textMain} space-y-1 leading-relaxed`}>
              <p><strong>상호:</strong> 라이트 &nbsp;|&nbsp; <strong>대표자:</strong> 주상하</p>
              <p><strong>사업자등록번호:</strong> 819-16-01461</p>
              <p><strong>주소:</strong> 경기도 시흥시 목감남서로5, 406호</p>
              <p><strong>전화:</strong> 010-5695-8838 &nbsp;|&nbsp; <strong>이메일:</strong> jshmir77@naver.com</p>
            </div>
          </div>

          {/* 링크 */}
          <div className="flex flex-col gap-4 md:items-end">
            <div className={`flex flex-wrap gap-4 text-xs ${linkColor}`}>
              <Link href="/about" className="transition-colors">서비스 소개</Link>
              <Link href="/pricing" className="transition-colors">요금제</Link>
              <Link href="/terms" className="transition-colors">이용약관</Link>
              <Link href="/privacy" className="transition-colors">개인정보처리방침</Link>
              <Link href="/refund" className="transition-colors">환불정책</Link>
            </div>
            <p className={`text-[11px] ${textSub}`}>&copy; 2026 logiSSign(로지사인). All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
