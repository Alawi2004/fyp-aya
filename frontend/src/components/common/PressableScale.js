import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';

// Animating the Pressable itself (rather than an inner wrapper) keeps the
// passed-in style — including flex — on a single element, so flex-row buttons
// size correctly while still scaling on press.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable that springs down slightly while pressed — adds tactile feedback
 * to buttons and cards. Drop-in replacement for TouchableOpacity in most cases:
 * `style` and press handlers pass straight through.
 *
 * @param {number} scaleTo  pressed scale (default 0.96)
 */
const PressableScale = ({
  children,
  onPress,
  onLongPress,
  disabled = false,
  style,
  scaleTo = 0.96,
  hitSlop,
  ...rest
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue) =>
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      friction: 7,
      tension: 140,
    }).start();

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => !disabled && spring(scaleTo)}
      onPressOut={() => spring(1)}
      style={[style, { transform: [{ scale }] }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
};

export default PressableScale;
