import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { getDriverTripsApi } from '../../api/driverApi';

const STATUS_CFG = {
  completed: { label: 'Completed', bg: COLORS.secondaryLight, text: COLORS.secondary,  icon: 'checkmark-circle'  },
  cancelled: { label: 'Cancelled', bg: COLORS.dangerLight,    text: COLORS.danger,     icon: 'close-circle'      },
  upcoming:  { label: 'Upcoming',  bg: COLORS.primaryLight,   text: COLORS.primary,    icon: 'time-outline'      },
  ongoing:   { label: 'Active',    bg: COLORS.warningLight ?? COLORS.primaryLight, text: COLORS.warning ?? COLORS.primary, icon: 'radio-button-on' },
};

function formatTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d) ? String(dateStr) : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function durationStr(start, end) {
  if (!start || !end) return '—';
  const diffMin = Math.round((new Date(end) - new Date(start)) / 60000);
  if (isNaN(diffMin) || diffMin <= 0) return '—';
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function normaliseTrip(t) {
  return {
    _id:           String(t.trip_id ?? t._id ?? ''),
    routeName:     t.route_name    ?? t.routeName    ?? 'Route',
    busNumber:     t.plate_number  ?? t.busNumber    ?? (t.vehicle_model ?? 'Bus'),
    origin:        t.start_location ?? t.origin      ?? '—',
    destination:   t.end_location   ?? t.destination ?? '—',
    date:          formatDate(t.start_time ?? t.departureTime),
    departureTime: formatTime(t.start_time ?? t.departureTime),
    arrivalTime:   formatTime(t.end_time   ?? t.arrivalTime),
    passengers:    t.passengers    ?? 0,
    totalSeats:    t.totalSeats    ?? t.capacity ?? 30,
    earnings:      parseFloat(t.earnings ?? 0),
    status:        t.status        ?? 'upcoming',
    duration:      durationStr(t.start_time, t.end_time),
  };
}

const DriverTripHistoryScreen = ({ navigation }) => {
  const headerInsets = useHeaderInsets();
  const [trips,      setTrips]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState('all');

  const loadTrips = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await getDriverTripsApi();
      const data = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.trips) ? res.data.trips : []);
      setTrips(data.map(normaliseTrip));
    } catch {
      setTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  const filtered = filter === 'all' ? trips : trips.filter(t => t.status === filter);

  const totalEarned  = trips.filter(t => t.status === 'completed').reduce((s, t) => s + t.earnings, 0);
  const completedCnt = trips.filter(t => t.status === 'completed').length;
  const cancelledCnt = trips.filter(t => t.status === 'cancelled').length;

  const renderItem = ({ item }) => {
    const cfg  = STATUS_CFG[item.status] || STATUS_CFG.upcoming;
    const fill = item.totalSeats > 0 ? item.passengers / item.totalSeats : 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="bus" size={16} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardRoute}>{item.routeName}</Text>
            <Text style={styles.cardBus}>{item.busNumber} · {item.date}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={10} color={cfg.text} />
            <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>

        <View style={styles.journey}>
          <View style={styles.journeyStop}>
            <View style={[styles.jDot, { backgroundColor: COLORS.secondary }]} />
            <View>
              <Text style={styles.jLbl}>FROM</Text>
              <Text style={styles.jPlace}>{item.origin}</Text>
              <Text style={styles.jTime}>{item.departureTime}</Text>
            </View>
          </View>
          <View style={styles.journeyMid}>
            <View style={styles.jLine} />
            <View style={styles.jChip}>
              <Ionicons name="arrow-forward" size={10} color={COLORS.primary} />
            </View>
            <View style={styles.jLine} />
          </View>
          <View style={[styles.journeyStop, { alignItems: 'flex-end' }]}>
            <View style={[styles.jDot, { backgroundColor: COLORS.danger }]} />
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.jLbl}>TO</Text>
              <Text style={styles.jPlace}>{item.destination}</Text>
              <Text style={styles.jTime}>{item.arrivalTime}</Text>
            </View>
          </View>
        </View>

        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Ionicons name="people-outline" size={11} color={COLORS.textMuted} />
            <Text style={styles.pillText}>{item.passengers} pax</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="hourglass-outline" size={11} color={COLORS.textMuted} />
            <Text style={styles.pillText}>{item.duration}</Text>
          </View>
          {item.status === 'completed' && item.earnings > 0 && (
            <View style={[styles.pill, { backgroundColor: COLORS.secondaryLight }]}>
              <Ionicons name="cash-outline" size={11} color={COLORS.secondary} />
              <Text style={[styles.pillText, { color: COLORS.secondary }]}>${item.earnings.toFixed(2)}</Text>
            </View>
          )}
          {item.totalSeats > 0 && item.status === 'completed' && (
            <View style={styles.fillWrap}>
              <View style={styles.fillBar}>
                <View style={[styles.fillFill, {
                  width: `${fill * 100}%`,
                  backgroundColor: fill >= 0.85 ? COLORS.danger : fill >= 0.6 ? COLORS.warning : COLORS.secondary,
                }]} />
              </View>
              <Text style={styles.fillPct}>{Math.round(fill * 100)}%</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      <View style={[styles.header, headerInsets]}>
        <View style={styles.headerDecor} />
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Trip History</Text>
            <Text style={styles.headerSub}>${totalEarned.toFixed(2)} total · {completedCnt} trips done</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.summaryRow}>
          {[
            { icon: 'checkmark-circle', label: 'Completed', value: completedCnt, color: COLORS.secondary   },
            { icon: 'close-circle',     label: 'Cancelled',  value: cancelledCnt,  color: COLORS.danger     },
            { icon: 'cash-outline',     label: 'Earned',     value: `$${totalEarned.toFixed(0)}`, color: 'rgba(255,255,255,0.9)' },
          ].map((s, i) => (
            <View key={s.label} style={[styles.summaryCell, i < 2 && styles.summaryCellBorder]}>
              <Ionicons name={s.icon} size={14} color={s.color} />
              <Text style={[styles.summaryVal, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.summaryLbl}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.filterWrap}>
        {[
          { key: 'all',       label: 'All Trips'  },
          { key: 'completed', label: 'Completed'  },
          { key: 'cancelled', label: 'Cancelled'  },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadTrips(true); }}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="receipt-outline" size={38} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No trips found</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: COLORS.headerBg,
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute', top: -50, right: -50,
    width: 190, height: 190, borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.05)',
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
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: '500' },
  summaryRow: {
    flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.18)', paddingVertical: 12,
  },
  summaryCell: { flex: 1, alignItems: 'center', gap: 3 },
  summaryCellBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.1)' },
  summaryVal: { fontSize: 16, fontWeight: '900' },
  summaryLbl: { fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase' },

  filterWrap: { flexDirection: 'row', padding: 14, gap: 8 },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999, backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1, borderColor: 'transparent',
  },
  filterBtnActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primaryMid },
  filterText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  filterTextActive: { color: COLORS.primary },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 14, paddingBottom: 24 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 14, marginBottom: 10,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cardIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  cardRoute: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.1 },
  cardBus: { fontSize: 10, color: COLORS.textMuted, marginTop: 1, fontWeight: '600' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
  },
  statusText: { fontSize: 10, fontWeight: '700' },

  journey: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: 12, marginBottom: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  journeyStop: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  jDot: { width: 8, height: 8, borderRadius: 4, marginTop: 12 },
  jLbl: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  jPlace: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2 },
  jTime: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '500', marginTop: 1 },
  journeyMid: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5 },
  jLine: { width: 10, height: 1.5, backgroundColor: COLORS.border },
  jChip: {
    width: 20, height: 20, borderRadius: 6,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surfaceAlt, borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  pillText: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '700' },
  fillWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 80 },
  fillBar: { flex: 1, height: 4, backgroundColor: COLORS.border, borderRadius: 99, overflow: 'hidden' },
  fillFill: { height: '100%', borderRadius: 99 },
  fillPct: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },

  emptyWrap: { alignItems: 'center', paddingTop: 56, gap: 10 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
});

export default DriverTripHistoryScreen;
