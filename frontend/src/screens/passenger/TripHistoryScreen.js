import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, Platform, StatusBar, Modal, ScrollView,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import EmptyState from '../../components/common/EmptyState';
import { COLORS } from '../../constants/colors';
import { formatDateTime } from '../../utils/formatters';

const FILTERS = [
  { key: 'all',       label: 'All'       },
  { key: 'upcoming',  label: 'Upcoming'  },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_CONFIG = {
  upcoming:  { bg: COLORS.primaryMid,     text: COLORS.primary,   icon: 'time-outline'     },
  completed: { bg: COLORS.secondaryLight, text: COLORS.secondary, icon: 'checkmark-circle' },
  cancelled: { bg: COLORS.dangerLight,    text: COLORS.danger,    icon: 'close-circle'     },
};

// ── Trip Detail Modal ─────────────────────────────────────────────────────────
function TripDetailModal({ item, visible, onClose, onCancel, navigation }) {
  if (!item) return null;

  const st      = STATUS_CONFIG[item.status] || STATUS_CONFIG.upcoming;
  const isTaxi  = item.type === 'taxi';
  const iconName  = isTaxi ? 'car-sport' : 'bus';
  const iconColor = isTaxi ? COLORS.warning : COLORS.primary;
  const iconBg    = isTaxi ? COLORS.warningLight : COLORS.primaryLight;

  const infoRows = [
    {
      icon: 'ticket-outline',
      label: 'Ticket',
      value: item.ticketRef || `TKT-${item._id}`,
      mono: true,
      color: COLORS.primary,
    },
    {
      icon: 'map-outline',
      label: 'Route',
      value: item.tripName || '—',
    },
    {
      icon: 'calendar-outline',
      label: 'Date & Time',
      value: formatDateTime(item.departureTime || item.date),
    },
    {
      icon: 'person-outline',
      label: 'Driver',
      value: item.driverName || '—',
    },
    {
      icon: 'bus-outline',
      label: 'Vehicle',
      value: [item.bus?.name, item.bus?.plate].filter(Boolean).join(' · ') || '—',
    },
    {
      icon: 'navigate-outline',
      label: 'From',
      value: item.bus?.origin || '—',
    },
    {
      icon: 'location-outline',
      label: 'To',
      value: item.bus?.destination || '—',
    },
    {
      icon: 'time-outline',
      label: 'Duration',
      value: item.bus?.duration || '—',
    },
    {
      icon: 'seat-outline',
      label: 'Seat',
      value: isTaxi ? 'Taxi' : `Seat ${item.seatId || item.seats?.[0] || '—'}`,
    },
    {
      icon: 'cash-outline',
      label: 'Fare',
      value: isTaxi ? '—' : `$${parseFloat(item.price || 0).toFixed(2)}`,
      color: COLORS.secondary,
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        <View style={styles.modalSheet}>
        {/* Handle */}
        <View style={styles.sheetHandle} />

        {/* Title row */}
        <View style={styles.sheetHeader}>
          <View style={[styles.sheetIconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name={iconName} size={20} color={iconColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>{item.tripName || item.bus?.name || 'Trip'}</Text>
            <Text style={styles.sheetSub}>
              {item.bus?.origin} → {item.bus?.destination}
            </Text>
          </View>
          <View style={[styles.sheetStatusBadge, { backgroundColor: st.bg }]}>
            <Ionicons name={st.icon} size={12} color={st.text} />
            <Text style={[styles.sheetStatusText, { color: st.text }]}>
              {(item.status || 'upcoming').charAt(0).toUpperCase() + (item.status || 'upcoming').slice(1)}
            </Text>
          </View>
        </View>

        {/* Info rows */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.sheetBody}
          showsVerticalScrollIndicator={false}
        >
          {infoRows.map((row, i) => (
            <View
              key={row.label}
              style={[styles.detailRow, i === infoRows.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={styles.detailLabelWrap}>
                <Ionicons name={row.icon} size={15} color={COLORS.textMuted} />
                <Text style={styles.detailLabel}>{row.label}</Text>
              </View>
              <Text style={[
                styles.detailValue,
                row.mono  && styles.detailValueMono,
                row.color && { color: row.color },
              ]}>
                {row.value}
              </Text>
            </View>
          ))}

          {/* Actions */}
          <View style={styles.sheetActions}>
            {item.status === 'upcoming' && !isTaxi && (
              <TouchableOpacity
                style={styles.sheetBtnBlue}
                onPress={() => {
                  onClose();
                  navigation.navigate('HomeStack', { screen: 'Ticket', params: { booking: item } });
                }}
              >
                <Ionicons name="ticket-outline" size={15} color={COLORS.primary} />
                <Text style={styles.sheetBtnBlueText}>View Ticket</Text>
              </TouchableOpacity>
            )}
            {item.status === 'upcoming' && !isTaxi && (
              <TouchableOpacity
                style={styles.sheetBtnBlue}
                onPress={() => {
                  onClose();
                  navigation.navigate('HomeStack', { screen: 'BusTracking', params: { tripId: item.bus?._id, busName: item.bus?.name } });
                }}
              >
                <Ionicons name="navigate-outline" size={15} color={COLORS.primary} />
                <Text style={styles.sheetBtnBlueText}>Track Bus</Text>
              </TouchableOpacity>
            )}
            {item.status === 'upcoming' && (
              <TouchableOpacity style={styles.sheetBtnRed} onPress={() => { onClose(); onCancel(item); }}>
                <Ionicons name="close-circle-outline" size={15} color={COLORS.danger} />
                <Text style={styles.sheetBtnRedText}>Cancel Booking</Text>
              </TouchableOpacity>
            )}
            {item.status === 'completed' && (
              <TouchableOpacity
                style={styles.sheetBtnYellow}
                onPress={() => {
                  onClose();
                  navigation.navigate('HomeStack', { screen: 'Feedback', params: { booking: item } });
                }}
              >
                <Ionicons name="star-outline" size={15} color={COLORS.warning} />
                <Text style={styles.sheetBtnYellowText}>Rate this trip</Text>
              </TouchableOpacity>
            )}
            {item.status === 'completed' && (
              <TouchableOpacity
                style={[styles.sheetBtnBlue, { backgroundColor: COLORS.dangerLight }]}
                onPress={() => {
                  onClose();
                  navigation.navigate('HomeStack', { screen: 'Complaint', params: { booking: item } });
                }}
              >
                <Ionicons name="flag-outline" size={15} color={COLORS.danger} />
                <Text style={[styles.sheetBtnBlueText, { color: COLORS.danger }]}>File Complaint</Text>
              </TouchableOpacity>
            )}
            {item.status === 'cancelled' && (
              <View style={styles.sheetRefundRow}>
                <Ionicons name="checkmark-circle" size={15} color={COLORS.secondary} />
                <Text style={styles.sheetRefundText}>
                  {!isTaxi && item.price > 0
                    ? `$${parseFloat(item.price).toFixed(2)} refunded to wallet`
                    : 'Reservation cancelled'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
const TripHistoryScreen = ({ navigation }) => {
  const headerInsets = useHeaderInsets();
  const { bookings, cancelBooking, refreshBookings } = useApp();
  const { user } = useAuth();
  const [filter,    setFilter]    = useState('all');
  const [exporting, setExporting] = useState(false);
  const [selected,  setSelected]  = useState(null);

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
        const seatCell  = isTaxi ? 'Taxi' : b.seats?.length > 1 ? `${b.seats.length} Seats` : (b.seatId || '—');
        const priceCell = isTaxi ? '—' : `$${parseFloat(b.price || 0).toFixed(2)}`;
        return `
        <tr style="background:${i % 2 === 0 ? '#F8FAFC' : '#FFFFFF'}">
          <td>${b.tripName || b.bus?.name || '—'}</td>
          <td>${b.bus?.origin || '—'} → ${b.bus?.destination || '—'}</td>
          <td>${formatDateTime(b.departureTime || b.date)}</td>
          <td>${b.driverName || '—'}</td>
          <td>${b.bus?.plate || b.bus?.name || '—'}</td>
          <td>${seatCell}</td>
          <td style="color:#2563EB;font-weight:700">${priceCell}</td>
          <td>
            <span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;
              background:${b.status === 'completed' ? '#DCFCE7' : b.status === 'upcoming' ? '#DBEAFE' : '#FEE2E2'};
              color:${b.status === 'completed' ? '#16A34A' : b.status === 'upcoming' ? '#2563EB' : '#DC2626'}">
              ${b.status.charAt(0).toUpperCase() + b.status.slice(1)}
            </span>
          </td>
        </tr>`;
      }).join('');

      const total = filtered
        .filter(b => b.status !== 'cancelled' && b.type !== 'taxi')
        .reduce((s, b) => s + parseFloat(b.price || 0), 0);

      const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', sans-serif; color: #1E293B; background: #fff; }
  .hdr { background: linear-gradient(135deg,#1D4ED8,#2563EB); color: #fff; padding: 28px 32px; }
  .logo { font-size: 22px; font-weight: 900; letter-spacing: 1px; margin-bottom: 4px; }
  .subtitle { font-size: 13px; opacity: .75; }
  .meta { margin-top: 12px; font-size: 12px; opacity: .8; }
  .body { padding: 24px 32px; }
  .summary { display: flex; gap: 16px; margin-bottom: 24px; }
  .stat { background: #F1F5F9; border-radius: 10px; padding: 14px 18px; flex: 1; }
  .stat-num { font-size: 24px; font-weight: 800; color: #2563EB; }
  .stat-lbl { font-size: 11px; color: #64748B; margin-top: 2px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #1E293B; color: #fff; padding: 9px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
  td { padding: 9px 10px; border-bottom: 1px solid #E2E8F0; }
  .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #94A3B8; }
</style></head>
<body>
<div class="hdr">
  <div class="logo">🚌 YALLA TRANSIT</div>
  <div class="subtitle">Trip History Report</div>
  <div class="meta">Passenger: ${user?.name || 'Passenger'} &nbsp;·&nbsp; Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} &nbsp;·&nbsp; Filter: ${filter.charAt(0).toUpperCase() + filter.slice(1)}</div>
</div>
<div class="body">
  <div class="summary">
    <div class="stat"><div class="stat-num">${filtered.length}</div><div class="stat-lbl">Trips Shown</div></div>
    <div class="stat"><div class="stat-num">${filtered.filter(b => b.status === 'completed').length}</div><div class="stat-lbl">Completed</div></div>
    <div class="stat"><div class="stat-num">$${total.toFixed(2)}</div><div class="stat-lbl">Total Spent</div></div>
  </div>
  <table>
    <thead><tr><th>Route</th><th>From → To</th><th>Date</th><th>Driver</th><th>Vehicle</th><th>Seat</th><th>Fare</th><th>Status</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="8" style="text-align:center;color:#94A3B8;padding:20px">No trips found</td></tr>'}</tbody>
  </table>
  <div class="footer">Yalla Transit — Official Trip History &nbsp;·&nbsp; Document generated automatically</div>
</div></body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Save Trip History PDF', UTI: 'com.adobe.pdf' });
    } catch {
      Alert.alert('Export failed', 'Could not generate the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [filtered, filter, user, exporting]);

  const handleCancel = (booking) => {
    const isTaxi   = booking.type === 'taxi';
    const subject  = isTaxi
      ? `taxi from ${booking.bus?.origin} to ${booking.bus?.destination}`
      : `seat ${booking.seatId} on ${booking.bus?.name}`;
    const refundLine = !isTaxi && booking.price > 0
      ? `\n\n$${booking.price?.toFixed(2)} will be refunded.`
      : '';
    Alert.alert(
      'Cancel Booking',
      `Cancel ${subject}?${refundLine}`,
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel', style: 'destructive',
          onPress: async () => {
            const result = await cancelBooking(booking._id);
            if (!result?.ok) {
              Alert.alert('Cancellation Failed', result?.error || 'Could not cancel this booking. Please try again.');
              return;
            }
            if (!isTaxi && result.refund > 0) {
              Alert.alert('Cancelled', `$${result.refund.toFixed(2)} refunded to your wallet.`);
            } else {
              Alert.alert('Cancelled', 'Reservation has been cancelled.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const st       = STATUS_CONFIG[item.status] || STATUS_CONFIG.upcoming;
    const isTaxi   = item.type === 'taxi';
    const iconName  = isTaxi ? 'car-sport' : 'bus';
    const iconColor = isTaxi ? COLORS.warning : COLORS.primary;
    const iconBg    = isTaxi ? COLORS.warningLight : COLORS.primaryLight;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setSelected(item)}
        activeOpacity={0.75}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.busIconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name={iconName} size={18} color={iconColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.busName}>{item.tripName || item.bus?.name}</Text>
            <Text style={styles.tripDate}>{formatDateTime(item.departureTime || item.date)}</Text>
            {item.bus?.name ? (
              <Text style={styles.vehicleName}>{item.bus.name}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
              <Ionicons name={st.icon} size={12} color={st.text} />
              <Text style={[styles.statusText, { color: st.text }]}>
                {(item.status || 'upcoming').charAt(0).toUpperCase() + (item.status || 'upcoming').slice(1)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
          </View>
        </View>

        {/* Route */}
        <View style={styles.routeRow}>
          <View style={styles.routePoint}>
            <View style={styles.dotGreen} />
            <Text style={styles.routeText}>{item.bus?.origin}</Text>
          </View>
          <View style={styles.routeLineMid}>
            <View style={styles.routeLineInner} />
            <Ionicons name="chevron-forward" size={12} color={COLORS.textMuted} />
            <View style={styles.routeLineInner} />
          </View>
          <View style={styles.routePoint}>
            <View style={[styles.dotGreen, { backgroundColor: COLORS.danger }]} />
            <Text style={styles.routeText}>{item.bus?.destination}</Text>
          </View>
        </View>

        {/* Quick info pills */}
        <View style={styles.pillRow}>
          {item.driverName ? (
            <View style={styles.pill}>
              <Ionicons name="person-outline" size={11} color={COLORS.primary} />
              <Text style={styles.pillText}>{item.driverName}</Text>
            </View>
          ) : null}
          {!isTaxi && (
            <View style={styles.pill}>
              <Ionicons name="ticket-outline" size={11} color={COLORS.primary} />
              <Text style={styles.pillText}>{item.ticketRef || `#${item._id}`}</Text>
            </View>
          )}
          {!isTaxi && (
            <View style={styles.pill}>
              <Ionicons name="cash-outline" size={11} color={COLORS.primary} />
              <Text style={styles.pillText}>${parseFloat(item.price || 0).toFixed(2)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.tapHint}>Tap for full trip details</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={[styles.pageHeader, headerInsets]}>
        {navigation?.canGoBack() ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>My Trips</Text>
          <Text style={styles.pageSubtitle}>{(bookings || []).length} bookings total</Text>
        </View>
        <TouchableOpacity
          style={[styles.exportBtn, exporting && { opacity: 0.55 }]}
          onPress={handleExportPdf}
          disabled={exporting || filtered.length === 0}
        >
          <Ionicons name={exporting ? 'hourglass-outline' : 'download-outline'} size={16} color={COLORS.primary} />
          <Text style={styles.exportBtnText}>{exporting ? 'Exporting…' : 'Export PDF'}</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
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

      <FlatList
        data={filtered}
        keyExtractor={i => i._id}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState icon="time-outline" title="No trips found" message="Your bookings will appear here." />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      />

      <TripDetailModal
        item={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        onCancel={handleCancel}
        navigation={navigation}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Page header */
  pageHeader: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16, paddingBottom: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle:    { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.3 },
  pageSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primaryLight, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.primaryMid,
  },
  exportBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  /* Filters */
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16,
    paddingVertical: 12, gap: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, backgroundColor: COLORS.background,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  filterBtnActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText:        { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  filterTextActive:  { color: COLORS.white },

  /* Trip card */
  card: {
    backgroundColor: COLORS.white, borderRadius: 20,
    padding: 16, marginBottom: 12,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  busIconWrap: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  busName:     { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.2 },
  tripDate:    { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: '600' },
  vehicleName: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  routeRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  routePoint:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeLineMid:  { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  routeLineInner:{ flex: 1, height: 1, backgroundColor: COLORS.border },
  dotGreen:      { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.secondary },
  routeText:     { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },

  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primaryLight, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  pillText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  tapHint: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 },

  /* ── Detail modal ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  sheetIconWrap: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetTitle:       { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.2 },
  sheetSub:         { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },
  sheetStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  sheetStatusText:  { fontSize: 11, fontWeight: '700' },

  sheetBody: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },

  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  detailLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailLabel:     { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  detailValue:     { fontSize: 13, color: COLORS.textPrimary, fontWeight: '700', maxWidth: '58%', textAlign: 'right' },
  detailValueMono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: COLORS.primary,
  },

  sheetActions: { marginTop: 18, gap: 10 },
  sheetBtnBlue: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: COLORS.primaryLight,
    borderRadius: 14, paddingVertical: 13,
  },
  sheetBtnBlueText:   { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  sheetBtnRed: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: COLORS.dangerLight,
    borderRadius: 14, paddingVertical: 13,
  },
  sheetBtnRedText:    { fontSize: 14, fontWeight: '700', color: COLORS.danger },
  sheetBtnYellow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: COLORS.warningLight,
    borderRadius: 14, paddingVertical: 13,
  },
  sheetBtnYellowText: { fontSize: 14, fontWeight: '700', color: COLORS.warning },
  sheetRefundRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: COLORS.secondaryLight,
    borderRadius: 14, paddingVertical: 13,
  },
  sheetRefundText: { fontSize: 14, fontWeight: '700', color: COLORS.secondary },
});

export default TripHistoryScreen;
