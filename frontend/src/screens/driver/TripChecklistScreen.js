import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Platform, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { submitChecklistApi, startTripApi } from '../../api/driverApi';

const ITEMS = [
  {
    key: 'fuel_ok',
    icon: 'water',
    label: 'Fuel Level',
    desc: 'Tank is at least quarter full and gauges are normal',
  },
  {
    key: 'lights_ok',
    icon: 'flashlight',
    label: 'Lights & Signals',
    desc: 'Headlights, brake lights, and indicators all working',
  },
  {
    key: 'tires_ok',
    icon: 'disc',
    label: 'Tires & Brakes',
    desc: 'Tires are inflated, no visible damage, brakes responsive',
  },
];

const TripChecklistScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const tripId = route?.params?.tripId ?? null;
  const tripInfo = route?.params?.tripInfo ?? null;

  const [checks, setChecks] = useState({ fuel_ok: false, lights_ok: false, tires_ok: false });
  const [loading, setLoading] = useState(false);

  const allChecked = Object.values(checks).every(Boolean);

  const toggle = (key) => setChecks(prev => ({ ...prev, [key]: !prev[key] }));

  const handleStartTrip = async () => {
    if (!allChecked) return;

    setLoading(true);
    try {
      if (tripId) {
        await submitChecklistApi(tripId, checks);
        await startTripApi(tripId);
      }
      navigation.replace('DriverMap', { tripId });
    } catch {
      Alert.alert('Error', 'Could not start trip. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkedCount = Object.values(checks).filter(Boolean).length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Pre-Trip Checklist</Text>
          <Text style={styles.headerSub}>Complete all checks before starting</Text>
        </View>
        <View style={styles.progressBadge}>
          <Text style={styles.progressText}>{checkedCount}/{ITEMS.length}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Trip info card */}
        {tripInfo && (
          <View style={styles.tripCard}>
            <View style={styles.tripCardLeft}>
              <View style={styles.tripIconWrap}>
                <Ionicons name="bus" size={20} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.tripRoute}>{tripInfo.routeName}</Text>
                <Text style={styles.tripMeta}>{tripInfo.busNumber}  ·  {tripInfo.departureTime}</Text>
              </View>
            </View>
            <View style={styles.journeyChip}>
              <Text style={styles.journeyChipText} numberOfLines={1}>
                {tripInfo.origin} → {tripInfo.destination}
              </Text>
            </View>
          </View>
        )}

        {/* Instruction */}
        <Text style={styles.sectionLabel}>Safety checks required</Text>

        {/* Checklist items */}
        {ITEMS.map((item) => {
          const checked = checks[item.key];
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.checkItem, checked && styles.checkItemDone]}
              activeOpacity={0.85}
              onPress={() => toggle(item.key)}
            >
              <View style={[styles.itemIconWrap, { backgroundColor: checked ? COLORS.secondaryLight : COLORS.surfaceAlt }]}>
                <Ionicons name={item.icon} size={20} color={checked ? COLORS.secondary : COLORS.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemLabel, checked && { color: COLORS.secondary }]}>{item.label}</Text>
                <Text style={styles.itemDesc}>{item.desc}</Text>
              </View>
              <View style={[styles.checkbox, checked && styles.checkboxDone]}>
                {checked && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Warning if not all checked */}
        {!allChecked && (
          <View style={styles.warningBox}>
            <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
            <Text style={styles.warningText}>
              All {ITEMS.length} checks must be confirmed before you can start the trip.
            </Text>
          </View>
        )}

        {/* Start button */}
        <TouchableOpacity
          style={[styles.startBtn, !allChecked && styles.startBtnDisabled]}
          disabled={!allChecked || loading}
          onPress={handleStartTrip}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="navigate" size={18} color={COLORS.white} />
              <Text style={styles.startBtnText}>Start Trip</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: COLORS.headerBg,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white, letterSpacing: -0.2 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: '500' },
  progressBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
  },
  progressText: { fontSize: 14, fontWeight: '800', color: COLORS.white },

  scroll: { padding: 16 },

  tripCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 20,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  tripCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  tripIconWrap: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  tripRoute: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  tripMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, fontWeight: '600' },
  journeyChip: {
    backgroundColor: COLORS.primaryLight, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  journeyChipText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },

  checkItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: COLORS.border,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  checkItemDone: {
    borderColor: COLORS.secondary,
    backgroundColor: COLORS.secondaryLight,
  },
  itemIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  itemLabel: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 3 },
  itemDesc: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', lineHeight: 16 },
  checkbox: {
    width: 26, height: 26, borderRadius: 8,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  checkboxDone: {
    backgroundColor: COLORS.secondary, borderColor: COLORS.secondary,
  },

  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFF8E7', borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#FBBF24',
  },
  warningText: { flex: 1, fontSize: 12, color: '#92400E', fontWeight: '600', lineHeight: 18 },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, marginTop: 4,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  startBtnDisabled: {
    backgroundColor: COLORS.border, shadowOpacity: 0,
  },
  startBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.white },
});

export default TripChecklistScreen;
