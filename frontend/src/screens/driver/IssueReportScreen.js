import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Alert, Platform, StatusBar, TextInput, KeyboardAvoidingView,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PURPLE } from '../../constants/colors';
import GradientFill from '../../components/common/GradientFill';
import PressableScale from '../../components/common/PressableScale';

const ISSUE_TYPES = [
  { id: 'traffic',    label: 'Traffic Congestion', icon: 'car-outline'           },
  { id: 'mechanical', label: 'Vehicle Problem',    icon: 'construct-outline'     },
  { id: 'passenger',  label: 'Passenger Issue',    icon: 'people-outline'        },
  { id: 'route',      label: 'Route Blockage',     icon: 'map-outline'           },
  { id: 'accident',   label: 'Accident / Incident', icon: 'warning-outline'      },
  { id: 'other',      label: 'Other',              icon: 'ellipsis-horizontal-outline' },
];

const PRIORITY_OPTS = [
  { key: 'low',    label: 'Low',    desc: 'Non-urgent',    color: COLORS.secondary, bg: COLORS.secondaryLight },
  { key: 'medium', label: 'Medium', desc: 'Moderate',      color: COLORS.warning,   bg: COLORS.warningLight   },
  { key: 'high',   label: 'High',   desc: 'Needs action',  color: COLORS.danger,    bg: COLORS.dangerLight    },
];

const IssueReportScreen = ({ navigation }) => {
  const headerInsets = useHeaderInsets();
  const [selectedType, setSelectedType] = useState(null);
  const [priority, setPriority]         = useState('medium');
  const [description, setDescription]   = useState('');
  const [loading, setLoading]           = useState(false);

  const handleSubmit = () => {
    if (!selectedType) {
      Alert.alert('Select Issue Type', 'Please choose a category for this issue.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Add Description', 'Please describe the issue before submitting.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Report Submitted',
        'Your issue has been reported to management. Passengers will be notified if needed.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }, 1200);
  };

  const selectedPriority = PRIORITY_OPTS.find(p => p.key === priority);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* Gradient hero header */}
      <View style={[styles.header, headerInsets]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill id="issueHero" colors={PURPLE.gradient} vertical />
          <View style={styles.headerDecor} />
        </View>
        <View style={styles.headerTop}>
          <PressableScale style={styles.backBtn} onPress={() => navigation.goBack()} scaleTo={0.88}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </PressableScale>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Report Issue</Text>
            <Text style={styles.headerSub}>Notify management instantly</Text>
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

        {/* Trip context */}
        <View style={styles.contextCard}>
          <View style={styles.contextRow}>
            <Ionicons name="bus-outline" size={15} color={PURPLE.primary} />
            <Text style={styles.contextLabel}>Active Trip</Text>
            <Text style={styles.contextVal}>Route A · BUS-101</Text>
          </View>
          <View style={styles.contextDivider} />
          <View style={styles.contextRow}>
            <Ionicons name="location-outline" size={15} color={COLORS.secondary} />
            <Text style={styles.contextLabel}>Location</Text>
            <Text style={styles.contextVal}>Sharing Live GPS</Text>
          </View>
        </View>

        {/* Issue types */}
        <Text style={styles.sectionTitle}>Issue Category</Text>
        <View style={styles.typesGrid}>
          {ISSUE_TYPES.map(t => (
            <PressableScale
              key={t.id}
              style={[styles.typeCard, selectedType?.id === t.id && styles.typeCardSelected]}
              scaleTo={0.93}
              onPress={() => setSelectedType(t)}
            >
              <View style={[styles.typeIconWrap, selectedType?.id === t.id && styles.typeIconActive]}>
                <Ionicons
                  name={t.icon}
                  size={20}
                  color={selectedType?.id === t.id ? PURPLE.primary : COLORS.textMuted}
                />
              </View>
              <Text style={[styles.typeLabel, selectedType?.id === t.id && styles.typeLabelSelected]}>
                {t.label}
              </Text>
              {selectedType?.id === t.id && (
                <View style={styles.typeCheckmark}>
                  <Ionicons name="checkmark-circle" size={14} color={PURPLE.primary} />
                </View>
              )}
            </PressableScale>
          ))}
        </View>

        {/* Priority */}
        <Text style={styles.sectionTitle}>Priority Level</Text>
        <View style={styles.priorityRow}>
          {PRIORITY_OPTS.map(p => (
            <PressableScale
              key={p.key}
              style={[
                styles.priorityBtn,
                priority === p.key && { backgroundColor: p.bg, borderColor: p.color },
              ]}
              scaleTo={0.94}
              onPress={() => setPriority(p.key)}
            >
              <Text style={[styles.priorityLabel, priority === p.key && { color: p.color }]}>
                {p.label}
              </Text>
              <Text style={[styles.priorityDesc, priority === p.key && { color: p.color }]}>
                {p.desc}
              </Text>
            </PressableScale>
          ))}
        </View>

        {/* Description */}
        <Text style={styles.sectionTitle}>Description</Text>
        <View style={styles.textAreaWrap}>
          <TextInput
            style={styles.textArea}
            placeholder="Describe the issue in detail — include location, time, and any relevant information..."
            placeholderTextColor={COLORS.textPlaceholder}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={500}
          />
          <View style={styles.charRow}>
            <Text style={styles.charCount}>{description.length} / 500</Text>
          </View>
        </View>

        {/* Auto-attach note */}
        <View style={styles.attachNote}>
          <Ionicons name="attach-outline" size={15} color={PURPLE.primary} />
          <Text style={styles.attachText}>
            GPS location, vehicle ID, and trip details will be attached automatically.
          </Text>
        </View>

        <PressableScale
          style={[styles.submitBtn, (!selectedType || !description.trim() || loading) && { opacity: 0.55 }]}
          onPress={handleSubmit}
          disabled={!selectedType || !description.trim() || loading}
        >
          <Ionicons name={loading ? 'hourglass-outline' : 'send-outline'} size={16} color={COLORS.white} />
          <Text style={styles.submitBtnText}>{loading ? 'Submitting…' : 'Submit Report'}</Text>
        </PressableScale>

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
  header: {
    backgroundColor: PURPLE.deep,
    overflow: 'hidden',
    borderBottomLeftRadius: 26, borderBottomRightRadius: 26,
  },
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
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '500' },

  /* Context card */
  contextCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 20,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contextLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600', flex: 1 },
  contextVal: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  contextDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },

  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 10, letterSpacing: -0.1 },

  /* Types */
  typesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  typeCard: {
    width: '30.5%', alignItems: 'center', gap: 7,
    backgroundColor: COLORS.white, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 6,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  typeCardSelected: { borderColor: PURPLE.primary, backgroundColor: PURPLE.light },
  typeIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  typeIconActive: { backgroundColor: COLORS.white },
  typeLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textAlign: 'center' },
  typeLabelSelected: { color: PURPLE.primary },
  typeCheckmark: { position: 'absolute', top: 6, right: 6 },

  /* Priority */
  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  priorityBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 14,
    alignItems: 'center', backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1.5, borderColor: 'transparent', gap: 2,
  },
  priorityLabel: { fontSize: 13, fontWeight: '800', color: COLORS.textMuted },
  priorityDesc: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted },

  /* Text area */
  textAreaWrap: {
    backgroundColor: COLORS.white, borderRadius: 14, marginBottom: 14,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  textArea: {
    fontSize: 14, color: COLORS.textPrimary, fontWeight: '500',
    lineHeight: 22, minHeight: 110, padding: 14,
  },
  charRow: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: 14, paddingBottom: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  charCount: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },

  /* Attach note */
  attachNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: PURPLE.light, borderRadius: 12,
    padding: 12, marginBottom: 18, borderWidth: 1, borderColor: PURPLE.midStrong,
  },
  attachText: { flex: 1, fontSize: 12, color: PURPLE.primary, fontWeight: '600', lineHeight: 18 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PURPLE.primary, borderRadius: 14, paddingVertical: 16,
    shadowColor: PURPLE.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
  },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.white },
});

export default IssueReportScreen;
