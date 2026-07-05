import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, StatusBar, ScrollView,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import EmptyState from '../../components/common/EmptyState';
import GradientFill from '../../components/common/GradientFill';
import FadeInView from '../../components/common/FadeInView';
import PressableScale from '../../components/common/PressableScale';
import { COLORS, PURPLE } from '../../constants/colors';
import { formatDateTime } from '../../utils/formatters';
import { getFavoriteRoutes, addFavoriteRoute, removeFavoriteRoute } from '../../api/apiClient';

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function formatRecurrence(rec) {
  if (!rec) return null;
  if (rec === 'daily')    return 'Daily';
  if (rec === 'weekdays') return 'Mon–Fri';
  if (rec === 'weekends') return 'Weekends';
  return rec.charAt(0).toUpperCase() + rec.slice(1);
}

const FILTERS = [
  { key: 'all',       label: 'All'       },
  { key: 'upcoming',  label: 'Upcoming'  },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_CONFIG = {
  upcoming:  { bg: PURPLE.mid,             text: PURPLE.primary,    icon: 'time-outline'          },
  completed: { bg: COLORS.secondaryLight,  text: COLORS.secondary,  icon: 'checkmark-circle'      },
  cancelled: { bg: COLORS.dangerLight,     text: COLORS.danger,     icon: 'close-circle'          },
};

const TripHistoryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { bookings, cancelBooking, refreshBookings, currency, fmtMoney, t } = useApp();
  const { user } = useAuth();
  const [filter, setFilter]       = useState('all');
  const [exporting, setExporting] = useState(false);
  const [favoriteRouteIds, setFavoriteRouteIds] = useState(new Set());

  const loadFavs = useCallback(async () => {
    try {
      const data = await getFavoriteRoutes();
      const list = Array.isArray(data) ? data : [];
      setFavoriteRouteIds(new Set(list.map((f) => f.route_id)));
    } catch { /* best-effort */ }
  }, []);

  useEffect(() => { loadFavs(); }, [loadFavs]);

  const toggleFavorite = useCallback(async (routeId) => {
    if (!routeId) return;
    const isFav = favoriteRouteIds.has(routeId);
    setFavoriteRouteIds((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(routeId) : next.add(routeId);
      return next;
    });
    try {
      if (isFav) await removeFavoriteRoute(routeId);
      else await addFavoriteRoute(routeId);
    } catch { loadFavs(); }
  }, [favoriteRouteIds, loadFavs]);

  // Refresh from DB every time this screen comes into focus
  useEffect(() => {
    const unsub = navigation.addListener('focus', refreshBookings);
    return unsub;
  }, [navigation, refreshBookings]);

  const filtered = (bookings || []).filter(b => filter === 'all' || b.status === filter);

  // ── PDF Export ────────────────────────────────────────────────────────────
  const handleExportPdf = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const rows = filtered.map((b, i) => {
        const isTaxi = b.type === 'taxi';
        const seatCell = isTaxi ? 'Taxi' : b.seats?.length > 1 ? `${b.seats.length} Seats` : (b.seatId || '—');
        const priceCell = isTaxi ? '—' : fmtMoney(parseFloat(b.price || 0));
        return `
        <tr style="background:${i % 2 === 0 ? '#F8FAFC' : '#FFFFFF'}">
          <td>${b.bus?.name || '—'}</td>
          <td>${b.bus?.origin || '—'} → ${b.bus?.destination || '—'}</td>
          <td>${formatDateTime(b.date)}</td>
          <td>${seatCell}</td>
          <td style="color:#7C3AED;font-weight:700">${priceCell}</td>
          <td>
            <span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;
              background:${b.status === 'completed' ? '#DCFCE7' : b.status === 'upcoming' ? '#EDE9FE' : '#FEE2E2'};
              color:${b.status === 'completed' ? '#16A34A' : b.status === 'upcoming' ? '#7C3AED' : '#DC2626'}">
              ${b.status.charAt(0).toUpperCase() + b.status.slice(1)}
            </span>
          </td>
        </tr>`;
      }).join('');

      const total = filtered
        .filter(b => b.status !== 'cancelled' && b.type !== 'taxi')
        .reduce((s, b) => s + parseFloat(b.price || 0), 0);

      const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', sans-serif; color: #1E293B; background: #fff; }
  .hdr { background: linear-gradient(135deg,#4C1D95,#7C3AED); color: #fff; padding: 28px 32px; }
  .logo { font-size: 22px; font-weight: 900; letter-spacing: 1px; margin-bottom: 4px; }
  .subtitle { font-size: 13px; opacity: .75; }
  .meta { margin-top: 12px; font-size: 12px; opacity: .8; }
  .body { padding: 24px 32px; }
  .summary { display: flex; gap: 16px; margin-bottom: 24px; }
  .stat { background: #F5F3FF; border-radius: 10px; padding: 14px 18px; flex: 1; }
  .stat-num { font-size: 24px; font-weight: 800; color: #7C3AED; }
  .stat-lbl { font-size: 11px; color: #64748B; margin-top: 2px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #1E293B; color: #fff; padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
  td { padding: 10px 12px; border-bottom: 1px solid #E2E8F0; }
  .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #94A3B8; }
</style>
</head>
<body>
<div class="hdr">
  <div class="logo">🚌 YALLA TRANSIT</div>
  <div class="subtitle">Trip History Report</div>
  <div class="meta">Passenger: ${user?.name || 'Passenger'} &nbsp;·&nbsp; Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} &nbsp;·&nbsp; Filter: ${filter.charAt(0).toUpperCase() + filter.slice(1)}</div>
</div>
<div class="body">
  <div class="summary">
    <div class="stat"><div class="stat-num">${filtered.length}</div><div class="stat-lbl">Trips Shown</div></div>
    <div class="stat"><div class="stat-num">${filtered.filter(b=>b.status==='completed').length}</div><div class="stat-lbl">Completed</div></div>
    <div class="stat"><div class="stat-num">${fmtMoney(total)}</div><div class="stat-lbl">Total Spent</div></div>
  </div>
  <table>
    <thead><tr><th>Bus</th><th>Route</th><th>Date & Time</th><th>Seat</th><th>Fare</th><th>Status</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#94A3B8;padding:20px">No trips found</td></tr>'}</tbody>
  </table>
  <div class="footer">Yalla Transit — Official Trip History &nbsp;·&nbsp; Document generated automatically</div>
</div>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Save Trip History PDF',
        UTI: 'com.adobe.pdf',
      });
    } catch {
      Alert.alert('Export failed', 'Could not generate the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [filtered, filter, user, exporting]);

  const handleCancel = (booking) => {
    const isTaxi = booking.type === 'taxi';
    const subject = isTaxi
      ? `taxi from ${booking.bus?.origin} to ${booking.bus?.destination}`
      : `seat ${booking.seatId} on ${booking.bus?.name}`;
    const refundLine = !isTaxi && booking.price > 0
      ? `\n\n${fmtMoney(booking.price)} will be refunded.`
      : '';
    Alert.alert(
      'Cancel Booking',
      `Cancel ${subject}?${refundLine}`,
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            const result = await cancelBooking(booking._id);
            if (!result?.ok) {
              Alert.alert('Cancellation Failed', result?.error || 'Could not cancel this booking. Please try again.');
              return;
            }
            if (!isTaxi && result.refund > 0) {
              Alert.alert('Cancelled', `${fmtMoney(result.refund)} refunded to your wallet.`);
            } else {
              Alert.alert('Cancelled', 'Reservation has been cancelled.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item, index }) => {
    const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.upcoming;
    const isTaxi = item.type === 'taxi';
    const iconName = isTaxi ? 'car-sport' : 'bus';
    const iconColor = isTaxi ? COLORS.warning : PURPLE.primary;
    const iconBg = isTaxi ? COLORS.warningLight : PURPLE.light;

    const seatLabel = isTaxi
      ? 'Taxi'
      : item.seats?.length > 1
        ? `${item.seats.length} Seats`
        : `Seat ${item.seatId || item.seats?.[0] || '—'}`;

    return (
      <FadeInView index={index}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={[styles.busIconWrap, { backgroundColor: iconBg }]}>
              <Ionicons name={iconName} size={18} color={iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.busName}>{item.bus?.name}</Text>
              <Text style={styles.tripDate}>{formatDateTime(item.date)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
              <Ionicons name={st.icon} size={12} color={st.text} />
              <Text style={[styles.statusText, { color: st.text }]}>
                {t((item.status || 'upcoming').charAt(0).toUpperCase() + (item.status || 'upcoming').slice(1))}
              </Text>
            </View>
          </View>

          {/* Route — vertical timeline, wraps gracefully for long taxi addresses */}
          <View style={styles.routeBlock}>
            <View style={styles.rail}>
              <View style={styles.dotGreen} />
              <View style={styles.railLine} />
              <View style={[styles.dotGreen, { backgroundColor: COLORS.danger }]} />
            </View>
            <View style={styles.routeTextCol}>
              <View>
                <Text style={styles.routeLabel}>FROM</Text>
                <Text style={styles.routeText} numberOfLines={2}>{item.bus?.origin || '—'}</Text>
              </View>
              <View>
                <Text style={styles.routeLabel}>TO</Text>
                <Text style={styles.routeText} numberOfLines={2}>{item.bus?.destination || '—'}</Text>
              </View>
            </View>
          </View>

          {/* Pills */}
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Ionicons
                name={isTaxi ? 'car-sport-outline' : 'ticket-outline'}
                size={12}
                color={isTaxi ? COLORS.warning : PURPLE.primary}
              />
              <Text style={[styles.pillText, isTaxi && { color: COLORS.warning }]}>{seatLabel}</Text>
            </View>
            {!isTaxi && (
              <View style={styles.pill}>
                <Ionicons name="cash-outline" size={12} color={PURPLE.primary} />
                <Text style={styles.pillText}>{fmtMoney(item.price)}</Text>
              </View>
            )}
            {isTaxi && item.scheduledFor && item.scheduledFor !== 'Now' && (
              <View style={styles.pill}>
                <Ionicons name="time-outline" size={12} color={PURPLE.primary} />
                <Text style={styles.pillText}>{item.scheduledFor}</Text>
              </View>
            )}
            {!isTaxi && item.bus?.duration && (
              <View style={styles.pill}>
                <Ionicons name="time-outline" size={12} color={PURPLE.primary} />
                <Text style={styles.pillText}>{item.bus.duration}</Text>
              </View>
            )}
            {!isTaxi && item.bus?.schedule_recurrence && (
              <View style={[styles.pill, { backgroundColor: COLORS.secondaryLight }]}>
                <Ionicons name="repeat-outline" size={12} color={COLORS.secondary} />
                <Text style={[styles.pillText, { color: COLORS.secondary }]}>
                  {formatRecurrence(item.bus.schedule_recurrence)}
                </Text>
              </View>
            )}
            {!isTaxi && item.bus?.route_id && item.bus?.schedule_recurrence && (
              <TouchableOpacity
                style={[styles.pill, { backgroundColor: favoriteRouteIds.has(item.bus.route_id) ? '#FFEBEE' : COLORS.borderLight }]}
                onPress={() => toggleFavorite(item.bus.route_id)}
              >
                <Ionicons
                  name={favoriteRouteIds.has(item.bus.route_id) ? 'heart' : 'heart-outline'}
                  size={12}
                  color={favoriteRouteIds.has(item.bus.route_id) ? COLORS.danger : COLORS.textMuted}
                />
                <Text style={[styles.pillText, { color: favoriteRouteIds.has(item.bus.route_id) ? COLORS.danger : COLORS.textMuted }]}>
                  {favoriteRouteIds.has(item.bus.route_id) ? 'Saved' : 'Save Route'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Actions */}
          {item.status === 'upcoming' && (
            <View style={styles.actions}>
              {/* Both taxis and bus tickets have a viewable QR ticket */}
              <PressableScale
                style={styles.actionBtnBlue}
                onPress={() => navigation.navigate('HomeStack', { screen: 'Ticket', params: { booking: item } })}
              >
                <Ionicons name="ticket-outline" size={14} color={PURPLE.primary} />
                <Text style={styles.actionTextBlue}>{t('View Ticket')}</Text>
              </PressableScale>
              <PressableScale
                style={styles.actionBtnBlue}
                onPress={() => navigation.navigate('HomeStack', {
                  screen: 'BusTracking',
                  // Taxi tracking is driven by the reservation object (pickup /
                  // stops / dest coords), so pass the booking along.
                  params: isTaxi
                    ? { tripId: item.bus?._id, busName: item.bus?.name, booking: item }
                    : { tripId: item.bus?._id, busName: item.bus?.name },
                })}
              >
                <Ionicons name="navigate-outline" size={14} color={PURPLE.primary} />
                <Text style={styles.actionTextBlue}>{isTaxi ? t('Track Taxi') : t('Track Bus')}</Text>
              </PressableScale>
              <PressableScale style={styles.actionBtnRed} onPress={() => handleCancel(item)}>
                <Ionicons name="close-circle-outline" size={14} color={COLORS.danger} />
                <Text style={styles.actionTextRed}>{t('Cancel')}</Text>
              </PressableScale>
            </View>
          )}

          {item.status === 'completed' && (
            <View style={styles.actions}>
              <PressableScale
                style={styles.actionBtnBlue}
                onPress={() => navigation.navigate('HomeStack', { screen: 'Feedback', params: { booking: item } })}
              >
                <Ionicons name="star-outline" size={14} color={COLORS.warning} />
                <Text style={[styles.actionTextBlue, { color: COLORS.warning }]}>{t('Rate')}</Text>
              </PressableScale>
              <PressableScale
                style={[styles.actionBtnBlue, { backgroundColor: COLORS.dangerLight }]}
                onPress={() => navigation.navigate('HomeStack', { screen: 'Complaint', params: { booking: item } })}
              >
                <Ionicons name="flag-outline" size={14} color={COLORS.danger} />
                <Text style={[styles.actionTextBlue, { color: COLORS.danger }]}>{t('Complaint')}</Text>
              </PressableScale>
            </View>
          )}

          {item.status === 'cancelled' && (
            <View style={styles.refundRow}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.secondary} />
              <Text style={styles.refundText}>
                {!isTaxi && item.price > 0
                  ? `${fmtMoney(item.price)} refunded to wallet`
                  : 'Reservation cancelled'}
              </Text>
            </View>
          )}
        </View>
      </FadeInView>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* Gradient header */}
      <View style={styles.hero}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill id="tripHero" colors={PURPLE.gradient} vertical />
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />
        </View>

        <View style={[styles.pageHeader, { paddingTop: insets.top + 8 }]}>
          {navigation?.canGoBack() ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={22} color={COLORS.white} />
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>{t('My Trips')}</Text>
            <Text style={styles.pageSubtitle}>{(bookings || []).length} {t('bookings total')}</Text>
          </View>
          <PressableScale
            style={[styles.exportBtn, (exporting || filtered.length === 0) && { opacity: 0.5 }]}
            onPress={handleExportPdf}
            disabled={exporting || filtered.length === 0}
          >
            <Ionicons name={exporting ? 'hourglass-outline' : 'download-outline'} size={16} color={COLORS.white} />
            <Text style={styles.exportBtnText}>{exporting ? 'Exporting…' : t('Export')}</Text>
          </PressableScale>
        </View>

        {/* Filters — horizontally scrollable so no pill ever gets clipped */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map(f => (
            <PressableScale
              key={f.key}
              style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
              onPress={() => setFilter(f.key)}
              scaleTo={0.92}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {t(f.label)}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i._id}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState icon="time-outline" title="No trips found" message="Your bookings will appear here." tint={PURPLE.primary} tintBg={PURPLE.light} tintGlow={PURPLE.glow} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Hero */
  hero: {
    backgroundColor: PURPLE.deep, // solid fallback so no white shows before/around the SVG gradient
    overflow: 'hidden',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingBottom: 6,
  },
  heroDecor1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -50,
  },
  heroDecor2: {
    position: 'absolute', width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: -10, left: -30,
  },

  /* Header */
  pageHeader: {
    paddingHorizontal: 16, paddingBottom: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle: { fontSize: 24, fontWeight: '900', color: COLORS.white, letterSpacing: -0.3 },
  pageSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: '500' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  exportBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  /* Filters */
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16,
    paddingVertical: 12, gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  filterBtnActive: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  filterText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  filterTextActive: { color: PURPLE.dark },

  /* Card */
  card: {
    backgroundColor: COLORS.white, borderRadius: 20,
    padding: 16, marginBottom: 12,
    shadowColor: PURPLE.deep, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  busIconWrap: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: PURPLE.light,
    alignItems: 'center', justifyContent: 'center',
  },
  busName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.2 },
  tripDate: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  /* Route — vertical timeline */
  routeBlock: {
    flexDirection: 'row', gap: 12,
    marginBottom: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rail: { width: 10, alignItems: 'center', paddingTop: 5 },
  railLine: { width: 2, flex: 1, minHeight: 18, backgroundColor: COLORS.border, marginVertical: 4, borderRadius: 1 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.secondary },
  routeTextCol: { flex: 1, gap: 14 },
  routeLabel: {
    fontSize: 9, fontWeight: '800', color: COLORS.textMuted,
    letterSpacing: 0.7, marginBottom: 2,
  },
  routeText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 18 },

  /* Pills */
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: PURPLE.light, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  pillText: { fontSize: 12, fontWeight: '700', color: PURPLE.primary },

  /* Actions */
  actions: { flexDirection: 'row', gap: 8 },
  actionBtnBlue: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, backgroundColor: PURPLE.light, borderRadius: 12, paddingVertical: 10,
  },
  actionTextBlue: { fontSize: 13, fontWeight: '700', color: PURPLE.primary },
  actionBtnRed: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, backgroundColor: COLORS.dangerLight, borderRadius: 12, paddingVertical: 10,
  },
  actionTextRed: { fontSize: 13, fontWeight: '700', color: COLORS.danger },
  refundRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.secondaryLight, borderRadius: 12, padding: 10,
  },
  refundText: { fontSize: 13, color: COLORS.secondary, fontWeight: '700' },
});

export default TripHistoryScreen;
