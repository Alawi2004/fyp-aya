import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;
const MOCK_OTP = '123456';

const OtpVerifyScreen = ({ navigation, route }) => {
  const { phone, purpose, userData } = route.params ?? {};
  const insets = useSafeAreaInsets();
  const { loginWithPhone } = useAuth();

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [timer, setTimer] = useState(RESEND_SECONDS);
  const [loading, setLoading] = useState(false);
  const inputs = useRef([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

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
    setTimeout(async () => {
      setLoading(false);
      if (code !== MOCK_OTP) {
        Alert.alert('Invalid Code', 'Incorrect OTP. Use 123456 for testing.');
        return;
      }
      if (purpose === 'register' && userData) {
        await loginWithPhone(userData.phone, userData.pin, 'passenger', userData);
      } else if (purpose === 'reset_pin') {
        Alert.alert('PIN Reset', 'Your PIN has been reset. Please log in with your new PIN.');
        navigation.replace('Login');
      }
    }, 900);
  };

  const resend = () => {
    setTimer(RESEND_SECONDS);
    setDigits(Array(OTP_LENGTH).fill(''));
    inputs.current[0]?.focus();
    Alert.alert('Code Sent', `A new OTP has been sent to ${phone}.`);
  };

  const maskedPhone = phone
    ? phone.replace(/(\+?\d{1,4})\d+(\d{4})$/, '$1 ••••• $2')
    : '•••••••••';

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
            <Ionicons name="chatbubble-ellipses-outline" size={36} color={COLORS.primary} />
          </View>

          <Text style={styles.heading}>Verify Your Number</Text>
          <Text style={styles.subtext}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phone}>{maskedPhone}</Text>
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

          <View style={styles.testBadge}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.testText}>
              Test mode — use code <Text style={{ fontWeight: '700' }}>123456</Text>
            </Text>
          </View>
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
  phone: { fontWeight: '700', color: COLORS.textPrimary },

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

  resendRow: { marginBottom: 24 },
  timerText: { fontSize: 14, color: COLORS.textSecondary },
  resendLink: { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  testBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  testText: { fontSize: 12, color: COLORS.textMuted },
});

export default OtpVerifyScreen;
