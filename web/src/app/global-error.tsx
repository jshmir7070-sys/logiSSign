'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', gap: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>오류가 발생했습니다</h2>
          <p style={{ fontSize: 14, color: '#666' }}>{error.message || '알 수 없는 오류'}</p>
          <button
            onClick={reset}
            style={{ padding: '10px 24px', borderRadius: 8, background: '#004ac6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
