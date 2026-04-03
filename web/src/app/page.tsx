'use client';

import { useState } from 'react';
import Link from 'next/link';

const MAX_BETA_SLOTS = 5;

export default function HomePage() {
  const [form, setForm] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    driverCount: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/beta-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '신청 실패');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '신청 중 오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="landing-page">
      {/* Background */}
      <div className="bg-canvas">
        <div className="grid-overlay" />
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <div className="glow glow-3" />
      </div>

      <main className="content">
        {/* Nav */}
        <nav className="nav fade-in">
          <div className="nav-brand">
            <img src="/logo.png" alt="logiSSign" className="nav-logo" />
          </div>
          <div className="nav-links">
            <Link href="/guide" className="nav-link">사용 가이드</Link>
            <Link href="/about" className="nav-link">서비스 소개</Link>
            <Link href="/portal/login" className="nav-link">로그인</Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="hero">
          <div className="badge fade-in" style={{ animationDelay: '0.2s' }}>
            <span className="badge-dot" />
            <span>🎉 베타 테스트 업체 모집 중 · {MAX_BETA_SLOTS}개 한정</span>
          </div>

          <div className="logo-section fade-in" style={{ animationDelay: '0.3s' }}>
            <img src="/logo.png" alt="logiSSign" className="hero-logo" />
          </div>

          <h1 className="headline fade-in" style={{ animationDelay: '0.4s' }}>
            택배 대리점 정산·계약
            <br />
            <span className="headline-accent">자동화 플랫폼</span>
          </h1>
          <p className="subheadline fade-in" style={{ animationDelay: '0.6s' }}>
            엑셀 업로드 → 자동 정산 · 전자계약서 · 기사 전용 앱
            <br />
            라스트마일 배송 대리점의 전산을 혁신합니다
          </p>
        </section>

        {/* Features */}
        <div className="features fade-in" style={{ animationDelay: '0.7s' }}>
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

        {/* Beta Apply */}
        <section className="beta-section fade-in" style={{ animationDelay: '0.9s' }} id="beta-apply">
          <div className="beta-header">
            <div className="beta-badge">1달 무료 · {MAX_BETA_SLOTS}개 업체 한정 · 기사 20명 미만</div>
            <h2 className="beta-title">베타 테스트 신청</h2>
            <p className="beta-desc">
              logiSSign의 모든 기능을 <strong>1달간 무료</strong>로 체험하세요.
              <br />기사 20명 미만 대리점 대상, 선착순 {MAX_BETA_SLOTS}개 업체에게
              <br />Enterprise 플랜 전 기능을 무료 제공합니다.
            </p>
          </div>

          {submitted ? (
            <div className="beta-success">
              <div className="success-icon">✅</div>
              <h3>신청이 완료되었습니다!</h3>
              <p>담당자가 확인 후 1~2 영업일 이내 연락드리겠습니다.</p>
            </div>
          ) : (
            <form className="beta-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>업체명 <span className="required">*</span></label>
                  <input
                    type="text"
                    placeholder="대리점/물류사 이름"
                    value={form.companyName}
                    onChange={e => updateField('companyName', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>담당자명 <span className="required">*</span></label>
                  <input
                    type="text"
                    placeholder="이름"
                    value={form.contactName}
                    onChange={e => updateField('contactName', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>이메일 <span className="required">*</span></label>
                  <input
                    type="email"
                    placeholder="example@company.com"
                    value={form.email}
                    onChange={e => updateField('email', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>연락처 <span className="required">*</span></label>
                  <input
                    type="tel"
                    placeholder="010-0000-0000"
                    value={form.phone}
                    onChange={e => updateField('phone', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>소속 기사 수 (20명 미만)</label>
                  <input
                    type="text"
                    placeholder="예: 15명"
                    value={form.driverCount}
                    onChange={e => updateField('driverCount', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>문의사항</label>
                  <input
                    type="text"
                    placeholder="궁금하신 점이 있으면 입력해주세요"
                    value={form.message}
                    onChange={e => updateField('message', e.target.value)}
                  />
                </div>
              </div>

              {error && <div className="form-error">{error}</div>}

              <button type="submit" className="submit-btn" disabled={submitting}>
                {submitting ? '신청 중...' : '🚀 베타 테스트 신청하기'}
              </button>

              <p className="form-hint">
                신청 정보는 베타 테스트 안내 목적으로만 사용됩니다.
              </p>
            </form>
          )}
        </section>

        {/* Pricing Preview */}
        <div className="pricing-preview fade-in" style={{ animationDelay: '1.1s' }}>
          <h3 className="pricing-title">정식 출시 요금제</h3>
          <div className="price-cards">
            <div className="price-card">
              <span className="price-name">무료</span>
              <span className="price-val">₩0</span>
              <span className="price-desc">10명 이하</span>
            </div>
            <div className="price-card">
              <span className="price-name">Basic</span>
              <span className="price-val">₩49,900</span>
              <span className="price-desc">30명</span>
            </div>
            <div className="price-card price-popular">
              <span className="price-badge-tag">추천</span>
              <span className="price-name">Standard</span>
              <span className="price-val">₩99,000</span>
              <span className="price-desc">80명</span>
            </div>
            <div className="price-card">
              <span className="price-name">Pro</span>
              <span className="price-val">₩199,000</span>
              <span className="price-desc">150명</span>
            </div>
            <div className="price-card">
              <span className="price-name">Enterprise</span>
              <span className="price-val">별도 문의</span>
              <span className="price-desc">150명 이상</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="footer fade-in" style={{ animationDelay: '1.3s' }}>
          <p>© 2026 logiSSign(로지사인). All rights reserved.</p>
          <p className="footer-links">
            <Link href="/terms">이용약관</Link>
            <span>·</span>
            <Link href="/privacy">개인정보처리방침</Link>
            <span>·</span>
            <Link href="/about">서비스 소개</Link>
          </p>
        </footer>
      </main>

      <style>{`
        .landing-page { min-height:100vh; position:relative; overflow-x:hidden; font-family:'Pretendard',-apple-system,BlinkMacSystemFont,sans-serif; color:#e2e8f0; }
        .bg-canvas { position:fixed; inset:0; background:#030712; z-index:0; }
        .grid-overlay { position:absolute; inset:0; background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px); background-size:60px 60px; }
        .glow { position:absolute; border-radius:50%; filter:blur(120px); opacity:0.4; animation:float 20s ease-in-out infinite; }
        .glow-1 { width:600px; height:600px; top:-200px; left:-100px; background:#004ac6; }
        .glow-2 { width:500px; height:500px; bottom:-150px; right:-100px; background:#2563eb; animation-delay:-7s; }
        .glow-3 { width:300px; height:300px; top:40%; left:60%; background:#007d55; opacity:0.2; animation-delay:-14s; }
        @keyframes float { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(30px,-30px) scale(1.05)} 66%{transform:translate(-20px,20px) scale(0.95)} }
        .content { position:relative; z-index:1; max-width:900px; margin:0 auto; padding:0 24px 40px; display:flex; flex-direction:column; align-items:center; gap:56px; }
        .fade-in { opacity:0; transform:translateY(24px); animation:fadeUp 0.8s ease-out forwards; }
        @keyframes fadeUp { to{opacity:1;transform:translateY(0)} }

        .nav { width:100%; display:flex; justify-content:space-between; align-items:center; padding:20px 0; }
        .nav-brand { display:flex; align-items:center; gap:10px; }
        .nav-logo { width:160px; object-fit:contain; }
        .nav-name { font-size:20px; font-weight:800; color:white; letter-spacing:-0.5px; }
        .accent { background:linear-gradient(135deg,#60a5fa,#2563eb); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .nav-links { display:flex; gap:20px; }
        .nav-link { font-size:13px; color:#94a3b8; text-decoration:none; font-weight:500; transition:color 0.2s; }
        .nav-link:hover { color:white; }

        .hero { text-align:center; padding-top:20px; }
        .hero-logo { width:1500px; max-width:90%; object-fit:contain; margin:0 auto 28px; display:block; }
        .badge { display:inline-flex; align-items:center; gap:8px; padding:6px 16px; border-radius:999px; background:rgba(37,99,235,0.12); border:1px solid rgba(37,99,235,0.25); font-size:13px; font-weight:600; color:#93c5fd; margin-bottom:24px; }
        .badge-dot { width:8px; height:8px; border-radius:50%; background:#22c55e; animation:pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
        .logo-section { margin-bottom:16px; }
        .headline { font-size:44px; font-weight:800; line-height:1.2; letter-spacing:-1.5px; color:white; margin-top:12px; }
        .headline-accent { background:linear-gradient(135deg,#004ac6,#60a5fa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .subheadline { margin-top:20px; font-size:16px; line-height:1.7; color:#94a3b8; }

        .features { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; width:100%; }
        .feature-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:16px; padding:28px 20px; text-align:center; transition:all 0.3s; }
        .feature-card:hover { background:rgba(255,255,255,0.06); border-color:rgba(0,74,198,0.3); transform:translateY(-4px); }
        .feature-icon { font-size:32px; margin-bottom:12px; }
        .feature-card h3 { font-size:16px; font-weight:700; color:white; margin-bottom:8px; }
        .feature-card p { font-size:13px; line-height:1.6; color:#64748b; }

        .beta-section { width:100%; max-width:640px; }
        .beta-header { text-align:center; margin-bottom:32px; }
        .beta-badge { display:inline-block; padding:6px 20px; border-radius:999px; background:linear-gradient(135deg,#004ac6,#2563eb); color:white; font-size:13px; font-weight:700; margin-bottom:16px; letter-spacing:0.5px; }
        .beta-title { font-size:28px; font-weight:800; color:white; margin-bottom:12px; }
        .beta-desc { font-size:15px; color:#94a3b8; line-height:1.7; }
        .beta-desc strong { color:#60a5fa; }

        .beta-form { display:flex; flex-direction:column; gap:16px; }
        .form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .form-group { display:flex; flex-direction:column; gap:6px; }
        .form-group label { font-size:13px; font-weight:600; color:#94a3b8; }
        .required { color:#f43f5e; }
        .form-group input { height:48px; padding:0 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); color:white; font-size:14px; outline:none; transition:all 0.2s; }
        .form-group input::placeholder { color:#475569; }
        .form-group input:focus { border-color:#2563eb; background:rgba(37,99,235,0.08); }
        .form-error { padding:12px 16px; border-radius:10px; background:rgba(244,63,94,0.1); border:1px solid rgba(244,63,94,0.2); color:#fda4af; font-size:13px; }
        .submit-btn { height:56px; border-radius:14px; border:none; cursor:pointer; background:linear-gradient(135deg,#004ac6,#2563eb); color:white; font-size:16px; font-weight:700; transition:all 0.2s; margin-top:8px; }
        .submit-btn:hover { transform:translateY(-2px); box-shadow:0 8px 32px rgba(0,74,198,0.4); }
        .submit-btn:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
        .form-hint { text-align:center; font-size:12px; color:#475569; margin-top:4px; }

        .beta-success { text-align:center; padding:48px 24px; background:rgba(255,255,255,0.03); border:1px solid rgba(34,197,94,0.2); border-radius:20px; }
        .success-icon { font-size:48px; margin-bottom:16px; }
        .beta-success h3 { font-size:20px; font-weight:700; color:white; margin-bottom:8px; }
        .beta-success p { font-size:14px; color:#94a3b8; }

        .pricing-preview { width:100%; text-align:center; }
        .pricing-title { font-size:13px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:2px; margin-bottom:20px; }
        .price-cards { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; }
        .price-card { position:relative; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:20px 12px; display:flex; flex-direction:column; gap:4px; align-items:center; }
        .price-popular { border-color:rgba(0,74,198,0.4); background:rgba(0,74,198,0.06); }
        .price-badge-tag { position:absolute; top:-10px; padding:2px 12px; border-radius:999px; background:linear-gradient(135deg,#004ac6,#2563eb); color:white; font-size:10px; font-weight:700; }
        .price-name { font-size:13px; font-weight:700; color:#94a3b8; }
        .price-val { font-size:20px; font-weight:800; color:white; font-variant-numeric:tabular-nums; }
        .price-desc { font-size:11px; color:#475569; }

        .footer { text-align:center; font-size:12px; color:#334155; padding-top:20px; border-top:1px solid rgba(255,255,255,0.04); width:100%; }
        .footer-links { margin-top:8px; display:flex; justify-content:center; gap:12px; }
        .footer-links a { color:#475569; text-decoration:none; transition:color 0.2s; }
        .footer-links a:hover { color:#60a5fa; }

        @media (max-width:640px) {
          .content { gap:40px; }
          .headline { font-size:28px; }
          .subheadline { font-size:14px; }
          .features { grid-template-columns:1fr; }
          .form-row { grid-template-columns:1fr; }
          .price-cards { grid-template-columns:repeat(2,1fr); }
          .nav-links { gap:12px; }
          .nav-link { font-size:12px; }
          .hero-logo { width:90%; max-width:1000px; }
        }
      `}</style>
    </div>
  );
}
