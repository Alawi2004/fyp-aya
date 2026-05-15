import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, StatusBar, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';

const DELETION_DATE_KEY = 'accountDeletionRequestedAt';

const WHAT_GETS_DELETED = [
  { icon: 'person-outline',      text: 'Your profile and personal information' },
  { icon: 'wallet-outline',      text: 'Your wallet balance and transaction history' },
  { icon: 'receipt-outline',     text: 'All trip history and bookings' },
  { icon: 'notifications-outline', text: 'All notifications and preferences' },
  { icon: 'star-outline',        text: 'Your ratings and feedback' },
];

const DeleteAccountScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('confirm'); // 'confirm' | 'done'

  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + 30);
  const deletionDateStr = scheduledDate.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const canSubmit = confirmText.trim().toUpperCase() === 'DELETE';

  const handleRequest = async () => {
    if (!canSubmit) return;
    Alert.alert(
      'Confirm Deletion Request',
      `Your account will be permanently deleted on ${deletionDateStr}. You can cancel this request by logging in before then.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Deletion',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await AsyncStorage.setItem(DELETION_DATE_KEY, scheduledDate.toISOString());
            setTimeout(() => {
              setLoading(false);
              setStep('done');
            }, 800);
          },
        },
      ]
    );
  };

  const handleDoneLogout = async () => {
    await logout();
  };

  if (step === 'done') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        <View style={styles.doneContainer}>
          <View style={styles.doneIconWrap}>
            <Ionicons name="checkmark-circle" size={64} color={COLORS.secondary} />
          </View>
          <Text style={styles.doneTitle}>Deletion Scheduled</Text>
          <Text style={styles.doneSubtitle}>
            Your account is set to be deleted on{'\n'}
            <Text style={styles.doneDate}>{deletionDateStr}</Text>
          </Text>
          <View style={styles.doneTips}>
            <View style={styles.doneTip}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
              <Text style={styles.doneTipText}>
                You can cancel this request by logging back in within 30 days.
              </Text>
            </View>
            <View style={styles.doneTip}>
              <Ionicons name="ban-outline" size={16} color={COLORS.danger} />
              <Text style={styles.doneTipText}>
                After {deletionDateStr}, your data cannot be recovered.
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleDoneLogout} activeOpacity={0.85}>
            <Text style={styles.logoutBtnText}>Sign Out Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delete Account</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        >
          {/* Warning banner */}
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={28} color={COLORS.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Permanent Action</Text>
              <Text style={styles.warningText}>
                This cannot be undone after the 30-day cooling off period.
              </Text>
            </View>
          </View>

          {/* Cooling off info */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: COLORS.primaryLight }]}>
                <Ionicons name="time-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>30-Day Cooling Off Period</Text>
                <Text style={styles.infoText}>
                  After you request deletion, your account enters a 30-day cooling off period.
                  Your account will be fully deleted on{' '}
                  <Text style={{ fontWeight: '700', color: COLORS.textPrimary }}>
                    {deletionDateStr}
                  </Text>
                  . During this time you can still log in to cancel.
                </Text>
              </View>
            </View>
          </View>

          {/* What gets deleted */}
          <Text style={styles.sectionLabel}>What will be deleted</Text>
          <View style={styles.deletionList}>
            {WHAT_GETS_DELETED.map((item, i) => (
              <View key={i} style={styles.deletionItem}>
                <View style={styles.deletionDot}>
                  <Ionicons name={item.icon} size={16} color={COLORS.danger} />
                </View>
                <Text style={styles.deletionText}>{item.text}</Text>
              </View>
            ))}
          </View>

          {/* What's kept */}
          <View style={styles.keptCard}>
            <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.secondary} />
            <Text style={styles.keptText}>
              Anonymized transaction records may be retained for legal compliance.
            </Text>
          </View>

          {/* Confirm input */}
          <Text style={styles.sectionLabel}>Confirm your request</Text>
          <Text style={styles.confirmInstruction}>
            Type <Text style={styles.confirmWord}>DELETE</Text> below to continue.
          </Text>
          <View style={[styles.confirmInput, canSubmit && styles.confirmInputValid]}>
            <TextInput
              style={styles.confirmTextInput}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="Type DELETE here"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {canSubmit && (
              <Ionicons name="checkmark-circle" size={20} color={COLORS.secondary} />
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.deleteBtn, !canSubmit && styles.deleteBtnDisabled]}
            onPress={handleRequest}
            disabled={!canSubmit || loading}
            activeOpacity={0.85}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.white} />
            <Text style={styles.deleteBtnText}>
              {loading ? 'Submitting…' : 'Request Account Deletion'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>Keep My Account</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.dangerLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.dangerMid,
    padding: 16,
    marginBottom: 16,
  },
  warningTitle: { fontSize: 15, fontWeight: '800', color: COLORS.danger, marginBottom: 2 },
  warningText: { fontSize: 13, color: '#991B1B', lineHeight: 19 },

  infoCard: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 20,
  },
  infoRow: { flexDirection: 'row', gap: 12 },
  infoIcon: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  infoText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 10,
    marginTop: 4,
  },
  deletionList: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 12,
    marginBottom: 12,
  },
  deletionItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deletionDot: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: COLORS.dangerLight,
    alignItems: 'center', justifyContent: 'center',
  },
  deletionText: { flex: 1, fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },

  keptCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.secondaryLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  keptText: { flex: 1, fontSize: 12, color: COLORS.secondaryDark, lineHeight: 18 },

  confirmInstruction: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 10,
    lineHeight: 20,
  },
  confirmWord: { fontWeight: '800', color: COLORS.danger, fontFamily: 'monospace' },
  confirmInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 2,
    marginBottom: 20,
  },
  confirmInputValid: { borderColor: COLORS.secondary },
  confirmTextInput: {
    flex: 1,
    height: 52,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.danger,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 12,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteBtnDisabled: { backgroundColor: COLORS.textMuted, shadowOpacity: 0 },
  deleteBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },

  /* Done state */
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  doneIconWrap: { marginBottom: 20 },
  doneTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  doneSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  doneDate: { fontWeight: '800', color: COLORS.danger },
  doneTips: { gap: 12, width: '100%', marginBottom: 32 },
  doneTip: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
  },
  doneTipText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  logoutBtn: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});

export default DeleteAccountScreen;
