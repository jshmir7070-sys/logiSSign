import { supabase } from '../lib/supabase';

/* ── Types ── */

export interface EducationCourse {
  id: string;
  title: string;
  category: string;
  description: string | null;
  required_minutes: number;
  video_url: string | null;
  video_duration_sec: number | null;
  content_text: string | null;
  quiz_data: QuizItem[] | null;
  quiz_pass_score: number;
  year: number;
}

export interface QuizItem {
  question: string;
  options: string[];
  answer: number; // 0-based index
  explanation: string;
}

export interface EducationRecord {
  id: string;
  course_id: string;
  driver_id: string;
  video_watched_sec: number;
  text_read_sec: number;
  quiz_time_sec: number;
  total_study_sec: number;
  quiz_score: number | null;
  quiz_passed: boolean;
  status: 'in_progress' | 'completed' | 'expired';
  completed_at: string | null;
  certificate_url: string | null;
  certificate_number: string | null;
  created_at: string;
}

export interface CourseWithRecord extends EducationCourse {
  record: EducationRecord | null;
}

/* ── 과목 목록 조회 ── */

export async function getEducationCourses(agencyId: string): Promise<{
  data: EducationCourse[] | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('education_courses')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('is_active', true)
      .order('created_at');
    if (error) throw error;
    return { data: data as EducationCourse[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : '교육 과목 조회 실패' };
  }
}

/* ── 기사 이수 기록 조회 ── */

export async function getEducationRecords(driverId: string): Promise<{
  data: EducationRecord[] | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('education_records')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at');
    if (error) throw error;
    return { data: data as EducationRecord[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : '이수 기록 조회 실패' };
  }
}

/* ── 이수 기록 생성/업데이트 ── */

export async function upsertEducationRecord(
  courseId: string,
  driverId: string,
  agencyId: string,
  updates: {
    video_watched_sec?: number;
    text_read_sec?: number;
    quiz_time_sec?: number;
    quiz_score?: number;
    quiz_answers?: unknown[];
    quiz_passed?: boolean;
    status?: 'in_progress' | 'completed';
    ip_address?: string;
    user_agent?: string;
  }
): Promise<{ data: EducationRecord | null; error: string | null }> {
  try {
    // 기존 기록 조회
    const { data: existing } = await supabase
      .from('education_records')
      .select('id, video_watched_sec, text_read_sec, quiz_time_sec')
      .eq('course_id', courseId)
      .eq('driver_id', driverId)
      .maybeSingle();

    const totalStudySec =
      (updates.video_watched_sec ?? (existing as EducationRecord | null)?.video_watched_sec ?? 0) +
      (updates.text_read_sec ?? (existing as EducationRecord | null)?.text_read_sec ?? 0) +
      (updates.quiz_time_sec ?? (existing as EducationRecord | null)?.quiz_time_sec ?? 0);

    const payload = {
      course_id: courseId,
      driver_id: driverId,
      agency_id: agencyId,
      ...updates,
      total_study_sec: totalStudySec,
      last_activity_at: new Date().toISOString(),
      ...(updates.status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
    };

    if (existing) {
      const { data, error } = await supabase
        .from('education_records')
        .update(payload as never)
        .eq('id', (existing as { id: string }).id)
        .select('*')
        .single();
      if (error) throw error;
      return { data: data as EducationRecord, error: null };
    } else {
      const { data, error } = await supabase
        .from('education_records')
        .insert(payload as never)
        .select('*')
        .single();
      if (error) throw error;
      return { data: data as EducationRecord, error: null };
    }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : '이수 기록 저장 실패' };
  }
}

/* ── 활동 로그 기록 ── */

export async function logEducationActivity(
  recordId: string,
  eventType: string,
  eventData?: Record<string, unknown>
): Promise<void> {
  await supabase
    .from('education_activity_logs')
    .insert({
      record_id: recordId,
      event_type: eventType,
      event_data: eventData ?? {},
    } as never);
}

/* ── 이수증 번호 생성 ── */

export function generateCertificateNumber(category: string, year: number): string {
  const prefix = {
    safety: 'SAF',
    harassment: 'HAR',
    privacy: 'PRI',
    disability: 'DIS',
    platform: 'PLT',
    custom: 'CUS',
  }[category] ?? 'EDU';

  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${year}-${random}`;
}

/* ── 이수 완료 처리 ── */

export async function completeEducation(
  courseId: string,
  driverId: string,
  agencyId: string,
  quizScore: number,
  quizPassed: boolean,
  totalVideoSec: number,
  totalTextSec: number,
  totalQuizSec: number,
  category: string,
  year: number
): Promise<{ certificateNumber: string | null; error: string | null }> {
  if (!quizPassed) {
    return { certificateNumber: null, error: '퀴즈를 통과해야 이수할 수 있습니다.' };
  }

  const certNumber = generateCertificateNumber(category, year);

  const { error } = await upsertEducationRecord(courseId, driverId, agencyId, {
    video_watched_sec: totalVideoSec,
    text_read_sec: totalTextSec,
    quiz_time_sec: totalQuizSec,
    quiz_score: quizScore,
    quiz_passed: true,
    status: 'completed',
  });

  if (error) return { certificateNumber: null, error };

  // 이수증 번호 저장
  await supabase
    .from('education_records')
    .update({
      certificate_number: certNumber,
    } as never)
    .eq('course_id', courseId)
    .eq('driver_id', driverId);

  return { certificateNumber: certNumber, error: null };
}

/* ── 카테고리 한글 라벨 ── */

export const CATEGORY_LABELS: Record<string, string> = {
  safety: '산업안전보건',
  harassment: '성희롱예방',
  privacy: '개인정보보호',
  disability: '장애인인식개선',
  platform: '플랫폼 자체교육',
  custom: '기타',
};

export const CATEGORY_ICONS: Record<string, string> = {
  safety: '🦺',
  harassment: '🛡️',
  privacy: '🔒',
  disability: '♿',
  platform: '📦',
  custom: '📚',
};
