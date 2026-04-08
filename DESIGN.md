# Design System — logiSSign

## Product Context
- **What this is:** Korean logistics groupware. Contract management + settlement calculation for branch managers and delivery drivers.
- **Who it's for:** Branch managers (대리점장, desktop web) and delivery drivers (기사, 40-60 years old, mobile app)
- **Space/industry:** Korean logistics, B2B SaaS, groupware (KakaoWork/Naver Works category)
- **Project type:** Web dashboard (admin/portal) + Mobile app (drivers)

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian with Korean groupware polish
- **Decoration level:** Minimal — typography and whitespace do the work
- **Mood:** Trustworthy, simple, no-nonsense. Like a well-organized office tool, not a flashy consumer app. A 55-year-old delivery driver should be able to use it without thinking about the UI.
- **Branding rule:** Driver-facing screens show the agency (대리점) logo and company name, NOT logiSSign. logiSSign branding only appears in the app icon, splash screen, and admin portal. The driver sees their company's identity.

## Typography
- **All text:** Pretendard (Korean-native geometric sans, standard for Korean B2B apps)
- **Loading:** `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css`
- **Why Pretendard:** Used by Toss, Kakao, most Korean B2B apps. Drivers recognize it subconsciously as "professional Korean app." No Latin-first font substitution. Full Korean glyph support.
- **Scale (mobile, for drivers — NEVER below 14px):**
  - Title: 22px / Bold
  - Subtitle: 18px / SemiBold
  - Body: 16px / Regular
  - Caption: 14px / Regular (metadata only)
  - Amount (settlement net): 28px / Bold
- **Scale (web, for branch managers):**
  - Page title: 24px / Bold
  - Section title: 20px / SemiBold
  - Body: 15px / Regular
  - Small: 13px / Regular
  - Data table: 14px / Regular (tabular-nums)
- **Code:** JetBrains Mono (only if code appears, rare)

## Color
- **Approach:** Restrained — 1 accent + neutrals. Purple is rare and meaningful.
- **Primary:** #7B2FF7 — brand purple. Used sparingly: CTAs, active tab, key badges only.
- **Primary hover:** #6B1FE7
- **Background (web):** #FFFFFF
- **Background (mobile):** #F5F5F5
- **Surface:** #F8F9FA — cards, panels, elevated content
- **Text primary:** #1A1A1A
- **Text secondary:** #6B7280
- **Border:** #E5E7EB
- **Semantic:**
  - Success: #10B981 (서명완료, 정산완료)
  - Warning: #F59E0B (서명대기, 기한 임박)
  - Error: #EF4444 (인증실패, 오류)
  - Info: #3B82F6 (새 알림)
- **Dark mode:** Not supported. Work tool used during daytime by non-tech-savvy users. Adds complexity with zero user value.

## Spacing
- **Base unit:** 8px
- **Density:**
  - Web portal (branch managers): comfortable, 16-24px gaps between elements
  - Mobile app (drivers): spacious, 16-32px gaps, generous padding
- **Scale:** 4, 8, 12, 16, 24, 32, 48, 64
- **Touch targets:** 48px minimum on mobile (drivers have rough hands, not clean dry fingers)

## Layout
- **Approach:** Grid-disciplined — standard groupware patterns
- **Web portal:** Sidebar nav (240px) + main content area. Collapsible on smaller screens.
- **Mobile app:** Bottom tab bar (5 tabs: 홈, 계약, 정산, 공지, 프로필) + full-width cards
- **Max content width:** 1280px (web), 375-428px (mobile)
- **Border radius:**
  - Small (buttons, inputs): 8px
  - Medium (cards): 12px
  - Full (badges, pills): 9999px
- **Cards:** Only when card IS the interaction (contract card, settlement card). No decorative card grids.

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension
- **Page transitions:** 200ms ease-out
- **Button press:** 100ms scale(0.98) for tactile feedback
- **No fancy animations.** Drivers don't care. Speed matters. Older phones must perform well.
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)

## Driver-Facing Screen Rules
1. NEVER below 14px text
2. 48px minimum touch targets
3. Agency logo + company name at top (not logiSSign)
4. Settlement amounts: 28px Bold, net amount is the first thing visible
5. Deductions in red (#EF4444) for instant recognition
6. Empty states: warm Korean copy + primary action, not just "데이터가 없습니다"
7. Loading: skeleton cards, not spinner (feels faster)
8. Error: clear Korean message + retry button + support contact

## Branch Manager Web Rules
1. Sidebar navigation with Korean labels
2. Data tables: sortable, filterable, 14px tabular-nums
3. Batch actions visible (send all settlements, send all contracts)
4. Agency logo upload area in settings
5. Status badges consistent with mobile (same colors, same labels)

## Interaction States (all features)

| Feature | Loading | Empty | Error | Success |
|---------|---------|-------|-------|---------|
| Contract list | Skeleton cards | "아직 계약서가 없습니다" + 운영사 문의 | "불러올 수 없습니다" + 재시도 | Normal list |
| Contract signing | Full-screen spinner | — | "본인인증 실패" + 재시도 + 지원 연락처 | Celebration + "서명 완료!" |
| Settlement list | Skeleton rows | "정산서가 아직 없습니다" + 정산일 안내 | "불러올 수 없습니다" + 재시도 | Normal list |
| Settlement PDF | PDF loading indicator | — | "PDF 열 수 없습니다" + 다운로드 링크 | PDF rendered |
| Push notification | — | — | — | "새 정산서가 도착했습니다" |

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-08 | Initial design system | Created by /design-consultation. Korean groupware aesthetic. KakaoWork/Naver Works reference. |
| 2026-04-08 | Pretendard as sole font | Korean-native, used by Toss/Kakao. No Latin-first font substitution needed. |
| 2026-04-08 | 16px minimum mobile text | Drivers are 40-60, not tech-savvy. Readability over density. |
| 2026-04-08 | No dark mode | Work tool, daytime use, adds complexity with zero value for target users. |
| 2026-04-08 | Agency branding over platform branding | Drivers see their company's logo, not logiSSign. White-label groupware pattern. |
| 2026-04-08 | Settlement-first mobile home | Drivers open app to check pay. Net amount is the hero. Contract banner secondary. |
| 2026-04-08 | Settlement PDF with detailed deductions | Customer logo + company name, each deduction/incident visible individually. |
