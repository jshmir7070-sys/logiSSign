import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { getClientIp } from "@/lib/get-ip";
import { rateLimitAuth } from "@/lib/rate-limit";
import { logDataModification, logPiiAccess } from "@/lib/security-logger";
import { createSignedStorageUrl } from "@/lib/storage-reference";
import { decryptAgencyPii, encryptAgencyPii } from "@/services/pii.service";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const editableFields = [
  "name",
  "owner_name",
  "phone",
  "owner_birth_date",
  "business_type",
  "business_category",
  "privacy_officer_name",
  "privacy_officer_phone",
  "privacy_officer_email",
] as const;

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const limited = await rateLimitAuth(ip, "/api/agency/profile");
  if (limited) return limited;

  try {
    const { auth, error: authError } = await authenticateRequest(request);
    if (authError || !auth) return authError!;

    const { data: agency, error } = await supabaseAdmin
      .from("agencies")
      .select(`
        id, name, owner_name, phone, address, address_detail, business_number, email, invite_code,
        owner_birth_date, business_type, business_category, privacy_officer_name,
        privacy_officer_phone, privacy_officer_email, logo_url
      `)
      .eq("id", auth.agencyId)
      .single();

    if (error || !agency) {
      return NextResponse.json({ error: "대리점 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    void logPiiAccess({
      actorId: auth.userId,
      actorIp: ip,
      resource: "agencies",
      resourceId: agency.id,
      fields: [
        "owner_name",
        "phone",
        "address",
        "business_number",
        "email",
        "owner_birth_date",
        "privacy_officer_name",
        "privacy_officer_phone",
        "privacy_officer_email",
      ],
      action: "read",
    });

    const decryptedAgency = await decryptAgencyPii(agency);
    let logoUrl = (decryptedAgency.logo_url as string | null) ?? null;

    if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
      const signed = await createSignedStorageUrl(supabaseAdmin, "documents", logoUrl, 60 * 30);
      logoUrl = signed.url;
    }

    return NextResponse.json({
      data: {
        ...decryptedAgency,
        logo_url: logoUrl,
      },
      error: null,
    });
  } catch (error) {
    return apiError(error, 500, "대리점 정보를 불러오는 중 오류가 발생했습니다.", request);
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limited = await rateLimitAuth(ip, "/api/agency/profile");
  if (limited) return limited;

  try {
    const { auth, error: authError } = await authenticateRequest(request);
    if (authError || !auth) return authError!;

    const body = await request.json();
    const safeFields: Record<string, unknown> = {};

    for (const field of editableFields) {
      if (field in body) {
        safeFields[field] = body[field];
      }
    }

    void logPiiAccess({
      actorId: auth.userId,
      actorIp: ip,
      resource: "agencies",
      resourceId: auth.agencyId,
      fields: Object.keys(safeFields),
      action: "update",
    });

    void logDataModification({
      actorId: auth.userId,
      actorIp: ip,
      resource: "agencies",
      resourceId: auth.agencyId,
      changes: Object.fromEntries(
        Object.keys(safeFields).map((field) => [field, { before: "[REDACTED]", after: "[REDACTED]" }])
      ),
    });

    const encryptedFields = await encryptAgencyPii(safeFields);
    const { error } = await supabaseAdmin
      .from("agencies")
      .update(encryptedFields)
      .eq("id", auth.agencyId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: true });
  } catch (error) {
    return apiError(error, 500, "대리점 정보 수정 중 오류가 발생했습니다.", request);
  }
}
