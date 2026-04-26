'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/shared/Badge';
import { toastSuccess, toastError } from '@/components/shared/Toast';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  getWorksheet,
  getWorksheetNames,
  loadExcelWorkbook,
  sheetToSafeRecords,
  worksheetToRows,
  type ExcelWorkbook,
} from '@/lib/safe-xlsx';
import { getPrincipals, getUploadMapping, saveUploadMapping, normalizeFieldConfig, UPLOAD_MAPPING_PRESETS, EXCEL_TYPE_LABELS, type Principal, type ExcelType } from '@/services/principal.service';
import {
  parseExcelData,
  matchDrivers,
  calculateSettlements,
  parseCoupangSummary,
  parseCoupangRaw,
  calculateCoupangRouteSettlements,
  calculateCoupangSettlements,
  detectSheetTypes,
  saveSettlements,
  DEFAULT_COLUMN_MAPPINGS,
  type ExcelColumnMapping,
  type SettlementCalcResult,
  type UnmatchedRow,
  type SheetInfo,
} from '@/services/excel-settlement.service';
import { classifyColumns, type ColumnClassification } from '@/services/column-classifier.service';

type Step = 'upload' | 'sheet-select' | 'mapping' | 'preview' | 'done';
type ImportMode = 'calculate' | 'coupang_direct';

function formatKRW(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}

function getYearMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    options.push({ value, label });
  }
  return options;
}

type GuidedMappingKey =
  | 'employee_code_col'
  | 'driver_name_col'
  | 'delivery_count_col'
  | 'return_count_col'
  | 'collect_count_col'
  | 'delivery_amount_col'
  | 'return_amount_col'
  | 'collect_amount_col'
  | 'fresh_back_amount_col'
  | 'incentive_amount_col'
  | 'etc_income_amount_col';

const REQUIRED_MAPPING_KEYS: GuidedMappingKey[] = ['employee_code_col', 'delivery_count_col'];

const HEADER_FIELD_LABELS: Record<GuidedMappingKey, string> = {
  employee_code_col: '\uC0AC\uBC88 \uC5F4',
  driver_name_col: '\uAE30\uC0AC\uBA85 \uC5F4',
  delivery_count_col: '\uBC30\uC1A1 \uAC74\uC218 \uC5F4',
  return_count_col: '\uBC18\uD488 \uAC74\uC218 \uC5F4',
  collect_count_col: '\uC9D1\uD558 \uAC74\uC218 \uC5F4',
  delivery_amount_col: '\uBC30\uC1A1\uB9E4\uCD9C \uC5F4',
  return_amount_col: '\uBC18\uD488\uB9E4\uCD9C \uC5F4',
  collect_amount_col: '\uC9D1\uD558\uB9E4\uCD9C \uC5F4',
  fresh_back_amount_col: '\uD504\uB808\uC26C\uBC31 \uAE08\uC561 \uC5F4',
  incentive_amount_col: '\uC778\uC13C\uD2F0\uBE0C \uAE08\uC561 \uC5F4',
  etc_income_amount_col: '\uAE30\uD0C0 \uC218\uC785 \uAE08\uC561 \uC5F4',
};

const HEADER_FIELD_EXAMPLES: Record<GuidedMappingKey, string[]> = {
  employee_code_col: ['\uC0AC\uBC88', '\uAE30\uC0AC\uCF54\uB4DC', '\uAE30\uC0ACID'],
  driver_name_col: ['\uAE30\uC0AC\uBA85', '\uC774\uB984', '\uC131\uBA85'],
  delivery_count_col: ['\uBC30\uC1A1', '\uBC30\uC1A1\uAC74\uC218', '\uBC30\uC1A1\uC218\uB7C9'],
  return_count_col: ['\uBC18\uD488', '\uBC18\uD488\uAC74\uC218'],
  collect_count_col: ['\uC9D1\uD558', '\uC9D1\uD558\uAC74\uC218', '\uC9D1\uD654', '\uC9D1\uD654\uAC74\uC218'],
  delivery_amount_col: ['\uBC30\uC1A1\uB9E4\uCD9C', '\uBC30\uC1A1\uAE08\uC561', '\uBC30\uC1A1\uC218\uC218\uB8CC'],
  return_amount_col: ['\uBC18\uD488\uB9E4\uCD9C', '\uBC18\uD488\uAE08\uC561', '\uBC18\uD488\uC218\uC218\uB8CC'],
  collect_amount_col: ['\uC9D1\uD558\uB9E4\uCD9C', '\uC9D1\uD558\uAE08\uC561', '\uC9D1\uD558\uC218\uC218\uB8CC'],
  fresh_back_amount_col: ['\uD504\uB808\uC26C\uBC31', '\uD504\uB808\uC26C\uBC31\uAE08\uC561'],
  incentive_amount_col: ['\uC778\uC13C\uD2F0\uBE0C', '\uC131\uACFC\uAE09', '\uCD94\uAC00\uC218\uB2F9'],
  etc_income_amount_col: ['\uAE30\uD0C0\uC218\uC785', '\uAE30\uD0C0\uAE08\uC561', '\uAE30\uD0C0\uC815\uC0B0'],
};

function getHeaderExamples(field: GuidedMappingKey, excelType: ExcelType): string[] {
  const examples = [...HEADER_FIELD_EXAMPLES[field]];
  const preset = UPLOAD_MAPPING_PRESETS[excelType];
  const presetValue = preset?.[field];

  if (presetValue && !examples.includes(presetValue)) {
    examples.unshift(presetValue);
  }

  return examples;
}

function buildHeaderMappingError(
  headers: string[],
  mapping: ExcelColumnMapping,
  excelType: ExcelType
): string | null {
  const missingRequired = REQUIRED_MAPPING_KEYS.filter((field) => !mapping[field]);
  const invalidSelected = (Object.entries(HEADER_FIELD_LABELS) as [GuidedMappingKey, string][])
    .filter(([field]) => {
      const selected = mapping[field];
      return Boolean(selected) && !headers.includes(selected as string);
    })
    .map(([field]) => field);

  if (missingRequired.length === 0 && invalidSelected.length === 0) {
    return null;
  }

  const guideFields = Array.from(new Set([...missingRequired, ...invalidSelected]));
  const lines: string[] = ['\uD5E4\uB354 \uB9E4\uD551\uC744 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.'];

  if (missingRequired.length > 0) {
    lines.push(
      `\uD544\uC218 \uC120\uD0DD: ${missingRequired.map((field) => HEADER_FIELD_LABELS[field]).join(', ')}`
    );
  }

  if (invalidSelected.length > 0) {
    lines.push(
      `\uD30C\uC77C\uC5D0 \uC5C6\uB294 \uD5E4\uB354 \uC120\uD0DD: ${invalidSelected
        .map((field) => `${HEADER_FIELD_LABELS[field]} → "${mapping[field]}"`)
        .join(', ')}`
    );
  }

  lines.push('\uC785\uB825 \uAC00\uC774\uB4DC:');
  guideFields.forEach((field) => {
    lines.push(
      `- ${HEADER_FIELD_LABELS[field]}: ${getHeaderExamples(field, excelType)
        .map((value) => `"${value}"`)
        .join(', ')}`
    );
  });

  if (headers.length > 0) {
    const visibleHeaders = headers.slice(0, 12).map((header) => `"${header}"`).join(', ');
    lines.push(
      `\uD604\uC7AC \uD30C\uC77C \uD5E4\uB354: ${visibleHeaders}${headers.length > 12 ? ' ...' : ''}`
    );
  }

  return lines.join('\n');
}

const SHEET_RULE_GUIDES = [
  {
    title: '1시트 업로드',
    description: '요약 시트 1개만 있으면 바로 자동 정산이 가능합니다.',
    names: ['정산총괄'],
  },
  {
    title: '2시트 업로드',
    description: '요약 + Raw 조합이면 기사별/라우트별 검증까지 함께 진행합니다.',
    names: ['정산총괄', '정산Raw'],
  },
  {
    title: '3시트 업로드',
    description: '사고 내역 시트를 추가로 인식해 분실파손 차감까지 같이 확인합니다.',
    names: ['정산총괄', '정산Raw', '화물사고 상세내역 또는 분실파손'],
  },
];

const AUTO_DEDUCTION_GUIDES = [
  '보험료는 카테고리 설정과 기사 정보 기준으로 자동 계산됩니다.',
  '화물사고 상세내역은 카테고리 설정의 상세 입력값을 정산 상세 화면에만 표시합니다.',
  '운송장/선불/착불 차감은 카테고리 생성 후 기사 등록 시 기본 차감 항목으로 적용됩니다.',
];

export default function SettlementUploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [principalId, setPrincipalId] = useState('');

  const now = new Date();
  const defaultYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [yearMonth, setYearMonth] = useState(defaultYM);
  const ymOptions = getYearMonthOptions();

  const [step, setStep] = useState<Step>('upload');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  /* ── Excel data ── */
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);

  /* ── Multi-sheet state ── */
  const [sheetInfos, setSheetInfos] = useState<SheetInfo[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('calculate');
  // Store full workbook reference for sheet switching
  const workbookRef = useRef<ExcelWorkbook | null>(null);

  /* ── Coupang raw rows (array of arrays) ── */
  const [_coupangRawRows, setCoupangRawRows] = useState<unknown[][]>([]);

  /* ── Column mapping ── */
  const [mapping, setMapping] = useState<ExcelColumnMapping>({
    employee_code_col: '',
    driver_name_col: '',
    delivery_count_col: '',
    return_count_col: '',
    collect_count_col: '',
    delivery_amount_col: '',
    return_amount_col: '',
    collect_amount_col: '',
    fresh_count_col: '',
    etc_count_col: '',
    fresh_back_amount_col: '',
    incentive_amount_col: '',
    etc_income_amount_col: '',
  });

  /* ── Results ── */
  const [settlements, setSettlements] = useState<SettlementCalcResult[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedRow[]>([]);
  const [unmatchedRoutes, setUnmatchedRoutes] = useState<{ employee_code: string; route_code: string }[]>([]);
  const [skippedEntries, setSkippedEntries] = useState<string[]>([]);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [columnClassifications, setColumnClassifications] = useState<ColumnClassification[]>([]);

  useEffect(() => {
    async function init() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const aid = user.app_metadata?.agency_id as string | undefined;
      if (!aid) return;
      setAgencyId(aid);
      const result = await getPrincipals(aid);
      if (result.data) setPrincipals(result.data);
    }
    init();
  }, []);

  const [savedExcelType, setSavedExcelType] = useState<ExcelType>('generic');
  const selectedPrincipal = principals.find((principal) => principal.id === principalId);
  const selectedFieldConfig = selectedPrincipal?.field_config
    ? normalizeFieldConfig(selectedPrincipal.field_config)
    : undefined;
  const cargoAccidentDetail = selectedFieldConfig?.deduction_section.cargo_accident.description.trim() ?? '';

  /* Apply saved or default mapping when principal changes */
  useEffect(() => {
    if (!principalId) return;

    (async () => {
      const { mapping: savedMapping, excelType } = await getUploadMapping(principalId);
      setSavedExcelType(excelType);

      if (savedMapping && savedMapping.employee_code_col) {
        // DB에 저장된 매핑 사용
        setMapping({
          employee_code_col: savedMapping.employee_code_col,
          driver_name_col: savedMapping.driver_name_col ?? '',
          delivery_count_col: savedMapping.delivery_count_col ?? '',
          return_count_col: savedMapping.return_count_col ?? '',
          collect_count_col: savedMapping.collect_count_col ?? '',
          delivery_amount_col: savedMapping.delivery_amount_col ?? '',
          return_amount_col: savedMapping.return_amount_col ?? '',
          collect_amount_col: savedMapping.collect_amount_col ?? '',
          fresh_count_col: savedMapping.fresh_count_col ?? '',
          etc_count_col: savedMapping.etc_count_col ?? '',
          fresh_back_amount_col: savedMapping.fresh_back_amount_col ?? '',
          incentive_amount_col: savedMapping.incentive_amount_col ?? '',
          etc_income_amount_col: savedMapping.etc_income_amount_col ?? '',
        });
      } else {
        // 프리셋 또는 하드코딩 기본값 fallback
        const preset = UPLOAD_MAPPING_PRESETS[excelType];
        const p = principals.find((pr) => pr.id === principalId);
        const legacyDefaults = p ? DEFAULT_COLUMN_MAPPINGS[p.name] : null;
        const defaults = preset ?? legacyDefaults;

        if (defaults) {
          setMapping({
            employee_code_col: defaults.employee_code_col,
            driver_name_col: defaults.driver_name_col ?? '',
            delivery_count_col: defaults.delivery_count_col ?? '',
            return_count_col: defaults.return_count_col ?? '',
            collect_count_col: defaults.collect_count_col ?? '',
            delivery_amount_col: defaults.delivery_amount_col ?? '',
            return_amount_col: defaults.return_amount_col ?? '',
            collect_amount_col: defaults.collect_amount_col ?? '',
            fresh_count_col: defaults.fresh_count_col ?? '',
            etc_count_col: defaults.etc_count_col ?? '',
            fresh_back_amount_col: defaults.fresh_back_amount_col ?? '',
            incentive_amount_col: defaults.incentive_amount_col ?? '',
            etc_income_amount_col: defaults.etc_income_amount_col ?? '',
          });
        }
      }
    })();
  }, [principalId, principals]);

  const autoDetectMapping = useCallback(function autoDetectMapping(cols: string[]) {
    // 자동 분류 엔진 실행
    const formulas = new Map<number, never>(); // 업로드 시 수식은 별도 파싱 필요
    const colValues = new Map<number, number[]>();
    // rawRows에서 샘플링하여 값 기반 분류 보강
    if (rawRows.length > 0) {
      cols.forEach((col, idx) => {
        const vals = rawRows.slice(0, 20).map(r => Number(r[col])).filter(v => !isNaN(v) && v !== 0);
        if (vals.length > 0) colValues.set(idx, vals);
      });
    }
    const classifications = classifyColumns(cols, formulas, colValues);
    setColumnClassifications(classifications);

    if (!mapping.employee_code_col) {
      const nameCol = cols.find((c) => /기사명|이름|성명/i.test(c));
      const codeCol = cols.find((c) => /사번|기사코드|코드|ID/i.test(c));
      const deliveryCol = cols.find((c) => /배송|배달|건수/i.test(c));
      const returnCol = cols.find((c) => /반품/i.test(c));
      const collectCol = cols.find((c) => /집하/i.test(c));

      setMapping((prev) => ({
        ...prev,
        employee_code_col: codeCol ?? prev.employee_code_col ?? cols[0],
        driver_name_col: nameCol ?? prev.driver_name_col ?? '',
        delivery_count_col: deliveryCol ?? prev.delivery_count_col ?? '',
        return_count_col: returnCol ?? prev.return_count_col ?? '',
        collect_count_col: collectCol ?? prev.collect_count_col ?? '',
      }));

      setMapping((prev) => ({
        ...prev,
        delivery_amount_col: prev.delivery_amount_col ?? '',
        return_amount_col: prev.return_amount_col ?? '',
        collect_amount_col: prev.collect_amount_col ?? '',
        fresh_back_amount_col: prev.fresh_back_amount_col ?? '',
        incentive_amount_col: prev.incentive_amount_col ?? '',
        etc_income_amount_col: prev.etc_income_amount_col ?? '',
      }));
    }
  }, [mapping.employee_code_col, rawRows]);

  /* ── File handling ── */
  const handleFile = useCallback(async (file: File) => {
    setError('');
    setProcessing(true);

    if (false) {
      setError('?쇱슦???④? 媛 ?몄꽕?뺤씤 湲곗궗媛 ?덉뼱 ????섏? ?딆뒿?덈떎. ?쇱슦???④?瑜?硫쇱? ?ㅼ젙?섏꽭??');
      setProcessing(false);
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const wb = await loadExcelWorkbook(buffer);
      workbookRef.current = wb;
      setFileName(file.name);

      // Detect sheet types
      const sheetNames = getWorksheetNames(wb);
      const infos = detectSheetTypes(sheetNames, (name) => {
        const ws = getWorksheet(wb, name);
        return ws ? worksheetToRows(ws) : [];
      });
      setSheetInfos(infos);

      const hasCoupangSummary = infos.some((s) => s.detected === 'coupang_summary');

      if (hasCoupangSummary) {
        // Coupang summary workbook (single or multi sheet)
        const summarySheet = infos.find((s) => s.detected === 'coupang_summary');
        setSelectedSheet(summarySheet?.name ?? sheetNames[0]);
        setImportMode('coupang_direct');
        setStep('sheet-select');
      } else {
        // Single sheet or generic - go to column mapping
        const ws = wb.worksheets[0];
        if (!ws) {
          setError('엑셀 파일에 시트가 없습니다');
          setProcessing(false);
          return;
        }
        const json = sheetToSafeRecords(ws);
        if (json.length === 0) {
          setError('엑셀 파일에 데이터가 없습니다');
          setProcessing(false);
          return;
        }
        const cols = Object.keys(json[0]);
        setHeaders(cols);
        setRawRows(json);
        setImportMode('calculate');
        autoDetectMapping(cols);
        setStep('mapping');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '엑셀 파일 파싱 실패');
    }
    setProcessing(false);
  }, [autoDetectMapping]);

  /* ── Load selected sheet for generic mode ── */
  function loadSheetForMapping(sheetName: string) {
    if (!workbookRef.current) return;
    const ws = getWorksheet(workbookRef.current, sheetName);
    if (!ws) return;
    const json = sheetToSafeRecords(ws);
    if (json.length === 0) {
      setError('선택한 시트에 데이터가 없습니다');
      return;
    }
    const cols = Object.keys(json[0]);
    setHeaders(cols);
    setRawRows(json);
    autoDetectMapping(cols);
  }

  /* ── Load Coupang summary sheet ── */
  function _loadCoupangSheet(sheetName: string) {
    if (!workbookRef.current) return;
    const ws = getWorksheet(workbookRef.current, sheetName);
    if (!ws) return;
    const rows = worksheetToRows(ws);
    setCoupangRawRows(rows);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  /* ── Sheet select → process (route-based from 정산Raw + 정산총괄) ── */
  async function processCoupangDirect() {
    if (!agencyId) return;
    setProcessing(true);
    setError('');

    try {
      if (!workbookRef.current) throw new Error('워크북을 찾을 수 없습니다');
      const selectedPrincipal = principals.find((principal) => principal.id === principalId);
      const fieldConfig = selectedPrincipal?.field_config
        ? normalizeFieldConfig(selectedPrincipal.field_config)
        : undefined;

      // Parse 정산Raw sheet for route-level detail
      const rawSheetName = sheetInfos.find((s) => s.detected === 'coupang_raw')?.name;
      if (!rawSheetName && !sheetInfos.some((s) => s.detected === 'coupang_summary')) {
        setError('정산Raw 시트를 찾을 수 없습니다.');
        setProcessing(false);
        return;
      }
      const rawWs = rawSheetName ? getWorksheet(workbookRef.current, rawSheetName) : null;
      const rawArrayRows = rawWs ? worksheetToRows(rawWs) : [];
      const { parsed: rawParsed } = parseCoupangRaw(rawArrayRows);

      // Parse 정산총괄 for pass-through amounts (프레쉬백, 추가인센, 분실파손)
      const summarySheetName = sheetInfos.find((s) => s.detected === 'coupang_summary')?.name;
      let summaryParsed: import('@/services/excel-settlement.service').CoupangSummaryRow[] = [];
      const skipped: string[] = [];
      if (summarySheetName) {
        const summaryWs = getWorksheet(workbookRef.current, summarySheetName);
        const summaryRows = summaryWs ? worksheetToRows(summaryWs) : [];
        const result = parseCoupangSummary(summaryRows);
        summaryParsed = result.parsed;
        skipped.push(...result.skipped);
      }
      setSkippedEntries(skipped);

      if (rawParsed.length === 0 && summaryParsed.length > 0) {
        const { results, unmatched: um } = await calculateCoupangSettlements(
          agencyId,
          summaryParsed,
          fieldConfig,
          principalId || null
        );
        setSettlements(results);
        setUnmatched(um);
        setUnmatchedRoutes([]);
        setStep('preview');
        setProcessing(false);
        return;
      }

      if (rawParsed.length === 0) {
        setError('정산Raw에 배송 데이터가 없습니다.');
        setProcessing(false);
        return;
      }

      const { results, unmatched: um, unmatchedRoutes: umr } = await calculateCoupangRouteSettlements(
        agencyId,
        rawParsed,
        summaryParsed,
        fieldConfig,
        principalId || null
      );
      setSettlements(results);
      setUnmatched(um);
      setUnmatchedRoutes(umr);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : '정산 처리 중 오류');
    }
    setProcessing(false);
  }

  /* ── Generic mode: parse + match + calculate ── */
  async function processSettlement() {
    if (!agencyId || !mapping.employee_code_col || !mapping.delivery_count_col) return;
    setProcessing(true);
    setError('');

    try {
      const mappingError = buildHeaderMappingError(headers, mapping, savedExcelType);
      if (mappingError) {
        setError(mappingError);
        setProcessing(false);
        return;
      }

      const selectedPrincipal = principals.find((principal) => principal.id === principalId);
      const fieldConfig = selectedPrincipal?.field_config
        ? normalizeFieldConfig(selectedPrincipal.field_config)
        : undefined;
      const { parsed, errors } = parseExcelData(rawRows, mapping);
      if (errors.length > 0) {
        setError(errors.slice(0, 5).join('\n'));
        setProcessing(false);
        return;
      }
      if (parsed.length === 0) {
        setError(
          buildHeaderMappingError(headers, mapping, savedExcelType) ??
            '\uB9E4\uCE6D \uAC00\uB2A5\uD55C \uD589\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC0AC\uBC88 \uC5F4\uACFC \uBC30\uC1A1\uAC74\uC218 \uC5F4 \uB9E4\uD551\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.'
        );
        setProcessing(false);
        return;
      }
      if (parsed.length === 0) {
        setError('매칭 가능한 행이 없습니다. 사번 열 매핑을 확인하세요.');
        setProcessing(false);
        return;
      }

      const { matched, unmatched: um } = await matchDrivers(agencyId, parsed, principalId || null);
      setUnmatched(um);

      const mismatchCount = um.filter((item) => item.reason && item.reason !== '등록된 기사 없음').length;
      if (mismatchCount > 0) {
        toastError(`이름/사번 불일치 또는 중복 기사코드가 ${mismatchCount}건 있습니다. 미리보기의 미매칭 목록을 확인해주세요.`);
      }

      if (matched.size === 0) {
        setError('매칭된 기사가 없습니다. 기사 등록 시 사번이 올바른지 확인하세요.');
        setProcessing(false);
        return;
      }

      const results = await calculateSettlements(matched, fieldConfig);
      setSettlements(results);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : '정산 계산 중 오류');
    }
    setProcessing(false);
  }

  /* ── Save ── */
  async function handleSave() {
    if (!agencyId) return;
    setProcessing(true);
    setError('');

    // 엑셀 업로드 포인트 사전 확인
    try {
      if (unmatched.length > 0) {
        setError(`미매칭 기사 ${unmatched.length}건이 있어 저장할 수 없습니다. 기사 등록, 원청사 연결, 사번/기사명을 먼저 확인해 주세요.`);
        setProcessing(false);
        return;
      }

      if (unmatchedRoutes.length > 0) {
        setError(`미설정 라우트 ${unmatchedRoutes.length}건이 있어 저장할 수 없습니다. 기사 상세에서 라우트별 단가를 먼저 설정해 주세요.`);
        setProcessing(false);
        return;
      }

      const checkRes = await fetch('/api/settlements/excel-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check' }),
      });
      const checkData = await checkRes.json();
      if (!checkRes.ok || (checkData.enough === false)) {
        setError(checkData.error || `포인트 잔액 부족 (필요: ${checkData.required?.toLocaleString()}P, 잔액: ${checkData.balance?.toLocaleString()}P)`);
        setProcessing(false);
        return;
      }
    } catch { /* 확인 실패 시 일단 진행 */ }

    if (unmatched.length > 0) {
      setError(`미매칭 기사 ${unmatched.length}건이 있어 저장할 수 없습니다. 기사 등록, 원청사 연결, 사번/기사명을 먼저 확인해 주세요.`);
      setProcessing(false);
      return;
    }

    if (unmatchedRoutes.length > 0) {
      setError(`미설정 라우트 ${unmatchedRoutes.length}건이 있어 저장할 수 없습니다. 기사 상세에서 라우트별 단가를 먼저 설정해 주세요.`);
      setProcessing(false);
      return;
    }

    const result = await saveSettlements(agencyId, yearMonth, principalId || null, settlements);
    if (result.error) {
      setError(result.error);
      setProcessing(false);
      return;
    }

    // 저장 성공 후 포인트 차감
    try {
      await fetch('/api/settlements/excel-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deduct', yearMonth }),
      });
    } catch { /* 차감 실패는 로그만 */ }

    setStep('done');
    setProcessing(false);
  }

  /* ── Summary stats ── */
  const totalBase = settlements.reduce((s, r) => s + r.base_amount, 0);
  const totalFreshIncentive = settlements.reduce((s, r) => s + (r.fresh_incentive ?? 0), 0);
  const totalExtraIncentive = settlements.reduce((s, r) => s + (r.extra_incentive ?? 0), 0);
  const totalDeduction = settlements.reduce((s, r) => s + r.total_deduction, 0);
  const totalVat = settlements.reduce((s, r) => s + (r.vat_amount ?? 0), 0);
  const totalWithholding = settlements.reduce((s, r) => s + (r.withholding_amount ?? 0), 0);
  const totalFinal = settlements.reduce((s, r) => s + (r.final_amount ?? r.net_amount), 0);

  const isCoupangMode = importMode === 'coupang_direct';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">
          엑셀 업로드 자동 정산
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant font-korean">
          운송사 엑셀 파일을 업로드하면 사번으로 기사를 매칭하고 개인별 단가로 자동 정산합니다
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 flex-wrap">
        {(isCoupangMode
          ? (['upload', 'sheet-select', 'preview', 'done'] as Step[])
          : (['upload', 'mapping', 'preview', 'done'] as Step[])
        ).map((s, idx) => {
          const labels = isCoupangMode
            ? ['파일 업로드', '시트 선택', '정산 미리보기', '완료']
            : ['파일 업로드', '열 매핑', '정산 미리보기', '완료'];
          const steps = isCoupangMode
            ? ['upload', 'sheet-select', 'preview', 'done']
            : ['upload', 'mapping', 'preview', 'done'];
          const current = steps.indexOf(step);
          const thisIdx = idx;
          return (
            <div key={s} className="flex items-center gap-2">
              {idx > 0 && <div className={`w-8 h-0.5 ${thisIdx <= current ? 'bg-primary' : 'bg-outline-variant/30'}`} />}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-label ${
                thisIdx === current ? 'bg-primary text-white' : thisIdx < current ? 'bg-primary/10 text-primary' : 'bg-surface-container-low text-on-surface-variant'
              }`}>
                <span className="font-semibold">{idx + 1}</span>
                <span className="font-korean">{labels[idx]}</span>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="bg-error/10 text-error rounded-xl px-4 py-3 text-sm font-korean whitespace-pre-line">{error}</div>
      )}

      {/* ═══ Step 1: Upload ═══ */}
      {step === 'upload' && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4">
            <h2 className="text-base font-headline font-semibold text-on-surface font-korean">기본 설정</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">카테고리 (거래처)</label>
                <select
                  value={principalId}
                  onChange={(e) => setPrincipalId(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">전체 (카테고리 무관)</option>
                  {principals.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">정산 월</label>
                <select
                  value={yearMonth}
                  onChange={(e) => setYearMonth(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {ymOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4">
            <div>
              <h3 className="text-sm font-headline font-semibold text-on-surface font-korean">시트 수 / 시트명 규칙</h3>
              <p className="text-xs text-on-surface-variant mt-1 font-korean">
                파일 구조가 아래 규칙과 맞으면 시트 자동 감지가 더 정확하게 동작합니다.
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {SHEET_RULE_GUIDES.map((guide) => (
                <div key={guide.title} className="rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3">
                  <p className="text-sm font-semibold text-on-surface font-korean">{guide.title}</p>
                  <p className="mt-1 text-xs text-on-surface-variant font-korean">{guide.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {guide.names.map((name) => (
                      <span key={name} className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-korean">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 border-2 border-dashed border-outline-variant/30 hover:border-primary/40 cursor-pointer transition-colors flex flex-col items-center gap-4"
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="text-primary/40">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-body text-on-surface font-korean">
                엑셀 파일을 드래그하거나 <span className="text-primary font-semibold">클릭하여 선택</span>하세요
              </p>
              <p className="text-xs text-on-surface-variant mt-1 font-korean">.xlsx, .xls 파일 지원 (멀티 시트 자동 감지)</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {processing && (
              <p className="text-sm text-primary font-korean">파일 읽는 중...</p>
            )}
          </div>

          <div className="bg-tertiary/5 border border-tertiary/15 rounded-2xl px-5 py-4">
            <p className="text-sm font-semibold text-tertiary font-korean">차감 항목 자동 반영 안내</p>
            <div className="mt-2 space-y-1 text-xs text-on-surface-variant font-korean">
              {AUTO_DEDUCTION_GUIDES.map((guide) => (
                <p key={guide}>- {guide}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Step 1.5: Sheet Select (Coupang multi-sheet) ═══ */}
      {step === 'sheet-select' && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-headline font-semibold text-on-surface font-korean">시트 선택</h2>
                <p className="text-xs text-on-surface-variant mt-1 font-korean">
                  파일: <span className="font-data text-on-surface">{fileName}</span> ({sheetInfos.length}개 시트 감지)
                </p>
              </div>
              <Badge label="쿠팡 정산서 감지" variant="info" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sheetInfos.map((sheet) => {
                const isSelected = selectedSheet === sheet.name;
                const typeLabels: Record<string, { label: string; desc: string; color: string }> = {
                  'coupang_summary': { label: '정산총괄', desc: '기사별 합산 정산 (추천)', color: 'text-primary' },
                  'coupang_raw': { label: '정산Raw', desc: '일별 배송 상세 데이터', color: 'text-on-surface-variant' },
                  'damage_list': { label: '분실파손', desc: '분실/파손 차감 상세', color: 'text-error' },
                  'generic': { label: '기타', desc: '이력 및 메타 데이터', color: 'text-on-surface-variant' },
                };
                const info = typeLabels[sheet.detected] ?? typeLabels['generic'];

                return (
                  <button
                    key={sheet.name}
                    onClick={() => setSelectedSheet(sheet.name)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-outline-variant/20 hover:border-outline-variant/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-body font-semibold text-on-surface">{sheet.name}</span>
                      <span className={`text-xs font-label ${info.color}`}>{info.label}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant font-korean">{info.desc}</p>
                    <p className="text-xs font-data text-on-surface-variant mt-1">{sheet.rowCount}행</p>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3">
              <p className="text-xs font-semibold text-on-surface font-korean mb-2">권장 시트명</p>
              <div className="space-y-1 text-xs text-on-surface-variant font-korean">
                <p>- 1시트: <span className="text-on-surface font-semibold">정산총괄</span></p>
                <p>- 2시트: <span className="text-on-surface font-semibold">정산총괄</span> + <span className="text-on-surface font-semibold">정산Raw</span></p>
                <p>- 3시트: <span className="text-on-surface font-semibold">정산총괄</span> + <span className="text-on-surface font-semibold">정산Raw</span> + <span className="text-on-surface font-semibold">화물사고 상세내역</span></p>
              </div>
            </div>

            {/* Import mode selection */}
            <div className="pt-2 border-t border-outline-variant/20">
              <p className="text-xs font-label font-medium text-on-surface-variant mb-2 font-korean">정산 모드</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setImportMode('coupang_direct')}
                  className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${
                    importMode === 'coupang_direct'
                      ? 'border-primary bg-primary/5'
                      : 'border-outline-variant/20 hover:border-outline-variant/40'
                  }`}
                >
                  <p className="text-sm font-body font-semibold text-on-surface font-korean">자동 정산 (추천)</p>
                  <p className="text-xs text-on-surface-variant mt-0.5 font-korean">
                    정산총괄 시트에서 건수 추출 → 기사별 계약 단가 적용
                  </p>
                </button>
                <button
                  onClick={() => setImportMode('calculate')}
                  className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${
                    importMode === 'calculate'
                      ? 'border-primary bg-primary/5'
                      : 'border-outline-variant/20 hover:border-outline-variant/40'
                  }`}
                >
                  <p className="text-sm font-body font-semibold text-on-surface font-korean">열 매핑 정산</p>
                  <p className="text-xs text-on-surface-variant mt-0.5 font-korean">
                    직접 열을 매핑하여 건수/단가 계산
                  </p>
                </button>
              </div>
            </div>

            {/* Preview of selected sheet */}
            {selectedSheet && importMode === 'coupang_direct' && (() => {
              const wb = workbookRef.current;
              if (!wb) return null;
              const ws = getWorksheet(wb, selectedSheet);
              if (!ws) return null;
              const rows = worksheetToRows(ws);
              const headerRow = rows[4] as string[] | undefined;
              const dataRows = rows.slice(5, 10);

              if (!headerRow) return null;

              return (
                <div>
                  <p className="text-xs font-label font-medium text-on-surface-variant mb-2 font-korean">데이터 미리보기 (상위 5행)</p>
                  <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-surface-container-low">
                          {headerRow.map((h, i) => (
                            <th key={i} className="px-3 py-2 font-label font-semibold text-on-surface-variant whitespace-nowrap">
                              {String(h ?? '').replace(/\r\n/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/20">
                        {dataRows.map((row, idx) => (
                          <tr key={idx}>
                            {headerRow.map((_, i) => {
                              const arr = row as unknown[];
                              return (
                                <td key={i} className="px-3 py-2 font-data text-on-surface whitespace-nowrap">
                                  {typeof arr[i] === 'number'
                                    ? (arr[i] as number).toLocaleString()
                                    : String(arr[i] ?? '')}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => { setStep('upload'); setSheetInfos([]); }}
              className="h-11 px-6 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm hover:bg-surface-container-highest transition-colors font-korean"
            >
              다시 업로드
            </button>
            <button
              onClick={() => {
                if (importMode === 'coupang_direct') {
                  processCoupangDirect();
                } else {
                  loadSheetForMapping(selectedSheet);
                  setStep('mapping');
                }
              }}
              disabled={processing || !selectedSheet}
              className="h-11 px-8 rounded-xl bg-power-gradient text-white font-label font-semibold text-sm hover:shadow-lg transition-shadow disabled:opacity-50 font-korean"
            >
              {processing ? '처리 중...' : importMode === 'coupang_direct' ? '자동 정산 실행' : '열 매핑으로 이동'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ Step 2: Column Mapping (generic mode) ═══ */}
      {step === 'mapping' && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-headline font-semibold text-on-surface font-korean">열 매핑 설정</h2>
                <p className="text-xs text-on-surface-variant mt-1 font-korean">
                  파일: <span className="font-data text-on-surface">{fileName}</span> ({rawRows.length}행)
                </p>
                {savedExcelType !== 'generic' && (
                  <p className="text-xs text-tertiary mt-1 font-korean">
                    ✅ 저장된 매핑 적용됨 ({EXCEL_TYPE_LABELS[savedExcelType]})
                  </p>
                )}
              </div>
              <Badge label={`${headers.length}개 열 감지`} variant="info" />
            </div>

            {/* 자동 분류 결과 요약 */}
            {columnClassifications.length > 0 && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-xs font-semibold text-primary font-korean mb-2">🤖 자동 분류 결과</p>
                <div className="flex flex-wrap gap-2 text-[11px] font-korean">
                  <span className="px-2 py-1 rounded bg-blue-50 text-blue-700">
                    수익 {columnClassifications.filter(c => c.category === 'income').length}개
                  </span>
                  <span className="px-2 py-1 rounded bg-red-50 text-red-700">
                    차감 {columnClassifications.filter(c => c.category === 'deduction').length}개
                  </span>
                  <span className="px-2 py-1 rounded bg-gray-100 text-gray-600">
                    정보 {columnClassifications.filter(c => c.category === 'info').length}개
                  </span>
                  <span className="px-2 py-1 rounded bg-surface-container-high text-on-surface-variant">
                    미분류 {columnClassifications.filter(c => c.category === 'unmapped').length}개
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'employee_code_col' as const, label: '사번 열 *', required: true },
                { key: 'delivery_count_col' as const, label: '배송 건수 열 *', required: true },
                { key: 'return_count_col' as const, label: '반품 건수 열', required: false },
                { key: 'collect_count_col' as const, label: '집하 건수 열', required: false },
                { key: 'fresh_count_col' as const, label: '프레쉬백 건수 열', required: false },
                { key: 'etc_count_col' as const, label: '기타 건수 열', required: false },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">
                    {field.label}
                  </label>
                  <select
                    value={mapping[field.key] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">{field.required ? '필수 선택' : '해당없음'}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">
                  기사명 열
                </label>
                <select
                  value={mapping.driver_name_col ?? ''}
                  onChange={(e) => setMapping((m) => ({ ...m, driver_name_col: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">해당없음</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-on-surface-variant font-korean">
                  이름 열을 선택하면 사번과 기사명을 함께 검증해 오발송을 줄입니다.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'delivery_amount_col' as const, label: '\uBC30\uC1A1 \uAE08\uC561 \uC5F4', required: false },
                { key: 'return_amount_col' as const, label: '\uBC18\uD488 \uAE08\uC561 \uC5F4', required: false },
                { key: 'collect_amount_col' as const, label: '\uC9D1\uD558 \uAE08\uC561 \uC5F4', required: false },
                { key: 'fresh_back_amount_col' as const, label: '\uD504\uB808\uC26C\uBC31 \uAE08\uC561 \uC5F4', required: false },
                { key: 'incentive_amount_col' as const, label: '\uC778\uC13C\uD2F0\uBE0C \uAE08\uC561 \uC5F4', required: false },
                { key: 'etc_income_amount_col' as const, label: '\uAE30\uD0C0 \uC218\uC785 \uAE08\uC561 \uC5F4', required: false },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">
                    {field.label}
                  </label>
                  <select
                    value={mapping[field.key] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">{field.required ? '\uD544\uC218 \uC120\uD0DD' : '\uD574\uB2F9\uC5C6\uC74C'}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-tertiary/20 bg-tertiary/5 px-4 py-3">
              <p className="text-xs font-semibold text-tertiary font-korean mb-2">
                {'\uD5E4\uB354 \uC785\uB825 \uAC00\uC774\uB4DC'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-on-surface-variant font-korean">
                {(['employee_code_col', 'driver_name_col', 'delivery_count_col', 'delivery_amount_col', 'return_count_col', 'collect_count_col'] as GuidedMappingKey[]).map((field) => (
                  <p key={field}>
                    <span className="font-semibold text-on-surface">{HEADER_FIELD_LABELS[field]}</span>
                    {' : '}
                    {getHeaderExamples(field, savedExcelType).map((value) => `"${value}"`).join(', ')}
                  </p>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3">
              <p className="text-xs font-semibold text-on-surface font-korean mb-2">보험료 / 차감 안내</p>
              <div className="space-y-1 text-xs text-on-surface-variant font-korean">
                {AUTO_DEDUCTION_GUIDES.map((guide) => (
                  <p key={guide}>- {guide}</p>
                ))}
              </div>
            </div>

            {false && (null
              /*
              {[
                { key: 'delivery_amount_col' as const, label: '諛곗넚 湲덉븸 ??, required: false },
                { key: 'return_amount_col' as const, label: '諛섑뭹 湲덉븸 ??, required: false },
                { key: 'collect_amount_col' as const, label: '吏묓븯 湲덉븸 ??, required: false },
                { key: 'fresh_back_amount_col' as const, label: '?꾨젅?щ갚 湲덉븸 ??, required: false },
                { key: 'incentive_amount_col' as const, label: '?몄꽱?곕툕 湲덉븸 ??, required: false },
                { key: 'etc_income_amount_col' as const, label: '湲고??섏엯 湲덉븸 ??, required: false },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">
                    {field.label}
                  </label>
                  <select
                    value={mapping[field.key] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">{field.required ? '?꾩닔 ?좏깮' : '?대떦?놁쓬'}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
              */
            )}

            <div>
              <p className="text-xs font-label font-medium text-on-surface-variant mb-2 font-korean">데이터 미리보기 (상위 3행)</p>
              <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-surface-container-low">
                      {headers.map((h, hIdx) => {
                        const cls = columnClassifications[hIdx];
                        const catLabel = cls?.category === 'income' ? '수익' : cls?.category === 'deduction' ? '차감' : cls?.category === 'info' ? '정보' : null;
                        const catColor = cls?.category === 'income' ? 'text-blue-600 bg-blue-50' : cls?.category === 'deduction' ? 'text-red-600 bg-red-50' : cls?.category === 'info' ? 'text-gray-600 bg-gray-100' : '';
                        return (
                        <th key={h} className="px-3 py-2 font-label font-semibold text-on-surface-variant whitespace-nowrap">
                          <span>{h}</span>
                          {h === mapping.employee_code_col && <span className="text-primary ml-1">(사번)</span>}
                          {h === mapping.delivery_count_col && <span className="text-primary ml-1">(배송)</span>}
                          {catLabel && cls && cls.confidence >= 0.5 && (
                            <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${catColor}`}>{catLabel}</span>
                          )}
                        </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {rawRows.slice(0, 3).map((row, idx) => (
                      <tr key={idx}>
                        {headers.map((h) => (
                          <td key={h} className="px-3 py-2 font-data text-on-surface whitespace-nowrap">
                            {String(row[h] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => { setStep('upload'); setRawRows([]); setHeaders([]); }}
              className="h-11 px-6 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm hover:bg-surface-container-highest transition-colors font-korean"
            >
              다시 업로드
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  if (!principalId) return;
                  const { error: saveErr } = await saveUploadMapping(principalId, {
                    employee_code_col: mapping.employee_code_col,
                    driver_name_col: mapping.driver_name_col ?? '',
                    delivery_count_col: mapping.delivery_count_col,
                    return_count_col: mapping.return_count_col ?? '',
                    collect_count_col: mapping.collect_count_col ?? '',
                    delivery_amount_col: mapping.delivery_amount_col ?? '',
                    return_amount_col: mapping.return_amount_col ?? '',
                    collect_amount_col: mapping.collect_amount_col ?? '',
                    fresh_count_col: mapping.fresh_count_col ?? '',
                    etc_count_col: mapping.etc_count_col ?? '',
                    fresh_back_amount_col: mapping.fresh_back_amount_col ?? '',
                    incentive_amount_col: mapping.incentive_amount_col ?? '',
                    etc_income_amount_col: mapping.etc_income_amount_col ?? '',
                  }, savedExcelType);
                  if (saveErr) { toastError('매핑 저장 실패: ' + saveErr); return; }
                  toastSuccess('이 원청사의 엑셀 매핑이 저장되었습니다. 다음 업로드 시 자동 적용됩니다.');
                }}
                disabled={!principalId || !mapping.employee_code_col}
                className="h-11 px-5 rounded-xl bg-surface-container-low text-on-surface-variant border border-outline-variant/30 font-label text-sm hover:bg-surface-container-high transition-colors disabled:opacity-40 font-korean"
              >
                이 매핑 저장
              </button>
              <button
                onClick={processSettlement}
                disabled={processing || !mapping.employee_code_col || !mapping.delivery_count_col}
                className="h-11 px-8 rounded-xl bg-power-gradient text-white font-label font-semibold text-sm hover:shadow-lg transition-shadow disabled:opacity-50 font-korean"
              >
                {processing ? '정산 계산 중...' : '자동 정산 실행'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Step 3: Preview ═══ */}
      {step === 'preview' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className={`grid gap-4 ${isCoupangMode ? 'grid-cols-2 lg:grid-cols-6' : 'grid-cols-2 lg:grid-cols-5'}`}>
            {[
              { title: '매칭 기사', value: `${settlements.length}명`, color: 'text-primary' },
              { title: '미매칭', value: `${unmatched.length}건`, color: unmatched.length > 0 ? 'text-error' : 'text-on-surface' },
              { title: '기본 정산액', value: formatKRW(totalBase), color: 'text-primary' },
              ...(isCoupangMode ? [
                { title: '인센티브', value: formatKRW(totalFreshIncentive + totalExtraIncentive), color: 'text-success' },
              ] : []),
              { title: '총 공제액', value: formatKRW(totalDeduction), color: 'text-error' },
              ...(totalVat > 0 ? [{ title: '부가세 공제', value: formatKRW(totalVat), color: 'text-error' }] : []),
              ...(totalWithholding > 0 ? [{ title: '원천징수 3.3%', value: formatKRW(totalWithholding), color: 'text-error' }] : []),
              { title: '실지급 합계', value: formatKRW(totalFinal), color: 'text-tertiary' },
            ].map((card) => (
              <div key={card.title} className="bg-surface-container-lowest rounded-2xl shadow-ambient p-4">
                <p className="text-xs font-label text-on-surface-variant font-korean">{card.title}</p>
                <p className={`mt-1 text-lg font-data font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Skipped entries notice */}
          {skippedEntries.length > 0 && (
            <div className="bg-surface-container-low rounded-xl px-4 py-3">
              <p className="text-xs text-on-surface-variant font-korean">
                제외된 특수 항목: {skippedEntries.join(', ')}
              </p>
            </div>
          )}

          {/* Unmatched warning */}
          {unmatched.length > 0 && (
            <div className="bg-warning/10 rounded-xl px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-warning font-korean">
                미매칭 기사 {unmatched.length}건
              </p>
              <div className="text-xs text-on-surface-variant font-korean space-y-0.5">
                {unmatched.slice(0, 5).map((u, idx) => (
                  <p key={idx}>
                    사번 &quot;{u.employee_code}&quot;
                    {u.driver_name ? ` / 엑셀 기사명 "${u.driver_name}"` : ''}
                    {' — '}
                    {u.reason ?? '등록된 기사 없음'}
                  </p>
                ))}
                {unmatched.length > 5 && <p>... 외 {unmatched.length - 5}건</p>}
              </div>
              <p className="text-xs text-warning/80 font-korean mt-1">
                미매칭이 0건이어야 정산 저장이 가능합니다.
              </p>
            </div>
          )}

          {/* Unmatched routes warning */}
          {unmatchedRoutes.length > 0 && (
            <div className="bg-error/10 rounded-xl px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-error font-korean">
                미설정 라우트 {unmatchedRoutes.length}건 (단가 0원 적용됨)
              </p>
              <div className="text-xs text-on-surface-variant font-korean space-y-0.5">
                {unmatchedRoutes.slice(0, 8).map((u, idx) => (
                  <p key={idx}>{u.employee_code} → 라우트 &quot;{u.route_code}&quot; 단가 미설정</p>
                ))}
                {unmatchedRoutes.length > 8 && <p>... 외 {unmatchedRoutes.length - 8}건</p>}
              </div>
              <p className="text-xs text-error/70 font-korean mt-1">
                기사 관리 &gt; 기사 상세에서 라우트별 단가를 설정하세요
              </p>
            </div>
          )}

          {/* Settlement table */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean">기사명</th>
                    <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean">사번</th>
                    <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean text-right">배송</th>
                    <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean text-right">반품</th>
                    <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean text-right">기본금액</th>
                    {isCoupangMode && (
                      <>
                        <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean text-right">프레쉬백</th>
                        <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean text-right">추가인센</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean text-right">공제</th>
                    <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean text-right">실수령</th>
                    <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean">상세</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {settlements.map((s) => (
                    <>
                      <tr key={s.driver_id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-body text-on-surface font-korean">{s.driver_name}</td>
                        <td className="px-4 py-3 text-xs font-data text-on-surface-variant">{s.employee_code}</td>
                        <td className="px-4 py-3 text-sm font-data text-on-surface text-right">{s.delivery_count.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-data text-on-surface text-right">{s.return_count.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-data text-on-surface text-right">{formatKRW(s.base_amount)}</td>
                        {isCoupangMode && (
                          <>
                            <td className="px-4 py-3 text-sm font-data text-success text-right">{formatKRW(s.fresh_incentive ?? 0)}</td>
                            <td className="px-4 py-3 text-sm font-data text-success text-right">{formatKRW(s.extra_incentive ?? 0)}</td>
                          </>
                        )}
                        <td className="px-4 py-3 text-sm font-data text-error text-right">-{formatKRW(s.total_deduction)}</td>
                        <td className="px-4 py-3 text-sm font-data font-semibold text-primary text-right">{formatKRW(s.final_amount ?? s.net_amount)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpandedDriver(expandedDriver === s.driver_id ? null : s.driver_id)}
                            className="text-xs text-primary hover:underline font-korean"
                          >
                            {expandedDriver === s.driver_id ? '접기' : '펼치기'}
                          </button>
                        </td>
                      </tr>
                      {expandedDriver === s.driver_id && (
                        <tr key={`${s.driver_id}-detail`}>
                          <td colSpan={isCoupangMode ? 10 : 8} className="px-4 py-4 bg-surface-container-low/30">
                            <div className="space-y-4 text-xs">
                              {/* Route-based rate details */}
                              {s.route_details && s.route_details.length > 0 ? (
                                <div>
                                  <p className="font-label font-semibold text-on-surface-variant mb-2 font-korean">라우트별 정산 내역</p>
                                  <div className="overflow-x-auto rounded-lg border border-outline-variant/20">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="bg-surface-container-low">
                                          <th className="px-3 py-1.5 font-label font-semibold text-on-surface-variant font-korean">라우트</th>
                                          <th className="px-3 py-1.5 font-label font-semibold text-on-surface-variant font-korean text-right">배송</th>
                                          <th className="px-3 py-1.5 font-label font-semibold text-on-surface-variant font-korean text-right">반품</th>
                                          <th className="px-3 py-1.5 font-label font-semibold text-on-surface-variant font-korean text-right">계약단가</th>
                                          <th className="px-3 py-1.5 font-label font-semibold text-on-surface-variant font-korean text-right">쿠팡단가</th>
                                          <th className="px-3 py-1.5 font-label font-semibold text-on-surface-variant font-korean text-right">금액</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-outline-variant/10">
                                        {s.route_details.map((rd, idx) => (
                                          <tr key={idx} className={rd.driver_delivery_rate === 0 ? 'bg-error/5' : ''}>
                                            <td className="px-3 py-1.5 font-data font-semibold">{rd.route_code}</td>
                                            <td className="px-3 py-1.5 font-data text-right">{rd.delivery_count.toLocaleString()}</td>
                                            <td className="px-3 py-1.5 font-data text-right">{rd.return_count.toLocaleString()}</td>
                                            <td className="px-3 py-1.5 font-data text-right">
                                              {rd.driver_delivery_rate > 0 ? `₩${rd.driver_delivery_rate.toLocaleString()}` : <span className="text-error">미설정</span>}
                                            </td>
                                            <td className="px-3 py-1.5 font-data text-on-surface-variant text-right">₩{rd.coupang_rate.toLocaleString()}</td>
                                            <td className="px-3 py-1.5 font-data font-semibold text-right">{formatKRW(rd.total_amount)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ) : s.rate_details.length > 0 ? (
                                <div>
                                  <p className="font-label font-semibold text-on-surface-variant mb-2 font-korean">단가 내역</p>
                                  <div className="space-y-1">
                                    {s.rate_details.map((r, idx) => (
                                      <div key={idx} className="flex items-center justify-between">
                                        <span className="font-korean">{r.package_type} {r.count.toLocaleString()}건 x ₩{r.rate_value.toLocaleString()}</span>
                                        <span className="font-data font-semibold">{formatKRW(r.amount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-on-surface-variant/50 font-korean">설정된 단가 없음 (기사 상세에서 라우트별 단가를 설정하세요)</p>
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Incentives */}
                                {isCoupangMode && ((s.fresh_incentive ?? 0) > 0 || (s.extra_incentive ?? 0) > 0) && (
                                  <div>
                                    <p className="font-label font-semibold text-on-surface-variant mb-1 font-korean">인센티브 (100% 지급)</p>
                                    <div className="space-y-1">
                                      {(s.fresh_incentive ?? 0) > 0 && (
                                        <div className="flex items-center justify-between">
                                          <span className="font-korean">프레쉬백 회수</span>
                                          <span className="font-data font-semibold text-success">+{formatKRW(s.fresh_incentive ?? 0)}</span>
                                        </div>
                                      )}
                                      {(s.extra_incentive ?? 0) > 0 && (
                                        <div className="flex items-center justify-between">
                                          <span className="font-korean">추가 인센티브</span>
                                          <span className="font-data font-semibold text-success">+{formatKRW(s.extra_incentive ?? 0)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {/* Deductions */}
                                <div>
                                  <p className="font-label font-semibold text-on-surface-variant mb-1 font-korean">공제 내역</p>
                                  {s.deduction_details.length === 0 ? (
                                    <p className="text-on-surface-variant/50 font-korean">공제 없음</p>
                                  ) : (
                                    <div className="space-y-1">
                                      {s.deduction_details.map((d, idx) => (
                                        <div key={idx} className="flex items-center justify-between">
                                          <span className="font-korean">{d.name}</span>
                                          <span className="font-data font-semibold text-error">-{formatKRW(d.calculated)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {cargoAccidentDetail && s.deduction_details.some((detail) => /화물사고|분실파손/.test(detail.name)) && (
                                <div className="rounded-xl bg-surface-container-high px-4 py-3">
                                  <p className="font-label font-semibold text-on-surface-variant mb-1 font-korean">화물사고 상세내역</p>
                                  <p className="text-sm text-on-surface-variant font-korean whitespace-pre-line">
                                    {cargoAccidentDetail}
                                  </p>
                                </div>
                              )}

                              {/* VAT / Business info */}
                              <div className="pt-2 border-t border-outline-variant/20 flex flex-wrap items-center gap-4">
                                <span className="font-korean text-on-surface-variant">사업자: <span className="text-on-surface font-semibold">{s.is_business_owner ? '유' : '무'}</span></span>
                                {s.is_business_owner && (
                                  <span className="font-korean text-on-surface-variant">부가세: <span className="text-on-surface font-semibold">{s.vat_included ? '포함가' : '별도'}</span></span>
                                )}
                                {(s.vat_amount ?? 0) > 0 && (
                                  <span className="font-korean text-on-surface-variant">부가세 공제: <span className="text-error font-semibold">-{formatKRW(s.vat_amount ?? 0)}</span></span>
                                )}
                                {(s.withholding_amount ?? 0) > 0 && (
                                  <span className="font-korean text-on-surface-variant">원천징수 3.3%: <span className="text-error font-semibold">-{formatKRW(s.withholding_amount ?? 0)}</span></span>
                                )}
                                <span className="font-korean text-on-surface-variant">실지급액: <span className="text-primary font-bold">{formatKRW(s.final_amount ?? s.net_amount)}</span></span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
                {/* Totals footer */}
                <tfoot>
                  <tr className="bg-surface-container-low font-semibold">
                    <td className="px-4 py-3 text-sm font-label text-on-surface font-korean" colSpan={2}>합계</td>
                    <td className="px-4 py-3 text-sm font-data text-on-surface text-right">
                      {settlements.reduce((s, r) => s + r.delivery_count, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-data text-on-surface text-right">
                      {settlements.reduce((s, r) => s + r.return_count, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-data text-on-surface text-right">{formatKRW(totalBase)}</td>
                    {isCoupangMode && (
                      <>
                        <td className="px-4 py-3 text-sm font-data text-success text-right">{formatKRW(totalFreshIncentive)}</td>
                        <td className="px-4 py-3 text-sm font-data text-success text-right">{formatKRW(totalExtraIncentive)}</td>
                      </>
                    )}
                    <td className="px-4 py-3 text-sm font-data text-error text-right">-{formatKRW(totalDeduction)}</td>
                    <td className="px-4 py-3 text-sm font-data font-bold text-primary text-right">{formatKRW(totalFinal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(isCoupangMode ? 'sheet-select' : 'mapping')}
              className="h-11 px-6 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm hover:bg-surface-container-highest transition-colors font-korean"
            >
              {isCoupangMode ? '시트 선택으로' : '매핑 수정'}
            </button>
            <div className="flex items-center gap-3">
              <p className="text-sm text-on-surface-variant font-korean">
                {yearMonth.replace('-', '년 ')}월 정산으로 저장합니다
              </p>
              <button
                onClick={handleSave}
                disabled={processing || unmatched.length > 0 || unmatchedRoutes.length > 0}
                className="h-11 px-8 rounded-xl bg-power-gradient text-white font-label font-semibold text-sm hover:shadow-lg transition-shadow disabled:opacity-50 font-korean"
              >
                {processing ? '저장 중...' : '정산 확정 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Step 4: Done ═══ */}
      {step === 'done' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-success">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-headline font-bold text-on-surface font-korean">정산 저장 완료</h2>
            <p className="mt-2 text-sm text-on-surface-variant font-korean">
              {settlements.length}명의 기사에 대한 {yearMonth.replace('-', '년 ')}월 정산이 저장되었습니다
            </p>
          </div>
          <div className={`grid gap-6 text-center ${isCoupangMode ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <div>
              <p className="text-xs text-on-surface-variant font-korean">기본 정산액</p>
              <p className="text-lg font-data font-bold text-primary">{formatKRW(totalBase)}</p>
            </div>
            {isCoupangMode && (
              <div>
                <p className="text-xs text-on-surface-variant font-korean">인센티브</p>
                <p className="text-lg font-data font-bold text-success">{formatKRW(totalFreshIncentive + totalExtraIncentive)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-on-surface-variant font-korean">총 공제액</p>
              <p className="text-lg font-data font-bold text-error">{formatKRW(totalDeduction)}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant font-korean">실지급 합계</p>
              <p className="text-lg font-data font-bold text-tertiary">{formatKRW(totalFinal)}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/portal/settlements/generate')}
              className="h-11 px-6 rounded-xl bg-primary text-white font-label font-semibold text-sm hover:bg-primary/90 font-korean"
            >
              정산서 확인
            </button>
            <button
              onClick={() => { setStep('upload'); setSettlements([]); setUnmatched([]); setRawRows([]); setHeaders([]); setSheetInfos([]); setSkippedEntries([]); }}
              className="h-11 px-6 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm hover:bg-surface-container-highest transition-colors font-korean"
            >
              추가 업로드
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
