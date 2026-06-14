import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, StatusBar, TextInput, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PURPLE } from '../../constants/colors';
import GradientFill from '../../components/common/GradientFill';
import PressableScale from '../../components/common/PressableScale';
import { scheduleServiceApi } from '../../api/driverApi';

const SERVICE_TYPES = [
  { key: 'routine',  label: 'Routine Service',  icon: 'construct-outline',   color: PURPLE.primary   },
  { key: 'oil',      label: 'Oil Change',        icon: 'water-outline',       color: '#F97316'        },
  { key: 'tyre',     label: 'Tyre Check',        icon: 'ellipse-outline',     color: COLORS.warning   },
  { key: 'brake',    label: 'Brake Check',       icon: 'alert-circle-outline', color: COLORS.danger   },
  { key: 'ac',       label: 'AC Service',        icon: 'snow-outline',        color: '#06B6D4'        },
  { key: 'other',    label: 'Other',             icon: 'ellipsis-horizontal-outline', color: COLORS.textMuted },
];

const ScheduleServiceScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [serviceType, setServiceType] = useState(null);
  const [date,        setDate]        = useState(new Date());
  const [showPicker,  setShowPicker]  = useState(false);
  const [notes,       setNotes]       = useState('');
  const [loading,     setLoading]     = useState(false);

  const dateLabel = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  const handleDateChange = (_event, selected) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setDate(selected);
  };

  const handleSubmit = async () => {
    if (!serviceType) {
      Alert.alert('Select Service Type', 'Please choose a service category.');
      return;
    }
    setLoading(true);
    try {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      await scheduleServiceApi({
        service_type: SERVICE_TYPES.find(s => s.key === serviceType)?.label || serviceType,
        service_date: `${y}-${m}-${d}`,
        notes: notes.trim() || null,
      });
      Alert.alert(
        'Request Submitted',
        `Your ${SERVICE_TYPES.find(s => s.key === serviceType)?.label} has been scheduled for ${dateLabel}. Management will confirm shortly.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Could not submit your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selected = SERVICE_TYPES.find(s => s.key === serviceType);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

        {/* Gradient hero header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <GradientFill id="schedHero" colors={PURPLE.gradient} vertical />
            <View style={styles.headerDecor1} />
            <View style={styles.headerDecor2} />
          </View>
          <View style={styles.headerTop}>
            <PressableScale style={styles.backBtn} onPress={() => navigation.goBack()} scaleTo={0.88}>
              <Ionicons name="arrow-back" size={20} color={COLORS.white} />
            </PressableScale>
            <Text style={styles.headerTitle}>Schedule Service</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.headerSub}>
            <Ionicons name="construct-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.headerSubText}>Request a maintenance appointment for your vehicle</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Service type */}
          <Text style={styles.sectionLabel}>Service Type</Text>
          <View style={styles.typeGrid}>
            {SERVICE_TYPES.map(s => {
              const isSelected = serviceType === s.key;
              return (
                <PressableScale
                  key={s.key}
                  style={[
                    styles.typeChip,
                    isSelected && { backgroundColor: s.color + '18', borderColor: s.color },
                  ]}
                  onPress={() => setServiceType(s.key)}
                  scaleTo={0.95}
                >
                  <View style={[styles.typeChipIcon, { backgroundColor: isSelected ? s.color + '25' : COLORS.background }]}>
                    <Ionicons name={s.icon} size={18} color={isSelected ? s.color : COLORS.textMuted} />
                  </View>
                  <Text style={[styles.typeChipLabel, isSelected && { color: s.color, fontWeight: '700' }]}>
                    {s.label}
                  </Text>
                  {isSelected && (
                    <View style={[styles.typeChipCheck, { backgroundColor: s.color }]}>
                      <Ionicons name="checkmark" size={10} color={COLORS.white} />
                    </View>
                  )}
                </PressableScale>
              );
            })}
          </View>

          {/* Preferred date */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Preferred Date</Text>
          <TouchableOpacity style={styles.datePicker} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
            <View style={styles.dateLeft}>
              <View style={styles.dateIconWrap}>
                <Ionicons name="calendar-outline" size={18} color={PURPLE.primary} />
              </View>
              <View>
                <Text style={styles.dateLabel}>Selected date</Text>
                <Text style={styles.dateValue}>{dateLabel}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* Android date picker */}
          {showPicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              minimumDate={new Date()}
              onChange={handleDateChange}
            />
          )}

          {/* iOS date picker in modal */}
          {Platform.OS === 'ios' && (
            <Modal visible={showPicker} transparent animationType="slide">
              <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowPicker(false)} />
              <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.pickerSheetHandle} />
                <View style={styles.pickerSheetHeader}>
                  <Text style={styles.pickerSheetTitle}>Select Date</Text>
                  <TouchableOpacity onPress={() => setShowPicker(false)}>
                    <Text style={styles.iosPickerDone}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="spinner"
                  minimumDate={new Date()}
                  onChange={handleDateChange}
                  style={{ backgroundColor: COLORS.white }}
                />
              </View>
            </Modal>
          )}

          {/* Notes */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
            Additional Notes <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Describe any specific concerns or symptoms…"
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />

          {/* Summary card (shown when service type is picked) */}
          {selected && (
            <View style={[styles.summaryCard, { borderLeftColor: selected.color }]}>
              <View style={[styles.summaryIcon, { backgroundColor: selected.color + '18' }]}>
                <Ionicons name={selected.icon} size={16} color={selected.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryTitle}>{selected.label}</Text>
                <Text style={styles.summaryDate}>{dateLabel}</Text>
              </View>
            </View>
          )}

          {/* Submit */}
          <PressableScale
            style={[styles.submitBtn, (!serviceType || loading) && { opacity: 0.55 }]}
            onPress={handleSubmit}
            disabled={!serviceType || loading}
          >
            <Ionicons name={loading ? 'hourglass-outline' : 'checkmark-circle-outline'} size={18} color={COLORS.white} />
            <Text style={styles.submitBtnText}>{loading ? 'Submitting…' : 'Submit Request'}</Text>
          </PressableScale>

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ScheduleServiceScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: PURPLE.deep,
    paddingHorizontal: 20, paddingBottom: 18, overflow: 'hidden',
    borderBottomLeftRadius: 26, borderBottomRightRadius: 26,
  },
  headerDecor1: {
    position: 'absolute', top: -50, right: -50,
    width: 190, height: 190, borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerDecor2: {
    position: 'absolute', top: 10, right: 80,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  headerSub: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerSubText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500', flex: 1 },

  scroll: { padding: 16 },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  optional: { fontWeight: '400', textTransform: 'none' },

  /* Service type grid */
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeChip: {
    width: '47%', flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: 14, padding: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    position: 'relative',
  },
  typeChipIcon: {
    width: 36, height: 36, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  typeChipLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, flex: 1 },
  typeChipCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Date picker */
  datePicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  dateLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: PURPLE.light, alignItems: 'center', justifyContent: 'center',
  },
  dateLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  dateValue: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },

  /* iOS picker modal */
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20,
  },
  pickerSheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: 16,
  },
  pickerSheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
  },
  pickerSheetTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  iosPickerDone: { fontSize: 15, fontWeight: '700', color: PURPLE.primary },

  /* Notes */
  notesInput: {
    backgroundColor: COLORS.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    padding: 14, fontSize: 14, color: COLORS.textPrimary,
    minHeight: 100, lineHeight: 21,
  },

  /* Summary */
  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    marginTop: 16, borderLeftWidth: 3,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  summaryIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  summaryDate: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },

  /* Submit */
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PURPLE.primary, borderRadius: 14,
    paddingVertical: 15, marginTop: 20,
    shadowColor: PURPLE.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.white },
});
