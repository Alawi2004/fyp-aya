import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../constants/colors';

const SplashScreen = ({ navigation }) => {
  const scale = useRef(new Animated.Value(0.65)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.4)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 60 }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(ringScale, { toValue: 1.15, useNativeDriver: true, friction: 5, tension: 50 }),
        Animated.timing(ringOpacity, { toValue: 0.55, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textSlide, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
    ]).start();

    const timer = setTimeout(async () => {
      const seen = await AsyncStorage.getItem('hasSeenOnboarding');
      navigation.replace(seen ? 'Login' : 'Onboarding');
    }, 2400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      {/* Ambient background circles */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      {/* Glow ring */}
      <Animated.View style={[styles.glowRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />

      {/* Logo */}
      <Animated.View style={[styles.logoWrap, { transform: [{ scale }], opacity }]}>
        <View style={styles.innerHighlight} pointerEvents="none" />
        <Ionicons name="bus" size={60} color={COLORS.white} />
      </Animated.View>

      {/* Text */}
      <Animated.View style={{ opacity, transform: [{ translateY: textSlide }], alignItems: 'center' }}>
        <Text style={styles.title}>Yalla Transit</Text>
        <Text style={styles.subtitle}>Smart Bus Booking & Tracking</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgCircle1: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(255,255,255,0.04)',
    top: -80,
    right: -80,
  },
  bgCircle2: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -60,
    left: -60,
  },
  glowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginBottom: 0,
  },
  logoWrap: {
    width: 128,
    height: 128,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  innerHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.white,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});

export default SplashScreen;
