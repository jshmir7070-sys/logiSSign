import React, { useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, type GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, borderRadius } from '../../constants/theme';

interface SignaturePadProps {
  onSignatureChange: (base64: string | null) => void;
  width: number;
  height: number;
}

export default function SignaturePad({ onSignatureChange, width, height }: SignaturePadProps) {
  const [paths, setPaths] = useState<string[]>([]);
  const currentPath = useRef<string>('');

  const getPoint = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    return { x: Math.round(locationX), y: Math.round(locationY) };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { x, y } = getPoint(e);
        currentPath.current = `M${x},${y}`;
      },
      onPanResponderMove: (e) => {
        const { x, y } = getPoint(e);
        currentPath.current += ` L${x},${y}`;
        setPaths((prev) => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].startsWith(currentPath.current.split(' L')[0])) {
            updated[updated.length - 1] = currentPath.current;
          } else {
            updated.push(currentPath.current);
          }
          return updated;
        });
      },
      onPanResponderRelease: () => {
        setPaths((prev) => [...prev.filter((p) => !p.startsWith(currentPath.current.split(' L')[0])), currentPath.current]);
        // Generate a simple base64 placeholder — real impl would use canvas/viewShot
        const svgContent = paths.join(' ');
        onSignatureChange(svgContent.length > 10 ? btoa(svgContent) : null);
        currentPath.current = '';
      },
    })
  ).current;

  return (
    <View
      style={[styles.container, { width, height }]}
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
  );
}

export function clearSignature(setPaths: React.Dispatch<React.SetStateAction<string[]>>) {
  setPaths([]);
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.outlineVariant + '40',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
});
