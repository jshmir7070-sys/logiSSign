import type { Metadata } from "next";
import { Inter, Noto_Sans_KR, Manrope } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-pretendard",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "logiSSign | 택배 대리점 정산 · 전자계약 자동화 플랫폼",
    template: "%s | logiSSign",
  },
  description:
    "정산 업로드, 기사 전자서명, 문서 전송과 교육 관리까지. 택배 대리점을 위한 운영 자동화 SaaS 플랫폼입니다.",
  metadataBase: new URL("https://logissign.com"),
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://logissign.com",
    siteName: "logiSSign",
    title: "logiSSign | 택배 대리점 정산 · 전자계약 자동화 플랫폼",
    description:
      "정산 업로드, 기사 전자서명, 법정교육 이수 관리까지 한 번에 운영할 수 있습니다.",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "logiSSign" }],
  },
  twitter: {
    card: "summary",
    title: "logiSSign",
    description: "택배 대리점 정산 · 전자계약 자동화 플랫폼",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${inter.variable} ${notoSansKR.variable} ${manrope.variable}`}
    >
      <head />
      <body className="bg-surface text-on-surface font-body antialiased">
        {children}
      </body>
    </html>
  );
}
