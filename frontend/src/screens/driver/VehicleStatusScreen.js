import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  StatusBar, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PURPLE } from '../../constants/colors';
import GradientFill from '../../components/common/GradientFill';
import FadeInView from '../../components/common/FadeInView';
import PressableScale from '../../components/common/PressableScale';
import { SkeletonCardList } from '../../components/common/Skeleton';
import { getDriverVehicleApi } from '../../api/driverApi';
import { useApp } from '../../context/AppContext';

const STATUS_META = {
  active:      { label: 'Operational',    color: COLORS.secondary, bg: COLORS.secondaryLight },
  maintenance: { label: 'In Maintenance', color: COLORS.warning,   bg: COLORS.warningLight   },
  inactive:    { label: 'Inactive',       color: COLORS.danger,    bg: COLORS.dangerLight    },
};

const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? String(s) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');

const VehicleStatusScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { t } = useApp();
  const [vehicle,     setVehicle]     = useState(null);
  const [maintenance, setMaintenance] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getDriverVehicleApi();
      setVehicle(res.data?.vehicle ?? null);
      setMaintenance(res.data?.maintenance ?? null);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not reach the server.');
      setVehicle(null);
      setMaintenance(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const status = STATUS_META[vehicle?.status] || STATUS_META.active;
  const title  = vehicle?.model || (vehicle ? `Vehicle #${vehicle.vehicle_id}` : 'Vehicle');

  const quickStats = [
    { icon: 'speedometer-outline', label: 'Odometer',     value: maintenance?.odometer_km != null ? `${Number(maintenance.odometer_km).toLocaleString()} km` : '—', color: PURPLE.primary },
    { icon: 'construct-outline',   label: 'Next Service', value: fmtDate(maintenance?.next_service), color: COLORS.warning   },
    { icon: 'people-outline',      label: 'Capacity',     value: vehicle ? `${vehicle.capacity} ${t('Seats')}` : '—', color: COLORS.secondary },
  ];

  const specs = [
    { label: 'Model',        value: vehicle?.model || '—',                    icon: 'bus-outline'      },
    { label: 'Plate No.',    value: vehicle?.plate_number || '—',             icon: 'card-outline'     },
    { label: 'Type',         value: cap(vehicle?.vehicle_type),               icon: 'pricetag-outline' },
    { label: 'Capacity',     value: vehicle ? `${vehicle.capacity} ${t('Seats')}` : '—', icon: 'people-outline' },
    { label: 'Last Service', value: fmtDate(maintenance?.last_service),       icon: 'time-outline'     },
    { label: 'Status',       value: t(status.label),                          icon: 'ellipse-outline'  },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* ── Gradient hero ── */}
      <View style={styles.header}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill id="vehHero" colors={PURPLE.gradient} vertical />
          <View style={styles.headerDecor1} />
          <View style={styles.headerDecor2} />
        </View>

        <View style={[styles.headerTop, { paddingTop: insets.top + 8 }]}>
          <PressableScale style={styles.backBtn} onPress={() => navigation.goBack()} scaleTo={0.88}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </PressableScale>
          <Text style={styles.headerTitle}>{t('Vehicle Status')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Vehicle ID card */}
        <View style={styles.vehicleIdCard}>
          <View style={styles.vehicleIconWrap}>
            <Ionicons name="bus" size={28} color={PURPLE.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.vehicleId} numberOfLines={1}>{title}</Text>
            <Text style={styles.vehiclePlate}>{vehicle?.plate_number || (loading ? t('Loading...') : t('No vehicle assigned'))}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusBadgeText, { color: status.color }]}>{t(status.label)}</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <SkeletonCardList count={4} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              colors={[PURPLE.primary]} tintColor={PURPLE.primary}
            />
          }
        >
          {error ? (
            <View style={styles.errorCard}>
              <Ionicons name="cloud-offline-outline" size={22} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
              <PressableScale style={styles.retryBtn} onPress={() => load()} scaleTo={0.94}>
                <Text style={styles.retryText}>{t('Retry')}</Text>
              </PressableScale>
            </View>
          ) : !vehicle ? (
            <View style={styles.errorCard}>
              <Ionicons name="bus-outline" size={28} color={COLORS.textMuted} />
              <Text style={styles.errorText}>{t('No vehicle is currently assigned to you.')}</Text>
            </View>
          ) : (
            <>
              {/* Quick stats */}
              <FadeInView index={0}>
                <View style={styles.quickStats}>
                  {quickStats.map((s, i) => (
                    <View key={s.label} style={[styles.quickStat, i < 2 && styles.quickStatBorder]}>
                      <View style={[styles.quickStatIcon, { backgroundColor: s.color + '18' }]}>
                        <Ionicons name={s.icon} size={16} color={s.color} />
                      </View>
                      <Text style={styles.quickStatVal} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
                      <Text style={styles.quickStatLbl}>{t(s.label)}</Text>
                    </View>
                  ))}
                </View>
              </FadeInView>

              {/* Maintenance — scheduled service only */}
              <FadeInView index={1}>
                <Text style={styles.sectionTitle}>{t('Maintenance')}</Text>
                <PressableScale
                  style={styles.alertCard}
                  onPress={() => navigation.navigate('ScheduleService')}
                  scaleTo={0.98}
                >
                  <View style={styles.alertIcon}>
                    <Ionicons name="construct-outline" size={18} color={PURPLE.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTitle}>{t('Scheduled Service')}</Text>
                    <Text style={styles.alertDesc}>
                      {maintenance?.next_service
                        ? `Next service due on ${fmtDate(maintenance.next_service)}`
                        : 'No upcoming service scheduled — tap to book one'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={PURPLE.primary} />
                </PressableScale>
              </FadeInView>

              {/* Specs */}
              <FadeInView index={2}>
                <Text style={styles.sectionTitle}>{t('Vehicle Specifications')}</Text>
                <View style={styles.specsCard}>
                  {specs.map((spec, i) => (
                    <View key={spec.label} style={[styles.specRow, i < specs.length - 1 && styles.specRowBorder]}>
                      <View style={styles.specLeft}>
                        <Ionicons name={spec.icon} size={14} color={COLORS.textMuted} />
                        <Text style={styles.specLabel}>{t(spec.label)}</Text>
                      </View>
                      <Text style={styles.specValue} numberOfLines={1}>{spec.value}</Text>
                    </View>
                  ))}
                </View>
              </FadeInView>

              {/* Report issue CTA */}
              <FadeInView index={3}>
                <PressableScale style={styles.reportCta} onPress={() => navigation.navigate('IssueReport')} scaleTo={0.97}>
                  <View style={styles.reportCtaLeft}>
                    <View style={styles.reportCtaIcon}>
                      <Ionicons name="document-text-outline" size={18} color={PURPLE.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reportCtaTitle}>{t('Report a Vehicle Issue')}</Text>
                      <Text style={styles.reportCtaSub}>{t('Notify management about any problems')}</Text>
                    </View>
                  </View>
                  <Ionicons name="arrow-forward-circle" size={22} color={PURPLE.primary} />
                </PressableScale>
              </FadeInView>
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
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
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerDecor1: { position: 'absolute', top: -60, right: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.07)' },
  headerDecor2: { position: 'absolute', top: 10, right: 90, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)' },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },

  vehicleIdCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, margin: 16, marginTop: 0,
    borderRadius: 18, padding: 16,
    shadowColor: PURPLE.deep, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 8,
  },
  vehicleIconWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: PURPLE.light, alignItems: 'center', justifyContent: 'center' },
  vehicleId: { fontSize: 19, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: -0.4 },
  vehiclePlate: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  /* Quick stats */
  quickStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.white, borderRadius: 16, marginBottom: 18,
    shadowColor: PURPLE.deep, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
    paddingVertical: 14,
  },
  quickStat: { flex: 1, alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  quickStatBorder: { borderRightWidth: 1, borderRightColor: COLORS.border },
  quickStatIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  quickStatVal: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  quickStatLbl: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },

  sectionTitle: { fontSize: 15, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 10, letterSpacing: -0.1 },

  /* Maintenance alert */
  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 20,
    borderLeftWidth: 3, borderLeftColor: PURPLE.primary,
    shadowColor: PURPLE.deep, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
  },
  alertIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: PURPLE.light, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  alertDesc: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', marginTop: 2 },

  /* Specs */
  specsCard: {
    backgroundColor: COLORS.white, borderRadius: 16, marginBottom: 20, overflow: 'hidden',
    shadowColor: PURPLE.deep, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  specRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  specRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  specLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  specLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  specValue: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 1, textAlign: 'right' },

  /* Report CTA */
  reportCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: PURPLE.light, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: PURPLE.midStrong,
  },
  reportCtaLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  reportCtaIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  reportCtaTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  reportCtaSub: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', marginTop: 2 },

  /* Error / empty */
  errorCard: {
    alignItems: 'center', gap: 10, padding: 24, backgroundColor: COLORS.white, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  errorText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600', textAlign: 'center' },
  retryBtn: { backgroundColor: PURPLE.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 2 },
  retryText: { fontSize: 13, fontWeight: '800', color: COLORS.white },
});

export default VehicleStatusScreen;
