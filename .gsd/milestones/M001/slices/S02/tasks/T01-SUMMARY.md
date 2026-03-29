---
id: T01
parent: S02
milestone: M001
provides: []
requires: []
affects: []
key_files: ["supabase/schema.sql"]
key_decisions: ["Added 4 per-driver override tables matching web service requirements", "Added ON DELETE CASCADE to child table FKs", "RLS enabled on all 15 non-system tables (was only 7)", "Added invoice_type to tax_invoices, vat_amount to settlements"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "All FK references resolve to existing tables. 19 tables, 15 RLS-enabled, 20 policies, 15 indexes."
completed_at: 2026-03-29T08:27:24.840Z
blocker_discovered: false
---

# T01: Extended schema from 15→19 tables with full RLS coverage matching all web service requirements

> Extended schema from 15→19 tables with full RLS coverage matching all web service requirements

## What Happened
---
id: T01
parent: S02
milestone: M001
key_files:
  - supabase/schema.sql
key_decisions:
  - Added 4 per-driver override tables matching web service requirements
  - Added ON DELETE CASCADE to child table FKs
  - RLS enabled on all 15 non-system tables (was only 7)
  - Added invoice_type to tax_invoices, vat_amount to settlements
duration: ""
verification_result: passed
completed_at: 2026-03-29T08:27:24.889Z
blocker_discovered: false
---

# T01: Extended schema from 15→19 tables with full RLS coverage matching all web service requirements

**Extended schema from 15→19 tables with full RLS coverage matching all web service requirements**

## What Happened

Reviewed existing schema against all 11 web service files. Discovered 4 missing tables and 12 missing columns that services already reference. Added driver_rates, driver_route_rates, driver_deductions, driver_incentives tables. Extended drivers table with employee_code, delivery_area, business fields. Added vat_amount to settlements, invoice_type to tax_invoices. Extended RLS from 7 to 15 tables with 20 policies. Added ON DELETE CASCADE where appropriate. Added 5 new indexes.

## Verification

All FK references resolve to existing tables. 19 tables, 15 RLS-enabled, 20 policies, 15 indexes.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -c 'CREATE TABLE' supabase/schema.sql` | 0 | ✅ 19 tables | 50ms |
| 2 | `grep -c 'CREATE POLICY' supabase/schema.sql` | 0 | ✅ 20 policies | 50ms |
| 3 | `FK reference validation` | 0 | ✅ all FKs resolve | 50ms |


## Deviations

Added 4 new tables (driver_rates, driver_route_rates, driver_deductions, driver_incentives) that weren't in original schema but were required by existing web service files. Added 12 columns to drivers table (employee_code, delivery_area, is_business_owner, etc.).

## Known Issues

None.

## Files Created/Modified

- `supabase/schema.sql`


## Deviations
Added 4 new tables (driver_rates, driver_route_rates, driver_deductions, driver_incentives) that weren't in original schema but were required by existing web service files. Added 12 columns to drivers table (employee_code, delivery_area, is_business_owner, etc.).

## Known Issues
None.
