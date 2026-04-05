import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder, TouchableOpacity, Dimensions, type GestureResponderEvent, Modal, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, typography } from '../../constants/theme';

const { width: SW, height: SH } = Dimensions.get('window');

/** 필기구 스타일 */
interface PenStyle {
  id: string;
  label: string;
  icon: string;
  strokeWidth: number;
  opacity: number;
  // 곡선 부드러움 (0~1, 1이 가장 부드러움)
  smoothing: number;
  // 필압 시뮬레이션
  pressureEffect: boolean;
  color: string;
}

const PEN_STYLES: PenStyle[] = [
  { id: 'ballpoint', label: '볼펜', icon: '🖊️', strokeWidth: 2, opacity: 1, smoothing: 0.6, pressureEffect: false, color: '#1a1a2e' },
  { id: 'signpen', label: '싸인펜', icon: '🖋️', strokeWidth: 3.5, opacity: 0.95, smoothing: 0.8, pressureEffect: true, color: '#0d0d0d' },
  { id: 'brush', label: '붓펜', icon: '🖌️', strokeWidth: 5, opacity: 0.85, smoothing: 0.9, pressureEffect: true, color: '#111111' },
  { id: 'fountain', label: '만년필', icon: '✒️', strokeWidth: 2.5, opacity: 1, smoothing: 0.75, pressureEffect: true, color: '#1a237e' },
];

interface Point { x: number; y: number; t: number }

/** 점 배열 → 부드러운 SVG path (Catmull-Rom → 베지에 변환) */
function smoothPath(points: Point[], smoothing: number): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;
  }

  let d = `M${points[0].x},${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const p0 = points[Math.max(0, i - 2)];
    const p1 = points[i - 1];
    const p2 = points[i];
    const p3 = points[Math.min(points.length - 1, i + 1)];

    // Catmull-Rom to Bezier
    const tension = 1 - smoothing;
    const cp1x = p1.x + (p2.x - p0.x) / 6 * (1 - tension);
    const cp1y = p1.y + (p2.y - p0.y) / 6 * (1 - tension);
    const cp2x = p2.x - (p3.x - p1.x) / 6 * (1 - tension);
    const cp2y = p2.y - (p3.y - p1.y) / 6 * (1 - tension);

    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  return d;
}

/** 필압 시뮬레이션: 속도에 따라 굵기 변화 */
function calcStrokeWidths(points: Point[], baseWidth: number, pressureEffect: boolean): number[] {
  if (!pressureEffect || points.length < 3) return points.map(() => baseWidth);
  return points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return baseWidth * 0.7;
    const prev = points[i - 1];
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    const dt = Math.max(p.t - prev.t, 1);
    const speed = Math.sqrt(dx * dx + dy * dy) / dt;
    // 빠르면 가늘게, 느리면 굵게
    const factor = Math.max(0.5, Math.min(1.5, 1.3 - speed * 0.15));
    return baseWidth * factor;
  });
}

interface SignaturePadProps {
  onSignatureChange: (base64: string | null) => void;
  width: number;
  height: number;
  /** true이면 전체화면 모달로 열림 */
  fullScreen?: boolean;
}

interface StrokeData {
  path: string;
  strokeWidth: number;
  opacity: number;
  color: string;
  widths: number[];
  points: Point[];
}

function SignaturePadInner({
  onSignatureChange,
  width,
  height,
  onClose,
  isModal,
}: {
  onSignatureChange: (base64: string | null) => void;
  width: number;
  height: number;
  onClose?: () => void;
  isModal?: boolean;
}) {
  const [strokes, setStrokes] = useState<StrokeData[]>([]);
  const [penIdx, setPenIdx] = useState(1); // 기본: 싸인펜
  const currentPoints = useRef<Point[]>([]);
  const viewShotRef = useRef<ViewShot>(null);
  const hasDrawn = useRef(false);

  const pen = PEN_STYLES[penIdx];

  const getPoint = (e: GestureResponderEvent): Point => {
    const { locationX, locationY, timestamp } = e.nativeEvent;
    return { x: locationX, y: locationY, t: timestamp };
  };

  const captureSignature = useCallback(async () => {
    if (!hasDrawn.current || !viewShotRef.current) { onSignatureChange(null); return; }
    try {
      const uri = await (viewShotRef.current as ViewShot & { capture: () => Promise<string> }).capture();
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => { onSignatureChange(reader.result as string); };
      reader.readAsDataURL(blob);
    } catch { onSignatureChange(null); }
  }, [onSignatureChange]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        hasDrawn.current = true;
        currentPoints.current = [getPoint(e)];
      },
      onPanResponderMove: (e) => {
        const pt = getPoint(e);
        currentPoints.current.push(pt);

        const pts = currentPoints.current;
        const path = smoothPath(pts, pen.smoothing);
        const widths = calcStrokeWidths(pts, pen.strokeWidth, pen.pressureEffect);
        const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length;

        setStrokes(prev => {
          const updated = [...prev];
          const liveStroke: StrokeData = {
            path,
            strokeWidth: avgWidth,
            opacity: pen.opacity,
            color: pen.color,
            widths,
            points: [...pts],
          };
          // 마지막이 진행 중 스트로크면 교체
          if (updated.length > 0 && updated[updated.length - 1].path.startsWith('M' + pts[0].x.toFixed(1))) {
            updated[updated.length - 1] = liveStroke;
          } else {
            updated.push(liveStroke);
          }
          return updated;
        });
      },
      onPanResponderRelease: () => {
        const pts = currentPoints.current;
        if (pts.length > 0) {
          const path = smoothPath(pts, pen.smoothing);
          const widths = calcStrokeWidths(pts, pen.strokeWidth, pen.pressureEffect);
          const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length;

          setStrokes(prev => {
            const filtered = prev.filter(s => !s.path.startsWith('M' + pts[0].x.toFixed(1)));
            return [...filtered, { path, strokeWidth: avgWidth, opacity: pen.opacity, color: pen.color, widths, points: [...pts] }];
          });
        }
        currentPoints.current = [];
        setTimeout(() => captureSignature(), 150);
      },
    })
  ).current;

  const handleClear = () => {
    setStrokes([]);
    hasDrawn.current = false;
    onSignatureChange(null);
  };

  const handleUndo = () => {
    setStrokes(prev => prev.slice(0, -1));
    if (strokes.length <= 1) { hasDrawn.current = false; onSignatureChange(null); }
    else setTimeout(() => captureSignature(), 100);
  };

  return (
    <View style={[innerStyles.wrapper, isModal && { flex: 1 }]}>
      {/* 필기구 선택 */}
      <View style={innerStyles.penBar}>
        {PEN_STYLES.map((p, i) => (
          <TouchableOpacity
            key={p.id}
            style={[innerStyles.penChip, penIdx === i && innerStyles.penChipActive]}
            onPress={() => setPenIdx(i)}
            activeOpacity={0.7}
          >
            <Text style={innerStyles.penIcon}>{p.icon}</Text>
            <Text style={[innerStyles.penLabel, penIdx === i && innerStyles.penLabelActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 서명 영역 */}
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0, result: 'tmpfile' }} style={[innerStyles.canvas, { width, height }]}>
        <View style={{ width, height }} {...panResponder.panHandlers}>
          <Svg width={width} height={height}>
            {strokes.map((s, i) => (
              <Path key={i} d={s.path} stroke={s.color} strokeWidth={s.strokeWidth} fill="none"
                strokeLinecap="round" strokeLinejoin="round" opacity={s.opacity} />
            ))}
          </Svg>
          {strokes.length === 0 && (
            <View style={innerStyles.placeholder}>
              <Text style={innerStyles.placeholderText}>여기에 서명하세요</Text>
            </View>
          )}
        </View>
      </ViewShot>

      {/* 하단 액션 */}
      <View style={innerStyles.actions}>
        <TouchableOpacity style={innerStyles.actionBtn} onPress={handleUndo} disabled={strokes.length === 0}>
          <MaterialIcons name="undo" size={20} color={strokes.length > 0 ? colors.onSurfaceVariant : colors.outline} />
          <Text style={[innerStyles.actionText, strokes.length === 0 && { color: colors.outline }]}>되돌리기</Text>
        </TouchableOpacity>
        <TouchableOpacity style={innerStyles.actionBtn} onPress={handleClear} disabled={strokes.length === 0}>
          <MaterialIcons name="delete-outline" size={20} color={strokes.length > 0 ? colors.error : colors.outline} />
          <Text style={[innerStyles.actionText, { color: strokes.length > 0 ? colors.error : colors.outline }]}>전체 지우기</Text>
        </TouchableOpacity>
        {isModal && onClose && (
          <TouchableOpacity style={[innerStyles.actionBtn, innerStyles.doneBtn]} onPress={onClose}>
            <MaterialIcons name="check" size={20} color="#fff" />
            <Text style={[innerStyles.actionText, { color: '#fff' }]}>완료</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const innerStyles = StyleSheet.create({
  wrapper: { gap: 8 },
  penBar: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: 4 },
  penChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant + '20',
  },
  penChipActive: { backgroundColor: colors.primary + '12', borderColor: colors.primary + '40' },
  penIcon: { fontSize: 16 },
  penLabel: { ...typography.labelSmall, color: colors.onSurfaceVariant },
  penLabelActive: { color: colors.primary, fontWeight: '700' },
  canvas: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant + '30',
    overflow: 'hidden',
  },
  placeholder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  placeholderText: { ...typography.bodyMedium, color: colors.outline + '60' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10 },
  actionText: { ...typography.labelSmall, color: colors.onSurfaceVariant },
  doneBtn: { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
});

/**
 * 서명 패드 — 인라인 또는 전체화면 모달
 */
export default function SignaturePad({ onSignatureChange, width, height, fullScreen }: SignaturePadProps) {
  const insets = useSafeAreaInsets();
  const [showModal, setShowModal] = useState(false);

  if (fullScreen) {
    return (
      <>
        <TouchableOpacity
          style={fsStyles.trigger}
          onPress={() => setShowModal(true)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="gesture" size={32} color={colors.primary} />
          <Text style={fsStyles.triggerText}>터치하여 서명하기</Text>
          <Text style={fsStyles.triggerHint}>전체 화면에서 서명합니다</Text>
        </TouchableOpacity>

        <Modal visible={showModal} animationType="slide" presentationStyle="fullScreen">
          <View style={[fsStyles.modal, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
            <View style={fsStyles.modalHeader}>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
              <Text style={fsStyles.modalTitle}>전자서명</Text>
              <View style={{ width: 24 }} />
            </View>
            <SignaturePadInner
              onSignatureChange={onSignatureChange}
              width={SW - spacing.md * 2}
              height={SH * 0.5}
              onClose={() => setShowModal(false)}
              isModal
            />
          </View>
        </Modal>
      </>
    );
  }

  return <SignaturePadInner onSignatureChange={onSignatureChange} width={width} height={height} />;
}

const fsStyles = StyleSheet.create({
  trigger: {
    height: 120, borderRadius: borderRadius.xl, borderWidth: 2, borderStyle: 'dashed',
    borderColor: colors.primary + '40', backgroundColor: colors.primary + '05',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  triggerText: { ...typography.bodyMedium, color: colors.primary, fontWeight: '600' },
  triggerHint: { ...typography.labelSmall, color: colors.onSurfaceVariant },
  modal: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, marginBottom: spacing.md,
  },
  modalTitle: { ...typography.titleMedium, color: colors.onSurface, fontWeight: '700' },
});
