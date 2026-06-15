import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text } from 'react-native';

const CountUp = ({ value = 0, decimals = 0, style, duration = 800 }) => {
  const animVal  = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(value.toFixed(decimals));

  useEffect(() => {
    const anim = Animated.timing(animVal, {
      toValue:         value,
      duration,
      useNativeDriver: false,
    });
    const id = animVal.addListener(({ value: v }) => setDisplay(v.toFixed(decimals)));
    anim.start(() => animVal.removeListener(id));
    return () => animVal.removeListener(id);
  }, [value, decimals]);

  return <Text style={style}>{display}</Text>;
};

export default CountUp;
