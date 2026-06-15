import React, { useRef, useEffect, useState } from 'react';
import { Text, Animated, Easing } from 'react-native';

/**
 * Animates a number counting up from 0 to `value` on mount / value change.
 * Used for the ratings average so the summary card feels alive.
 *
 * @param {number} value     target number
 * @param {number} decimals  decimal places (default 1)
 * @param {number} duration  ms (default 900)
 */
const CountUp = ({ value = 0, decimals = 1, duration = 900, style, suffix = '' }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState((0).toFixed(decimals));

  useEffect(() => {
    const target = Number(value) || 0;
    const id = anim.addListener(({ value: v }) => setDisplay(v.toFixed(decimals)));
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // animating a JS-side number, not a transform
    }).start();
    return () => anim.removeListener(id);
  }, [value, decimals, duration, anim]);

  return <Text style={style}>{display}{suffix}</Text>;
};

export default CountUp;
