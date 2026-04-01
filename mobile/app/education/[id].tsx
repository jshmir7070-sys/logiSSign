import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, AppState, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuthStore } from '../../stores/authStore';
import {
  getEducationCourses,
  getEducationRecords,
  upsertEducationRecord,
  logEducationActivity,
  completeEducation,
  CATEGORY_LABELS,
  type EducationCourse,
  type EducationRecord,
  type QuizItem,
} from '../../services/education.service';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

type Phase = 'video' | 'text' | 'quiz' | 'result';

export default function EducationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const driver = useAuthStore((s) => s.driver);
  const { width } = useWindowDimensions();

  const [course, setCourse] = useState<EducationCourse | null>(null);
  const [record, setRecord] = useState<EducationRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // 학습 상태
  const [phase, setPhase] = useState<Phase>('video');
  const [videoSec, setVideoSec] = useState(0);
  const [textSec, setTextSec] = useState(0);
  const [quizSec, setQuizSec] = useState(0);

  // 퀴즈 상태
  const [quizIndex, setQuizIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [quizDone, setQuizDone] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // 타이머
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordIdRef = useRef<string | null>(null);

  // 랜덤 확인 팝업
  const [popupVisible, setPopupVisible] = useState(false);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 탭 이탈 감지
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (!id || !driver?.id || !driver?.agency_id) return;

    (async () => {
      const [coursesRes, recordsRes] = await Promise.all([
        getEducationCourses(driver.agency_id!),
        getEducationRecords(driver.id),
      ]);

      const c = (coursesRes.data ?? []).find((co) => co.id === id);
      if (!c) { setLoading(false); return; }
      setCourse(c);

      const r = (recordsRes.data ?? []).find((re) => re.course_id === id);
      if (r) {
        setRecord(r);
        recordIdRef.current = r.id;
        setVideoSec(r.video_watched_sec);
        setTextSec(r.text_read_sec);
        setQuizSec(r.quiz_time_sec);
        if (r.status === 'completed') {
          setPhase('result');
          setQuizDone(true);
          setQuizScore(r.quiz_score ?? 0);
        }
      }

      if (c.quiz_data) {
        setAnswers(new Array(c.quiz_data.length).fill(null));
      }

      setLoading(false);
    })();
  }, [id, driver?.id, driver?.agency_id]);

  // 학습 타이머 — 1초마다 카운트
  useEffect(() => {
    if (phase === 'result') return;

    timerRef.current = setInterval(() => {
      if (phase === 'video') setVideoSec((s) => s + 1);
      else if (phase === 'text') setTextSec((s) => s + 1);
      else if (phase === 'quiz') setQuizSec((s) => s + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // 랜덤 확인 팝업 — 3~7분 간격
  useEffect(() => {
    if (phase === 'result' || popupVisible) return;

    const delay = (3 + Math.random() * 4) * 60 * 1000; // 3~7분
    popupTimerRef.current = setTimeout(() => {
      setPopupVisible(true);
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordIdRef.current) {
        logEducationActivity(recordIdRef.current, 'popup_shown');
      }
    }, delay);

    return () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    };
  }, [phase, popupVisible]);

  // 탭 이탈 감지
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
        // 앱 이탈 — 타이머 정지
        if (timerRef.current) clearInterval(timerRef.current);
        if (recordIdRef.current) {
          logEducationActivity(recordIdRef.current, 'tab_leave');
        }
      } else if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        // 앱 복귀
        if (recordIdRef.current) {
          logEducationActivity(recordIdRef.current, 'tab_return');
        }
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // 진행률 저장 (30초마다)
  useEffect(() => {
    if (!course || !driver?.id || !driver?.agency_id || phase === 'result') return;

    const saveInterval = setInterval(() => {
      upsertEducationRecord(course.id, driver.id, driver.agency_id!, {
        video_watched_sec: videoSec,
        text_read_sec: textSec,
        quiz_time_sec: quizSec,
      }).then((res) => {
        if (res.data && !recordIdRef.current) {
          recordIdRef.current = res.data.id;
        }
      });
    }, 30000);

    return () => clearInterval(saveInterval);
  }, [course, driver?.id, driver?.agency_id, phase, videoSec, textSec, quizSec]);

  const dismissPopup = useCallback(() => {
    setPopupVisible(false);
    if (recordIdRef.current) {
      logEducationActivity(recordIdRef.current, 'popup_answered');
    }
  }, []);

  const totalSec = videoSec + textSec + quizSec;
  const requiredSec = (course?.required_minutes ?? 0) * 60;
  const progressPct = requiredSec > 0 ? Math.min(100, Math.round((totalSec / requiredSec) * 100)) : 0;
  const timeRemaining = Math.max(0, requiredSec - totalSec);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}분 ${s.toString().padStart(2, '0')}초`;
  };

  const handleQuizSubmit = async () => {
    if (!course?.quiz_data || !driver?.id || !driver?.agency_id) return;

    const quizData = course.quiz_data!;
    const correct = answers.reduce<number>((count, ans, idx) => {
      return count + (ans === quizData[idx].answer ? 1 : 0);
    }, 0);
    const score = Math.round((correct / quizData.length) * 100);
    const passed = score >= (course.quiz_pass_score ?? 70);
    const timeEnough = totalSec >= requiredSec;

    setQuizScore(score);
    setQuizDone(true);

    if (passed && timeEnough) {
      const { certificateNumber, error } = await completeEducation(
        course.id, driver.id, driver.agency_id!,
        score, true, videoSec, textSec, quizSec,
        course.category, course.year
      );

      if (error) {
        Alert.alert('이수 처리 실패', error);
      } else {
        setPhase('result');
        Alert.alert(
          '🎉 교육 이수 완료!',
          `${course.title} 교육을 이수했습니다.\n이수증 번호: ${certificateNumber}\n퀴즈 점수: ${score}점`,
        );
      }
    } else if (!passed) {
      Alert.alert('퀴즈 미통과', `${score}점으로 합격 기준(${course.quiz_pass_score}점) 미달입니다.\n다시 응시해주세요.`);
      setQuizDone(false);
      setQuizIndex(0);
      setAnswers(new Array(course.quiz_data.length).fill(null));
    } else {
      Alert.alert('학습시간 부족', `법정 이수시간(${course.required_minutes}분)을 채워야 합니다.\n남은 시간: ${formatTime(timeRemaining)}`);
      setQuizDone(false);
      setPhase('video');
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;
  if (!course) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="교육" showBack />
        <View style={styles.center}>
          <Text style={styles.errorText}>교육 과목을 찾을 수 없습니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  const quizItems = (course.quiz_data ?? []) as QuizItem[];
  const isCompleted = record?.status === 'completed' || phase === 'result';

  return (
    <SafeAreaView style={styles.container}>
      <Header title={course.title} showBack />

      {/* 랜덤 확인 팝업 */}
      {popupVisible && (
        <View style={styles.popupOverlay}>
          <View style={styles.popupCard}>
            <Text style={styles.popupTitle}>학습 확인</Text>
            <Text style={styles.popupText}>교육을 계속 수강하고 계신가요?</Text>
            <Button title="네, 계속합니다" onPress={dismissPopup} fullWidth size="md" />
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {/* 상단 진행률 카드 */}
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>학습 진행률</Text>
            <Text style={styles.progressPct}>{progressPct}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>⏱ 총 {formatTime(totalSec)} / {course.required_minutes}분</Text>
            {!isCompleted && timeRemaining > 0 && (
              <Text style={styles.timeRemaining}>남은 {formatTime(timeRemaining)}</Text>
            )}
          </View>
        </View>

        {/* 단계 탭 */}
        {!isCompleted && (
          <View style={styles.phaseTabs}>
            {(['video', 'text', 'quiz'] as Phase[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.phaseTab, phase === p && styles.phaseTabActive]}
                onPress={() => setPhase(p)}
              >
                <Text style={[styles.phaseTabText, phase === p && styles.phaseTabTextActive]}>
                  {p === 'video' ? `🎬 영상 (${formatTime(videoSec)})` :
                   p === 'text' ? `📖 텍스트 (${formatTime(textSec)})` :
                   `✍️ 퀴즈 (${formatTime(quizSec)})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 영상 단계 */}
        {phase === 'video' && (
          <View style={styles.section}>
            <View style={styles.videoPlaceholder}>
              {course.video_url ? (
                <Text style={styles.videoUrl}>영상 URL: {course.video_url}</Text>
              ) : (
                <View style={styles.videoEmpty}>
                  <MaterialIcons name="play-circle-outline" size={64} color={colors.outline} />
                  <Text style={styles.videoEmptyText}>교육 영상이 준비 중입니다</Text>
                  <Text style={styles.videoEmptyHint}>텍스트 교육으로 진행해주세요</Text>
                </View>
              )}
            </View>
            <Button title="텍스트 교육으로 이동 →" variant="outline" onPress={() => setPhase('text')} fullWidth />
          </View>
        )}

        {/* 텍스트 단계 */}
        {phase === 'text' && (
          <View style={styles.section}>
            <View style={styles.textCard}>
              <Text style={styles.textContent}>
                {course.content_text ?? '텍스트 교육 콘텐츠가 준비 중입니다.'}
              </Text>
            </View>
            {quizItems.length > 0 && (
              <Button title="퀴즈 응시하기 →" onPress={() => setPhase('quiz')} fullWidth />
            )}
          </View>
        )}

        {/* 퀴즈 단계 */}
        {phase === 'quiz' && quizItems.length > 0 && !quizDone && (
          <View style={styles.section}>
            <View style={styles.quizHeader}>
              <Text style={styles.quizProgress}>문제 {quizIndex + 1} / {quizItems.length}</Text>
              <Text style={styles.quizPassInfo}>합격: {course.quiz_pass_score}점 이상</Text>
            </View>

            <View style={styles.quizCard}>
              <Text style={styles.quizQuestion}>{quizItems[quizIndex].question}</Text>
              {quizItems[quizIndex].options.map((opt, optIdx) => (
                <TouchableOpacity
                  key={optIdx}
                  style={[styles.quizOption, answers[quizIndex] === optIdx && styles.quizOptionSelected]}
                  onPress={() => {
                    const next = [...answers];
                    next[quizIndex] = optIdx;
                    setAnswers(next);
                  }}
                >
                  <View style={[styles.quizRadio, answers[quizIndex] === optIdx && styles.quizRadioSelected]}>
                    {answers[quizIndex] === optIdx && <View style={styles.quizRadioDot} />}
                  </View>
                  <Text style={[styles.quizOptionText, answers[quizIndex] === optIdx && styles.quizOptionTextSelected]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.quizNav}>
              {quizIndex > 0 && (
                <Button title="이전" variant="outline" size="sm" onPress={() => setQuizIndex(quizIndex - 1)} />
              )}
              <View style={{ flex: 1 }} />
              {quizIndex < quizItems.length - 1 ? (
                <Button title="다음" size="sm" onPress={() => setQuizIndex(quizIndex + 1)}
                  disabled={answers[quizIndex] === null} />
              ) : (
                <Button title="제출하기" size="sm" onPress={handleQuizSubmit}
                  disabled={answers.some((a) => a === null)} />
              )}
            </View>
          </View>
        )}

        {/* 이수 완료 */}
        {isCompleted && (
          <View style={styles.completedCard}>
            <MaterialIcons name="verified" size={48} color={colors.tertiary} />
            <Text style={styles.completedTitle}>교육 이수 완료</Text>
            <Text style={styles.completedScore}>퀴즈 점수: {quizScore}점</Text>
            <View style={styles.completedMeta}>
              <Text style={styles.completedMetaText}>이수증 번호: {record?.certificate_number ?? '-'}</Text>
              <Text style={styles.completedMetaText}>
                이수일: {record?.completed_at ? new Date(record.completed_at).toLocaleDateString('ko-KR') : '-'}
              </Text>
              <Text style={styles.completedMetaText}>총 학습시간: {formatTime(totalSec)}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...typography.bodyMedium, color: colors.error },
  content: { padding: spacing.lg, paddingBottom: spacing['5xl'], gap: spacing.md },

  progressCard: {
    backgroundColor: colors.surfaceContainerLowest, borderRadius: borderRadius.xl,
    padding: spacing.lg, ...shadows.card,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  progressLabel: { ...typography.labelLarge, color: colors.onSurface },
  progressPct: { ...typography.titleSmall, color: colors.primary, fontWeight: '700' },
  progressBarBg: { height: 6, backgroundColor: colors.surfaceContainerHigh, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  timeText: { ...typography.labelSmall, color: colors.onSurfaceVariant },
  timeRemaining: { ...typography.labelSmall, color: colors.error, fontWeight: '600' },

  phaseTabs: { flexDirection: 'row', gap: spacing.sm },
  phaseTab: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceContainerLow, alignItems: 'center',
  },
  phaseTabActive: { backgroundColor: colors.primary },
  phaseTabText: { ...typography.labelSmall, color: colors.onSurfaceVariant },
  phaseTabTextActive: { color: '#fff', fontWeight: '700' },

  section: { gap: spacing.md },

  videoPlaceholder: {
    backgroundColor: colors.surfaceContainerLowest, borderRadius: borderRadius.xl,
    padding: spacing.lg, minHeight: 200, justifyContent: 'center', ...shadows.sm,
  },
  videoUrl: { ...typography.bodySmall, color: colors.primary, textAlign: 'center' },
  videoEmpty: { alignItems: 'center', gap: spacing.sm },
  videoEmptyText: { ...typography.bodyMedium, color: colors.onSurfaceVariant },
  videoEmptyHint: { ...typography.labelSmall, color: colors.outline },

  textCard: {
    backgroundColor: colors.surfaceContainerLowest, borderRadius: borderRadius.xl,
    padding: spacing.lg, ...shadows.sm,
  },
  textContent: { ...typography.bodyMedium, color: colors.onSurface, lineHeight: 22 },

  quizHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quizProgress: { ...typography.labelLarge, color: colors.onSurface },
  quizPassInfo: { ...typography.labelSmall, color: colors.onSurfaceVariant },
  quizCard: {
    backgroundColor: colors.surfaceContainerLowest, borderRadius: borderRadius.xl,
    padding: spacing.lg, ...shadows.sm,
  },
  quizQuestion: { ...typography.bodyLarge, color: colors.onSurface, fontWeight: '600', marginBottom: spacing.lg },
  quizOption: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.outlineVariant + '30', marginBottom: spacing.sm,
  },
  quizOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  quizRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: colors.outline, justifyContent: 'center', alignItems: 'center',
  },
  quizRadioSelected: { borderColor: colors.primary },
  quizRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  quizOptionText: { ...typography.bodyMedium, color: colors.onSurface, flex: 1 },
  quizOptionTextSelected: { color: colors.primary, fontWeight: '600' },
  quizNav: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  completedCard: {
    backgroundColor: colors.tertiary + '08', borderRadius: borderRadius.xl,
    padding: spacing['3xl'], alignItems: 'center', borderWidth: 1, borderColor: colors.tertiary + '20',
  },
  completedTitle: { ...typography.titleLarge, color: colors.onSurface, marginTop: spacing.md },
  completedScore: { ...typography.titleSmall, color: colors.primary, marginTop: spacing.sm },
  completedMeta: { marginTop: spacing.lg, gap: spacing.xs, alignItems: 'center' },
  completedMetaText: { ...typography.labelSmall, color: colors.onSurfaceVariant },

  popupOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', zIndex: 999,
  },
  popupCard: {
    backgroundColor: colors.surfaceContainerLowest, borderRadius: borderRadius.xl,
    padding: spacing['2xl'], width: '80%', gap: spacing.md,
  },
  popupTitle: { ...typography.titleMedium, color: colors.onSurface, textAlign: 'center' },
  popupText: { ...typography.bodyMedium, color: colors.onSurfaceVariant, textAlign: 'center' },
});
