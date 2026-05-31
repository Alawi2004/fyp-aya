import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { COLORS } from '../../constants/colors';
import { sendOtpApi } from '../../api/authApi';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => String(currentYear - i));

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

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

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

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
            <TouchableOpacity
              style={[styles.backBtn, { top: insets.top + 16 }]}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.white} />
            </TouchableOpacity>

            <View style={styles.logoCircle}>
              <Ionicons name="person-add-outline" size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.heroTitle}>Create Account</Text>
            <Text style={styles.heroSub}>Join Yalla Transit as a Passenger</Text>
          </View>

          {/* Form sheet */}
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Your Details</Text>
            <Text style={styles.sheetSubtitle}>
              We'll send a verification code to your email
            </Text>

            <Input
              label="Full Name"
              value={form.name}
              onChangeText={(v) => set('name', v)}
              placeholder="e.g. Sarah Ahmed"
              error={errors.name}
              icon={<Ionicons name="person-outline" size={18} color={COLORS.textMuted} />}
            />

            <Input
              label="Email Address"
              value={form.email}
              onChangeText={(v) => set('email', v)}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              icon={<Ionicons name="mail-outline" size={18} color={COLORS.textMuted} />}
            />

            <Input
              label="Phone Number"
              value={form.phone}
              onChangeText={(v) => set('phone', v)}
              placeholder="+974 5555 1234"
              keyboardType="phone-pad"
              error={errors.phone}
              icon={<Ionicons name="call-outline" size={18} color={COLORS.textMuted} />}
            />

            <Input
              label="Password"
              value={form.password}
              onChangeText={(v) => set('password', v)}
              placeholder="Min 8 chars, uppercase, number, symbol"
              secureTextEntry
              error={errors.password}
              icon={<Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} />}
            />

            <Input
              label="Confirm Password"
              value={form.confirmPassword}
              onChangeText={(v) => set('confirmPassword', v)}
              placeholder="Repeat your password"
              secureTextEntry
              error={errors.confirmPassword}
              icon={<Ionicons name="shield-checkmark-outline" size={18} color={COLORS.textMuted} />}
            />

            {/* Birthday section */}
            <Text style={styles.sectionLabel}>Date of Birth</Text>

            <View style={styles.birthdayRow}>
              {/* Day */}
              <View style={[styles.birthdayField, { flex: 1 }]}>
                <Input
                  label="Day"
                  value={form.birthDay}
                  onChangeText={(v) => set('birthDay', v.replace(/[^0-9]/g, '').slice(0, 2))}
                  placeholder="DD"
                  keyboardType="number-pad"
                  error={errors.birthDay}
                  icon={null}
                />
              </View>

              {/* Month */}
              <View style={[styles.birthdayField, { flex: 2 }]}>
                <Text style={styles.fieldLabel}>Month</Text>
                <TouchableOpacity
                  style={[styles.pickerBtn, errors.birthMonth && styles.pickerBtnError]}
                  onPress={() => { setShowMonthPicker(true); setShowYearPicker(false); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.pickerBtnText, !form.birthMonth && styles.pickerBtnPlaceholder]}>
                    {form.birthMonth || 'Month'}
                  </Text>
                  <Ionicons name="chevron-down" size={15} color={COLORS.textMuted} />
                </TouchableOpacity>
                {errors.birthMonth ? <Text style={styles.errorText}>{errors.birthMonth}</Text> : null}
              </View>

              {/* Year */}
              <View style={[styles.birthdayField, { flex: 1.5 }]}>
                <Text style={styles.fieldLabel}>Year</Text>
                <TouchableOpacity
                  style={[styles.pickerBtn, errors.birthYear && styles.pickerBtnError]}
                  onPress={() => { setShowYearPicker(true); setShowMonthPicker(false); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.pickerBtnText, !form.birthYear && styles.pickerBtnPlaceholder]}>
                    {form.birthYear || 'Year'}
                  </Text>
                  <Ionicons name="chevron-down" size={15} color={COLORS.textMuted} />
                </TouchableOpacity>
                {errors.birthYear ? <Text style={styles.errorText}>{errors.birthYear}</Text> : null}
              </View>
            </View>

            {/* Month picker dropdown */}
            {showMonthPicker && (
              <View style={styles.dropdownList}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                  {MONTHS.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.dropdownItem, form.birthMonth === m && styles.dropdownItemActive]}
                      onPress={() => { set('birthMonth', m); setShowMonthPicker(false); }}
                    >
                      <Text style={[styles.dropdownItemText, form.birthMonth === m && styles.dropdownItemTextActive]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Year picker dropdown */}
            {showYearPicker && (
              <View style={styles.dropdownList}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                  {YEARS.map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.dropdownItem, form.birthYear === y && styles.dropdownItemActive]}
                      onPress={() => { set('birthYear', y); setShowYearPicker(false); }}
                    >
                      <Text style={[styles.dropdownItemText, form.birthYear === y && styles.dropdownItemTextActive]}>
                        {y}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Button
              title="Send Verification Code"
              onPress={handleSendOtp}
              loading={loading}
              size="lg"
              style={{ marginTop: 20 }}
            />

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
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
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  backBtn: {
    position: 'absolute',
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
  heroTitle: { fontSize: 26, fontWeight: '800', color: COLORS.white, letterSpacing: 0.3 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 52,
  },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  sheetSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 24, lineHeight: 20 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
    marginTop: 4,
  },

  birthdayRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  birthdayField: {},

  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 13,
    backgroundColor: COLORS.background,
    minHeight: 48,
  },
  pickerBtnError: { borderColor: COLORS.error ?? '#EF4444' },
  pickerBtnText: { fontSize: 14, color: COLORS.textPrimary, flex: 1 },
  pickerBtnPlaceholder: { color: COLORS.textMuted },

  dropdownList: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  dropdownItemActive: { backgroundColor: COLORS.primaryLight },
  dropdownItemText: { fontSize: 14, color: COLORS.textPrimary },
  dropdownItemTextActive: { color: COLORS.primary, fontWeight: '700' },

  errorText: { fontSize: 12, color: COLORS.error ?? '#EF4444', marginTop: 4 },

  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  loginText: { fontSize: 14, color: COLORS.textSecondary },
  loginLink: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
});

export default PassengerRegisterScreen;
