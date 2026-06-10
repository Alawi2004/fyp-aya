import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Platform, StatusBar, Animated,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

const VEHICLE = {
  id: 'BUS-101',
  model: 'Yutong ZK6122HQ',
  plate: 'WXY 1234',
  year: 2022,
  capacity: 30,
  fuelLevel: 72,       // %
  odometer: 48320,     // km
  lastService: '2025-03-01',
  nextService: '2025-06-01',
  status: 'operational',
};

const ALERTS = [
  { id: '1', level: 'info',    title: 'Scheduled Service',  desc: 'Next service due on 01 Jun 2025',     icon: 'construct-outline', color: COLORS.primary,    bg: COLORS.primaryLight,   navigate: 'ScheduleService' },
  { id: '2', level: 'warning', title: 'Tyre Check Required', desc: 'Front-right tyre pressure is low',   icon: 'ellipse-outline',   color: COLORS.warning,    bg: COLORS.warningLight,   navigate: null },
  { id: '3', level: 'info',    title: 'AC System OK',        desc: 'Air conditioning serviced last week', icon: 'snow-outline',      color: COLORS.secondary,  bg: COLORS.secondaryLight, navigate: null },
];

const SPECS = [
  { label: 'Model',       value: VEHICLE.model,                     icon: 'bus-outline'         },
  { label: 'Plate No.',   value: VEHICLE.plate,                     icon: 'card-outline'        },
  { label: 'Year',        value: String(VEHICLE.year),              icon: 'calendar-outline'    },
  { label: 'Capacity',    value: `${VEHICLE.capacity} seats`,       icon: 'people-outline'      },
  { label: 'Odometer',    value: `${VEHICLE.odometer.toLocaleString()} km`, icon: 'speedometer-outline' },
  { label: 'Last Service', value: VEHICLE.lastService,              icon: 'time-outline'        },
];

const VehicleStatusScreen = ({ navigation }) => {
  const headerInsets = useHeaderInsets();
  const fuelAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(fuelAnim, { toValue: VEHICLE.fuelLevel / 100, duration: 1000, useNativeDriver: false }),
    ]).start();
  }, []);

  const fuelColor = VEHICLE.fuelLevel < 20
    ? COLORS.danger
    : VEHICLE.fuelLevel < 40
      ? COLORS.warning
      : COLORS.secondary;

  const fuelBarWidth = fuelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      {/* Header */}
      <View style={[styles.header, headerInsets]}>
        <View style={styles.headerDecor1} />
        <View style={styles.headerDecor2} />
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vehicle Status</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Vehicle ID card */}
        <View style={styles.vehicleIdCard}>
          <View style={styles.vehicleIconWrap}>
            <Ionicons name="bus" size={28} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.vehicleId}>{VEHICLE.id}</Text>
            <Text style={styles.vehiclePlate}>{VEHICLE.plate}</Text>
          </View>
          <View style={styles.operationalBadge}>
            <View style={styles.operationalDot} />
            <Text style={styles.operationalText}>Operational</Text>
          </View>
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        style={{ opacity: fadeAnim }}
      >

        {/* Fuel gauge */}
        <View style={styles.fuelCard}>
          <View style={styles.fuelHeader}>
            <View style={styles.fuelLeft}>
              <View style={[styles.fuelIconWrap, { backgroundColor: fuelColor + '20' }]}>
                <Ionicons name="water" size={18} color={fuelColor} />
              </View>
              <View>
                <Text style={styles.fuelTitle}>Fuel Level</Text>
                <Text style={styles.fuelSub}>Last refuelled: Today 06:30</Text>
              </View>
            </View>
            <View style={[styles.fuelPctBadge, { backgroundColor: fuelColor + '20' }]}>
              <Text style={[styles.fuelPct, { color: fuelColor }]}>{VEHICLE.fuelLevel}%</Text>
            </View>
          </View>

          <View style={styles.fuelBarTrack}>
            <Animated.View
              style={[styles.fuelBarFill, { width: fuelBarWidth, backgroundColor: fuelColor }]}
            />
          </View>

          <View style={styles.fuelMarkers}>
            {['E', '¼', '½', '¾', 'F'].map(m => (
              <Text key={m} style={styles.fuelMarkerText}>{m}</Text>
            ))}
          </View>

          {VEHICLE.fuelLevel < 30 && (
            <View style={styles.fuelWarning}>
              <Ionicons name="warning-outline" size={13} color={COLORS.warning} />
              <Text style={styles.fuelWarningText}>Low fuel — consider refuelling soon</Text>
            </View>
          )}
        </View>

        {/* Quick stats */}
        <View style={styles.quickStats}>
          {[
            { icon: 'speedometer-outline', label: 'Odometer',     value: `${VEHICLE.odometer.toLocaleString()} km`, color: COLORS.primary   },
            { icon: 'construct-outline',   label: 'Next Service', value: VEHICLE.nextService,                       color: COLORS.warning    },
            { icon: 'people-outline',      label: 'Capacity',     value: `${VEHICLE.capacity} seats`,               color: COLORS.secondary  },
          ].map((s, i) => (
            <View key={s.label} style={[styles.quickStat, i < 2 && styles.quickStatBorder]}>
              <View style={[styles.quickStatIcon, { backgroundColor: s.color + '18' }]}>
                <Ionicons name={s.icon} size={16} color={s.color} />
              </View>
              <Text style={styles.quickStatVal}>{s.value}</Text>
              <Text style={styles.quickStatLbl}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Maintenance alerts */}
        <Text style={styles.sectionTitle}>Maintenance Alerts</Text>
        {ALERTS.map(alert => {
          const Wrapper = alert.navigate ? TouchableOpacity : View;
          return (
            <Wrapper
              key={alert.id}
              style={[styles.alertCard, { borderLeftColor: alert.color }]}
              {...(alert.navigate ? { onPress: () => navigation.navigate(alert.navigate), activeOpacity: 0.8 } : {})}
            >
              <View style={[styles.alertIcon, { backgroundColor: alert.bg }]}>
                <Ionicons name={alert.icon} size={16} color={alert.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertDesc}>{alert.desc}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={alert.navigate ? alert.color : COLORS.textMuted}
              />
            </Wrapper>
          );
        })}

        {/* Vehicle specs */}
        <Text style={styles.sectionTitle}>Vehicle Specifications</Text>
        <View style={styles.specsCard}>
          {SPECS.map((spec, i) => (
            <View key={spec.label} style={[styles.specRow, i < SPECS.length - 1 && styles.specRowBorder]}>
              <View style={styles.specLeft}>
                <Ionicons name={spec.icon} size={14} color={COLORS.textMuted} />
                <Text style={styles.specLabel}>{spec.label}</Text>
              </View>
              <Text style={styles.specValue}>{spec.value}</Text>
            </View>
          ))}
        </View>

        {/* Report issue CTA */}
        <TouchableOpacity
          style={styles.reportCta}
          onPress={() => navigation.navigate('IssueReport')}
        // IssueReport is registered in VehicleStack (same stack as VehicleStatusMain)
        >
          <View style={styles.reportCtaLeft}>
            <Ionicons name="document-text-outline" size={18} color={COLORS.warning} />
            <View>
              <Text style={styles.reportCtaTitle}>Report a Vehicle Issue</Text>
              <Text style={styles.reportCtaSub}>Notify management about any problems</Text>
            </View>
          </View>
          <Ionicons name="arrow-forward-circle" size={22} color={COLORS.warning} />
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },

  /* Header */
  header: {
    backgroundColor: COLORS.headerBg,
    paddingBottom: 0, overflow: 'hidden',
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
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },

  /* Vehicle ID card */
  vehicleIdCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, margin: 16, marginTop: 0,
    borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  vehicleIconWrap: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  vehicleId: { fontSize: 20, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: -0.5 },
  vehiclePlate: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600', marginTop: 2 },
  operationalBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.secondaryLight, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  operationalDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.secondary },
  operationalText: { fontSize: 11, fontWeight: '700', color: COLORS.secondary },

  /* Fuel card */
  fuelCard: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 16, marginBottom: 12,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  fuelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  fuelLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fuelIconWrap: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  fuelTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  fuelSub: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', marginTop: 2 },
  fuelPctBadge: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 7 },
  fuelPct: { fontSize: 18, fontWeight: '900' },
  fuelBarTrack: {
    height: 12, backgroundColor: COLORS.border,
    borderRadius: 99, overflow: 'hidden', marginBottom: 6,
  },
  fuelBarFill: { height: '100%', borderRadius: 99 },
  fuelMarkers: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  fuelMarkerText: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },
  fuelWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.warningLight, borderRadius: 10,
    padding: 10, marginTop: 10, borderWidth: 1, borderColor: COLORS.warningMid,
  },
  fuelWarningText: { fontSize: 12, color: COLORS.warning, fontWeight: '600' },

  /* Quick stats */
  quickStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.white, borderRadius: 16, marginBottom: 16,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    paddingVertical: 14,
  },
  quickStat: { flex: 1, alignItems: 'center', gap: 5 },
  quickStatBorder: { borderRightWidth: 1, borderRightColor: COLORS.border },
  quickStatIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  quickStatVal: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  quickStatLbl: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },

  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 10, letterSpacing: -0.1 },

  /* Alerts */
  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 8,
    borderLeftWidth: 3,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
  },
  alertIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  alertDesc: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', marginTop: 2 },

  /* Specs */
  specsCard: {
    backgroundColor: COLORS.white, borderRadius: 16, marginBottom: 16,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, overflow: 'hidden',
  },
  specRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  specRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  specLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  specLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  specValue: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },

  /* Report CTA */
  reportCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.warningLight, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.warningMid,
  },
  reportCtaLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reportCtaTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  reportCtaSub: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', marginTop: 2 },
});

export default VehicleStatusScreen;
