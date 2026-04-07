import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { validateInput } from '@/lib/api-schemas'
import { rateLimitPublic } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

const betaApplySchema = z.object({
  companyName: z.string().min(1, '업체명은 필수입니다').max(100),
  contactName: z.string().min(1, '담당자명은 필수입니다').max(50),
  email: z.string().email('유효한 이메일 주소를 입력하세요'),
  phone: z.string().min(1, '연락처는 필수입니다').max(20),
  driverCount: z.string().max(10).optional(),
  message: z.string().max(500).optional(),
})

const NOTIFY_EMAIL = 'jshmir7070@gmail.com'

export async function POST(request: NextRequest) {
  // Rate limit: IP당 분 3회
  const ip = getClientIp(request)
  const limited = await rateLimitPublic(ip, '/api/beta-apply')
  if (limited) return limited

  const rawBody = await request.json().catch(() => null)
  if (!rawBody) {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 })
  }

  const { data, error: validationError } = validateInput(betaApplySchema, rawBody)
  if (validationError || !data) {
    return NextResponse.json({ error: validationError ?? '입력값을 확인해주세요' }, { status: 400 })
  }

  const { companyName, contactName, email, phone, driverCount, message } = data

  // ✅ 보안: HTML 이스케이프 (Stored XSS 방지)
  const esc = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  const safeCompanyName = esc(companyName)
  const safeContactName = esc(contactName)
  const safeEmail = esc(email)
  const safePhone = esc(phone)
  const safeDriverCount = driverCount ? esc(driverCount) : '미기입'
  const safeMessage = message ? esc(message) : ''

  // Resend API로 이메일 전송
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    // Resend 미설정 시 콘솔 로그만 남기고 성공 응답
    console.info('[Beta Apply] Resend API key not set. Application:', {
      companyName, contactName, email, phone, driverCount, message,
      appliedAt: new Date().toISOString(),
    })
    return NextResponse.json({ success: true })
  }

  try {
    const resend = new Resend(resendApiKey)

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'logiSSign <onboarding@resend.dev>',
      to: NOTIFY_EMAIL,
      subject: `[베타 테스트 신청] ${safeCompanyName} - ${safeContactName}`,
      html: `
        <div style="font-family: 'Pretendard', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <div style="background: linear-gradient(135deg, #004ac6, #2563eb); padding: 24px 32px; border-radius: 16px 16px 0 0;">
            <h1 style="color: white; font-size: 20px; margin: 0;">logiSSign 베타 테스트 신청</h1>
          </div>
          <div style="background: #f8fafc; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 12px 0; color: #64748b; width: 120px; vertical-align: top;">업체명</td>
                <td style="padding: 12px 0; color: #1e293b; font-weight: 600;">${safeCompanyName}</td>
              </tr>
              <tr style="border-top: 1px solid #e2e8f0;">
                <td style="padding: 12px 0; color: #64748b;">담당자</td>
                <td style="padding: 12px 0; color: #1e293b; font-weight: 600;">${safeContactName}</td>
              </tr>
              <tr style="border-top: 1px solid #e2e8f0;">
                <td style="padding: 12px 0; color: #64748b;">이메일</td>
                <td style="padding: 12px 0; color: #1e293b;"><a href="mailto:${safeEmail}" style="color: #2563eb;">${safeEmail}</a></td>
              </tr>
              <tr style="border-top: 1px solid #e2e8f0;">
                <td style="padding: 12px 0; color: #64748b;">연락처</td>
                <td style="padding: 12px 0; color: #1e293b;">${safePhone}</td>
              </tr>
              <tr style="border-top: 1px solid #e2e8f0;">
                <td style="padding: 12px 0; color: #64748b;">기사 수</td>
                <td style="padding: 12px 0; color: #1e293b;">${safeDriverCount}</td>
              </tr>
              ${safeMessage ? `
              <tr style="border-top: 1px solid #e2e8f0;">
                <td style="padding: 12px 0; color: #64748b; vertical-align: top;">문의사항</td>
                <td style="padding: 12px 0; color: #1e293b;">${safeMessage}</td>
              </tr>
              ` : ''}
            </table>
            <div style="margin-top: 24px; padding: 16px; background: #eff6ff; border-radius: 8px; font-size: 12px; color: #64748b;">
              신청 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}<br/>
              IP: ${ip}
            </div>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Beta Apply] Email send failed:', err)
    return NextResponse.json({ error: '신청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }
}
