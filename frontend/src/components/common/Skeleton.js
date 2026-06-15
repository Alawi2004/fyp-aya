import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { COLORS } from '../../constants/colors';

/**
 * Shimmering placeholder block. Loops a soft opacity pulse (native driver),
 * giving list screens a polished loading state instead of a bare spinner.
 *
 * @param {number|string} width
 * @param {number} height
 * @param {number} radius   border radius (default 8)
 */
export const Skeleton = ({ width = '100%', height = 14, radius = 8, style }) => {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: COLORS.surfaceAlt, opacity: pulse },
        style,
      ]}
    />
  );
};

/**
 * A card-shaped skeleton matching the rounded white cards used across the
 * profile screens. Renders `count` of them for a believable loading list.
 */
export const SkeletonCardList = ({ count = 5 }) => (
  <View style={styles.list}>
    {Array.from({ length: count }).map((_, i) => (
      <View key={i} style={styles.card}>
        <View style={styles.row}>
          <Skeleton width={42} height={42} radius={13} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="55%" height={13} />
            <Skeleton width="35%" height={11} />
          </View>
          <Skeleton width={64} height={22} radius={999} />
        </View>
        <Skeleton width="100%" height={11} style={{ marginTop: 14 }} />
        <Skeleton width="80%" height={11} style={{ marginTop: 8 }} />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});

export default Skeleton;
