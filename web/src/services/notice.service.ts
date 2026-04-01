import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { Database } from '@/types/database'

type NoticeRow = Database['public']['Tables']['notices']['Row']
type NoticeInsert = Database['public']['Tables']['notices']['Insert']

export type NoticeListItem = Pick<
  NoticeRow,
  | 'id'
  | 'title'
  | 'content'
  | 'category'
  | 'created_by_type'
  | 'target_type'
  | 'status'
  | 'published_at'
  | 'created_at'
>

export async function getNotices(agencyId: string): Promise<{
  data: NoticeListItem[] | null
  error: string | null
}> {
  const supabase = createBrowserSupabaseClient()

  try {
    // Fetch agency's own notices + provider notices targeting all agencies
    const { data, error } = await supabase
      .from('notices')
      .select(
        'id, title, content, category, created_by_type, target_type, status, published_at, created_at'
      )
      .or(`agency_id.eq.${agencyId},and(created_by_type.eq.provider,target_type.eq.all)`)
      .eq('status', 'published')
      .order('published_at', { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch notices'
    return { data: null, error: message }
  }
}

export async function createNotice(data: {
  agency_id: string
  title: string
  content: string
  category: NoticeRow['category']
}): Promise<{
  data: NoticeRow | null
  error: string | null
}> {
  const supabase = createBrowserSupabaseClient()

  const insertData: NoticeInsert = {
    agency_id: data.agency_id,
    title: data.title,
    content: data.content,
    category: data.category,
    created_by_type: 'agency',
    target_type: 'agency',
    status: 'published',
    published_at: new Date().toISOString(),
  }

  try {
    const { data: notice, error } = await supabase
      .from('notices')
      .insert(insertData)
      .select(
        'id, created_by_type, provider_id, agency_id, target_type, title, content, category, attachment_url, appstore_url, playstore_url, status, published_at, created_at'
      )
      .single()

    if (error) throw error
    return { data: notice, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create notice'
    return { data: null, error: message }
  }
}
