import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  StatusBar, Alert, KeyboardAvoidingView, Platform, Animated, Easing,
  ActivityIndicator, Pressable, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { verifyOtpApi, sendOtpApi } from '../../api/authApi';
import { COLORS } from '../../constants/colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BRAND = ['#1E3A8A', '#4338CA', '#7C3AED'];
const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

// ── SVG gradient fill that measures its own box ──────────────────────────────
const GradientFill = ({ id, colors, radius = 0, vertical = false }) => {
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((p) => (p.w === width && p.h === height ? p : { w: width, h: height }));
      }}
    >
      {box.w > 0 && box.h > 0 && (
        <Svg width={box.w} height={box.h}>
          <Defs>
            <SvgGradient id={id} x1="0" y1="0" x2={vertical ? '0' : box.w} y2={box.h} gradientUnits="userSpaceOnUse">
              {colors.map((c, i) => <Stop key={i} offset={`${i / (colors.length - 1)}`} stopColor={c} />)}
            </SvgGradient>
          </Defs>
          <Rect x="0" y="0" width={box.w} height={box.h} rx={radius} ry={radius} fill={`url(#${id})`} />
        </Svg>
      )}
    </View>
  );
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const OtpVerifyScreen = ({ navigation, route }) => {
  const { email, purpose, userData, authData, devCode } = route.params ?? {};
  const insets = useSafeAreaInsets();
  const { register, finalizeLogin } = useAuth();

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [timer, setTimer] = useState(RESEND_SECONDS);
  const [loading, setLoading] = useState(false);
  const inputs = useRef([]);

  // Animations
  const intro = useRef([...Array(5)].map(() => new Animated.Value(0))).current;
  const blobA = useRef(new Animated.Value(0)).current;
  const blobB = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.max(b.length, 4)) + c)
    : '••••••••';

  useEffect(() => {
    Animated.stagger(110, intro.map((a) =>
      Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 9, tension: 55 })
    )).start();

    const loop = (val, dur) => Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop(blobA, 6000).start();
    loop(blobB, 8000).start();

    const t = setTimeout(() => inputs.current[0]?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (timer === 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const sect = (i) => ({
    opacity: intro[i],
    transform: [{ translateY: intro[i].interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }],
  });

  const handleDigit = (text, idx) => {
    const d = [...digits];
    d[idx] = text.replace(/[^0-9]/g, '').slice(-1);
    setDigits(d);
    if (d[idx] && idx < OTP_LENGTH - 1) {
      inputs.current[idx + 1]?.focus();
    }
  };

  const handleKeyPress = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[idx] && idx > 0) {
      const d = [...digits];
      d[idx - 1] = '';
      setDigits(d);
      inputs.current[idx - 1]?.focus();
    }
  };

  const verify = async () => {
    const code = digits.join('');
    if (code.length < OTP_LENGTH) {
      Alert.alert('Incomplete', 'Please enter all 6 digits.');
      return;
    }
    setLoading(true);

    // Step 1 — verify the OTP code itself
    try {
      await verifyOtpApi(email, code);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Verification failed.';
      const isExpiredOrMissing = msg.toLowerCase().includes('no code') || msg.toLowerCase().includes('expired');
      const isTooMany = msg.toLowerCase().includes('too many');
      Alert.alert(
        isExpiredOrMissing ? 'Code Expired' : isTooMany ? 'Too Many Attempts' : 'Invalid Code',
        isExpiredOrMissing
          ? 'This code has expired. Tap "Resend Code" to get a new one.'
          : isTooMany
            ? 'You have made too many attempts. Please wait a few minutes and request a new code.'
            : 'The code you entered is incorrect. Please check your email and try again.',
      );
      setLoading(false);
      return;
    }

    // Step 2 — OTP is valid; complete registration or login
    try {
      if (purpose === 'register' && userData) {
        await register(userData, 'passenger');
      } else if (purpose === 'login_verify' && authData) {
        await finalizeLogin(authData.userRole, authData.userData, authData.accessToken, authData.refreshToken);
      }
    } catch (err) {
      const details = err.response?.data?.details;
      const firstDetail = details ? Object.values(details)[0]?.[0] : null;
      const msg = firstDetail || err.response?.data?.error || err.message || 'Something went wrong. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setTimer(RESEND_SECONDS);
    setDigits(Array(OTP_LENGTH).fill(''));
    inputs.current[0]?.focus();
    try {
      await sendOtpApi(email, purpose);
      Alert.alert('Code Sent', `A new verification code has been sent to ${maskedEmail}.`);
    } catch {
      Alert.alert('Error', 'Could not resend code. Please try again.');
    }
  };

  const headingText = purpose === 'login_verify' ? 'Verify your login' : 'Verify your account';

  const blobAStyle = {
    transform: [
      { translateX: blobA.interpolate({ inputRange: [0, 1], outputRange: [-20, 30] }) },
      { translateY: blobA.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }) },
      { scale: blobA.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) },
    ],
  };
  const blobBStyle = {
    transform: [
      { translateX: blobB.interpolate({ inputRange: [0, 1], outputRange: [20, -30] }) },
      { translateY: blobB.interpolate({ inputRange: [0, 1], outputRange: [10, -30] }) },
      { scale: blobB.interpolate({ inputRange: [0, 1], outputRange: [1.1, 0.9] }) },
    ],
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND[0]} />

      {/* Animated gradient background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <GradientFill id="otpBgGrad" colors={BRAND} vertical />
        <Animated.View style={[styles.blob, styles.blobA, blobAStyle]} />
        <Animated.View style={[styles.blob, styles.blobB, blobBStyle]} />
        <View style={styles.blobC} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Hero */}
          <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
            <TouchableOpacity
              style={[styles.backBtn, { top: insets.top + 20 }]}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.white} />
            </TouchableOpacity>

            <Animated.View style={[styles.logoWrap, {
              opacity: intro[0],
              transform: [{ scale: intro[0].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
            }]}>
              <View style={styles.logoCircle}>
                <Ionicons name="shield-checkmark" size={34} color={COLORS.primary} />
              </View>
            </Animated.View>
            <Animated.Text style={[styles.brand, sect(1)]}>{headingText}</Animated.Text>
            <Animated.Text style={[styles.tagline, sect(1)]}>
              Enter the 6-digit code we sent you
            </Animated.Text>
          </View>

          {/* Card */}
          <Animated.View style={[styles.card, sect(2), { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>Enter code</Text>
            <Text style={styles.subtitle}>
              Sent to <Text style={styles.emailHighlight}>{maskedEmail}</Text>
            </Text>

            {devCode ? (
              <View style={styles.devNote}>
                <Ionicons name="construct" size={15} color={COLORS.primary} />
                <Text style={styles.devNoteText}>Dev code: <Text style={{ fontWeight: '800' }}>{devCode}</Text></Text>
              </View>
            ) : null}

            <Animated.View style={sect(3)}>
              {/* OTP boxes */}
              <View style={styles.otpRow}>
                {digits.map((d, i) => {
                  const active = focusedIdx === i;
                  return (
                    <TextInput
                      key={i}
                      ref={(r) => (inputs.current[i] = r)}
                      style={[
                        styles.otpBox,
                        d ? styles.otpBoxFilled : null,
                        active ? styles.otpBoxActive : null,
                      ]}
                      value={d}
                      onChangeText={(t) => handleDigit(t, i)}
                      onKeyPress={(e) => handleKeyPress(e, i)}
                      onFocus={() => setFocusedIdx(i)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                    />
                  );
                })}
              </View>

              {/* Verify button */}
              <AnimatedPressable
                onPress={verify}
                disabled={loading}
                onPressIn={() => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
                onPressOut={() => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start()}
                style={[styles.primaryBtn, { transform: [{ scale: btnScale }], opacity: loading ? 0.85 : 1 }]}
              >
                <View style={styles.primaryBg} pointerEvents="none">
                  <GradientFill id="otpBtnGrad" colors={['#2563EB', '#7C3AED']} radius={16} />
                </View>
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Text style={styles.primaryText}>Verify Code</Text>
                    <Ionicons name="checkmark-circle" size={19} color={COLORS.white} />
                  </>
                )}
              </AnimatedPressable>

              {/* Resend */}
              <View style={styles.resendRow}>
                {timer > 0 ? (
                  <Text style={styles.timerText}>
                    Resend code in <Text style={{ color: COLORS.primary, fontWeight: '800' }}>{timer}s</Text>
                  </Text>
                ) : (
                  <TouchableOpacity onPress={resend} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.resendLink}>Resend Code</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>

            <View style={styles.secureRow}>
              <Ionicons name="shield-checkmark" size={13} color={COLORS.textMuted} />
              <Text style={styles.secureText}>Protected with end-to-end encryption</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND[0] },

  /* Background blobs */
  blob: { position: 'absolute', borderRadius: 9999 },
  blobA: { width: 280, height: 280, top: -60, right: -80, backgroundColor: 'rgba(124,58,237,0.45)' },
  blobB: { width: 240, height: 240, top: SCREEN_H * 0.22, left: -90, backgroundColor: 'rgba(37,99,235,0.40)' },
  blobC: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -30, left: SCREEN_W * 0.3, backgroundColor: 'rgba(255,255,255,0.06)' },

  /* Hero */
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 34 },
  backBtn: {
    position: 'absolute', left: 24, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  logoWrap: {
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25, shadowRadius: 18, elevation: 10,
  },
  logoCircle: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  brand: { fontSize: 27, fontWeight: '900', color: COLORS.white, letterSpacing: 0.2, textAlign: 'center' },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.78)', marginTop: 5, textAlign: 'center' },

  /* Card */
  card: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 34, borderTopRightRadius: 34,
    paddingHorizontal: 24, paddingTop: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 20,
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 18 },
  title: { fontSize: 26, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 22 },
  emailHighlight: { fontWeight: '800', color: COLORS.textPrimary },

  devNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 18,
  },
  devNoteText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  /* OTP boxes */
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 26 },
  otpBox: {
    width: 48, height: 60, borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.border, backgroundColor: COLORS.background,
    fontSize: 24, fontWeight: '800', textAlign: 'center', color: COLORS.textPrimary,
  },
  // value-based + focus highlight only change border/colour (focus-safe, no
  // backgroundColor/shadow toggling that would drop native focus on Fabric).
  otpBoxFilled: { borderColor: COLORS.primaryMid, color: COLORS.primary },
  otpBoxActive: { borderColor: COLORS.primary },

  /* Primary gradient button */
  primaryBtn: {
    height: 56, borderRadius: 16, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32, shadowRadius: 14, elevation: 8,
  },
  primaryBg: { ...StyleSheet.absoluteFillObject, borderRadius: 16, overflow: 'hidden' },
  primaryText: { fontSize: 16, fontWeight: '800', color: COLORS.white, letterSpacing: 0.3 },

  /* Resend */
  resendRow: { alignItems: 'center', marginTop: 18 },
  timerText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  resendLink: { fontSize: 14, fontWeight: '800', color: COLORS.primary },

  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 22 },
  secureText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
});

export default OtpVerifyScreen;
