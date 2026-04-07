'use client'

import { AccountFindIdPage } from '@/components/auth/AccountFindIdPage'

export default function AdminFindIdPage() {
  return (
    <AccountFindIdPage
      accountType="admin"
      title="관리자 아이디 찾기"
      description="휴대폰 인증으로 관리자 이메일을 확인합니다."
      loginHref="/admin/login"
      resetHref="/admin/reset-password"
      signupHref={undefined}
    />
  )
}
