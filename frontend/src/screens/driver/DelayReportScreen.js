import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Platform, StatusBar, TextInput, KeyboardAvoidingView,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/common/Button';
import { COLORS } from '../../constants/colors';
import { reportDelayApi } from '../../api/driverApi';

const DELAY_REASONS = [
  { id: 'traffic',  label: 'Heavy Traffic',  icon: 'car-outline'                 },
  { id: 'weather',  label: 'Bad Weather',    icon: 'thunderstorm-outline'        },
  { id: 'vehicle',  label: 'Vehicle Issue',  icon: 'construct-outline'           },
  { id: 'road',     label: 'Road Closure',   icon: 'close-circle-outline'        },
  { id: 'accident', label: 'Accident',       icon: 'warning-outline'             },
  { id: 'other',    label: 'Other',          icon: 'ellipsis-horizontal-outline' },
];

const DELAY_MINS = [5, 10, 15, 20, 30, 45];

const DelayReportScreen = ({ navigation, route }) => {
  const headerInsets     = useHeaderInsets();
  const tripId           = route?.params?.tripId ?? null;
  const [reason, setReason]         = useState(null);
  const [delayMins, setDelayMins]   = useState(null);
  const [notes, setNotes]           = useState('');
  const [loading, setLoading]       = useState(false);

  const canSubmit = !!(reason && delayMins);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await reportDelayApi(tripId, {
        reason: reason.id,
        delay_minutes: delayMins,
        notes: notes.trim() || undefined,
      });
      const affected = res.data?.affected_passengers ?? 0;
      Alert.alert(
        'Delay Reported',
        `${affected > 0 ? affected : 'All'} passenger${affected !== 1 ? 's' : ''} on this trip will be notified of the ~${delayMins}-minute delay.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch {
      Alert.alert('Error', 'Could not submit the delay report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      {/* Header */}
      <View style={[styles.header, headerInsets]}>
        <View style={styles.headerDecor} />
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Report Delay</Text>
            <Text style={styles.headerSub}>Passengers auto-notified on submit</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Reason */}
          <Text style={styles.sectionTitle}>Delay Reason</Text>
          <View style={styles.reasonsGrid}>
            {DELAY_REASONS.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[styles.reasonCard, reason?.id === r.id && styles.reasonCardActive]}
                activeOpacity={0.8}
                onPress={() => setReason(r)}
              >
                <View style={[styles.reasonIconWrap, reason?.id === r.id && styles.reasonIconActive]}>
                  <Ionicons
                    name={r.icon}
                    size={20}
                    color={reason?.id === r.id ? COLORS.warning : COLORS.textMuted}
                  />
                </View>
                <Text style={[styles.reasonLabel, reason?.id === r.id && styles.reasonLabelActive]}>
                  {r.label}
                </Text>
                {reason?.id === r.id && (
                  <View style={styles.reasonCheck}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.warning} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Estimated delay */}
          <Text style={styles.sectionTitle}>Estimated Delay</Text>
          <View style={styles.minsWrap}>
            {DELAY_MINS.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.minPill, delayMins === m && styles.minPillActive]}
                onPress={() => setDelayMins(m)}
              >
                <Text style={[styles.minText, delayMins === m && styles.minTextActive]}>
                  {m === 45 ? '45+' : m} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Optional notes */}
          <Text style={styles.sectionTitle}>
            Notes <Text style={styles.optional}>(optional)</Text>
          </Text>
          <View style={styles.textAreaWrap}>
            <TextInput
              style={styles.textArea}
              placeholder="Any additional context for passengers or dispatch..."
              placeholderTextColor={COLORS.textPlaceholder}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={300}
            />
            <View style={styles.charRow}>
              <Text style={styles.charCount}>{notes.length} / 300</Text>
            </View>
          </View>

          {/* Notification info banner */}
          <View style={styles.notifyNote}>
            <Ionicons name="notifications-outline" size={15} color={COLORS.warning} />
            <Text style={styles.notifyText}>
              All confirmed passengers on this trip will receive a delay notification automatically.
            </Text>
          </View>

          <Button
            title="Report Delay"
            onPress={handleSubmit}
            loading={loading}
            disabled={!canSubmit}
            style={styles.submitBtn}
            size="lg"
            icon={<Ionicons name="time-outline" size={15} color={COLORS.white} />}
          />
          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },

  /* Header */
  header: { backgroundColor: COLORS.headerBg, overflow: 'hidden' },
  headerDecor: {
    position: 'absolute', top: -50, right: -50,
    width: 190, height: 190, borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 20,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '500' },

  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 10, letterSpacing: -0.1 },
  optional:     { fontSize: 12, fontWeight: '500', color: COLORS.textMuted },

  /* Reason grid */
  reasonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  reasonCard: {
    width: '30.5%', alignItems: 'center', gap: 7,
    backgroundColor: COLORS.white, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 6,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  reasonCardActive:  { borderColor: COLORS.warning, backgroundColor: COLORS.warningLight },
  reasonIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  reasonIconActive:  { backgroundColor: COLORS.white },
  reasonLabel:       { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textAlign: 'center' },
  reasonLabelActive: { color: COLORS.warningDark },
  reasonCheck:       { position: 'absolute', top: 6, right: 6 },

  /* Minute pills */
  minsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  minPill: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  minPillActive:  { borderColor: COLORS.warning, backgroundColor: COLORS.warningLight },
  minText:        { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  minTextActive:  { color: COLORS.warningDark },

  /* Text area */
  textAreaWrap: {
    backgroundColor: COLORS.white, borderRadius: 14, marginBottom: 14,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  textArea: {
    fontSize: 14, color: COLORS.textPrimary, fontWeight: '500',
    lineHeight: 22, minHeight: 80, padding: 14,
  },
  charRow: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: 14, paddingBottom: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8,
  },
  charCount: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },

  /* Notification info */
  notifyNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.warningLight, borderRadius: 12,
    padding: 12, marginBottom: 18,
    borderWidth: 1, borderColor: COLORS.warningMid,
  },
  notifyText: { flex: 1, fontSize: 12, color: COLORS.warningDark, fontWeight: '600', lineHeight: 18 },

  submitBtn: { borderRadius: 14 },
});

export default DelayReportScreen;
