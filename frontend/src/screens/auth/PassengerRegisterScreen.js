import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { COLORS } from '../../constants/colors';

const CATEGORIES = [
  {
    key: 'regular',
    label: 'Regular',
    icon: 'person-outline',
    color: COLORS.primary,
    bg: COLORS.primaryLight,
    discount: 'Full fare',
  },
  {
    key: 'student',
    label: 'Student',
    icon: 'school-outline',
    color: '#7C3AED',
    bg: '#F5F3FF',
    discount: '30% off',
  },
  {
    key: 'senior',
    label: 'Senior (60+)',
    icon: 'walk-outline',
    color: COLORS.secondary,
    bg: COLORS.secondaryLight,
    discount: '50% off',
  },
  {
    key: 'employee',
    label: 'Employee',
    icon: 'briefcase-outline',
    color: COLORS.warning,
    bg: COLORS.warningLight,
    discount: '25% off',
  },
  {
    key: 'school_child',
    label: 'School Child',
    icon: 'bus-outline',
    color: '#EA580C',
    bg: '#FFF7ED',
    discount: '50% off',
  },
];

const CategoryCard = ({ item, selected, onPress }) => (
  <TouchableOpacity
    style={[
      styles.catCard,
      selected && { borderColor: item.color, backgroundColor: item.bg },
    ]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <View style={[styles.catIconWrap, { backgroundColor: selected ? item.color : COLORS.surfaceAlt }]}>
      <Ionicons name={item.icon} size={18} color={selected ? COLORS.white : COLORS.textMuted} />
    </View>
    <Text style={[styles.catLabel, selected && { color: item.color }]}>{item.label}</Text>
    <Text style={[styles.catDiscount, selected && { color: item.color }]}>{item.discount}</Text>
    {selected && (
      <View style={[styles.catCheck, { backgroundColor: item.color }]}>
        <Ionicons name="checkmark" size={10} color={COLORS.white} />
      </View>
    )}
  </TouchableOpacity>
);

const PassengerRegisterScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({ name: '', phone: '', pin: '', confirmPin: '' });
  const [category, setCategory] = useState('regular');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.phone || form.phone.replace(/\D/g, '').length < 8)
      e.phone = 'Enter a valid phone number';
    if (!form.pin || form.pin.length < 4) e.pin = 'PIN must be 4–6 digits';
    if (!/^\d+$/.test(form.pin)) e.pin = 'PIN must contain only numbers';
    if (form.pin !== form.confirmPin) e.confirmPin = 'PINs do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSendOtp = () => {
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigation.navigate('OtpVerify', {
        phone: form.phone,
        purpose: 'register',
        userData: {
          name: form.name,
          phone: form.phone,
          pin: form.pin,
          category,
          role: 'passenger',
        },
      });
    }, 400);
  };

  const selectedCat = CATEGORIES.find((c) => c.key === category);

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
            <Text style={styles.heroSub}>Join BusApp as a Passenger</Text>
          </View>

          {/* Form sheet */}
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Your Details</Text>
            <Text style={styles.sheetSubtitle}>
              We'll send an OTP to verify your phone number
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
              label="Phone Number"
              value={form.phone}
              onChangeText={(v) => set('phone', v)}
              placeholder="+974 5555 1234"
              keyboardType="phone-pad"
              error={errors.phone}
              icon={<Ionicons name="call-outline" size={18} color={COLORS.textMuted} />}
            />

            {/* Passenger Category */}
            <View style={styles.catSection}>
              <Text style={styles.catSectionLabel}>Passenger Category</Text>
              <Text style={styles.catSectionSub}>
                Your category determines your fare discount. You'll need a valid ID to claim it.
              </Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map((item) => (
                  <CategoryCard
                    key={item.key}
                    item={item}
                    selected={category === item.key}
                    onPress={() => setCategory(item.key)}
                  />
                ))}
              </View>
              {selectedCat && (
                <View style={[styles.discountBanner, { backgroundColor: selectedCat.bg }]}>
                  <Ionicons name="pricetag-outline" size={14} color={selectedCat.color} />
                  <Text style={[styles.discountText, { color: selectedCat.color }]}>
                    {selectedCat.label} passengers receive{' '}
                    <Text style={{ fontWeight: '800' }}>{selectedCat.discount}</Text>{' '}
                    on all rides.
                  </Text>
                </View>
              )}
            </View>

            <Input
              label="Set PIN (4–6 digits)"
              value={form.pin}
              onChangeText={(v) => set('pin', v.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="Choose a numeric PIN"
              keyboardType="number-pad"
              secureTextEntry
              error={errors.pin}
              icon={<Ionicons name="keypad-outline" size={18} color={COLORS.textMuted} />}
            />
            <Input
              label="Confirm PIN"
              value={form.confirmPin}
              onChangeText={(v) => set('confirmPin', v.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="Repeat your PIN"
              keyboardType="number-pad"
              secureTextEntry
              error={errors.confirmPin}
              icon={<Ionicons name="shield-checkmark-outline" size={18} color={COLORS.textMuted} />}
            />

            <View style={styles.pinNote}>
              <Ionicons name="information-circle-outline" size={15} color={COLORS.primary} />
              <Text style={styles.pinNoteText}>
                Your PIN is used instead of a password for fast daily login.
              </Text>
            </View>

            <Button
              title="Send Verification Code"
              onPress={handleSendOtp}
              loading={loading}
              size="lg"
              style={{ marginTop: 16 }}
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

  /* Category */
  catSection: { marginBottom: 20 },
  catSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  catSectionSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  catCard: {
    width: '30%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  catIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  catDiscount: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  catCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 10,
  },
  discountText: { flex: 1, fontSize: 12, lineHeight: 18 },

  /* PIN */
  pinNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  pinNoteText: { flex: 1, fontSize: 12, color: COLORS.primary, lineHeight: 18 },

  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  loginText: { fontSize: 14, color: COLORS.textSecondary },
  loginLink: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
});

export default PassengerRegisterScreen;
