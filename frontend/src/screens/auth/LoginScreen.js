import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { COLORS } from '../../constants/colors';

const LoginScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { login, loginWithPhone, biometricLogin, isBiometricEnabled, setBiometricEnabled } = useAuth();
  const [role, setRole] = useState('passenger');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Passenger fields
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  // Driver fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricType, setBiometricType] = useState('biometrics'); // 'fingerprint' | 'face' | 'biometrics'

  const isPassenger = role === 'passenger';

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        setBiometricAvailable(true);
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('face');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('fingerprint');
        }
      }
      const enabled = await isBiometricEnabled();
      setBiometricEnabledState(enabled);
    } catch (_) {}
  };

  const validatePassenger = () => {
    const e = {};
    if (!phone || phone.replace(/\D/g, '').length < 8) e.phone = 'Enter a valid phone number';
    if (!pin || pin.length < 4) e.pin = 'PIN must be at least 4 digits';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateDriver = () => {
    const e = {};
    if (!email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email address';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const offerBiometricSetup = async () => {
    if (!biometricAvailable || biometricEnabled) return;
    const label = biometricType === 'face' ? 'Face ID' : biometricType === 'fingerprint' ? 'Fingerprint' : 'Biometrics';
    Alert.alert(
      `Enable ${label}?`,
      `Speed up future logins with ${label} instead of entering your PIN every time.`,
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: `Enable ${label}`,
          onPress: async () => {
            await setBiometricEnabled(true);
            setBiometricEnabledState(true);
            Alert.alert('Enabled!', `${label} login is now active.`);
          },
        },
      ]
    );
  };

  const handleLogin = async () => {
    if (isPassenger ? !validatePassenger() : !validateDriver()) return;
    setLoading(true);
    try {
      if (isPassenger) {
        await loginWithPhone(phone, pin, 'passenger');
        await offerBiometricSetup();
      } else {
        await login(email, password, 'driver');
      }
    } catch (err) {
      Alert.alert('Login Failed', err.response?.data?.message || 'Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const label = biometricType === 'face' ? 'Face ID' : biometricType === 'fingerprint' ? 'Fingerprint' : 'Biometrics';
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Sign in with ${label}`,
        fallbackLabel: 'Use PIN instead',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) {
        setLoading(true);
        await biometricLogin();
        setLoading(false);
      } else if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
        Alert.alert('Authentication Failed', 'Please use your PIN to sign in.');
      }
    } catch (err) {
      Alert.alert('Error', 'Biometric authentication unavailable.');
    }
  };

  const handleForgotPin = () => {
    if (!phone || phone.replace(/\D/g, '').length < 8) {
      Alert.alert('Enter Phone First', 'Please enter your phone number so we can send an OTP.');
      return;
    }
    navigation.navigate('OtpVerify', { phone, purpose: 'reset_pin' });
  };

  const biometricIcon = biometricType === 'face' ? 'scan-outline' : 'finger-print-outline';
  const biometricLabel = biometricType === 'face' ? 'Face ID' : biometricType === 'fingerprint' ? 'Fingerprint' : 'Biometrics';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={[styles.hero, { paddingTop: insets.top + 30 }]}>
            <View style={styles.logoCircle}>
              <Ionicons name="bus" size={44} color={COLORS.primary} />
            </View>
            <Text style={styles.appName}>BusApp</Text>
            <Text style={styles.appTagline}>Smart Bus Booking & Tracking</Text>
          </View>

          {/* Form sheet */}
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Welcome Back</Text>
            <Text style={styles.sheetSubtitle}>Sign in to your account</Text>

            {/* Role toggle */}
            <View style={styles.roleRow}>
              {['passenger', 'driver'].map((r) => {
                const active = role === r;
                const btnColor = r === 'driver' ? COLORS.driverPrimary : COLORS.primary;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.roleBtn,
                      active && { backgroundColor: btnColor, borderColor: btnColor },
                    ]}
                    onPress={() => { setRole(r); setErrors({}); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={r === 'passenger' ? 'person-outline' : 'car-outline'}
                      size={17}
                      color={active ? COLORS.white : COLORS.textSecondary}
                    />
                    <Text style={[styles.roleBtnText, active && styles.roleBtnTextActive]}>
                      {r === 'passenger' ? 'Passenger' : 'Driver'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Passenger: phone + PIN + biometric */}
            {isPassenger ? (
              <>
                {/* Biometric button (shown only when enabled and hardware available) */}
                {biometricAvailable && biometricEnabled && (
                  <TouchableOpacity
                    style={styles.biometricBtn}
                    onPress={handleBiometricLogin}
                    activeOpacity={0.8}
                  >
                    <View style={styles.biometricIconWrap}>
                      <Ionicons name={biometricIcon} size={28} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.biometricLabel}>Sign in with {biometricLabel}</Text>
                      <Text style={styles.biometricSub}>Touch to authenticate</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}

                <Input
                  label="Phone Number"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+974 5555 1234"
                  keyboardType="phone-pad"
                  error={errors.phone}
                  icon={<Ionicons name="call-outline" size={18} color={COLORS.textMuted} />}
                />
                <Input
                  label="PIN"
                  value={pin}
                  onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="Enter your PIN"
                  keyboardType="number-pad"
                  secureTextEntry
                  error={errors.pin}
                  icon={<Ionicons name="keypad-outline" size={18} color={COLORS.textMuted} />}
                />
                <TouchableOpacity onPress={handleForgotPin} style={styles.forgotWrap}>
                  <Text style={[styles.forgotText, { color: COLORS.primary }]}>Forgot PIN?</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Driver: email + password */
              <>
                <Input
                  label="Email Address"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  keyboardType="email-address"
                  error={errors.email}
                  icon={<Ionicons name="mail-outline" size={18} color={COLORS.textMuted} />}
                />
                <Input
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  secureTextEntry
                  error={errors.password}
                  icon={<Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} />}
                />
                <TouchableOpacity
                  onPress={() => navigation.navigate('ForgotPassword')}
                  style={styles.forgotWrap}
                >
                  <Text style={[styles.forgotText, { color: COLORS.driverPrimary }]}>
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <Button
              title={`Sign In as ${isPassenger ? 'Passenger' : 'Driver'}`}
              onPress={handleLogin}
              loading={loading}
              driverMode={!isPassenger}
              size="lg"
              style={{ marginTop: 4 }}
            />

            {/* Biometric setup prompt (when available but not yet enabled) */}
            {isPassenger && biometricAvailable && !biometricEnabled && (
              <TouchableOpacity
                style={styles.biometricSetupHint}
                onPress={() => offerBiometricSetup()}
                activeOpacity={0.7}
              >
                <Ionicons name={biometricIcon} size={15} color={COLORS.primary} />
                <Text style={styles.biometricSetupText}>
                  Enable {biometricLabel} for faster login
                </Text>
              </TouchableOpacity>
            )}

            {isPassenger && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
                <View style={styles.signupRow}>
                  <Text style={styles.signupText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('PassengerRegister')}>
                    <Text style={[styles.signupLink, { color: COLORS.primary }]}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.primary },

  hero: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  appName: { fontSize: 32, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5 },
  appTagline: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    minHeight: 520,
  },
  sheetTitle: { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  sheetSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 24 },

  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  roleBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  roleBtnTextActive: { color: COLORS.white },

  /* Biometric */
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primaryMid,
    padding: 14,
    marginBottom: 20,
  },
  biometricIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricLabel: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  biometricSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  biometricSetupHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
  },
  biometricSetupText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  forgotWrap: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 13, fontWeight: '600' },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },

  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signupText: { fontSize: 14, color: COLORS.textSecondary },
  signupLink: { fontSize: 14, fontWeight: '700' },
});

export default LoginScreen;
