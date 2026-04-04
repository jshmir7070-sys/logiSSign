import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  renderSealCanvas,
  ensureSealFontsLoaded,
  ALL_SEAL_FONTS,
  type SealShape,
} from '@/services/seal.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/seals/generate
 * 도장 이미지 생성 API — 이름 + 옵션 → data URI 반환
 * 모바일/웹 공용
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, shape, fontIdx, fontSize, letterSpacing, sealSize, showDot } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: '이름을 입력하세요' }, { status: 400 })
    }

    ensureSealFontsLoaded()
    const font = ALL_SEAL_FONTS[fontIdx ?? 0] ?? ALL_SEAL_FONTS[0]

    const dataUri = renderSealCanvas({
      name: name.trim(),
      category: 'personal',
      shape: (shape as SealShape) || 'circle',
      fontFamily: font.family,
      fontWeight: font.weight,
      size: sealSize || 250,
      showDot: showDot ?? true,
      fontSizeScale: (fontSize || 100) / 100,
      letterSpacingScale: (letterSpacing || 100) / 100,
      useHanja: false,
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
 */
export async function GET(request: NextRequest) {
  try {
    const name = request.nextUrl.searchParams.get('name')
    if (!name?.trim()) {
      return NextResponse.json({ error: '이름 필수' }, { status: 400 })
    }

    ensureSealFontsLoaded()

    const shapes: SealShape[] = ['circle', 'square', 'oval']
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
          showDot: true,
          fontSizeScale: 1,
          letterSpacingScale: 1,
          useHanja: false,
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
