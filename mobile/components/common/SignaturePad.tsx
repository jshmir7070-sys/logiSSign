import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, PanResponder, type GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import { colors, borderRadius } from '../../constants/theme';

interface SignaturePadProps {
  onSignatureChange: (base64: string | null) => void;
  width: number;
  height: number;
}

/**
 * 전자서명 패드
 * PanResponder로 SVG Path를 그리고, ViewShot으로 실제 PNG 이미지를 캡처
 * onSignatureChange에 data:image/png;base64,... 형태로 전달
 */
export default function SignaturePad({ onSignatureChange, width, height }: SignaturePadProps) {
  const [paths, setPaths] = useState<string[]>([]);
  const currentPath = useRef<string>('');
  const viewShotRef = useRef<ViewShot>(null);
  const hasDrawn = useRef(false);

  const getPoint = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    return { x: Math.round(locationX), y: Math.round(locationY) };
  };

  // ViewShot으로 실제 PNG 캡처
  const captureSignature = useCallback(async () => {
    if (!hasDrawn.current || !viewShotRef.current) {
      onSignatureChange(null);
      return;
    }

    try {
      const uri = await (viewShotRef.current as ViewShot & { capture: () => Promise<string> }).capture();
      // file URI → base64 변환
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        onSignatureChange(base64);
      };
      reader.readAsDataURL(blob);
    } catch {
      onSignatureChange(null);
    }
  }, [onSignatureChange]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        hasDrawn.current = true;
        const { x, y } = getPoint(e);
        currentPath.current = `M${x},${y}`;
      },
      onPanResponderMove: (e) => {
        const { x, y } = getPoint(e);
        currentPath.current += ` L${x},${y}`;
        setPaths((prev) => {
          const updated = [...prev];
          const prefix = currentPath.current.split(' L')[0];
          if (updated.length > 0 && updated[updated.length - 1].startsWith(prefix)) {
            updated[updated.length - 1] = currentPath.current;
          } else {
            updated.push(currentPath.current);
          }
          return updated;
        });
      },
      onPanResponderRelease: () => {
        setPaths((prev) => {
          const prefix = currentPath.current.split(' L')[0];
          return [...prev.filter((p) => !p.startsWith(prefix)), currentPath.current];
        });
        currentPath.current = '';
        // 터치 종료 시 PNG 캡처
        setTimeout(() => captureSignature(), 100);
      },
    })
  ).current;

  return (
    <ViewShot
      ref={viewShotRef}
      options={{ format: 'png', quality: 1.0, result: 'tmpfile' }}
      style={[styles.container, { width, height }]}
    >
      <View
        style={{ width, height }}
        {...panResponder.panHandlers}
      >
        <Svg width={width} height={height}>
          {paths.map((d, i) => (
            <Path
              key={i}
              d={d}
              stroke={colors.onSurface}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      </View>
    </ViewShot>
  );
}

/** 서명 초기화 헬퍼 */
export function clearSignature(setPaths: React.Dispatch<React.SetStateAction<string[]>>) {
  setPaths([]);
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.outlineVariant + '40',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
});
