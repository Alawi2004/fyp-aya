import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Dimensions,
  TouchableOpacity, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { THEME } from '../../constants/theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    key: '1',
    icon: 'bus',
    bgColor: '#EFF6FF',
    ringColor: 'rgba(37,99,235,0.10)',
    iconColor: COLORS.primary,
    title: 'Welcome to Yalla Transit',
    subtitle:
      'Your smart companion for bus travel.\nTrack buses in real-time and never miss your ride.',
  },
  {
    key: '2',
    icon: 'ticket-outline',
    bgColor: '#F5F3FF',
    ringColor: 'rgba(124,58,237,0.10)',
    iconColor: '#7C3AED',
    title: 'Book Your Seat',
    subtitle:
      'Find your route, pick a bus, and reserve your seat in seconds. Your ticket lives in the app.',
  },
  {
    key: '3',
    icon: 'wallet-outline',
    bgColor: '#ECFDF5',
    ringColor: 'rgba(16,185,129,0.10)',
    iconColor: COLORS.secondary,
    title: 'Top Up & Pay',
    subtitle:
      'Load your wallet easily and pay for rides seamlessly. No cash, no hassle — ever.',
  },
];

const OnboardingScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const flatRef = useRef(null);
  const [current, setCurrent] = useState(0);

  const finish = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    navigation.replace('Login');
  };

  const goTo = (index) => {
    flatRef.current?.scrollToIndex({ index, animated: true });
    setCurrent(index);
  };

  const next = () => {
    if (current < SLIDES.length - 1) {
      goTo(current + 1);
    } else {
      finish();
    }
  };

  const slide = SLIDES[current];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Skip */}
      {current < SLIDES.length - 1 && (
        <TouchableOpacity style={styles.skip} onPress={finish}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            {/* Layered illustration: outer ring → colored bg circle → icon */}
            <View style={[styles.ringOuter, { backgroundColor: item.ringColor }]}>
              <View style={[styles.illustrationWrap, { backgroundColor: item.bgColor }]}>
                <View style={[styles.iconCircle, { backgroundColor: item.iconColor }]}>
                  <View style={styles.iconInnerHighlight} pointerEvents="none" />
                  <Ionicons name={item.icon} size={54} color={COLORS.white} />
                </View>
              </View>
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Dot indicators */}
      <View style={styles.dotsRow}>
        {SLIDES.map((s, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => goTo(i)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={[
              styles.dot,
              i === current
                ? { width: 28, backgroundColor: slide.iconColor }
                : { width: 8, backgroundColor: COLORS.border },
            ]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: slide.iconColor }]}
          onPress={next}
          activeOpacity={0.84}
        >
          <View style={styles.btnHighlight} pointerEvents="none" />
          <Text style={styles.btnText}>
            {current === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons
            name={current === SLIDES.length - 1 ? 'checkmark' : 'arrow-forward'}
            size={20}
            color={COLORS.white}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },

  skip: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: THEME.borderRadius.round,
    backgroundColor: COLORS.background,
  },
  skipText: {
    fontSize: THEME.fontSize.sm,
    fontWeight: THEME.fontWeight.semibold,
    color: COLORS.textSecondary,
  },

  slide: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingTop: 64,
  },
  ringOuter: {
    width: 260,
    height: 260,
    borderRadius: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  illustrationWrap: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 144,
    height: 144,
    borderRadius: 72,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  iconInnerHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
  },
  title: {
    fontSize: THEME.fontSize.xxl,
    fontWeight: THEME.fontWeight.extrabold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.4,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: THEME.fontSize.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: THEME.fontWeight.medium,
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
    marginBottom: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: THEME.borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  btnHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
  },
  btnText: {
    fontSize: THEME.fontSize.md,
    fontWeight: THEME.fontWeight.bold,
    color: COLORS.white,
    letterSpacing: 0.2,
  },
});

export default OnboardingScreen;
