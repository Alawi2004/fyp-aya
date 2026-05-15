import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Dimensions,
  TouchableOpacity, StatusBar, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    key: '1',
    icon: 'bus',
    bgColor: '#EFF6FF',
    iconColor: COLORS.primary,
    title: 'Welcome to BusApp',
    subtitle:
      'Your smart companion for bus travel.\nTrack buses in real-time and never miss your ride.',
  },
  {
    key: '2',
    icon: 'ticket-outline',
    bgColor: '#F5F3FF',
    iconColor: '#7C3AED',
    title: 'Book Your Seat',
    subtitle:
      'Find your route, pick a bus, and reserve your seat in seconds. Your ticket lives in the app.',
  },
  {
    key: '3',
    icon: 'wallet-outline',
    bgColor: '#ECFDF5',
    iconColor: COLORS.secondary,
    title: 'Top Up & Pay',
    subtitle:
      'Load your wallet easily and pay for rides seamlessly. No cash, no hassle — ever.',
  },
];

const OnboardingScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const flatRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [current, setCurrent] = useState(0);

  const finish = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    navigation.replace('Login');
  };

  const next = () => {
    if (current < SLIDES.length - 1) {
      const next = current + 1;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrent(next);
    } else {
      finish();
    }
  };

  const slide = SLIDES[current];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Skip button */}
      {current < SLIDES.length - 1 && (
        <TouchableOpacity style={styles.skip} onPress={finish}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <Animated.FlatList
        ref={flatRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={[styles.illustrationWrap, { backgroundColor: item.bgColor }]}>
              <View style={[styles.iconCircle, { backgroundColor: item.iconColor }]}>
                <Ionicons name={item.icon} size={56} color={COLORS.white} />
              </View>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Dot indicators */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => {
          const dotWidth = scrollX.interpolate({
            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });
          const dotColor = scrollX.interpolate({
            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
            outputRange: [COLORS.border, slide.iconColor, COLORS.border],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={i}
              style={[styles.dot, { width: dotWidth, backgroundColor: dotColor }]}
            />
          );
        })}
      </View>

      {/* CTA Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: slide.iconColor }]}
          onPress={next}
          activeOpacity={0.85}
        >
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
    top: 52,
    right: 24,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.background,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  slide: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingTop: 60,
  },
  illustrationWrap: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 44,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
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
    paddingVertical: 17,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.white,
  },
});

export default OnboardingScreen;
