import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  StatusBar, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PURPLE } from '../../constants/colors';
import GradientFill from '../../components/common/GradientFill';
import FadeInView from '../../components/common/FadeInView';
import PressableScale from '../../components/common/PressableScale';
import { SkeletonCardList } from '../../components/common/Skeleton';
import { getDriverTripsApi } from '../../api/driverApi';
import { useApp } from '../../context/AppContext';

const STATUS_CFG = {
  completed: { label: 'Completed', bg: COLORS.secondaryLight, text: COLORS.secondary, icon: 'checkmark-circle'  },
  cancelled: { label: 'Cancelled', bg: COLORS.dangerLight,    text: COLORS.danger,    icon: 'close-circle'      },
  upcoming:  { label: 'Upcoming',  bg: PURPLE.mid,            text: PURPLE.primary,   icon: 'time-outline'      },
  confirmed: { label: 'Scheduled', bg: PURPLE.mid,            text: PURPLE.primary,   icon: 'calendar-outline'  },
  boarded:   { label: 'Boarding',  bg: PURPLE.mid,            text: PURPLE.primary,   icon: 'people-outline'    },
  ongoing:   { label: 'Active',    bg: COLORS.warningLight,   text: COLORS.warning,   icon: 'radio-button-on'   },
};

const UPCOMING_STATUSES = ['upcoming', 'confirmed', 'boarded'];

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

const FILTERS = [
  { key: 'all',       label: 'All'       },
  { key: 'upcoming',  label: 'Upcoming'  },
  { key: 'ongoing',   label: 'Active'    },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const DriverTripHistoryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { currency, fmtMoney, t } = useApp();
  const [trips,      setTrips]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState('all');
  const [error,      setError]      = useState(null);

  const loadTrips = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await getDriverTripsApi();
      const data = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.trips) ? res.data.trips : []);
      setTrips(data.map(normaliseTrip));
      setError(null);
    } catch (err) {
      // Surface the real reason so "not connected" is distinguishable from "no trips"
      setError(err?.response?.data?.error || err?.message || 'Could not reach the server.');
      setTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  const filtered = (() => {
    if (filter === 'all')      return trips;
    if (filter === 'upcoming') return trips.filter(t => UPCOMING_STATUSES.includes(t.status));
    return trips.filter(t => t.status === filter);
  })();

  const totalEarned  = trips.filter(t => t.status === 'completed').reduce((s, t) => s + t.earnings, 0);
  const completedCnt = trips.filter(t => t.status === 'completed').length;
  const cancelledCnt = trips.filter(t => t.status === 'cancelled').length;
  const upcomingCnt  = trips.filter(t => UPCOMING_STATUSES.includes(t.status)).length;

  const renderItem = ({ item, index }) => {
    const cfg  = STATUS_CFG[item.status] || STATUS_CFG.upcoming;
    const fill = item.totalSeats > 0 ? item.passengers / item.totalSeats : 0;

    return (
      <FadeInView index={index}>
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="bus" size={16} color={PURPLE.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardRoute}>{item.routeName}</Text>
              <Text style={styles.cardBus}>{item.busNumber} · {t(item.date)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={10} color={cfg.text} />
              <Text style={[styles.statusText, { color: cfg.text }]}>{t(cfg.label)}</Text>
            </View>
          </View>

          {/* Vertical timeline — wraps gracefully for long location names */}
          <View style={styles.journey}>
            <View style={styles.rail}>
              <View style={[styles.jDot, { backgroundColor: COLORS.secondary }]} />
              <View style={styles.railLine} />
              <View style={[styles.jDot, { backgroundColor: COLORS.danger }]} />
            </View>
            <View style={styles.journeyCol}>
              <View style={styles.journeyStop}>
                <Text style={styles.jLbl}>{t('FROM')}</Text>
                <Text style={styles.jPlace} numberOfLines={2}>{item.origin}</Text>
                <Text style={styles.jTime}>{item.departureTime}</Text>
              </View>
              <View style={styles.journeyStop}>
                <Text style={styles.jLbl}>{t('TO')}</Text>
                <Text style={styles.jPlace} numberOfLines={2}>{item.destination}</Text>
                <Text style={styles.jTime}>{item.arrivalTime}</Text>
              </View>
            </View>
          </View>

          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Ionicons name="people-outline" size={11} color={COLORS.textMuted} />
              <Text style={styles.pillText}>{item.passengers} {t('pax')}</Text>
            </View>
            <View style={styles.pill}>
              <Ionicons name="hourglass-outline" size={11} color={COLORS.textMuted} />
              <Text style={styles.pillText}>{item.duration}</Text>
            </View>
            {item.status === 'completed' && item.earnings > 0 && (
              <View style={[styles.pill, { backgroundColor: COLORS.secondaryLight }]}>
                <Ionicons name="cash-outline" size={11} color={COLORS.secondary} />
                <Text style={[styles.pillText, { color: COLORS.secondary }]}>{fmtMoney(item.earnings)}</Text>
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
      </FadeInView>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* ── Gradient hero ── */}
      <View style={styles.header}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill id="driverHistHero" colors={PURPLE.gradient} vertical />
          <View style={styles.headerDecor} />
        </View>

        <View style={[styles.headerTop, { paddingTop: insets.top + 8 }]}>
          <PressableScale style={styles.backBtn} onPress={() => navigation.goBack()} scaleTo={0.88}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </PressableScale>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>{t('Trip History')}</Text>
            <Text style={styles.headerSub}>{fmtMoney(totalEarned)} {t('Total')} · {completedCnt} {t('trips')}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.summaryRow}>
          {[
            { icon: 'checkmark-circle', label: 'Completed', value: completedCnt,          color: '#A7F3D0'               },
            { icon: 'calendar-outline', label: 'Upcoming',  value: upcomingCnt,           color: 'rgba(255,255,255,0.95)' },
            { icon: 'close-circle',     label: 'Cancelled', value: cancelledCnt,          color: '#FCA5A5'               },
            { icon: 'cash-outline',     label: 'Earned',    value: fmtMoney(totalEarned), color: 'rgba(255,255,255,0.95)' },
          ].map((s, i) => (
            <View key={s.label} style={[styles.summaryCell, i < 3 && styles.summaryCellBorder]}>
              <Ionicons name={s.icon} size={14} color={s.color} />
              <Text style={[styles.summaryVal, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.summaryLbl}>{t(s.label)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.filterWrap}>
        {FILTERS.map(f => (
          <PressableScale
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
            scaleTo={0.92}
          >
            <Text
              style={[styles.filterText, filter === f.key && styles.filterTextActive]}
              numberOfLines={1}
            >
              {t(f.label)}
            </Text>
          </PressableScale>
        ))}
      </View>

      {loading ? (
        <SkeletonCardList count={5} />
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
              colors={[PURPLE.primary]}
              tintColor={PURPLE.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIcon, error && { backgroundColor: COLORS.dangerLight }]}>
                <Ionicons
                  name={error ? 'cloud-offline-outline' : 'receipt-outline'}
                  size={38}
                  color={error ? COLORS.danger : PURPLE.primary}
                />
              </View>
              <Text style={styles.emptyText}>{error ? t("Couldn't load trips") : t('No trips found')}</Text>
              {error ? (
                <>
                  <Text style={styles.emptySub}>{error}</Text>
                  <PressableScale style={styles.retryBtn} onPress={() => loadTrips()} scaleTo={0.94}>
                    <Ionicons name="refresh" size={15} color={COLORS.white} />
                    <Text style={styles.retryText}>{t('Retry')}</Text>
                  </PressableScale>
                </>
              ) : (
                <Text style={styles.emptySub}>{t('Your assigned trips will appear here.')}</Text>
              )}
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
    backgroundColor: PURPLE.deep,
    overflow: 'hidden',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  headerDecor: {
    position: 'absolute', top: -60, right: -50,
    width: 190, height: 190, borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: '500' },
  summaryRow: {
    flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.16)', paddingVertical: 12,
  },
  summaryCell: { flex: 1, alignItems: 'center', gap: 3 },
  summaryCellBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.12)' },
  summaryVal: { fontSize: 16, fontWeight: '900' },
  summaryLbl: { fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase' },

  filterWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6,
  },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: PURPLE.midStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: PURPLE.primary, borderColor: PURPLE.primary },
  filterText: { fontSize: 12, fontWeight: '700', color: PURPLE.primary },
  filterTextActive: { color: COLORS.white },

  list: { paddingHorizontal: 14, paddingBottom: 24 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 14, marginBottom: 10,
    shadowColor: PURPLE.deep, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09, shadowRadius: 12, elevation: 3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cardIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: PURPLE.light, alignItems: 'center', justifyContent: 'center',
  },
  cardRoute: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.1 },
  cardBus: { fontSize: 10, color: COLORS.textMuted, marginTop: 1, fontWeight: '600' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
  },
  statusText: { fontSize: 10, fontWeight: '700' },

  /* Vertical timeline */
  journey: {
    flexDirection: 'row', gap: 10,
    paddingBottom: 12, marginBottom: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rail: { width: 10, alignItems: 'center', paddingTop: 4 },
  railLine: { width: 2, flex: 1, minHeight: 16, backgroundColor: COLORS.border, marginVertical: 4, borderRadius: 1 },
  journeyCol: { flex: 1, gap: 12 },
  journeyStop: {},
  jDot: { width: 9, height: 9, borderRadius: 5 },
  jLbl: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  jPlace: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2, lineHeight: 16 },
  jTime: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '500', marginTop: 1 },

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

  emptyWrap: { alignItems: 'center', paddingTop: 56, gap: 14 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 26,
    backgroundColor: PURPLE.light, alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '800' },
  emptySub: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500', textAlign: 'center', paddingHorizontal: 40, marginTop: -6 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6,
    backgroundColor: PURPLE.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10,
  },
  retryText: { fontSize: 13, fontWeight: '800', color: COLORS.white },
});

export default DriverTripHistoryScreen;
