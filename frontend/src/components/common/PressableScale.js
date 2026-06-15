import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';

const PressableScale = ({ children, onPress, style, scaleTo = 0.95, disabled, ...rest }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, friction: 6, tension: 300 }).start();

  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 300 }).start();

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export default PressableScale;
