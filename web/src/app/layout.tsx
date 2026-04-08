import type { Metadata } from 'next'
import { Inter, Manrope, Noto_Sans_KR } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  variable: '--font-pretendard',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'logiSSign | 고객사 정산 및 전자계약 운영 플랫폼',
    template: '%s | logiSSign',
  },
  description:
    '정산 업로드, 기사 전자서명, 문서 전송과 교육 관리까지 한 번에 운영하는 고객사 전용 플랫폼입니다.',
  metadataBase: new URL('https://logissign.com'),
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://logissign.com',
    siteName: 'logiSSign',
    title: 'logiSSign | 고객사 정산 및 전자계약 운영 플랫폼',
    description: '정산 업로드, 기사 전자서명, 법정교육 관리까지 한 번에 처리할 수 있습니다.',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'logiSSign' }],
  },
  twitter: {
    card: 'summary',
    title: 'logiSSign',
    description: '고객사 정산 및 전자계약 운영 플랫폼',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: { icon: '/favicon.png' },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ko"
      className={`${inter.variable} ${notoSansKR.variable} ${manrope.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="bg-surface font-body text-on-surface antialiased">{children}</body>
    </html>
  )
}
