import type { Metadata } from 'next'
import AdminGuideChecklist from '@/components/admin/AdminGuideChecklist'

export const metadata: Metadata = {
  title: '운영 가이드 | logiSSign',
}

export default function AdminGuidePage() {
  return <AdminGuideChecklist />
}
