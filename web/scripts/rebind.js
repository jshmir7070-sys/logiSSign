const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const driverId = 'a550302b-7df8-40fc-8db3-5b5204adfcf9';
  const agencyId = '9397ea40-2ced-4bd8-ba50-6a353f142037';

  // 기존 삭제
  await sb.from('contracts').delete().eq('driver_id', driverId);
  console.log('기존 계약서 삭제');

  const { data: d } = await sb.from('drivers').select('*').eq('id', driverId).single();
  const { data: a } = await sb.from('agencies').select('*').eq('id', agencyId).single();

  // 전체 변수 매핑 — 템플릿에서 사용하는 모든 {{변수}} 대응
  const bindingData = {
    // 기사 정보
    '기사명': d.name || '',
    '전화번호': d.phone || '',
    '주소': d.address || '',
    '생년월일': d.birth_date || '',
    '사번': d.employee_code || '',
    '배송지역': d.delivery_area || '',
    '사업자번호': d.business_reg_number || '',
    '대표자명': d.representative_name || d.name || '',
    '사업장주소': d.business_address || d.address || '',
    '주민등록번호': '',  // 보안상 비워둠

    // 차량 정보
    '차종': d.vehicle_type || '',
    '차명': d.vehicle_type || '',
    '차량형태': d.vehicle_type || '',
    '연식': d.vehicle_year || '',
    '차량번호': d.vehicle_number || '',
    '차대번호': d.vehicle_vin || '',
    '인도시주행거리': d.vehicle_mileage ? Number(d.vehicle_mileage).toLocaleString() + 'km' : '',
    '최대적재량': '',
    '연료종류': '',
    '월임대료': d.vehicle_rent_monthly ? Number(d.vehicle_rent_monthly).toLocaleString() + '원' : '',
    '보증금': d.vehicle_deposit ? Number(d.vehicle_deposit).toLocaleString() + '원' : '',
    '보험부담': d.vehicle_insurance_by === 'lessor' ? '임대인' : '임차인',

    // 단가
    '배송단가': d.flat_rate ? Number(d.flat_rate).toLocaleString() + '원' : '',
    '반품단가': '',
    '집하단가': '',
    '노선별단가': '',

    // 세금/보험
    '부가세구분': d.vat_included ? '포함가 (VAT 포함)' : '별도 (VAT 별도)',
    '세금처리': d.tax_type === 'vat_invoice' ? '세금계산서 발행' : d.tax_type === 'withholding_3_3' ? '3.3% 원천징수' : d.tax_type || '',
    '고용보험_기사부담': '',
    '고용보험_사업주부담': '',
    '산재보험_기사부담': '',
    '산재보험_사업주부담': '',

    // 면허/자격
    '면허번호': '',
    '면허종류': '',
    '자격증번호': '',
    '자격취득일': '',
    '경력기간': '',
    '경력시작': '',
    '경력종료': '',

    // 계약 일자
    '계약시작일': new Date().toLocaleDateString('ko-KR'),
    '계약종료일': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR'),
    '계약일': new Date().toLocaleDateString('ko-KR'),
    '전속계약기간': '1년',

    // 대리점(위탁자) 정보
    '대리점명': a.name || '',
    '대리점사업자번호': a.business_number || '',
    '대리점대표자': a.owner_name || '',
    '대리점연락처': a.phone || '',
    '대리점주소': a.address ? (a.address + (a.address_detail ? ' ' + a.address_detail : '')) : '',
    '택배사업자명': a.name || '',

    // 기타
    '관할법원': '',
  };

  console.log('=== 바인딩 데이터 (빈 값 제외) ===');
  Object.entries(bindingData).forEach(([k, v]) => {
    if (v) console.log(k, ':', v);
  });
  console.log('\n=== 빈 값 ===');
  Object.entries(bindingData).forEach(([k, v]) => {
    if (!v) console.log(k, ': (빈값)');
  });

  // 선택된 5개 템플릿
  const titles = [
    '영업점-택배기사 위수탁 표준계약서',
    '개인정보 수집·이용 동의서',
    '개인정보보호 비밀유지 서약서',
    '안전운행 서약서',
    '부속합의서 (택배서비스 위수탁)',
  ];

  const { data: templates } = await sb.from('contract_templates').select('id, title, content').eq('is_active', true);
  const selected = templates.filter(t => titles.includes(t.title));

  let created = 0;
  for (const t of selected) {
    let bound = t.content;
    for (const [k, v] of Object.entries(bindingData)) {
      const pattern = '{{' + k + '}}';
      while (bound.includes(pattern)) bound = bound.replace(pattern, v || '');
    }

    // 남은 미치환 변수 확인
    const remaining = bound.match(/\{\{[^}]+\}\}/g);
    if (remaining) console.log('[' + t.title + '] 미치환:', [...new Set(remaining)].join(', '));

    const contentHash = crypto.createHash('sha256').update(bound).digest('hex');
    const signToken = crypto.randomUUID();
    const docNum = 'LSS-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-6);
    const verCode = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 8);

    const { error } = await sb.from('contracts').insert({
      template_id: t.id, agency_id: agencyId, driver_id: driverId,
      title: t.title, content: bound, content_hash: contentHash,
      sign_token: signToken,
      token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'sent', sent_at: new Date().toISOString(),
      document_number: docNum, verification_code: verCode,
    });
    if (error) console.error('Error:', t.title, error.message);
    else { console.log('✅', t.title); created++; }
  }
  console.log('\nTotal:', created);
})();
