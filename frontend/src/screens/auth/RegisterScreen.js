import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { COLORS } from '../../constants/colors';

const RegisterScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
  });
  const [role, setRole] = useState('passenger');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email is required';
    if (!form.phone) e.phone = 'Phone number is required';
    if (!form.password || form.password.length < 6) e.password = 'Minimum 6 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register(form, role);
    } catch (err) {
      Alert.alert('Registration Failed', err.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isDriver = role === 'driver';
  const accentColor = isDriver ? COLORS.driverPrimary : COLORS.primary;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
            <TouchableOpacity
              style={[styles.backBtn, { top: insets.top + 16 }]}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.white} />
            </TouchableOpacity>

            <View style={styles.logoCircle}>
              <Ionicons name="bus" size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.appName}>Create Account</Text>
            <Text style={styles.appTagline}>Join BusApp today</Text>
          </View>

          {/* ── Form Sheet ── */}
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Your Details</Text>
            <Text style={styles.sheetSubtitle}>Fill in the information below to get started</Text>

            {/* Role Toggle */}
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
                    onPress={() => setRole(r)}
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

            {/* Inputs */}
            <Input
              label="Full Name"
              value={form.name}
              onChangeText={v => set('name', v)}
              placeholder="John Doe"
              error={errors.name}
              icon={<Ionicons name="person-outline" size={18} color={COLORS.textMuted} />}
            />
            <Input
              label="Email Address"
              value={form.email}
              onChangeText={v => set('email', v)}
              placeholder="your@email.com"
              keyboardType="email-address"
              error={errors.email}
              icon={<Ionicons name="mail-outline" size={18} color={COLORS.textMuted} />}
            />
            <Input
              label="Phone Number"
              value={form.phone}
              onChangeText={v => set('phone', v)}
              placeholder="+1 234 567 8900"
              keyboardType="phone-pad"
              error={errors.phone}
              icon={<Ionicons name="call-outline" size={18} color={COLORS.textMuted} />}
            />
            <Input
              label="Password"
              value={form.password}
              onChangeText={v => set('password', v)}
              placeholder="Minimum 6 characters"
              secureTextEntry
              error={errors.password}
              icon={<Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} />}
            />
            <Input
              label="Confirm Password"
              value={form.confirmPassword}
              onChangeText={v => set('confirmPassword', v)}
              placeholder="Repeat your password"
              secureTextEntry
              error={errors.confirmPassword}
              icon={<Ionicons name="shield-checkmark-outline" size={18} color={COLORS.textMuted} />}
            />

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
              driverMode={isDriver}
              size="lg"
              style={{ marginTop: 8 }}
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={[styles.loginLink, { color: accentColor }]}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },

  /* Hero */
  hero: {
    alignItems: 'center',
    paddingBottom: 32,
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
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  appTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },

  /* Sheet */
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
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
  },

  /* Role Toggle */
  roleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
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
  roleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  roleBtnTextActive: {
    color: COLORS.white,
  },

  /* Divider */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  /* Login Link */
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default RegisterScreen;
