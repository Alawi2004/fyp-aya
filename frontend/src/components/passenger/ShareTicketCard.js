import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PURPLE } from '../../constants/colors';
import { formatDateTime } from '../../utils/formatters';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  upcoming:  { label: 'CONFIRMED',  bg: '#DCFCE7', color: '#16A34A', dot: '#16A34A' },
  confirmed: { label: 'CONFIRMED',  bg: '#DCFCE7', color: '#16A34A', dot: '#16A34A' },
  completed: { label: 'USED',       bg: '#E0E7FF', color: '#4F46E5', dot: '#4F46E5' },
  cancelled: { label: 'CANCELLED',  bg: '#FEE2E2', color: '#DC2626', dot: '#DC2626' },
  boarding:  { label: 'BOARDING',   bg: '#FEF9C3', color: '#CA8A04', dot: '#CA8A04' },
  default:   { label: 'CONFIRMED',  bg: '#DCFCE7', color: '#16A34A', dot: '#16A34A' },
};

// ── Perforated tear-line ───────────────────────────────────────────────────────
const TearLine = ({ isDark }) => (
  <View style={styles.tearRow}>
    <View style={[styles.tearCircle, styles.tearLeft,  isDark && styles.tearCircleDark]} />
    <View style={styles.tearDashes}>
      {Array.from({ length: 18 }).map((_, i) => (
        <View
          key={i}
          style={[styles.tearDash, isDark && { backgroundColor: 'rgba(255,255,255,0.18)' }]}
        />
      ))}
    </View>
    <View style={[styles.tearCircle, styles.tearRight, isDark && styles.tearCircleDark]} />
  </View>
);

// ── Single detail cell ────────────────────────────────────────────────────────
const DetailCell = ({ label, value, accent, isDark }) => (
  <View style={styles.cell}>
    <Text style={[styles.cellLabel, isDark && { color: 'rgba(255,255,255,0.45)' }]}>{label}</Text>
    <Text
      style={[
        styles.cellValue,
        isDark && { color: COLORS.white },
        accent && { color: accent },
      ]}
      numberOfLines={1}
    >
      {value || '—'}
    </Text>
  </View>
);

// ── Main card ─────────────────────────────────────────────────────────────────
const ShareTicketCard = React.forwardRef(
  ({ booking, ticket, passengerName, boardingQr, shareUrl, isDark = false }, ref) => {
    const status  = booking?.status ?? 'upcoming';
    const cfg     = STATUS_CFG[status] ?? STATUS_CFG.default;
    const bus     = booking?.bus ?? {};
    const qrValue = boardingQr || shareUrl || `yallatransit://ticket/${booking?._id ?? 'demo'}`;

    const bg    = isDark ? '#0F172A' : COLORS.white;
    const body  = isDark ? '#1E293B' : COLORS.background;
    const txPri = isDark ? COLORS.white : COLORS.textPrimary;
    const txSec = isDark ? 'rgba(255,255,255,0.55)' : COLORS.textSecondary;
    const bdr   = isDark ? 'rgba(255,255,255,0.08)' : COLORS.border;

    return (
      <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: bg }]}>

        {/* ── Branded header ── */}
        <View style={styles.header}>
          {/* Decorative circles */}
          <View style={styles.headerDecor1} />
          <View style={styles.headerDecor2} />

          <View style={styles.headerRow}>
            <View style={styles.logoWrap}>
              <Ionicons name="bus" size={22} color={COLORS.white} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.brandName}>YALLA TRANSIT</Text>
              <Text style={styles.brandTagline}>Official Digital Ticket</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.color + '55' }]}>
              <View style={[styles.statusDot, { backgroundColor: cfg.dot }]} />
              <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>
        </View>

        {/* ── Route section ── */}
        <View style={[styles.routeSection, { backgroundColor: body }]}>
          <View style={styles.busNameRow}>
            <Ionicons name="bus-outline" size={16} color={PURPLE.primary} />
            <Text style={[styles.busName, { color: txPri }]}>{bus.name || 'Express Service'}</Text>
            {bus.route ? (
              <View style={[styles.routePill, { borderColor: bdr }]}>
                <Text style={[styles.routePillText, { color: txSec }]}>{bus.route}</Text>
              </View>
            ) : null}
          </View>

          {/* FROM → TO */}
          <View style={styles.routeRow}>
            <View style={styles.routeStop}>
              <Text style={[styles.stopCity, { color: txPri }]} numberOfLines={1}>
                {bus.origin || '—'}
              </Text>
              <Text style={[styles.stopTime, { color: PURPLE.primary }]}>
                {bus.departureTime || '—'}
              </Text>
              <Text style={[styles.stopLabel, { color: txSec }]}>DEPARTURE</Text>
            </View>

            <View style={styles.routeMid}>
              <View style={[styles.routeLine, { backgroundColor: bdr }]} />
              <View style={styles.routeChip}>
                <Ionicons name="time-outline" size={11} color={txSec} />
                <Text style={[styles.routeDuration, { color: txSec }]}>
                  {bus.duration || '—'}
                </Text>
              </View>
              <View style={[styles.routeLine, { backgroundColor: bdr }]} />
              <View style={[styles.arrowHead, { borderLeftColor: COLORS.primary }]} />
            </View>

            <View style={[styles.routeStop, { alignItems: 'flex-end' }]}>
              <Text style={[styles.stopCity, { color: txPri }]} numberOfLines={1}>
                {bus.destination || '—'}
              </Text>
              <Text style={[styles.stopTime, { color: PURPLE.primary }]}>
                {bus.arrivalTime || '—'}
              </Text>
              <Text style={[styles.stopLabel, { color: txSec }]}>ARRIVAL</Text>
            </View>
          </View>
        </View>

        {/* ── Tear line ── */}
        <TearLine isDark={isDark} />

        {/* ── Passenger detail grid ── */}
        <View style={[styles.detailSection, { backgroundColor: bg }]}>
          <View style={styles.detailGrid}>
            <DetailCell label="PASSENGER" value={passengerName || 'Passenger'} isDark={isDark} />
            <DetailCell label="SEAT"      value={ticket?.seat_number ?? booking?.seatId}              isDark={isDark} accent={PURPLE.primary} />
            <DetailCell
              label="DATE"
              value={booking?.date
                ? new Date(booking.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'}
              isDark={isDark}
            />
            <DetailCell label="FARE"   value={`$${parseFloat(ticket?.amount ?? booking?.price ?? 0).toFixed(2)}`} isDark={isDark} />
          </View>

          {/* Ticket / Booking ID */}
          <View style={[styles.bookingIdRow, { borderColor: bdr }]}>
            <Ionicons name="barcode-outline" size={14} color={txSec} />
            <Text style={[styles.bookingIdLabel, { color: txSec }]}>TICKET ID</Text>
            <Text style={[styles.bookingIdValue, { color: txPri }]}>#{ticket?.ticket_id ?? booking?._id ?? 'N/A'}</Text>
          </View>
        </View>

        {/* ── Second tear line ── */}
        <TearLine isDark={isDark} />

        {/* ── QR section ── */}
        <View style={[styles.qrSection, { backgroundColor: isDark ? '#1E293B' : COLORS.background }]}>
          <Text style={[styles.qrTitle, { color: txSec }]}>
            Scan to board
          </Text>

          <View style={[styles.qrFrame, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : COLORS.border }]}>
            <View style={styles.qrInner}>
              <QRCode
                value={qrValue}
                size={140}
                color={isDark ? '#0F172A' : COLORS.textPrimary}
                backgroundColor={COLORS.white}
                quietZone={6}
              />
            </View>
          </View>

          <View style={styles.trackRow}>
            <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.secondary} />
            <Text style={[styles.trackText, { color: COLORS.secondary }]}>
              Valid boarding pass · Show this QR to board
            </Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={[styles.footer, { backgroundColor: isDark ? '#0B1120' : '#F1F5F9', borderTopColor: bdr }]}>
          <Ionicons name="lock-closed-outline" size={12} color={txSec} />
          <Text style={[styles.footerText, { color: txSec }]}>
            Secured by Yalla Transit · Valid for boarding only at listed stop
          </Text>
        </View>
      </View>
    );
  }
);

export default ShareTicketCard;

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },

  /* Header */
  header: {
    backgroundColor: PURPLE.primary,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  headerDecor1: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40,
  },
  headerDecor2: {
    position: 'absolute', width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.06)', bottom: -30, left: 60,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  logoWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  brandName: { fontSize: 15, fontWeight: '900', color: COLORS.white, letterSpacing: 1.2 },
  brandTagline: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginTop: 1 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  /* Route */
  routeSection: { paddingHorizontal: 18, paddingVertical: 16 },
  busNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  busName: { fontSize: 16, fontWeight: '800', flex: 1 },
  routePill: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  routePillText: { fontSize: 11, fontWeight: '600' },

  routeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  routeStop: { width: 100 },
  stopCity: { fontSize: 15, fontWeight: '800', marginBottom: 3 },
  stopTime: { fontSize: 18, fontWeight: '900', marginBottom: 2 },
  stopLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },

  routeMid: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingTop: 22 },
  routeLine: { flex: 1, height: 1.5 },
  routeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999, marginHorizontal: 4,
  },
  routeDuration: { fontSize: 10, fontWeight: '600' },
  arrowHead: {
    width: 0, height: 0,
    borderTopWidth: 5, borderBottomWidth: 5, borderLeftWidth: 8,
    borderTopColor: 'transparent', borderBottomColor: 'transparent',
    marginLeft: -4,
  },

  /* Tear line */
  tearRow: { flexDirection: 'row', alignItems: 'center', height: 24, overflow: 'visible' },
  tearCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.background, zIndex: 2,
  },
  tearCircleDark: { backgroundColor: '#0F172A' },
  tearLeft:  { marginLeft: -12 },
  tearRight: { marginRight: -12 },
  tearDashes: { flex: 1, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  tearDash: { width: 4, height: 1.5, backgroundColor: COLORS.border },

  /* Detail grid */
  detailSection: { paddingHorizontal: 18, paddingVertical: 16 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 14 },
  cell: { width: '44%', flexGrow: 1 },
  cellLabel: {
    fontSize: 9, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4,
  },
  cellValue: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },

  bookingIdRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderTopWidth: 1, paddingTop: 10,
  },
  bookingIdLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 },
  bookingIdValue: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  /* QR section */
  qrSection: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 18 },
  qrTitle: { fontSize: 12, fontWeight: '600', marginBottom: 14, letterSpacing: 0.2 },
  qrFrame: {
    borderRadius: 18, borderWidth: 1.5,
    padding: 12, backgroundColor: COLORS.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  qrInner: { borderRadius: 10, overflow: 'hidden' },
  trackRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14,
  },
  trackText: { fontSize: 12, fontWeight: '600' },

  /* Footer */
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 10,
    borderTopWidth: 1,
  },
  footerText: { flex: 1, fontSize: 10, fontWeight: '500', lineHeight: 14 },
});
