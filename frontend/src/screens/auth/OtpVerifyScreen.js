import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { verifyOtpApi, sendOtpApi } from '../../api/authApi';
import { COLORS } from '../../constants/colors';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

const OtpVerifyScreen = ({ navigation, route }) => {
  const { email, purpose, userData, authData, devCode } = route.params ?? {};
  const insets = useSafeAreaInsets();
  const { register, finalizeLogin } = useAuth();

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [timer, setTimer] = useState(RESEND_SECONDS);
  const [loading, setLoading] = useState(false);
  const inputs = useRef([]);

  // Auto-fill code in dev mode
  useEffect(() => {
    if (devCode && String(devCode).length === OTP_LENGTH) {
      const filled = String(devCode).split('');
      setDigits(filled);
    }
    inputs.current[0]?.focus();
  }, [devCode]);

  useEffect(() => {
    if (timer === 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

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
    try {
      // Verify OTP against backend
      await verifyOtpApi(email, code);

      if (purpose === 'register' && userData) {
        await register(userData, 'passenger');
      } else if (purpose === 'login_verify' && authData) {
        await finalizeLogin(authData.userRole, authData.userData, authData.accessToken);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Verification failed. Please try again.';
      Alert.alert('Invalid Code', msg);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setTimer(RESEND_SECONDS);
    setDigits(Array(OTP_LENGTH).fill(''));
    inputs.current[0]?.focus();
    try {
      const res = await sendOtpApi(email, purpose);
      const newDevCode = res.data?.dev_code;
      if (newDevCode) {
        setDigits(String(newDevCode).split(''));
        Alert.alert('Code Sent', `A new code has been sent to ${maskedEmail}.\n\n(Dev: ${newDevCode})`);
      } else {
        Alert.alert('Code Sent', `A new verification code has been sent to ${maskedEmail}.`);
      }
    } catch {
      Alert.alert('Error', 'Could not resend code. Please try again.');
    }
  };

  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.max(b.length, 4)) + c)
    : '••••••••';

  const headingText = purpose === 'login_verify' ? 'Verify Your Login' : 'Verify Your Account';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-outline" size={36} color={COLORS.primary} />
          </View>

          <Text style={styles.heading}>{headingText}</Text>
          <Text style={styles.subtext}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.emailHighlight}>{maskedEmail}</Text>
          </Text>

          {/* OTP boxes */}
          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => (inputs.current[i] = r)}
                style={[styles.otpBox, d ? styles.otpBoxFilled : null]}
                value={d}
                onChangeText={(t) => handleDigit(t, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                caretHidden
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.verifyBtn, loading && { opacity: 0.7 }]}
            onPress={verify}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.verifyBtnText}>{loading ? 'Verifying…' : 'Verify Code'}</Text>
          </TouchableOpacity>

          <View style={styles.resendRow}>
            {timer > 0 ? (
              <Text style={styles.timerText}>
                Resend code in{' '}
                <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{timer}s</Text>
              </Text>
            ) : (
              <TouchableOpacity onPress={resend}>
                <Text style={styles.resendLink}>Resend Code</Text>
              </TouchableOpacity>
            )}
          </View>

          {devCode ? (
            <View style={styles.devBadge}>
              <Ionicons name="code-outline" size={14} color="#7C3AED" />
              <Text style={styles.devText}>
                Dev mode — code auto-filled: <Text style={{ fontWeight: '700' }}>{devCode}</Text>
              </Text>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },

  back: {
    marginTop: 8,
    marginLeft: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 28,
  },

  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },

  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 36,
  },
  emailHighlight: { fontWeight: '700', color: COLORS.textPrimary },

  otpRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 36,
  },
  otpBox: {
    width: 46,
    height: 58,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
  },
  otpBoxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    color: COLORS.primary,
  },

  verifyBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

  resendRow: { marginBottom: 20 },
  timerText: { fontSize: 14, color: COLORS.textSecondary },
  resendLink: { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  devBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  devText: { fontSize: 12, color: '#7C3AED' },
});

export default OtpVerifyScreen;
