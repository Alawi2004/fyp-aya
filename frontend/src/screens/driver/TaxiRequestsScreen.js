import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { COLORS, PURPLE } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import {
  getDriverTaxiReservationsApi,
  updateTaxiReservationStatusApi,
  updateTaxiLocationApi,
} from '../../api/driverApi';

const ACTIVE_STATUSES = ['accepted', 'on_the_way', 'arrived'];

const STATUS_CFG = {
  pending:    { label: 'New Request', color: COLORS.warning,   bg: COLORS.warningLight ?? '#FEF3C7' },
  accepted:   { label: 'Accepted',    color: PURPLE.primary,   bg: PURPLE.light },
  on_the_way: { label: 'On the Way',  color: '#2563EB',        bg: '#EFF6FF' },
  arrived:    { label: 'Arrived',     color: '#0369A1',        bg: '#F0F9FF' },
  completed:  { label: 'Completed',   color: COLORS.textMuted, bg: COLORS.surfaceAlt ?? '#F1F5F9' },
};

// Next action a driver can take from each status
const NEXT_ACTION = {
  pending:    { status: 'accepted',   label: 'Accept Request', icon: 'checkmark-circle' },
  accepted:   { status: 'on_the_way', label: 'Start Driving',  icon: 'navigate' },
  on_the_way: { status: 'arrived',    label: 'Mark Arrived',   icon: 'flag' },
  arrived:    { status: 'completed',  label: 'Complete Trip',  icon: 'checkmark-done' },
};

const fmtMoney = (v) => `$${Number(v ?? 0).toFixed(2)}`;

const TaxiRequestsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { t } = useApp();
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId,     setBusyId]     = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getDriverTaxiReservationsApi();
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 15000);
    return () => clearInterval(id);
  }, [load]);

  // Stream this driver's live GPS to the passenger while a taxi is in progress.
  const activeId = items.find((r) => ACTIVE_STATUSES.includes(r.status))?.reservation_id ?? null;
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    let sub = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 10 },
          (loc) => {
            updateTaxiLocationApi(activeId, {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            }).catch(() => {});
          }
        );
      } catch { /* location unavailable */ }
    })();
    return () => { cancelled = true; sub?.remove?.(); };
  }, [activeId]);

  const advance = (item) => {
    const action = NEXT_ACTION[item.status];
    if (!action) return;
    Alert.alert(action.label, `${action.label} for ${item.passenger_name || 'this passenger'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action.label, onPress: async () => {
          setBusyId(item.reservation_id);
          try {
            await updateTaxiReservationStatusApi(item.reservation_id, action.status);
            load(true);
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.error || 'Could not update the request.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const renderCard = (item) => {
    const cfg    = STATUS_CFG[item.status] || STATUS_CFG.pending;
    const action = NEXT_ACTION[item.status];
    const isBusy = busyId === item.reservation_id;

    return (
      <View key={item.reservation_id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.taxiIcon}>
            <Ionicons name="car" size={18} color={PURPLE.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.passenger}>{item.passenger_name || 'Passenger'}</Text>
            <Text style={styles.meta}>{item.vehicle_type} · {fmtMoney(item.estimated_fare)}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Route */}
        <View style={styles.route}>
          <View style={styles.rail}>
            <View style={[styles.dot, { backgroundColor: COLORS.secondary }]} />
            <View style={styles.railLine} />
            <View style={[styles.dot, { backgroundColor: COLORS.danger }]} />
          </View>
          <View style={{ flex: 1, gap: 10 }}>
            <View>
              <Text style={styles.lbl}>PICKUP</Text>
              <Text style={styles.addr} numberOfLines={2}>{item.pickup_address}</Text>
            </View>
            <View>
              <Text style={styles.lbl}>DROP-OFF</Text>
              <Text style={styles.addr} numberOfLines={2}>{item.dest_address}</Text>
            </View>
          </View>
        </View>

        {item.scheduled_for && item.scheduled_for !== 'Now' && (
          <View style={styles.schedRow}>
            <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.schedText}>Scheduled: {item.scheduled_for}</Text>
          </View>
        )}
        {item.passenger_phone && (
          <View style={styles.schedRow}>
            <Ionicons name="call-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.schedText}>{item.passenger_phone}</Text>
          </View>
        )}

        {/* Verify the passenger's boarding QR against this exact ride */}
        {ACTIVE_STATUSES.includes(item.status) && (
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={() => navigation.navigate('PassengerVerify', {
              reservationId: item.reservation_id,
              passengerName: item.passenger_name || 'Passenger',
            })}
            activeOpacity={0.85}
          >
            <Ionicons name="qr-code-outline" size={18} color={PURPLE.primary} />
            <Text style={styles.scanBtnText}>{t('Scan Passenger QR')}</Text>
          </TouchableOpacity>
        )}

        {action && (
          <TouchableOpacity
            style={[styles.actionBtn, isBusy && { opacity: 0.6 }]}
            onPress={() => advance(item)}
            disabled={isBusy}
            activeOpacity={0.85}
          >
            {isBusy
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Ionicons name={action.icon} size={18} color={COLORS.white} />}
            <Text style={styles.actionText}>{action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('Taxi Requests')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}><ActivityIndicator size="large" color={PURPLE.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}
              colors={[PURPLE.primary]} tintColor={PURPLE.primary} />
          }
        >
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="car-outline" size={52} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No taxi requests</Text>
              <Text style={styles.emptyText}>New passenger taxi bookings assigned to you will appear here.</Text>
            </View>
          ) : items.map(renderCard)}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: PURPLE.deep, paddingHorizontal: 16, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  scroll: { padding: 16 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 15, marginBottom: 12,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  taxiIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: PURPLE.light, alignItems: 'center', justifyContent: 'center' },
  passenger: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  meta: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600', marginTop: 1, textTransform: 'capitalize' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  route: { flexDirection: 'row', gap: 12, paddingBottom: 12, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rail: { width: 10, alignItems: 'center', paddingTop: 4 },
  railLine: { width: 2, flex: 1, minHeight: 16, backgroundColor: COLORS.border, marginVertical: 4, borderRadius: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  lbl: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  addr: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2, lineHeight: 17 },

  schedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  schedText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.secondary, borderRadius: 14, paddingVertical: 14, marginTop: 8,
  },
  actionText: { fontSize: 15, fontWeight: '800', color: COLORS.white },

  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PURPLE.light, borderRadius: 14, paddingVertical: 13, marginTop: 8,
    borderWidth: 1.5, borderColor: PURPLE.primary,
  },
  scanBtnText: { fontSize: 15, fontWeight: '800', color: PURPLE.primary },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginTop: 8 },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 40, lineHeight: 19 },
});

export default TaxiRequestsScreen;
