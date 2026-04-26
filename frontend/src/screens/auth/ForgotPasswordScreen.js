import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { forgotPasswordApi } from '../../api/authApi';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { COLORS } from '../../constants/colors';

const ForgotPasswordScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      Alert.alert('Invalid Email', 'Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await forgotPasswordApi(email);
      setSent(true);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Hero */}
          <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
            <TouchableOpacity
              style={[styles.backBtn, { top: insets.top + 16 }]}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.white} />
            </TouchableOpacity>

            <View style={styles.iconCircle}>
              <Ionicons name={sent ? 'mail' : 'lock-open-outline'} size={38} color={COLORS.primary} />
            </View>
            <Text style={styles.heroTitle}>{sent ? 'Check Your Email' : 'Reset Password'}</Text>
            <Text style={styles.heroSub}>
              {sent
                ? `We sent a reset link to ${email}`
                : 'Enter your email to receive a reset link'}
            </Text>
          </View>

          {/* Sheet */}
          <View style={styles.sheet}>
            {!sent ? (
              <>
                <Text style={styles.sheetTitle}>Forgot Password?</Text>
                <Text style={styles.sheetSubtitle}>
                  No worries — we'll send you reset instructions.
                </Text>
                <Input
                  label="Email Address"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  keyboardType="email-address"
                  icon={<Ionicons name="mail-outline" size={18} color={COLORS.textMuted} />}
                  style={{ marginTop: 8 }}
                />
                <Button
                  title="Send Reset Link"
                  onPress={handleSend}
                  loading={loading}
                  size="lg"
                  style={{ marginTop: 8 }}
                />
                <TouchableOpacity style={styles.backToLogin} onPress={() => navigation.navigate('Login')}>
                  <Ionicons name="arrow-back" size={14} color={COLORS.primary} />
                  <Text style={styles.backToLoginText}>Back to Sign In</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.sheetTitle}>Email Sent!</Text>
                <Text style={styles.sheetSubtitle}>
                  Open your inbox and follow the link to reset your password.
                </Text>
                <View style={styles.successNote}>
                  <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.successNoteText}>
                    Didn't receive it? Check your spam folder or try again.
                  </Text>
                </View>
                <Button
                  title="Back to Sign In"
                  onPress={() => navigation.navigate('Login')}
                  size="lg"
                  style={{ marginTop: 16 }}
                />
                <Button
                  title="Resend Email"
                  onPress={() => { setSent(false); }}
                  variant="ghost"
                  style={{ marginTop: 8 }}
                />
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
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  backBtn: {
    position: 'absolute',
    top: 0,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 20,
  },

  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
    minHeight: 400,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
    lineHeight: 21,
  },
  backToLogin: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  backToLoginText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  successNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  successNoteText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.primary,
    lineHeight: 19,
  },
});

export default ForgotPasswordScreen;
