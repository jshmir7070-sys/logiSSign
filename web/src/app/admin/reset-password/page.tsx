'use client'

import { AccountResetPasswordPage } from '@/components/auth/AccountResetPasswordPage'

export default function AdminResetPasswordPage() {
  return (
    <AccountResetPasswordPage
      accountType="admin"
      title="관리자 비밀번호 재설정"
      description="휴대폰 인증 후 관리자 비밀번호를 새로 설정합니다."
      loginHref="/admin/login"
      findIdHref="/admin/find-id"
      signupHref={undefined}
    />
  )
}
