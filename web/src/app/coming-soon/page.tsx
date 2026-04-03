'use client';

export default function ComingSoonPage() {
  return (
    <div className="coming-soon-page">
      {/* Animated Background */}
      <div className="bg-canvas">
        <div className="grid-overlay" />
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <div className="glow glow-3" />
        <div className="noise-overlay" />
      </div>

      {/* Content */}
      <main className="content">
        {/* Top Badge */}
        <div className="badge fade-in" style={{ animationDelay: '0.2s' }}>
          <span className="badge-dot" />
          <span>logiSSign 서비스 준비 중</span>
        </div>

        {/* Logo */}
        <div className="logo-section fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="logo-icon">
            <img src="/logo.png" alt="logiSSign" style={{ height: 64 }} />
          </div>
        </div>

        {/* Headline */}
        <div className="headline-section">
          <h2 className="headline fade-in" style={{ animationDelay: '0.6s' }}>
            택배 대리점 정산·계약
            <br />
            <span className="headline-accent">자동화 플랫폼</span>
          </h2>
          <p className="subheadline fade-in" style={{ animationDelay: '0.8s' }}>
            엑셀 업로드 → 자동 정산 · 전자계약서 · 기사 전용 앱
            <br />
            라스트마일 배송 대리점의 전산을 혁신합니다
          </p>
        </div>

        {/* Feature Cards */}
        <div className="features fade-in" style={{ animationDelay: '1.0s' }}>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>자동 정산</h3>
            <p>운송사 엑셀 그대로 업로드<br />사번 매칭 → 단가 자동 계산</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>전자 계약</h3>
            <p>위수탁 표준계약서 자동 발송<br />본인인증 + 전자서명</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3>기사 앱</h3>
            <p>정산서 확인 · 계약서 서명<br />공지사항 · 법정교육 이수</p>
          </div>
        </div>

        {/* CTA */}
        <div className="cta-section fade-in" style={{ animationDelay: '1.2s' }}>
          <p className="cta-label">사전 예약 등록</p>
          <form className="cta-form" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="이메일 주소 입력"
              className="cta-input"
              required
            />
            <button type="submit" className="cta-button">
              알림 받기
            </button>
          </form>
          <p className="cta-hint">출시 시 가장 먼저 알려드립니다 · 무료 체험 포함</p>
        </div>

        {/* Launch Date */}
        <div className="launch-date fade-in" style={{ animationDelay: '1.4s' }}>
          <div className="launch-label">출시 예정</div>
          <div className="launch-tiles">
            <div className="tile">
              <span className="tile-num">2026</span>
              <span className="tile-label">YEAR</span>
            </div>
            <div className="tile-sep">·</div>
            <div className="tile">
              <span className="tile-num">Q2</span>
              <span className="tile-label">QUARTER</span>
            </div>
          </div>
        </div>

        {/* Pricing Preview */}
        <div className="pricing-preview fade-in" style={{ animationDelay: '1.6s' }}>
          <div className="price-card">
            <span className="price-name">Free</span>
            <span className="price-val">₩0</span>
            <span className="price-desc">10명 이하 · 정산만</span>
          </div>
          <div className="price-card price-popular">
            <span className="price-badge">추천</span>
            <span className="price-name">Basic</span>
            <span className="price-val">₩49,900</span>
            <span className="price-desc">50명 · 전체 기능</span>
          </div>
          <div className="price-card">
            <span className="price-name">Standard</span>
            <span className="price-val">₩99,000</span>
            <span className="price-desc">100명 · 리포트 포함</span>
          </div>
        </div>

        {/* Footer */}
        <footer className="footer fade-in" style={{ animationDelay: '1.8s' }}>
          <p>© 2026 logiSSign(로지싸인). All rights reserved.</p>
          <p className="footer-links">
            <a href="/portal/login">대리점 포털</a>
            <span>·</span>
            <a href="/admin/login">관리자</a>
          </p>
        </footer>
      </main>

      <style>{`
        .coming-soon-page {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #e2e8f0;
        }

        /* ── Background ── */
        .bg-canvas {
          position: fixed;
          inset: 0;
          background: #030712;
          z-index: 0;
        }
        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.4;
          animation: float 20s ease-in-out infinite;
        }
        .glow-1 {
          width: 600px; height: 600px;
          top: -200px; left: -100px;
          background: #004ac6;
          animation-delay: 0s;
        }
        .glow-2 {
          width: 500px; height: 500px;
          bottom: -150px; right: -100px;
          background: #2563eb;
          animation-delay: -7s;
        }
        .glow-3 {
          width: 300px; height: 300px;
          top: 40%; left: 60%;
          background: #007d55;
          opacity: 0.2;
          animation-delay: -14s;
        }
        .noise-overlay {
          position: absolute;
          inset: 0;
          opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
        }

        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }

        /* ── Content ── */
        .content {
          position: relative;
          z-index: 1;
          max-width: 800px;
          margin: 0 auto;
          padding: 60px 24px 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 48px;
        }

        /* ── Animations ── */
        .fade-in {
          opacity: 0;
          transform: translateY(24px);
          animation: fadeUp 0.8s ease-out forwards;
        }
        @keyframes fadeUp {
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Badge ── */
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 13px;
          font-weight: 500;
          color: #94a3b8;
          letter-spacing: 0.5px;
        }
        .badge-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #f59e0b;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        /* ── Logo ── */
        .logo-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .logo-text {
          font-size: 36px;
          font-weight: 800;
          letter-spacing: -1px;
          color: white;
        }
        .logo-highlight {
          background: linear-gradient(135deg, #60a5fa, #2563eb);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        /* ── Headline ── */
        .headline-section { text-align: center; }
        .headline {
          font-size: 42px;
          font-weight: 800;
          line-height: 1.2;
          letter-spacing: -1.5px;
          color: white;
        }
        .headline-accent {
          background: linear-gradient(135deg, #004ac6, #60a5fa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .subheadline {
          margin-top: 20px;
          font-size: 16px;
          line-height: 1.7;
          color: #94a3b8;
        }

        /* ── Features ── */
        .features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          width: 100%;
        }
        .feature-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 28px 20px;
          text-align: center;
          transition: all 0.3s;
        }
        .feature-card:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(0,74,198,0.3);
          transform: translateY(-4px);
        }
        .feature-icon { font-size: 32px; margin-bottom: 12px; }
        .feature-card h3 {
          font-size: 16px;
          font-weight: 700;
          color: white;
          margin-bottom: 8px;
        }
        .feature-card p {
          font-size: 13px;
          line-height: 1.6;
          color: #64748b;
        }

        /* ── CTA ── */
        .cta-section {
          text-align: center;
          width: 100%;
          max-width: 480px;
        }
        .cta-label {
          font-size: 13px;
          font-weight: 600;
          color: #60a5fa;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 16px;
        }
        .cta-form {
          display: flex;
          gap: 8px;
        }
        .cta-input {
          flex: 1;
          height: 52px;
          padding: 0 20px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: white;
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s;
        }
        .cta-input::placeholder { color: #475569; }
        .cta-input:focus {
          border-color: #004ac6;
          background: rgba(0,74,198,0.08);
        }
        .cta-button {
          height: 52px;
          padding: 0 28px;
          border-radius: 14px;
          background: linear-gradient(135deg, #004ac6, #2563eb);
          color: white;
          font-size: 15px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0,74,198,0.4);
        }
        .cta-hint {
          margin-top: 12px;
          font-size: 12px;
          color: #475569;
        }

        /* ── Launch Date ── */
        .launch-date { text-align: center; }
        .launch-label {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 3px;
          margin-bottom: 12px;
        }
        .launch-tiles {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .tile {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .tile-num {
          font-size: 28px;
          font-weight: 800;
          color: white;
          font-variant-numeric: tabular-nums;
        }
        .tile-label {
          font-size: 9px;
          font-weight: 600;
          color: #475569;
          letter-spacing: 2px;
        }
        .tile-sep {
          font-size: 24px;
          color: #334155;
          margin-top: -12px;
        }

        /* ── Pricing ── */
        .pricing-preview {
          display: flex;
          gap: 12px;
          width: 100%;
        }
        .price-card {
          flex: 1;
          position: relative;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 20px 16px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .price-popular {
          border-color: rgba(0,74,198,0.4);
          background: rgba(0,74,198,0.06);
        }
        .price-badge {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          padding: 2px 12px;
          border-radius: 999px;
          background: linear-gradient(135deg, #004ac6, #2563eb);
          color: white;
          font-size: 10px;
          font-weight: 700;
        }
        .price-name {
          font-size: 13px;
          font-weight: 700;
          color: #94a3b8;
        }
        .price-val {
          font-size: 22px;
          font-weight: 800;
          color: white;
          font-variant-numeric: tabular-nums;
        }
        .price-desc {
          font-size: 11px;
          color: #475569;
        }

        /* ── Footer ── */
        .footer {
          text-align: center;
          font-size: 12px;
          color: #334155;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.04);
          width: 100%;
        }
        .footer-links {
          margin-top: 8px;
          display: flex;
          justify-content: center;
          gap: 12px;
        }
        .footer-links a {
          color: #475569;
          text-decoration: none;
          transition: color 0.2s;
        }
        .footer-links a:hover { color: #60a5fa; }

        /* ── Mobile ── */
        @media (max-width: 640px) {
          .content { padding: 40px 20px 32px; gap: 36px; }
          .headline { font-size: 28px; }
          .subheadline { font-size: 14px; }
          .features { grid-template-columns: 1fr; }
          .cta-form { flex-direction: column; }
          .pricing-preview { flex-direction: column; }
          .logo-text { font-size: 28px; }
        }
      `}</style>
    </div>
  );
}
