import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, Platform, StatusBar,
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
  upcoming:  { bg: COLORS.primaryMid,     text: COLORS.primary,    icon: 'time-outline'          },
  completed: { bg: COLORS.secondaryLight, text: COLORS.secondary,  icon: 'checkmark-circle'      },
  cancelled: { bg: COLORS.dangerLight,    text: COLORS.danger,     icon: 'close-circle'          },
};

const TripHistoryScreen = ({ navigation }) => {
  const headerInsets = useHeaderInsets();
  const { bookings, cancelBooking } = useApp();
  const { user } = useAuth();
  const [filter, setFilter]       = useState('all');
  const [exporting, setExporting] = useState(false);

  const filtered = (bookings || []).filter(b => filter === 'all' || b.status === filter);

  // ── PDF Export ────────────────────────────────────────────────────────────
  const handleExportPdf = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const rows = filtered.map((b, i) => `
        <tr style="background:${i % 2 === 0 ? '#F8FAFC' : '#FFFFFF'}">
          <td>${b.bus?.name || '—'}</td>
          <td>${b.bus?.origin || '—'} → ${b.bus?.destination || '—'}</td>
          <td>${formatDateTime(b.date)}</td>
          <td>${b.seatId || '—'}</td>
          <td style="color:#2563EB;font-weight:700">$${parseFloat(b.price || 0).toFixed(2)}</td>
          <td>
            <span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;
              background:${b.status === 'completed' ? '#DCFCE7' : b.status === 'upcoming' ? '#DBEAFE' : '#FEE2E2'};
              color:${b.status === 'completed' ? '#16A34A' : b.status === 'upcoming' ? '#2563EB' : '#DC2626'}">
              ${b.status.charAt(0).toUpperCase() + b.status.slice(1)}
            </span>
          </td>
        </tr>`).join('');

      const total = filtered
        .filter(b => b.status !== 'cancelled')
        .reduce((s, b) => s + parseFloat(b.price || 0), 0);

      const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
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
    <div class="stat"><div class="stat-num">$${total.toFixed(2)}</div><div class="stat-lbl">Total Spent</div></div>
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
    Alert.alert(
      'Cancel Booking',
      `Cancel seat ${booking.seatId} on ${booking.bus?.name}?\n\n$${booking.price?.toFixed(2)} will be refunded.`,
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => {
            cancelBooking(booking._id);
            Alert.alert('Cancelled', `$${booking.price?.toFixed(2)} refunded to your wallet.`);
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.upcoming;
    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.busIconWrap}>
            <Ionicons name="bus" size={18} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.busName}>{item.bus?.name}</Text>
            <Text style={styles.tripDate}>{formatDateTime(item.date)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Ionicons name={st.icon} size={12} color={st.text} />
            <Text style={[styles.statusText, { color: st.text }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
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

        {/* Pills */}
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Ionicons name="ticket-outline" size={12} color={COLORS.primary} />
            <Text style={styles.pillText}>Seat {item.seatId}</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="cash-outline" size={12} color={COLORS.primary} />
            <Text style={styles.pillText}>${item.price?.toFixed(2)}</Text>
          </View>
          {item.bus?.duration && (
            <View style={styles.pill}>
              <Ionicons name="time-outline" size={12} color={COLORS.primary} />
              <Text style={styles.pillText}>{item.bus.duration}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        {item.status === 'upcoming' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtnBlue}
              onPress={() => navigation.navigate('HomeStack', { screen: 'BusTracking', params: { busId: item.bus?._id || 'bus1', busName: item.bus?.name } })}
            >
              <Ionicons name="navigate-outline" size={14} color={COLORS.primary} />
              <Text style={styles.actionTextBlue}>Track Bus</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnRed} onPress={() => handleCancel(item)}>
              <Ionicons name="close-circle-outline" size={14} color={COLORS.danger} />
              <Text style={styles.actionTextRed}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'completed' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtnBlue}
              onPress={() => navigation.navigate('HomeStack', { screen: 'Feedback', params: { booking: item } })}
            >
              <Ionicons name="star-outline" size={14} color={COLORS.warning} />
              <Text style={[styles.actionTextBlue, { color: COLORS.warning }]}>Rate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtnBlue, { backgroundColor: COLORS.dangerLight }]}
              onPress={() => navigation.navigate('HomeStack', { screen: 'Complaint', params: { booking: item } })}
            >
              <Ionicons name="flag-outline" size={14} color={COLORS.danger} />
              <Text style={[styles.actionTextBlue, { color: COLORS.danger }]}>Complaint</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'cancelled' && (
          <View style={styles.refundRow}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.secondary} />
            <Text style={styles.refundText}>${item.price?.toFixed(2)} refunded to wallet</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={[styles.pageHeader, headerInsets]}>
        <View>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Header */
  pageHeader: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20, paddingBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  pageTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.3 },
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
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  filterTextActive: { color: COLORS.white },

  /* Card */
  card: {
    backgroundColor: COLORS.white, borderRadius: 20,
    padding: 16, marginBottom: 12,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  busIconWrap: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  busName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.2 },
  tripDate: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  /* Route */
  routeRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  routePoint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeLineMid: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  routeLineInner: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.secondary },
  routeText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },

  /* Pills */
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primaryLight, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  pillText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  /* Actions */
  actions: { flexDirection: 'row', gap: 8 },
  actionBtnBlue: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, backgroundColor: COLORS.primaryLight, borderRadius: 12, paddingVertical: 10,
  },
  actionTextBlue: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  actionBtnRed: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, backgroundColor: COLORS.dangerLight, borderRadius: 12, paddingVertical: 10,
  },
  actionTextRed: { fontSize: 13, fontWeight: '700', color: COLORS.danger },
  rateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: COLORS.warningLight, borderRadius: 12, paddingVertical: 10,
  },
  rateText: { fontSize: 13, fontWeight: '700', color: COLORS.warning },
  refundRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.secondaryLight, borderRadius: 12, padding: 10,
  },
  refundText: { fontSize: 13, color: COLORS.secondary, fontWeight: '700' },
});

export default TripHistoryScreen;
