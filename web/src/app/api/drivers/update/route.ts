import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { getClientIp } from "@/lib/get-ip";
import { rateLimitAuth } from "@/lib/rate-limit";
import { logDataModification, logPiiAccess } from "@/lib/security-logger";
import { encryptDriverPii } from "@/services/pii.service";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const editableDriverFields = [
  "employee_code",
  "address",
  "email",
  "delivery_area",
  "camp_name",
  "is_business_owner",
  "business_reg_number",
  "representative_name",
  "business_address",
  "business_type",
  "business_category",
  "vat_included",
  "tax_type",
  "fresh_incentive_pct",
  "extra_incentive_pct",
  "rate_mode",
  "flat_rate",
  "rate_percentage",
  "vehicle_number",
  "vehicle_type",
  "vehicle_year",
  "vehicle_vin",
  "vehicle_mileage",
  "vehicle_owner",
  "vehicle_rent_monthly",
  "vehicle_deposit",
  "vehicle_insurance_by",
  "bank_name",
  "bank_account",
  "bank_holder",
  "custom_values",
  "birth_date",
  "status",
  "resigned_at",
] as const;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limited = await rateLimitAuth(ip, "/api/drivers/update");
  if (limited) return limited;

  try {
    const { auth, error: authError } = await authenticateRequest(request);
    if (authError || !auth) return authError!;

    const body = await request.json();
    const { driverId, driverRates, routeRates, deductions, ...fields } = body;

    if (!driverId) {
      return NextResponse.json({ error: "기사 ID가 필요합니다." }, { status: 400 });
    }

    const { data: driver } = await supabaseAdmin
      .from("drivers")
      .select("id, agency_id")
      .eq("id", driverId)
      .single();

    if (!driver || driver.agency_id !== auth.agencyId) {
      return NextResponse.json({ error: "소속 기사만 수정할 수 있습니다." }, { status: 403 });
    }

    if (fields.status && !["active", "resting", "inactive"].includes(fields.status)) {
      return NextResponse.json({ error: "올바르지 않은 상태값입니다." }, { status: 400 });
    }

    const safeFields: Record<string, unknown> = {};
    for (const key of editableDriverFields) {
      if (key in fields) safeFields[key] = fields[key];
    }

    const nextEmployeeCode =
      typeof safeFields.employee_code === "string" ? safeFields.employee_code.trim() : null;

    if (nextEmployeeCode) {
      const { data: duplicateDriver } = await supabaseAdmin
        .from("drivers")
        .select("id")
        .eq("agency_id", auth.agencyId)
        .ilike("employee_code", nextEmployeeCode)
        .neq("id", driverId)
        .limit(1)
        .maybeSingle();

      if (duplicateDriver) {
        return NextResponse.json({ error: "이미 사용 중인 사번입니다." }, { status: 409 });
      }

      safeFields.employee_code = nextEmployeeCode;
    }

    if (Object.keys(safeFields).length > 0) {
      void logPiiAccess({
        actorId: auth.userId,
        actorIp: ip,
        resource: "drivers",
        resourceId: driverId,
        fields: Object.keys(safeFields),
        action: "update",
      });

      void logDataModification({
        actorId: auth.userId,
        actorIp: ip,
        resource: "drivers",
        resourceId: driverId,
        changes: Object.fromEntries(
          Object.keys(safeFields).map((field) => [field, { before: "[REDACTED]", after: "[REDACTED]" }])
        ),
      });

      const encryptedFields = await encryptDriverPii(safeFields);
      const { error: updateError } = await supabaseAdmin
        .from("drivers")
        .update(encryptedFields)
        .eq("id", driverId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    if (Array.isArray(driverRates)) {
      await supabaseAdmin.from("driver_rates").delete().eq("driver_id", driverId);

      if (driverRates.length > 0) {
        const rows = driverRates.map(
          (rate: { package_type: string; unit_price: number; rate_type: string }) => ({
            driver_id: driverId,
            principal_id: null,
            package_type: rate.package_type,
            unit_price: rate.unit_price,
            rate_type: rate.rate_type || "fixed",
            is_active: true,
          })
        );

        const { error } = await supabaseAdmin.from("driver_rates").insert(rows);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (Array.isArray(routeRates)) {
      await supabaseAdmin.from("driver_route_rates").delete().eq("driver_id", driverId);

      if (routeRates.length > 0) {
        const rows = routeRates.map(
          (route: { route_code: string; delivery_rate: number; return_rate: number }) => ({
            driver_id: driverId,
            route_code: route.route_code,
            unit_price: route.delivery_rate,
            delivery_rate: route.delivery_rate,
            return_rate: route.return_rate || route.delivery_rate,
            is_active: true,
          })
        );

        const { error } = await supabaseAdmin.from("driver_route_rates").insert(rows);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (Array.isArray(deductions)) {
      await supabaseAdmin.from("driver_deductions").delete().eq("driver_id", driverId);

      if (deductions.length > 0) {
        const rows = deductions.map(
          (deduction: { name: string; amount: number; deduction_type: string }) => ({
            driver_id: driverId,
            name: deduction.name,
            amount: deduction.amount,
            deduction_type: deduction.deduction_type || "fixed",
            is_active: true,
          })
        );

        const { error } = await supabaseAdmin.from("driver_deductions").insert(rows);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ updated: true });
  } catch (error) {
    return apiError(error, 500, "기사 정보 업데이트에 실패했습니다.", request);
  }
}
