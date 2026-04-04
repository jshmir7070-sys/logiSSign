/**
 * 계약서 바인딩 필드 레지스트리
 * 
 * 번호 체계:
 *   D001~D099: 기사(Driver) 기본 정보
 *   D100~D199: 기사 사업자 정보
 *   D200~D299: 기사 차량 정보
 *   D300~D399: 기사 면허/자격
 *   R001~R099: 정산/단가(Rate) 정보
 *   R100~R199: 공제/보험
 *   A001~A099: 대리점(Agency) 정보
 *   C001~C099: 계약(Contract) 정보
 *   S001~S099: 시스템/기타
 * 
 * source: DB 테이블.컬럼 또는 계산 로직
 * templateVar: 기존 템플릿 {{변수명}}과 호환
 */

export interface BindingField {
  id: string           // D001, R001 등
  label: string        // 한글 표시명
  templateVar: string  // {{기사명}} 호환
  source: string       // 데이터 소스 (테이블.컬럼)
  group: string        // UI 그룹핑
  required: boolean    // 필수 여부
}

export const BINDING_FIELDS: BindingField[] = [
  // ── D: 기사(Driver) ──
  { id: 'D001', label: '기사명',           templateVar: '기사명',           source: 'drivers.name',                   group: '기사 기본', required: true },
  { id: 'D002', label: '전화번호',         templateVar: '전화번호',         source: 'drivers.phone',                  group: '기사 기본', required: true },
  { id: 'D003', label: '주소',             templateVar: '주소',             source: 'drivers.address',                group: '기사 기본', required: false },
  { id: 'D004', label: '생년월일',         templateVar: '생년월일',         source: 'drivers.birth_date',             group: '기사 기본', required: false },
  { id: 'D005', label: '사번',             templateVar: '사번',             source: 'drivers.employee_code',          group: '기사 기본', required: false },
  { id: 'D006', label: '배송지역',         templateVar: '배송지역',         source: 'drivers.delivery_area',          group: '기사 기본', required: false },
  { id: 'D007', label: '캠프명',           templateVar: '캠프명',           source: 'drivers.camp_name',              group: '기사 기본', required: false },
  { id: 'D008', label: '이메일',           templateVar: '이메일',           source: 'drivers.email',                  group: '기사 기본', required: false },
  { id: 'D009', label: '주민등록번호',     templateVar: '주민등록번호',     source: 'secure',                         group: '기사 기본', required: false },

  // 기사 사업자
  { id: 'D100', label: '대표자명',         templateVar: '대표자명',         source: 'drivers.representative_name',    group: '기사 사업자', required: false },
  { id: 'D101', label: '사업자번호',       templateVar: '사업자번호',       source: 'drivers.business_reg_number',    group: '기사 사업자', required: false },
  { id: 'D102', label: '사업장주소',       templateVar: '사업장주소',       source: 'drivers.business_address',       group: '기사 사업자', required: false },
  { id: 'D103', label: '업태',             templateVar: '업태',             source: 'drivers.business_type',          group: '기사 사업자', required: false },
  { id: 'D104', label: '종목',             templateVar: '종목',             source: 'drivers.business_category',      group: '기사 사업자', required: false },
  { id: 'D105', label: '사업자여부',       templateVar: '사업자여부',       source: 'drivers.is_business_owner',      group: '기사 사업자', required: false },

  // 기사 차량
  { id: 'D200', label: '차종',             templateVar: '차종',             source: 'drivers.vehicle_type',           group: '기사 차량', required: false },
  { id: 'D201', label: '차명',             templateVar: '차명',             source: 'drivers.vehicle_type',           group: '기사 차량', required: false },
  { id: 'D202', label: '차량형태',         templateVar: '차량형태',         source: 'drivers.vehicle_type',           group: '기사 차량', required: false },
  { id: 'D203', label: '연식',             templateVar: '연식',             source: 'drivers.vehicle_year',           group: '기사 차량', required: false },
  { id: 'D204', label: '차량번호',         templateVar: '차량번호',         source: 'drivers.vehicle_number',         group: '기사 차량', required: false },
  { id: 'D205', label: '차대번호',         templateVar: '차대번호',         source: 'drivers.vehicle_vin',            group: '기사 차량', required: false },
  { id: 'D206', label: '인도시주행거리',   templateVar: '인도시주행거리',   source: 'drivers.vehicle_mileage',        group: '기사 차량', required: false },
  { id: 'D207', label: '최대적재량',       templateVar: '최대적재량',       source: 'drivers.custom_values',          group: '기사 차량', required: false },
  { id: 'D208', label: '연료종류',         templateVar: '연료종류',         source: 'drivers.custom_values',          group: '기사 차량', required: false },
  { id: 'D209', label: '차량소유',         templateVar: '차량소유',         source: 'drivers.vehicle_owner',          group: '기사 차량', required: false },
  { id: 'D210', label: '월임대료',         templateVar: '월임대료',         source: 'drivers.vehicle_rent_monthly',   group: '기사 차량', required: false },
  { id: 'D211', label: '보증금',           templateVar: '보증금',           source: 'drivers.vehicle_deposit',        group: '기사 차량', required: false },
  { id: 'D212', label: '보험부담',         templateVar: '보험부담',         source: 'drivers.vehicle_insurance_by',   group: '기사 차량', required: false },

  // 기사 면허/자격
  { id: 'D300', label: '면허번호',         templateVar: '면허번호',         source: 'drivers.license_number',         group: '기사 면허', required: false },
  { id: 'D301', label: '면허종류',         templateVar: '면허종류',         source: 'drivers.custom_values',          group: '기사 면허', required: false },
  { id: 'D302', label: '자격증번호',       templateVar: '자격증번호',       source: 'drivers.custom_values',          group: '기사 면허', required: false },
  { id: 'D303', label: '자격취득일',       templateVar: '자격취득일',       source: 'drivers.custom_values',          group: '기사 면허', required: false },
  { id: 'D304', label: '경력기간',         templateVar: '경력기간',         source: 'drivers.custom_values',          group: '기사 면허', required: false },
  { id: 'D305', label: '경력시작',         templateVar: '경력시작',         source: 'drivers.custom_values',          group: '기사 면허', required: false },
  { id: 'D306', label: '경력종료',         templateVar: '경력종료',         source: 'drivers.custom_values',          group: '기사 면허', required: false },

  // ── R: 정산/단가(Rate) ──
  { id: 'R001', label: '정산모드',         templateVar: '정산모드',         source: 'drivers.rate_mode',              group: '정산', required: false },
  { id: 'R002', label: '배송단가',         templateVar: '배송단가',         source: 'driver_rates.배송',              group: '정산', required: false },
  { id: 'R003', label: '반품단가',         templateVar: '반품단가',         source: 'driver_rates.반품',              group: '정산', required: false },
  { id: 'R004', label: '집하단가',         templateVar: '집하단가',         source: 'driver_rates.집하',              group: '정산', required: false },
  { id: 'R005', label: '노선별단가',       templateVar: '노선별단가',       source: 'driver_route_rates',             group: '정산', required: false },
  { id: 'R006', label: '고정단가',         templateVar: '고정단가',         source: 'drivers.flat_rate',              group: '정산', required: false },
  { id: 'R007', label: '수수료율',         templateVar: '수수료율',         source: 'drivers.rate_percentage',        group: '정산', required: false },
  { id: 'R008', label: '신선인센티브',     templateVar: '신선인센티브',     source: 'drivers.fresh_incentive_pct',    group: '정산', required: false },
  { id: 'R009', label: '추가인센티브',     templateVar: '추가인센티브',     source: 'drivers.extra_incentive_pct',    group: '정산', required: false },
  { id: 'R010', label: '공제항목',         templateVar: '공제항목',         source: 'driver_deductions',              group: '정산', required: false },

  // 세금/보험
  { id: 'R100', label: '부가세구분',       templateVar: '부가세구분',       source: 'drivers.vat_included',           group: '세금/보험', required: false },
  { id: 'R101', label: '세금처리',         templateVar: '세금처리',         source: 'drivers.tax_type',               group: '세금/보험', required: false },
  { id: 'R102', label: '고용보험_기사부담', templateVar: '고용보험_기사부담', source: 'principal.insurance',            group: '세금/보험', required: false },
  { id: 'R103', label: '고용보험_사업주부담', templateVar: '고용보험_사업주부담', source: 'principal.insurance',       group: '세금/보험', required: false },
  { id: 'R104', label: '산재보험_기사부담', templateVar: '산재보험_기사부담', source: 'principal.insurance',            group: '세금/보험', required: false },
  { id: 'R105', label: '산재보험_사업주부담', templateVar: '산재보험_사업주부담', source: 'principal.insurance',       group: '세금/보험', required: false },

  // 입금 계좌
  { id: 'R110', label: '은행명',           templateVar: '은행명',           source: 'drivers.bank_name',              group: '입금계좌', required: false },
  { id: 'R111', label: '계좌번호',         templateVar: '계좌번호',         source: 'drivers.bank_account',           group: '입금계좌', required: false },
  { id: 'R112', label: '예금주',           templateVar: '예금주',           source: 'drivers.bank_holder',            group: '입금계좌', required: false },

  // ── A: 대리점(Agency) ──
  { id: 'A001', label: '대리점명',         templateVar: '대리점명',         source: 'agencies.name',                  group: '대리점', required: true },
  { id: 'A002', label: '대리점사업자번호', templateVar: '대리점사업자번호', source: 'agencies.business_number',       group: '대리점', required: false },
  { id: 'A003', label: '대리점대표자',     templateVar: '대리점대표자',     source: 'agencies.owner_name',            group: '대리점', required: false },
  { id: 'A004', label: '대리점연락처',     templateVar: '대리점연락처',     source: 'agencies.phone',                 group: '대리점', required: false },
  { id: 'A005', label: '대리점주소',       templateVar: '대리점주소',       source: 'agencies.address',               group: '대리점', required: false },
  { id: 'A006', label: '대리점이메일',     templateVar: '대리점이메일',     source: 'agencies.email',                 group: '대리점', required: false },
  { id: 'A007', label: '대리점업태',       templateVar: '대리점업태',       source: 'agencies.business_type',         group: '대리점', required: false },
  { id: 'A008', label: '대리점종목',       templateVar: '대리점종목',       source: 'agencies.business_category',     group: '대리점', required: false },
  { id: 'A009', label: '택배사업자명',     templateVar: '택배사업자명',     source: 'agencies.name',                  group: '대리점', required: false },

  // ── C: 계약(Contract) ──
  { id: 'C001', label: '계약시작일',       templateVar: '계약시작일',       source: 'contract_period.start',          group: '계약', required: false },
  { id: 'C002', label: '계약종료일',       templateVar: '계약종료일',       source: 'contract_period.end',            group: '계약', required: false },
  { id: 'C003', label: '계약일',           templateVar: '계약일',           source: 'system.today',                   group: '계약', required: false },
  { id: 'C004', label: '전속계약기간',     templateVar: '전속계약기간',     source: 'contract_period.duration',       group: '계약', required: false },

  // ── S: 시스템/기타 ──
  { id: 'S001', label: '관할법원',         templateVar: '관할법원',         source: 'config',                         group: '기타', required: false },
]

// ID → 필드 매핑
export const FIELD_BY_ID = new Map(BINDING_FIELDS.map(f => [f.id, f]))
// templateVar → 필드 매핑
export const FIELD_BY_VAR = new Map(BINDING_FIELDS.map(f => [f.templateVar, f]))
// 그룹별 필드
export function getFieldsByGroup(): Record<string, BindingField[]> {
  const groups: Record<string, BindingField[]> = {}
  for (const f of BINDING_FIELDS) {
    if (!groups[f.group]) groups[f.group] = []
    groups[f.group].push(f)
  }
  return groups
}
