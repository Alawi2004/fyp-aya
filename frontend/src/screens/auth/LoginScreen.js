import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, KeyboardAvoidingView, Platform, StatusBar, Animated, Easing,
  ActivityIndicator, Pressable, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect, Circle, Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { COLORS, PURPLE } from '../../constants/colors';
import { sendOtpApi } from '../../api/authApi';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BRAND = PURPLE.gradient;

// ── SVG gradient fill that measures its own box (reliable on iOS) ─────────────
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
            <SvgGradient id={id} x1="0" y1="0" x2={vertical ? '0' : box.w} y2={vertical ? box.h : box.h} gradientUnits="userSpaceOnUse">
              {colors.map((c, i) => (
                <Stop key={i} offset={`${i / (colors.length - 1)}`} stopColor={c} />
              ))}
            </SvgGradient>
          </Defs>
          <Rect x="0" y="0" width={box.w} height={box.h} rx={radius} ry={radius} fill={`url(#${id})`} />
        </Svg>
      )}
    </View>
  );
};

// ── Animated transit logo mark (pure SVG) ────────────────────────────────────
const LogoMark = ({ size = 76 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <SvgGradient id="logoG" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor="#FFFFFF" />
        <Stop offset="1" stopColor="#E5EDFF" />
      </SvgGradient>
    </Defs>
    {/* rounded badge */}
    <Rect x="6" y="6" width="88" height="88" rx="26" fill="url(#logoG)" />
    {/* bus body */}
    <Rect x="28" y="26" width="44" height="40" rx="11" fill={PURPLE.primary} />
    {/* windows */}
    <Rect x="34" y="33" width="13" height="11" rx="3.5" fill="#FFFFFF" />
    <Rect x="53" y="33" width="13" height="11" rx="3.5" fill="#FFFFFF" />
    {/* lower band */}
    <Rect x="34" y="50" width="32" height="6" rx="3" fill="rgba(255,255,255,0.55)" />
    {/* wheels */}
    <Circle cx="38" cy="70" r="6" fill="#1E293B" />
    <Circle cx="62" cy="70" r="6" fill="#1E293B" />
    {/* motion lines */}
    <Path d="M14 40 H24" stroke={PURPLE.primary} strokeWidth="4" strokeLinecap="round" />
    <Path d="M16 52 H24" stroke={PURPLE.primary} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
  </Svg>
);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Floating-label animated input ────────────────────────────────────────────
const Field = ({ icon, label, value, onChangeText, secure, keyboardType, error, autoCapitalize = 'none' }) => {
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
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
          secureTextEntry={secure && !show}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secure ? (
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShow((s) => !s)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={19} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
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

const LoginScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { verifyCredentials, finalizeLogin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // ── Animations ─────────────────────────────────────────────────────────────
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

  const validate = () => {
    const e = {};
    if (!email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Single sign-in — the backend decides the role (passenger vs driver).
  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const authData = await verifyCredentials(email.trim(), password);
      const role = authData.userRole || authData.userData?.role || 'passenger';

      if (role === 'passenger') {
        // Passengers complete an OTP step
        const otpRes = await sendOtpApi(email.trim(), 'login_verify');
        navigation.navigate('OtpVerify', {
          email: email.trim(),
          purpose: 'login_verify',
          devCode: otpRes.data?.dev_code ?? null,
          authData,
        });
      } else {
        // Drivers / staff sign in directly
        await finalizeLogin(authData.userRole, authData.userData, authData.accessToken, authData.refreshToken);
      }
    } catch (err) {
      Alert.alert(
        'Sign In Failed',
        err.response?.data?.error || err.response?.data?.message || 'Check your credentials and try again.',
      );
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
        <GradientFill id="bgGrad" colors={BRAND} vertical />
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
          <View style={[styles.hero, { paddingTop: insets.top + 40 }]}>
            <Animated.View style={[styles.logoWrap, {
              opacity: intro[0],
              transform: [
                { scale: intro[0].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              ],
            }]}>
              <LogoMark size={80} />
            </Animated.View>
            <Animated.Text style={[styles.brand, sect(1)]}>Yalla Transit</Animated.Text>
            <Animated.Text style={[styles.tagline, sect(1)]}>Smart bus booking & live tracking</Animated.Text>
          </View>

          {/* Card */}
          <Animated.View style={[styles.card, sect(2), { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue your journey</Text>

            <Animated.View style={sect(3)}>
              <Field
                icon="mail-outline"
                label="Email address"
                value={email}
                onChangeText={(t) => { setEmail(t); if (errors.email) setErrors((e) => ({ ...e, email: null })); }}
                keyboardType="email-address"
                error={errors.email}
              />
              <Field
                icon="lock-closed-outline"
                label="Password"
                value={password}
                onChangeText={(t) => { setPassword(t); if (errors.password) setErrors((e) => ({ ...e, password: null })); }}
                secure
                error={errors.password}
              />

              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgot} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {/* Sign In button */}
              <AnimatedPressable
                onPress={handleLogin}
                disabled={loading}
                onPressIn={() => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
                onPressOut={() => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start()}
                style={[styles.signInBtn, { transform: [{ scale: btnScale }], opacity: loading ? 0.85 : 1 }]}
              >
                <View style={styles.signInBg} pointerEvents="none">
                  <GradientFill id="btnGrad" colors={PURPLE.gradient} radius={16} />
                </View>
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Text style={styles.signInText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={19} color={COLORS.white} />
                  </>
                )}
              </AnimatedPressable>
            </Animated.View>

            {/* Footer */}
            <Animated.View style={[sect(4)]}>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>New to Yalla?</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.signupBtn}
                onPress={() => navigation.navigate('PassengerRegister')}
                activeOpacity={0.85}
              >
                <Text style={styles.signupText}>Create an account</Text>
                <Ionicons name="person-add-outline" size={17} color={PURPLE.primary} />
              </TouchableOpacity>

              <View style={styles.secureRow}>
                <Ionicons name="shield-checkmark" size={13} color={COLORS.textMuted} />
                <Text style={styles.secureText}>Protected with end-to-end encryption</Text>
              </View>
            </Animated.View>
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
  blobB: { width: 240, height: 240, top: SCREEN_H * 0.22, left: -90, backgroundColor: 'rgba(139,92,246,0.35)' },
  blobC: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -30, left: SCREEN_W * 0.3, backgroundColor: 'rgba(255,255,255,0.06)' },

  /* Hero */
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 34 },
  logoWrap: {
    marginBottom: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25, shadowRadius: 18, elevation: 10,
  },
  brand: { fontSize: 30, fontWeight: '900', color: COLORS.white, letterSpacing: 0.3 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.78)', marginTop: 5 },

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
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 24 },

  /* Field */
  fieldWrap: {
    flexDirection: 'row', alignItems: 'center',
    height: 58, borderRadius: 16, borderWidth: 1.5,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
  },
  // NOTE: focus highlight only changes borderColor (applied inline). Do NOT
  // toggle backgroundColor / shadow / elevation on focus — on the New
  // Architecture (Fabric) those heavy parent redraws during the onFocus event
  // make the native field drop focus instantly (keyboard never opens).
  fieldIcon: { width: 30, alignItems: 'center', justifyContent: 'center' },
  floatLabel: { position: 'absolute', left: 44, fontWeight: '600' },
  fieldInput: {
    flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textPrimary,
    paddingTop: 18, paddingLeft: 2, paddingRight: 6,
  },
  eyeBtn: { paddingHorizontal: 4 },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginLeft: 4 },
  errText: { fontSize: 12, color: COLORS.danger, fontWeight: '600' },

  forgot: { alignSelf: 'flex-end', marginTop: 2, marginBottom: 18 },
  forgotText: { fontSize: 13, fontWeight: '700', color: PURPLE.primary },

  /* Sign In button */
  signInBtn: {
    height: 56, borderRadius: 16, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32, shadowRadius: 14, elevation: 8,
  },
  signInBg: { ...StyleSheet.absoluteFillObject, borderRadius: 16, overflow: 'hidden' },
  signInText: { fontSize: 16, fontWeight: '800', color: COLORS.white, letterSpacing: 0.3 },

  /* Footer */
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  signupBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: PURPLE.midStrong,
    backgroundColor: PURPLE.light,
  },
  signupText: { fontSize: 15, fontWeight: '800', color: PURPLE.primary },
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18 },
  secureText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
});

export default LoginScreen;
