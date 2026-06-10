import React, { useRef } from 'react';
import { View, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

const STAR_COLOR = '#F59E0B';

const Star = ({ filled, size, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // Quick pop on tap.
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.35, useNativeDriver: true, friction: 4, tension: 220 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }),
    ]).start();
    onPress();
  };

  return (
    <Pressable onPress={handlePress} hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={filled ? 'star' : 'star-outline'}
          size={size}
          color={filled ? STAR_COLOR : COLORS.border}
        />
      </Animated.View>
    </Pressable>
  );
};

/**
 * Interactive star rating input with a tactile pop on each tap.
 *
 * @param {number}   value     current rating (0–5)
 * @param {function} onChange  called with the tapped star value
 * @param {number}   size      icon size (default 38)
 * @param {number}   gap       spacing between stars (default 8)
 */
const StarRatingInput = ({ value = 0, onChange, size = 38, gap = 8 }) => (
  <View style={{ flexDirection: 'row', gap }}>
    {[1, 2, 3, 4, 5].map((s) => (
      <Star key={s} filled={s <= value} size={size} onPress={() => onChange(s)} />
    ))}
  </View>
);

export default StarRatingInput;
