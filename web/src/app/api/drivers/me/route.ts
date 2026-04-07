import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { getClientIp } from "@/lib/get-ip";
import { rateLimitAuth } from "@/lib/rate-limit";
import { logPiiAccess } from "@/lib/security-logger";
import { decryptDriverPii } from "@/services/pii.service";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const limited = await rateLimitAuth(ip, "/api/drivers/me");
  if (limited) return limited;

  try {
    const { auth, error: authError } = await authenticateRequest(request);
    if (authError || !auth) return authError!;

    const { data: driver, error } = await supabaseAdmin
      .from("drivers")
      .select(`
        id, user_id, name, phone, email, birth_date, address,
        vehicle_number, vehicle_type, vehicle_year, vehicle_vin,
        bank_name, bank_account, bank_holder, custom_values
      `)
      .eq("user_id", auth.userId)
      .single();

    if (error || !driver) {
      return NextResponse.json({ error: "기사 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    void logPiiAccess({
      actorId: auth.userId,
      actorIp: ip,
      resource: "drivers",
      resourceId: driver.id,
      fields: [
        "phone",
        "email",
        "birth_date",
        "address",
        "bank_name",
        "bank_account",
        "bank_holder",
      ],
      action: "read",
    });

    const decryptedDriver = await decryptDriverPii(driver);
    return NextResponse.json({ data: decryptedDriver, error: null });
  } catch (error) {
    return apiError(error, 500, "기사 정보를 불러오는 중 오류가 발생했습니다.", request);
  }
}
