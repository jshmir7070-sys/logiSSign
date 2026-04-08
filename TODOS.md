# TODOS

Last updated: 2026-04-08 by /plan-eng-review

## Deferred from Eng Review

### 1. Self-serve Onboarding Flow
- **What:** Build guided onboarding: template selection, driver list CSV import, first contract cycle walkthrough
- **Why:** First 5 customers get white-glove. Self-serve needed for scaling beyond 5. Design doc defers to Phase 2.
- **Context:** White-glove process should be documented step-by-step during first customer onboarding, then automated.
- **Depends on:** First customer completing full cycle + confirmed pricing model

### 2. Contract Amendments UI
- **What:** Portal form for creating amendments + mobile driver response UI
- **Why:** Schema `contract_amendments` table exists with 6 amendment types. `amendment.service.ts` exists. But no portal UI for creating amendments or mobile UI for driver response.
- **Context:** Amendment types: rate, insurance, deduction, area, renewal, general. Status flow: pending -> approved/rejected/cancelled.
- **Depends on:** Contract signing flow working end-to-end

### 3. PortOne Operational Risk Mitigation
- **What:** Verify KISA compliance status, carrier agreement approvals, PortOne account limits
- **Why:** Outside voice flagged: PortOne V2 identity verification requires business registration, KISA compliance, and telecom carrier agreements. These are approval processes, not code changes. If PortOne rejects the application, signing is completely blocked.
- **Context:** PortOne is already in the codebase for payment integration. Identity verification (certification) may require separate approval.
- **Blocked by:** Nothing. Can be done in parallel with development.

### 4. Settlement Push Failure Retry
- **What:** Add retry mechanism for failed settlement push notifications and SMS
- **Why:** If Solapi SMS fails or push notification doesn't deliver, the driver never receives their settlement statement. No retry = silent failure.
- **Context:** Current implementation sends push + SMS simultaneously (after this review's fix). Need: delivery status tracking, retry on failure, branch manager notification of failed deliveries.
- **Depends on:** Settlement push implementation (simultaneous SMS+push)

## Deferred from Design Review

### 5. Amendment Notification UX
- **What:** Design the driver experience when their contract terms change mid-cycle (rate change, deduction change, etc.)
- **Why:** Without this, drivers won't know their pay terms changed until they see their settlement. Trust-destroying.
- **Context:** Push notification content, amendment detail screen in mobile app, approve/reject flow. Schema and service exist (`contract_amendments` table, `amendment.service.ts`). Mobile screen `amendment/[id]` exists but UX undefined.
- **Depends on:** Contract amendments UI (TODO #2)

### 6. Offline Indicator Design
- **What:** Design what drivers see when their phone has no signal (common during deliveries)
- **Why:** MMKV caching is planned for viewing contracts/settlements offline, but signing requires network. Without visual indicators, drivers in poor-signal areas will try to sign and hit confusing errors.
- **Context:** Subtle banner at top "오프라인 상태입니다", grayed-out sign/verify buttons with tooltip, cached content still viewable.
- **Depends on:** Mobile app core screens
