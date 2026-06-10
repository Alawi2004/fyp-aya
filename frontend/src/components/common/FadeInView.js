import React, { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Entrance animation wrapper — fade + slide-up + subtle scale-in.
 * Built on React Native's Animated API (native driver), so it stays smooth
 * inside FlatLists. Pass an incrementing `index` for a staggered cascade:
 *   <FadeInView index={i}>...</FadeInView>
 *
 * @param {number} delay      base delay in ms before animating (default 0)
 * @param {number} index      list index — multiplied by `stagger` (capped at 8)
 * @param {number} stagger    ms between successive items (default 65)
 * @param {number} offset     starting vertical offset in px (default 16)
 * @param {number} scaleFrom  starting scale (default 0.97; set 1 to disable)
 * @param {number} duration   animation duration in ms (default 460)
 */
const FadeInView = ({
  children,
  delay = 0,
  index = 0,
  stagger = 65,
  offset = 16,
  scaleFrom = 0.97,
  duration = 460,
  style,
}) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Cap the stagger so long lists don't take forever to settle.
    const totalDelay = delay + Math.min(index, 8) * stagger;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay: totalDelay,
      easing: Easing.bezier(0.22, 1, 0.36, 1), // gentle "ease-out-back"-ish
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay, index, stagger, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [offset, 0],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [scaleFrom, 1],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

export default FadeInView;
