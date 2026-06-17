import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, TouchableOpacity,
  Platform, StatusBar, Animated, ScrollView,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PURPLE } from '../../constants/colors';
import { sendEmergencyApi } from '../../api/driverApi';
import { useAuth } from '../../context/AuthContext';

const EMERGENCY_TYPES = [
  { id: 'accident',  label: 'Road Accident',    icon: 'warning-outline',      color: COLORS.danger,  bg: COLORS.dangerLight   },
  { id: 'medical',   label: 'Medical Emergency', icon: 'medkit-outline',       color: COLORS.danger,  bg: COLORS.dangerLight   },
  { id: 'breakdown', label: 'Vehicle Breakdown', icon: 'construct-outline',    color: COLORS.warning, bg: COLORS.warningLight  },
  { id: 'security',  label: 'Security Threat',  icon: 'shield-outline',       color: COLORS.danger,  bg: COLORS.dangerLight   },
  { id: 'fire',      label: 'Fire Alert',        icon: 'flame-outline',        color: COLORS.danger,  bg: COLORS.dangerLight   },
  { id: 'other',     label: 'Other',             icon: 'alert-circle-outline', color: COLORS.textSecondary, bg: COLORS.surfaceAlt },
];

const EmergencyScreen = ({ navigation, route }) => {
  const headerInsets = useHeaderInsets();
  const { user } = useAuth();
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const ringAnim     = useRef(new Animated.Value(1)).current;
  const [selected, setSelected]   = useState(null);
  const [triggered, setTriggered] = useState(false);
  const [sending, setSending]     = useState(false);

  useEffect(() => {
    const p1 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 700, useNativeDriver: true }),
      ])
    );
    const p2 = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1.5, duration: 1100, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 1.0, duration: 1100, useNativeDriver: true }),
      ])
    );
    p1.start();
    p2.start();
    return () => { p1.stop(); p2.stop(); };
  }, []);

  const handleSOS = () => {
    if (!selected) {
      Alert.alert('Select Emergency Type', 'Please select an emergency category first.');
      return;
    }
    Alert.alert(
      '⚠️ Confirm Emergency SOS',
      `Send a ${selected.label} alert? Dispatch and management will be notified immediately with your location.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS Now',
          style: 'destructive',
          onPress: async () => {
            setSending(true);
            try {
              await sendEmergencyApi({
                trip_id: route?.params?.trip_id ?? null,
                message: selected.label,
              });
              setTriggered(true);
              Alert.alert(
                'SOS Alert Sent',
                'Emergency services and management have been notified. Stay calm — help is on the way.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch {
              Alert.alert('Failed to Send', 'Could not reach the server. Please call emergency services directly.');
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.dangerDark} />

      {/* Header */}
      <View style={[styles.header, headerInsets]}>
        <View style={styles.headerDecor} />
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="warning" size={16} color={COLORS.white} />
          <Text style={styles.headerTitle}>Emergency SOS</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* SOS Button */}
        <View style={styles.sosCenterWrap}>
          <Animated.View style={[styles.sosRingOuter, { transform: [{ scale: ringAnim }] }]} />
          <Animated.View style={[styles.sosRingInner, { transform: [{ scale: pulseAnim }] }]} />
          <TouchableOpacity
            style={[styles.sosBtn, triggered && styles.sosBtnDone]}
            activeOpacity={0.85}
            onPress={handleSOS}
          >
            {triggered
              ? <Ionicons name="checkmark" size={44} color={COLORS.white} />
              : <View style={styles.sosBtnInner}>
                  <Ionicons name="warning" size={32} color={COLORS.white} />
                  <Text style={styles.sosBtnLabel}>SOS</Text>
                </View>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.sosHint}>
          {triggered
            ? 'Alert sent — emergency services notified'
            : 'Select a type below, then press SOS'}
        </Text>

        {/* Info strip */}
        <View style={styles.infoStrip}>
          {[
            { icon: 'location-outline',  label: 'GPS Location', val: 'Sharing' },
            { icon: 'bus-outline',       label: 'Vehicle ID',   val: 'BUS-101' },
            { icon: 'person-outline',    label: 'Driver ID',    val: 'DRV-042' },
          ].map(s => (
            <View key={s.label} style={styles.infoItem}>
              <Ionicons name={s.icon} size={14} color={PURPLE.primary} />
              <Text style={styles.infoLabel}>{s.label}</Text>
              <Text style={styles.infoVal}>{s.val}</Text>
            </View>
          ))}
        </View>

        {/* Emergency types */}
        <Text style={styles.sectionTitle}>Emergency Type</Text>
        <View style={styles.typesGrid}>
          {EMERGENCY_TYPES.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.typeCard, selected?.id === t.id && styles.typeCardSelected]}
              activeOpacity={0.8}
              onPress={() => setSelected(t)}
            >
              <View style={[styles.typeIconWrap, { backgroundColor: t.bg }]}>
                <Ionicons name={t.icon} size={20} color={t.color} />
              </View>
              <Text style={[styles.typeLabel, selected?.id === t.id && { color: COLORS.danger }]}>
                {t.label}
              </Text>
              {selected?.id === t.id && (
                <View style={styles.typeCheck}>
                  <Ionicons name="checkmark-circle" size={15} color={COLORS.danger} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Note */}
        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={16} color={PURPLE.primary} />
          <Text style={styles.noteText}>
            Your GPS location, bus ID, and driver details will be shared automatically when the SOS is triggered.
          </Text>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },

  /* Header */
  header: {
    backgroundColor: COLORS.dangerDark,
    paddingBottom: 18,
    paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },

  /* SOS */
  sosCenterWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 28, height: 180 },
  sosRingOuter: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  sosRingInner: {
    position: 'absolute',
    width: 148, height: 148, borderRadius: 74,
    backgroundColor: 'rgba(239,68,68,0.13)',
  },
  sosBtn: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: COLORS.danger,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: COLORS.danger, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 20, elevation: 14,
  },
  sosBtnDone: { backgroundColor: COLORS.secondary },
  sosBtnInner: { alignItems: 'center', gap: 2 },
  sosBtnLabel: { fontSize: 13, fontWeight: '900', color: COLORS.white, letterSpacing: 3 },
  sosHint: {
    textAlign: 'center', fontSize: 13, color: COLORS.textSecondary,
    fontWeight: '600', marginBottom: 16, marginHorizontal: 20,
  },

  /* Info strip */
  infoStrip: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderRadius: 14, padding: 12, marginBottom: 20, gap: 4,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  infoItem: { flex: 1, alignItems: 'center', gap: 4 },
  infoLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  infoVal: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12, letterSpacing: -0.2 },

  /* Types grid */
  typesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  typeCard: {
    width: '30.5%', alignItems: 'center', gap: 7,
    backgroundColor: COLORS.white, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 6,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  typeCardSelected: { borderColor: COLORS.danger, backgroundColor: COLORS.dangerLight },
  typeIconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, textAlign: 'center' },
  typeCheck: { position: 'absolute', top: 6, right: 6 },

  /* Note */
  noteCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: PURPLE.light, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: PURPLE.midStrong,
  },
  noteText: { flex: 1, fontSize: 12, color: PURPLE.primary, fontWeight: '600', lineHeight: 18 },
});

export default EmergencyScreen;
