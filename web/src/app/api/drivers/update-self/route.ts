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

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limited = await rateLimitAuth(ip, "/api/drivers/update-self");
  if (limited) return limited;

  try {
    const { auth, error: authError } = await authenticateRequest(request);
    if (authError || !auth) return authError!;

    const { data: driver } = await supabaseAdmin
      .from("drivers")
      .select("id, user_id")
      .eq("user_id", auth.userId)
      .single();

    if (!driver) {
      return NextResponse.json({ error: "기사 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const selfEditable = [
      "phone",
      "address",
      "email",
      "bank_name",
      "bank_account",
      "bank_holder",
      "vehicle_number",
      "vehicle_type",
      "vehicle_year",
      "vehicle_vin",
    ] as const;

    const safeFields: Record<string, unknown> = {};
    for (const key of selfEditable) {
      if (key in body) safeFields[key] = body[key];
    }

    if ("notification_preferences" in body) {
      const notificationPreferences = body.notification_preferences;
      if (
        notificationPreferences &&
        typeof notificationPreferences === "object" &&
        !Array.isArray(notificationPreferences)
      ) {
        const { data: existingDriver } = await supabaseAdmin
          .from("drivers")
          .select("custom_values")
          .eq("id", driver.id)
          .single();

        const existingCustomValues =
          existingDriver?.custom_values &&
          typeof existingDriver.custom_values === "object" &&
          !Array.isArray(existingDriver.custom_values)
            ? (existingDriver.custom_values as Record<string, unknown>)
            : {};

        safeFields.custom_values = {
          ...existingCustomValues,
          notification_preferences: notificationPreferences,
        };
      }
    }

    if (Object.keys(safeFields).length === 0) {
      return NextResponse.json({ error: "수정할 항목이 없습니다." }, { status: 400 });
    }

    void logPiiAccess({
      actorId: auth.userId,
      actorIp: ip,
      resource: "drivers",
      resourceId: driver.id,
      fields: Object.keys(safeFields),
      action: "update",
    });

    void logDataModification({
      actorId: auth.userId,
      actorIp: ip,
      resource: "drivers",
      resourceId: driver.id,
      changes: Object.fromEntries(
        Object.keys(safeFields).map((field) => [field, { before: "[REDACTED]", after: "[REDACTED]" }])
      ),
    });

    const encryptedFields = await encryptDriverPii(safeFields);
    const { error: updateError } = await supabaseAdmin
      .from("drivers")
      .update(encryptedFields)
      .eq("id", driver.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ updated: true, fields: Object.keys(safeFields) });
  } catch (error) {
    return apiError(error, 500, "수정에 실패했습니다.", request);
  }
}
