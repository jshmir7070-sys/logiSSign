import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import {
  renderSealCanvas,
  ALL_SEAL_FONTS,
  type SealShape,
} from '@/services/seal.service'
import { authenticateRequest } from '@/lib/api-auth'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

let serverSealFontsLoaded = false

function registerSealFont(fileName: string, familyName: string) {
  const fontPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'fonts', fileName)
  try {
    GlobalFonts.registerFromPath(fontPath, familyName)
  } catch (err) {
    console.warn(`[seals/generate] Font registration failed: ${familyName}`, err)
  }
}

function ensureServerSealFontsLoaded() {
  if (serverSealFontsLoaded) return
  serverSealFontsLoaded = true

  registerSealFont('HJ한전서A.ttf', 'HJJeonseoA')
  registerSealFont('HJ한전서B.ttf', 'HJJeonseoB')
  registerSealFont('HJ한전서A.ttf', 'YiSunShinBold')
  registerSealFont('HJ한전서B.ttf', 'WandohopeB')
  registerSealFont('HJ한전서A.ttf', 'SuseongBatang')
  registerSealFont('HJ한전서B.ttf', 'SuseongHyejeong')
  registerSealFont('NotoSansKR-Bold.otf', 'JeongseonArGothicB')
  registerSealFont('NotoSansKR-Bold.otf', 'GangwonEduBold')
  registerSealFont('NotoSansKR-Bold.otf', 'Noto Serif KR')
  registerSealFont('NotoSansKR-Bold.otf', 'Nanum Myeongjo')
  registerSealFont('NotoSansKR-Bold.otf', 'Hahmlet')
}

function createServerSealCanvas(width: number, height: number) {
  return createCanvas(width, height) as unknown as {
    width: number
    height: number
    getContext: (contextId: '2d') => CanvasRenderingContext2D | null
    toDataURL: (type?: string) => string
  }
}

/**
 * POST /api/seals/generate
 * 도장 이미지 생성 API — 이름 + 옵션 → data URI 반환
 * 모바일/웹 공용
 *
 * ✅ 보안: 인증 + 레이트리밋 추가
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/seals/generate')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  try {
    const body = await request.json()
    const { name, shape, fontIdx, fontSize, letterSpacing, sealSize, showDot } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: '이름을 입력하세요' }, { status: 400 })
    }

    ensureServerSealFontsLoaded()
    const font = ALL_SEAL_FONTS[fontIdx ?? 0] ?? ALL_SEAL_FONTS[0]

    const dataUri = renderSealCanvas({
      name: name.trim(),
      category: 'personal',
      shape: (shape as SealShape) || 'circle',
      fontFamily: font.family,
      fontWeight: font.weight,
      size: sealSize || 250,
      showDot: showDot ?? false,
      fontSizeScale: (fontSize || 100) / 100,
      letterSpacingScale: (letterSpacing || 100) / 100,
      useHanja: false,
      canvasFactory: createServerSealCanvas,
    })

    return NextResponse.json({
      dataUri,
      font: font.label,
      shape: shape || 'circle',
      size: sealSize || 250,
    })
  } catch (err) {
    console.error('[seals/generate]', err)
    return NextResponse.json({ error: '도장 생성 실패' }, { status: 500 })
  }
}

/**
 * GET /api/seals/generate?name=홍길동
 * 여러 스타일 미리보기 일괄 생성 (모바일에서 선택용)
 *
 * ✅ 보안: 인증 + 레이트리밋 추가
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/seals/generate-preview')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  try {
    const name = request.nextUrl.searchParams.get('name')
    if (!name?.trim()) {
      return NextResponse.json({ error: '이름 필수' }, { status: 400 })
    }

    ensureServerSealFontsLoaded()

    const shapes: SealShape[] = ['circle', 'square', 'oval', 'rounded_square']
    // 인기 폰트 4개만
    const fontIndices = [0, 1, 2, 3].filter(i => i < ALL_SEAL_FONTS.length)

    const previews: { id: string; dataUri: string; font: string; shape: string }[] = []

    for (const shape of shapes) {
      for (const fi of fontIndices) {
        const font = ALL_SEAL_FONTS[fi]
        const dataUri = renderSealCanvas({
          name: name.trim(),
          category: 'personal',
          shape,
          fontFamily: font.family,
          fontWeight: font.weight,
          size: 200,
          showDot: false,
          fontSizeScale: 1,
          letterSpacingScale: 1,
          useHanja: false,
          canvasFactory: createServerSealCanvas,
        })
        previews.push({
          id: `${shape}-${fi}`,
          dataUri,
          font: font.label,
          shape,
        })
      }
    }

    return NextResponse.json({ previews, total: previews.length })
  } catch (err) {
    console.error('[seals/generate GET]', err)
    return NextResponse.json({ error: '미리보기 생성 실패' }, { status: 500 })
  }
}
