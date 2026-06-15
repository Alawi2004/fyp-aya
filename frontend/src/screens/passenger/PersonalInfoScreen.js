import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, StatusBar, Platform, Modal, Animated, Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS, PURPLE } from '../../constants/colors';
import GradientFill from '../../components/common/GradientFill';
import FadeInView from '../../components/common/FadeInView';
import PressableScale from '../../components/common/PressableScale';
import apiClient from '../../api/apiClient';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseIso(iso) {
  if (!iso) return null;
  // Parse as local midnight to avoid UTC timezone shifting the date backward.
  // "2026-06-01" or "2026-06-01T00:00:00.000Z" → local June 1 midnight.
  const parts = String(iso).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return isNaN(d.getTime()) ? null : d;
}

function formatDisplay(date) {
  if (!date) return '';
  // Use local components — the date was constructed as local midnight.
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

function toIso(date) {
  if (!date) return null;
  // Use local components so we send the date the user actually picked,
  // not the UTC-shifted equivalent.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const FieldRow = ({
  icon, label, value, onChangeText,
  placeholder, keyboardType = 'default', autoCapitalize = 'none', last = false,
}) => (
  <View style={[styles.fieldRow, !last && styles.fieldRowBorder]}>
    <View style={styles.fieldIcon}>
      <Ionicons name={icon} size={16} color={PURPLE.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        returnKeyType="done"
      />
    </View>
  </View>
);

const ReadOnlyRow = ({ icon, label, value, last = false }) => (
  <View style={[styles.fieldRow, !last && styles.fieldRowBorder]}>
    <View style={[styles.fieldIcon, styles.fieldIconMuted]}>
      <Ionicons name={icon} size={16} color={COLORS.textMuted} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldReadOnly}>{value || '—'}</Text>
    </View>
    <Ionicons name="lock-closed-outline" size={13} color={COLORS.textMuted} />
  </View>
);

// ── Main screen ───────────────────────────────────────────────────────────────

const PersonalInfoScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name || user?.name || '');
  const [phone,    setPhone]    = useState(user?.phone || '');
  const [dobDate,  setDobDate]  = useState(parseIso(user?.birth_date));
  const [saving,   setSaving]   = useState(false);
  const [dirty,    setDirty]    = useState(false);

  // Date picker state
  const [showPicker,   setShowPicker]   = useState(false);
  const [pickerDate,   setPickerDate]   = useState(dobDate || new Date(1995, 0, 1));

  // Avatar entrance pop
  const avatarScale = useRef(new Animated.Value(0.6)).current;
  const avatarOpacity = useRef(new Animated.Value(0)).current;
  // Soft, continuously breathing glow ring behind the avatar
  const glowPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(avatarScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(avatarOpacity, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [avatarScale, avatarOpacity, glowPulse]);

  const initials = fullName
    ? fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'P';

  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '—';

  // ── Date picker handlers ───────────────────────────────────────────────────

  const openDatePicker = () => {
    setPickerDate(dobDate || new Date(1995, 0, 1));
    setShowPicker(true);
  };

  const onPickerChange = (event, selected) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && selected) {
        setDobDate(selected);
        setDirty(true);
      }
    } else {
      if (selected) setPickerDate(selected);
    }
  };

  const confirmIosPicker = () => {
    setShowPicker(false);
    setDobDate(pickerDate);
    setDirty(true);
  };

  const clearDob = () => { setDobDate(null); setDirty(true); };

  // ── Navigation guard ───────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (dirty) {
      Alert.alert('Unsaved Changes', 'You have unsaved changes. Leave anyway?', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  }, [dirty, navigation]);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      Alert.alert('Required', 'Full name cannot be empty.');
      return;
    }
    if (dobDate && dobDate > new Date()) {
      Alert.alert('Invalid Date', 'Date of birth cannot be in the future.');
      return;
    }

    setSaving(true);
    try {
      const res = await apiClient.put('/users/me', {
        full_name:  trimmedName,
        phone:      phone.trim() || null,
        birth_date: toIso(dobDate),
      });

      const raw = res.data.user;
      const updatedUser = {
        ...user,
        full_name:  raw.full_name,
        name:       raw.full_name,
        phone:      raw.phone,
        birth_date: raw.birth_date,
      };

      setUser(updatedUser);
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      setDirty(false);

      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Could not save. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* ── Gradient hero (header + avatar) ── */}
      <View style={styles.hero}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill id="piHero" colors={PURPLE.gradient} vertical />
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />
        </View>

        {/* Header bar */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Personal Info</Text>
          <TouchableOpacity
            style={[styles.saveHeaderBtn, (!dirty || saving) && { opacity: 0.38 }]}
            onPress={handleSave}
            disabled={!dirty || saving}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.saveHeaderText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarStack}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.avatarGlow,
                {
                  opacity: glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.45] }),
                  transform: [{ scale: glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.18] }) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.avatarWrap,
                { opacity: avatarOpacity, transform: [{ scale: avatarScale }] },
              ]}
            >
              <Text style={styles.avatarText}>{initials}</Text>
            </Animated.View>
          </View>
          <Text style={styles.avatarName}>{fullName || 'Your Name'}</Text>
          <Text style={styles.avatarEmail}>{user?.email || ''}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* ── Editable fields ── */}
        <View style={styles.formSection}>
          <FadeInView index={0}>
            <Text style={styles.sectionLabel}>BASIC INFORMATION</Text>
            <View style={styles.formCard}>
              <FieldRow
                icon="person-outline"
                label="Full Name"
                value={fullName}
                onChangeText={v => { setFullName(v); setDirty(true); }}
                placeholder="Your full name"
                autoCapitalize="words"
              />
              <FieldRow
                icon="call-outline"
                label="Phone"
                value={phone}
                onChangeText={v => { setPhone(v); setDirty(true); }}
                placeholder="+961 xx xxx xxx"
                keyboardType="phone-pad"
              />

              {/* Date of birth — tappable row */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldIcon}>
                  <Ionicons name="calendar-outline" size={16} color={PURPLE.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Date of Birth</Text>
                  <TouchableOpacity onPress={openDatePicker} activeOpacity={0.7}>
                    <Text style={[styles.fieldInput, !dobDate && { color: COLORS.textMuted }]}>
                      {dobDate ? formatDisplay(dobDate) : 'Select date'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {dobDate ? (
                  <TouchableOpacity onPress={clearDob} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                )}
              </View>
            </View>
          </FadeInView>

          {/* ── Read-only fields ── */}
          <FadeInView index={1}>
            <Text style={styles.sectionLabel}>ACCOUNT DETAILS</Text>
            <View style={styles.formCard}>
              <ReadOnlyRow icon="mail-outline"            label="Email Address" value={user?.email} />
              <ReadOnlyRow icon="shield-checkmark-outline" label="Account Type"
                value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—'} />
              <ReadOnlyRow icon="time-outline" label="Member Since" value={createdAt} last />
            </View>

            <Text style={styles.hintText}>
              To change your email address, contact support.
            </Text>
          </FadeInView>
        </View>

        {/* ── Save button ── */}
        <FadeInView index={2} style={styles.saveBtnWrap}>
          <PressableScale
            style={[styles.saveBtn, (!dirty || saving) && { opacity: 0.45 }]}
            onPress={handleSave}
            disabled={!dirty || saving}
          >
            {saving
              ? <ActivityIndicator color={COLORS.white} size="small" />
              : <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} />
            }
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </PressableScale>
        </FadeInView>
      </ScrollView>

      {/* ── Android date picker (renders as dialog) ── */}
      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display="default"
          onChange={onPickerChange}
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
        />
      )}

      {/* ── iOS date picker (bottom-sheet modal) ── */}
      {Platform.OS === 'ios' && (
        <Modal visible={showPicker} transparent animationType="slide">
          <View style={styles.iosPickerOverlay}>
            <View style={[styles.iosPickerSheet, { paddingBottom: insets.bottom + 8 }]}>
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={styles.iosPickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.iosPickerTitle}>Date of Birth</Text>
                <TouchableOpacity onPress={confirmIosPicker}>
                  <Text style={styles.iosPickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display="spinner"
                onChange={onPickerChange}
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

export default PersonalInfoScreen;

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Hero */
  hero: {
    backgroundColor: PURPLE.deep,
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroDecor1: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -50,
  },
  heroDecor2: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: -30, left: -40,
  },

  /* Header */
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 4,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 17, fontWeight: '800', color: COLORS.white,
  },
  saveHeaderBtn: { paddingHorizontal: 4 },
  saveHeaderText: { fontSize: 15, fontWeight: '700', color: COLORS.white },

  /* Avatar */
  avatarSection: {
    alignItems: 'center', paddingBottom: 30, paddingTop: 8, paddingHorizontal: 24,
  },
  avatarStack: {
    width: 84, height: 84, marginBottom: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarGlow: {
    position: 'absolute',
    width: 110, height: 110, borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  avatarWrap: {
    width: 84, height: 84, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 30, fontWeight: '900', color: COLORS.white },
  avatarName:  { fontSize: 19, fontWeight: '800', color: COLORS.white, marginBottom: 3 },
  avatarEmail: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },

  /* Form */
  formSection: { paddingHorizontal: 16, paddingTop: 24 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.9,
    marginBottom: 8, marginLeft: 4,
  },
  formCard: {
    backgroundColor: COLORS.white, borderRadius: 18, marginBottom: 20, overflow: 'hidden',
    shadowColor: PURPLE.deep, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 2,
  },

  /* Field rows */
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  fieldRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  fieldIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: PURPLE.light,
    alignItems: 'center', justifyContent: 'center',
  },
  fieldIconMuted: { backgroundColor: COLORS.background },
  fieldLabel: {
    fontSize: 10, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3,
  },
  fieldInput:    { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, padding: 0 },
  fieldReadOnly: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },

  hintText: {
    fontSize: 12, color: COLORS.textMuted,
    textAlign: 'center', marginTop: -8, marginBottom: 20, lineHeight: 18,
  },

  /* Save button */
  saveBtnWrap: { paddingHorizontal: 20, marginTop: 4 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: PURPLE.primary, borderRadius: 16, paddingVertical: 16,
    shadowColor: PURPLE.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32, shadowRadius: 12, elevation: 5,
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },

  /* iOS date picker modal */
  iosPickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  iosPickerSheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 22, borderTopRightRadius: 22,
  },
  iosPickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  iosPickerTitle:  { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  iosPickerCancel: { fontSize: 15, color: COLORS.textMuted, fontWeight: '600' },
  iosPickerDone:   { fontSize: 15, color: PURPLE.primary, fontWeight: '700' },
});
