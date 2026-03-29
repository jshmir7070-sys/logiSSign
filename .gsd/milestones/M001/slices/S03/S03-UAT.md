# S03: 웹 포털 — 정산서 생성 & 전자계약 관리 — UAT

**Milestone:** M001
**Written:** 2026-03-29T09:02:04.158Z

## UAT: Web Portal \u2014 Settlement & Contract\n\n### Build\n- [x] `npm run build` \u2014 0 errors\n- [x] `npx tsc --noEmit` \u2014 0 type errors\n\n### Settlement Pages\n- [x] Upload page renders (1015 lines, multi-step Excel upload)\n- [x] Generate page renders (749 lines, settlement list + summary KPIs)\n- [x] Rules page renders (191 lines, settlement rules management)\n- [x] Services: getSettlements, sendSettlements, confirmSettlements, generateTaxInvoices\n\n### Contract Pages\n- [x] Contract list page with status tabs (all/signed/sent/expired)\n- [x] Template CRUD with variable binding ({{\uae30\uc0ac\uba85}}, {{\uc804\ud654\ubc88\ud638}} etc)\n- [x] Contract service: createAndSendContracts with SHA-256 hash and sign token\n\n### Design System\n- [x] Pages use Precision Velocity tokens (font-headline, bg-power-gradient, shadow-ambient)
