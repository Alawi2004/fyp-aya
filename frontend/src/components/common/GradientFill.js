import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';

/**
 * Absolute-fill SVG gradient that measures its own box.
 * Matches the pattern used across the auth + profile screens so gradient
 * headers render identically without pulling in expo-linear-gradient.
 *
 * @param {string}   id        unique gradient id (required, must be unique per screen)
 * @param {string[]} colors    stop colors, top→bottom (or left→right)
 * @param {boolean}  vertical  vertical gradient when true (default), diagonal otherwise
 */
const GradientFill = ({ id, colors, vertical = true }) => {
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((p) => (p.w === width && p.h === height ? p : { w: width, h: height }));
      }}
    >
      {box.w > 0 && box.h > 0 && (
        <Svg width={box.w} height={box.h}>
          <Defs>
            <SvgGradient
              id={id}
              x1="0"
              y1="0"
              x2={vertical ? '0' : box.w}
              y2={box.h}
              gradientUnits="userSpaceOnUse"
            >
              {colors.map((c, i) => (
                <Stop key={i} offset={`${i / (colors.length - 1)}`} stopColor={c} />
              ))}
            </SvgGradient>
          </Defs>
          <Rect x="0" y="0" width={box.w} height={box.h} fill={`url(#${id})`} />
        </Svg>
      )}
    </View>
  );
};

export default GradientFill;
