import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const SkeletonBox = ({ width, height, style }) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });

  return (
    <Animated.View
      style={[{ width, height, borderRadius: 8, backgroundColor: '#E2E8F0', opacity }, style]}
    />
  );
};

export const SkeletonCard = () => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <SkeletonBox width={40} height={40} style={{ borderRadius: 12 }} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBox width="70%" height={12} />
        <SkeletonBox width="45%" height={10} />
      </View>
      <SkeletonBox width={60} height={22} style={{ borderRadius: 99 }} />
    </View>
    <SkeletonBox width="100%" height={10} style={{ marginTop: 12 }} />
    <SkeletonBox width="80%" height={10} style={{ marginTop: 8 }} />
  </View>
);

export const SkeletonCardList = ({ count = 3 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});

export default SkeletonCard;
