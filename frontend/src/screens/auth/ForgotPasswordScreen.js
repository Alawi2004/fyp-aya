import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, KeyboardAvoidingView, Platform, StatusBar, Animated, Easing,
  ActivityIndicator, Pressable, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { forgotPasswordApi } from '../../api/authApi';
import { COLORS, PURPLE } from '../../constants/colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BRAND = PURPLE.gradient;

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

// ── Floating-label animated input (focus-safe: borderColor only) ─────────────
const Field = ({ icon, label, value, onChangeText, keyboardType, error }) => {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: focused || value ? 1 : 0,
      duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: false,
    }).start();
  }, [focused, value]);

  const borderColor = error ? COLORS.danger : focused ? PURPLE.primary : COLORS.border;
  const tint = error ? COLORS.danger : focused ? PURPLE.primary : COLORS.textMuted;

  return (
    <View style={{ marginBottom: error ? 6 : 16 }}>
      <View style={[styles.fieldWrap, { borderColor }]}>
        <View style={styles.fieldIcon}>
          <Ionicons name={icon} size={19} color={tint} />
        </View>
        <Animated.Text
          pointerEvents="none"
          style={[styles.floatLabel, {
            color: tint,
            top: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 8] }),
            fontSize: anim.interpolate({ inputRange: [0, 1], outputRange: [15, 11] }),
          }]}
        >
          {label}
        </Animated.Text>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {error ? (
        <View style={styles.errRow}>
          <Ionicons name="alert-circle" size={13} color={COLORS.danger} />
          <Text style={styles.errText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
};

const ForgotPasswordScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Animations
  const intro = useRef([...Array(5)].map(() => new Animated.Value(0))).current;
  const blobA = useRef(new Animated.Value(0)).current;
  const blobB = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

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
  }, []);

  const sect = (i) => ({
    opacity: intro[i],
    transform: [{ translateY: intro[i].interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }],
  });

  const handleSend = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Enter a valid email address');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await forgotPasswordApi(email.trim());
      setSent(true);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

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
        <GradientFill id="fpBgGrad" colors={BRAND} vertical />
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
                <Ionicons name={sent ? 'mail' : 'lock-open'} size={34} color={PURPLE.primary} />
              </View>
            </Animated.View>
            <Animated.Text style={[styles.brand, sect(1)]}>
              {sent ? 'Check your email' : 'Reset password'}
            </Animated.Text>
            <Animated.Text style={[styles.tagline, sect(1)]}>
              {sent ? `We sent a reset link to ${email}` : 'We\'ll email you a secure reset link'}
            </Animated.Text>
          </View>

          {/* Card */}
          <Animated.View style={[styles.card, sect(2), { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.handle} />

            {!sent ? (
              <>
                <Text style={styles.title}>Forgot password?</Text>
                <Text style={styles.subtitle}>No worries — enter your email and we'll send reset instructions.</Text>

                <Animated.View style={sect(3)}>
                  <Field
                    icon="mail-outline"
                    label="Email address"
                    value={email}
                    onChangeText={(t) => { setEmail(t); if (error) setError(null); }}
                    keyboardType="email-address"
                    error={error}
                  />

                  <AnimatedPressable
                    onPress={handleSend}
                    disabled={loading}
                    onPressIn={() => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
                    onPressOut={() => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start()}
                    style={[styles.primaryBtn, { marginTop: 4, transform: [{ scale: btnScale }], opacity: loading ? 0.85 : 1 }]}
                  >
                    <View style={styles.primaryBg} pointerEvents="none">
                      <GradientFill id="fpBtnGrad" colors={PURPLE.gradient} radius={16} />
                    </View>
                    {loading ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <>
                        <Text style={styles.primaryText}>Send Reset Link</Text>
                        <Ionicons name="arrow-forward" size={19} color={COLORS.white} />
                      </>
                    )}
                  </AnimatedPressable>

                  <TouchableOpacity style={styles.backToLogin} onPress={() => navigation.navigate('Login')}>
                    <Ionicons name="arrow-back" size={14} color={PURPLE.primary} />
                    <Text style={styles.backToLoginText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </Animated.View>
              </>
            ) : (
              <Animated.View style={sect(3)}>
                <Text style={styles.title}>Email sent!</Text>
                <Text style={styles.subtitle}>Open your inbox and follow the link to reset your password.</Text>

                <View style={styles.note}>
                  <Ionicons name="information-circle" size={18} color={PURPLE.primary} />
                  <Text style={styles.noteText}>Didn't receive it? Check your spam folder, or resend below.</Text>
                </View>

                <AnimatedPressable
                  onPress={() => navigation.navigate('Login')}
                  onPressIn={() => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
                  onPressOut={() => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start()}
                  style={[styles.primaryBtn, { marginTop: 18, transform: [{ scale: btnScale }] }]}
                >
                  <View style={styles.primaryBg} pointerEvents="none">
                    <GradientFill id="fpBtnGrad2" colors={PURPLE.gradient} radius={16} />
                  </View>
                  <Text style={styles.primaryText}>Back to Sign In</Text>
                  <Ionicons name="arrow-forward" size={19} color={COLORS.white} />
                </AnimatedPressable>

                <TouchableOpacity style={styles.ghostBtn} onPress={() => setSent(false)} activeOpacity={0.85}>
                  <Ionicons name="refresh" size={17} color={PURPLE.primary} />
                  <Text style={styles.ghostText}>Resend email</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

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
  brand: { fontSize: 28, fontWeight: '900', color: COLORS.white, letterSpacing: 0.2, textAlign: 'center' },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.78)', marginTop: 5, textAlign: 'center', paddingHorizontal: 20 },

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
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 24, lineHeight: 21 },

  /* Field */
  fieldWrap: {
    flexDirection: 'row', alignItems: 'center',
    height: 58, borderRadius: 16, borderWidth: 1.5,
    backgroundColor: COLORS.background, paddingHorizontal: 12,
  },
  fieldIcon: { width: 30, alignItems: 'center', justifyContent: 'center' },
  floatLabel: { position: 'absolute', left: 44, fontWeight: '600' },
  fieldInput: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, paddingTop: 18, paddingLeft: 2, paddingRight: 6 },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginBottom: 10, marginLeft: 4 },
  errText: { fontSize: 12, color: COLORS.danger, fontWeight: '600' },

  /* Primary gradient button */
  primaryBtn: {
    height: 56, borderRadius: 16, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32, shadowRadius: 14, elevation: 8,
  },
  primaryBg: { ...StyleSheet.absoluteFillObject, borderRadius: 16, overflow: 'hidden' },
  primaryText: { fontSize: 16, fontWeight: '800', color: COLORS.white, letterSpacing: 0.3 },

  /* Secondary actions */
  backToLogin: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 },
  backToLoginText: { fontSize: 14, fontWeight: '700', color: PURPLE.primary },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: PURPLE.midStrong,
    backgroundColor: PURPLE.light, marginTop: 12,
  },
  ghostText: { fontSize: 15, fontWeight: '800', color: PURPLE.primary },

  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: PURPLE.light, borderRadius: 14, padding: 14,
  },
  noteText: { flex: 1, fontSize: 13, color: PURPLE.primary, lineHeight: 19, fontWeight: '500' },

  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 22 },
  secureText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
});

export default ForgotPasswordScreen;
