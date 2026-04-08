import Link from 'next/link';

export default function LibraryRedirectPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">내 문서함 안내</h1>
        <p className="mt-2 text-sm text-on-surface-variant font-korean">
          자료실 메뉴는 저장한 계약 서류와 템플릿 작업 결과를 한곳에서 관리하는 내 문서함으로 통합되었습니다.
        </p>
      </div>

      <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
        <h2 className="text-base font-headline font-bold text-on-surface font-korean">여기에서 할 수 있는 일</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-on-surface font-korean">저장된 문서 모아보기</p>
            <p className="mt-1 text-xs text-on-surface-variant font-korean">
              템플릿 만들기에서 저장한 계약 서류를 파일 형태로 보고, 미리보기와 편집을 이어갈 수 있습니다.
            </p>
          </div>
          <div className="rounded-xl bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-on-surface font-korean">전송 가능한 문서만 선택</p>
            <p className="mt-1 text-xs text-on-surface-variant font-korean">
              저장 완료된 문서만 문서/서류 전송 화면에서 선택할 수 있어 유령 문서가 섞이지 않습니다.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/portal/documents"
            className="inline-flex h-11 items-center rounded-xl bg-power-gradient px-5 text-sm font-semibold text-white font-korean"
          >
            내 문서함 열기
          </Link>
          <Link
            href="/portal/contracts/templates"
            className="inline-flex h-11 items-center rounded-xl border border-outline-variant/20 px-5 text-sm text-on-surface font-korean"
          >
            템플릿 만들기 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
