import { supabase } from '../lib/supabase';
import type { Row } from '../types/database';

type Notice = Row<'notices'>;

export async function getDriverNotices(): Promise<{
  data: Notice[] | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false });
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : '공지 조회 실패' };
  }
}

export function categoryLabel(cat: string | null): string {
  const map: Record<string, string> = {
    notice: '공지',
    guide: '안내',
    update: '업데이트',
    etc: '기타',
  };
  return map[cat ?? ''] ?? '공지';
}

export function categoryVariant(cat: string | null): 'info' | 'success' | 'warning' | 'default' {
  const map: Record<string, 'info' | 'success' | 'warning' | 'default'> = {
    notice: 'info',
    guide: 'success',
    update: 'warning',
    etc: 'default',
  };
  return map[cat ?? ''] ?? 'default';
}
