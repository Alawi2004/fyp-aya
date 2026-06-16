import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, StatusBar, Alert, Animated, Easing,
  ActivityIndicator, Pressable, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { COLORS, PURPLE } from '../../constants/colors';
import { sendOtpApi } from '../../api/authApi';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BRAND = PURPLE.gradient;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => String(currentYear - i));

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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Floating-label animated input ────────────────────────────────────────────
const Field = ({
  icon, label, value, onChangeText, secure, keyboardType,
  error, autoCapitalize = 'none', maxLength,
}) => {
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
  const labelLeft = icon ? 44 : 14;

  return (
    <View style={{ marginBottom: error ? 6 : 16 }}>
      <View style={[styles.fieldWrap, { borderColor }]}>
        {icon ? (
          <View style={styles.fieldIcon}>
            <Ionicons name={icon} size={19} color={tint} />
          </View>
        ) : null}
        <Animated.Text
          pointerEvents="none"
          style={[styles.floatLabel, {
            left: labelLeft,
            color: tint,
            top: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 8] }),
            fontSize: anim.interpolate({ inputRange: [0, 1], outputRange: [15, 11] }),
          }]}
        >
          {label}
        </Animated.Text>
        <TextInput
          style={[styles.fieldInput, !icon && { paddingLeft: 12 }]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure && !show}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
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

// ── Picker field (matches Field look, opens a dropdown on tap) ────────────────
const PickerField = ({ icon, label, value, onPress, error, active }) => {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value || active ? 1 : 0,
      duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: false,
    }).start();
  }, [value, active]);

  const borderColor = error ? COLORS.danger : active ? PURPLE.primary : COLORS.border;
  const tint = error ? COLORS.danger : active ? PURPLE.primary : COLORS.textMuted;
  const labelLeft = icon ? 44 : 14;

  return (
    <View style={{ marginBottom: error ? 6 : 16 }}>
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.fieldWrap, { borderColor }]}>
        {icon ? (
          <View style={styles.fieldIcon}>
            <Ionicons name={icon} size={19} color={tint} />
          </View>
        ) : null}
        <Animated.Text
          pointerEvents="none"
          style={[styles.floatLabel, {
            left: labelLeft,
            color: tint,
            top: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 8] }),
            fontSize: anim.interpolate({ inputRange: [0, 1], outputRange: [15, 11] }),
          }]}
        >
          {label}
        </Animated.Text>
        <Text style={[styles.pickerValue, { paddingLeft: icon ? 2 : 12 }]} numberOfLines={1}>
          {value || ''}
        </Text>
        <Ionicons name="chevron-down" size={17} color={tint} style={{ marginRight: 4 }} />
      </TouchableOpacity>
      {error ? (
        <View style={styles.errRow}>
          <Ionicons name="alert-circle" size={13} color={COLORS.danger} />
          <Text style={styles.errText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
};

const PassengerRegisterScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    birthDay: '',
    birthMonth: '',
    birthYear: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };

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
    if (!form.name.trim()) e.name = 'Full name is required';

    if (!form.email || !/\S+@\S+\.\S+/.test(form.email))
      e.email = 'Enter a valid email address';

    if (form.phone) {
      const normalized = form.phone.replace(/\s/g, '');
      if (!/^\+[1-9]\d{7,14}$/.test(normalized))
        e.phone = 'Use international format, e.g. +97450001234';
    }

    if (!form.password || form.password.length < 8)
      e.password = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(form.password))
      e.password = 'Password must contain at least one uppercase letter';
    else if (!/[0-9]/.test(form.password))
      e.password = 'Password must contain at least one digit';
    else if (!/[^A-Za-z0-9]/.test(form.password))
      e.password = 'Password must contain at least one special character';

    if (!form.confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';

    if (!form.birthDay || isNaN(Number(form.birthDay)) || Number(form.birthDay) < 1 || Number(form.birthDay) > 31)
      e.birthDay = 'Enter a valid day (1–31)';
    if (!form.birthMonth) e.birthMonth = 'Select a month';
    if (!form.birthYear) e.birthYear = 'Select a year';

    if (!e.birthDay && !e.birthMonth && !e.birthYear && form.birthDay && form.birthMonth && form.birthYear) {
      const monthIndex = MONTHS.indexOf(form.birthMonth) + 1;
      const dob = new Date(`${form.birthYear}-${String(monthIndex).padStart(2, '0')}-${String(form.birthDay).padStart(2, '0')}`);
      if (dob > new Date()) e.birthDay = 'Date of birth cannot be in the future';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSendOtp = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const monthIndex = MONTHS.indexOf(form.birthMonth) + 1;
      const birthDate = `${form.birthYear}-${String(monthIndex).padStart(2, '0')}-${String(form.birthDay).padStart(2, '0')}`;

      const res = await sendOtpApi(form.email, 'register');
      const devCode = res.data?.dev_code ?? null; // pre-fill in dev mode

      navigation.navigate('OtpVerify', {
        email: form.email,
        purpose: 'register',
        devCode,
        userData: {
          name: form.name,
          email: form.email,
          phone: form.phone ? form.phone.replace(/\s/g, '') : '',
          password: form.password,
          birth_date: birthDate,
          role: 'passenger',
        },
      });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not send verification code. Please try again.');
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
        <GradientFill id="regBgGrad" colors={BRAND} vertical />
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
          <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
            <TouchableOpacity
              style={[styles.backBtn, { top: insets.top + 12 }]}
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
                <Ionicons name="person-add" size={34} color={PURPLE.primary} />
              </View>
            </Animated.View>
            <Animated.Text style={[styles.brand, sect(1)]}>Create Account</Animated.Text>
            <Animated.Text style={[styles.tagline, sect(1)]}>Join Yalla Transit as a passenger</Animated.Text>
          </View>

          {/* Card */}
          <Animated.View style={[styles.card, sect(2), { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>Your details</Text>
            <Text style={styles.subtitle}>We'll send a verification code to your email</Text>

            <Animated.View style={sect(3)}>
              <Field
                icon="person-outline"
                label="Full name"
                value={form.name}
                onChangeText={(v) => set('name', v)}
                autoCapitalize="words"
                error={errors.name}
              />
              <Field
                icon="mail-outline"
                label="Email address"
                value={form.email}
                onChangeText={(v) => set('email', v)}
                keyboardType="email-address"
                error={errors.email}
              />
              <Field
                icon="call-outline"
                label="Phone number (optional)"
                value={form.phone}
                onChangeText={(v) => set('phone', v)}
                keyboardType="phone-pad"
                error={errors.phone}
              />
              <Field
                icon="lock-closed-outline"
                label="Password"
                value={form.password}
                onChangeText={(v) => set('password', v)}
                secure
                error={errors.password}
              />
              <Field
                icon="shield-checkmark-outline"
                label="Confirm password"
                value={form.confirmPassword}
                onChangeText={(v) => set('confirmPassword', v)}
                secure
                error={errors.confirmPassword}
              />

              {/* Date of birth */}
              <Text style={styles.sectionLabel}>Date of birth</Text>
              <View style={styles.birthRow}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="DD"
                    value={form.birthDay}
                    onChangeText={(v) => set('birthDay', v.replace(/[^0-9]/g, '').slice(0, 2))}
                    keyboardType="number-pad"
                    maxLength={2}
                    error={errors.birthDay ? ' ' : null}
                  />
                </View>
                <View style={{ flex: 1.5 }}>
                  <PickerField
                    label="Month"
                    value={form.birthMonth}
                    active={showMonthPicker}
                    error={errors.birthMonth ? ' ' : null}
                    onPress={() => { setShowMonthPicker((s) => !s); setShowYearPicker(false); }}
                  />
                </View>
                <View style={{ flex: 1.2 }}>
                  <PickerField
                    label="Year"
                    value={form.birthYear}
                    active={showYearPicker}
                    error={errors.birthYear ? ' ' : null}
                    onPress={() => { setShowYearPicker((s) => !s); setShowMonthPicker(false); }}
                  />
                </View>
              </View>
              {(errors.birthDay || errors.birthMonth || errors.birthYear) ? (
                <View style={styles.errRow}>
                  <Ionicons name="alert-circle" size={13} color={COLORS.danger} />
                  <Text style={styles.errText}>
                    {errors.birthDay || errors.birthMonth || errors.birthYear}
                  </Text>
                </View>
              ) : null}

              {/* Month picker dropdown */}
              {showMonthPicker && (
                <View style={styles.dropdownList}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
                    {MONTHS.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.dropdownItem, form.birthMonth === m && styles.dropdownItemActive]}
                        onPress={() => { set('birthMonth', m); setShowMonthPicker(false); }}
                      >
                        <Text style={[styles.dropdownItemText, form.birthMonth === m && styles.dropdownItemTextActive]}>
                          {m}
                        </Text>
                        {form.birthMonth === m ? <Ionicons name="checkmark" size={17} color={PURPLE.primary} /> : null}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Year picker dropdown */}
              {showYearPicker && (
                <View style={styles.dropdownList}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
                    {YEARS.map((y) => (
                      <TouchableOpacity
                        key={y}
                        style={[styles.dropdownItem, form.birthYear === y && styles.dropdownItemActive]}
                        onPress={() => { set('birthYear', y); setShowYearPicker(false); }}
                      >
                        <Text style={[styles.dropdownItemText, form.birthYear === y && styles.dropdownItemTextActive]}>
                          {y}
                        </Text>
                        {form.birthYear === y ? <Ionicons name="checkmark" size={17} color={PURPLE.primary} /> : null}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Submit button */}
              <AnimatedPressable
                onPress={handleSendOtp}
                disabled={loading}
                onPressIn={() => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
                onPressOut={() => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start()}
                style={[styles.signInBtn, { marginTop: 8, transform: [{ scale: btnScale }], opacity: loading ? 0.85 : 1 }]}
              >
                <View style={styles.signInBg} pointerEvents="none">
                  <GradientFill id="regBtnGrad" colors={PURPLE.gradient} radius={16} />
                </View>
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Text style={styles.signInText}>Send Verification Code</Text>
                    <Ionicons name="arrow-forward" size={19} color={COLORS.white} />
                  </>
                )}
              </AnimatedPressable>
            </Animated.View>

            {/* Footer */}
            <Animated.View style={sect(4)}>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Already a member?</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.signupBtn}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.85}
              >
                <Text style={styles.signupText}>Sign in instead</Text>
                <Ionicons name="log-in-outline" size={17} color={PURPLE.primary} />
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
  blobB: { width: 240, height: 240, top: SCREEN_H * 0.22, left: -90, backgroundColor: 'rgba(37,99,235,0.40)' },
  blobC: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -30, left: SCREEN_W * 0.3, backgroundColor: 'rgba(255,255,255,0.06)' },

  /* Hero */
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 28 },
  backBtn: {
    position: 'absolute', left: 24, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  logoWrap: {
    marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25, shadowRadius: 18, elevation: 10,
  },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  brand: { fontSize: 28, fontWeight: '900', color: COLORS.white, letterSpacing: 0.3 },
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
  floatLabel: { position: 'absolute', fontWeight: '600' },
  fieldInput: {
    flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textPrimary,
    paddingTop: 18, paddingLeft: 2, paddingRight: 6,
  },
  pickerValue: {
    flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, paddingTop: 14,
  },
  eyeBtn: { paddingHorizontal: 4 },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginBottom: 10, marginLeft: 4 },
  errText: { fontSize: 12, color: COLORS.danger, fontWeight: '600' },

  /* Date of birth */
  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10, marginTop: 2 },
  birthRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },

  /* Dropdowns */
  dropdownList: {
    backgroundColor: COLORS.white,
    borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border,
    marginBottom: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  dropdownItemActive: { backgroundColor: PURPLE.light },
  dropdownItemText: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600' },
  dropdownItemTextActive: { color: PURPLE.primary, fontWeight: '800' },

  /* Submit button */
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

export default PassengerRegisterScreen;
