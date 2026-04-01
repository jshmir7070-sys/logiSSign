import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', gap: 16 }}>
      <h2 style={{ fontSize: 48, fontWeight: 800, color: '#004ac6' }}>404</h2>
      <p style={{ fontSize: 16, color: '#666' }}>페이지를 찾을 수 없습니다</p>
      <Link
        href="/"
        style={{ padding: '10px 24px', borderRadius: 8, background: '#004ac6', color: '#fff', textDecoration: 'none', fontWeight: 600 }}
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
