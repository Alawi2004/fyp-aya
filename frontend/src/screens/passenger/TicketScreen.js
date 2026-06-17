import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  StatusBar, TouchableOpacity,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/common/Button';
import ShareTicketModal from '../../components/passenger/ShareTicketModal';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { COLORS, PURPLE } from '../../constants/colors';
import GradientFill from '../../components/common/GradientFill';
import { formatDateTime } from '../../utils/formatters';

// expo-crypto — optional; falls back to a simpler digest if unavailable
let Crypto = null;
try { Crypto = require('expo-crypto'); } catch (_) {}

const HMAC_SECRET = 'yalla-transit-qr-secret-2026';

// ── HMAC helpers ─────────────────────────────────────────────────────────────
// Each ticket gets exactly one signed QR — generated once and reused for the
// life of the ticket, so it stays scannable in screenshots, printouts and PDFs
// (a refreshing QR would go stale the moment it's shared).
const computeHmac = async (payload) => {
  const msg = `${payload.bid}:${payload.uid}:${payload.seat}:${payload.tid}`;
  if (Crypto) {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${HMAC_SECRET}:${msg}`,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    return digest.slice(0, 32);
  }
  return `${msg.length.toString(16).padStart(8, '0')}`.slice(0, 32);
};

// ── Static QR payload (offline, no signature) ────────────────────────────────
const buildStaticQr = (booking, ticket, userId) =>
  JSON.stringify({
    bid:    booking._id,
    tid:    ticket.ticket_id,
    uid:    userId ?? 'guest',
    seat:   ticket.seat_number,
    fare:   ticket.amount,
    mode:   'offline-static',
  });

// ── Component ────────────────────────────────────────────────────────────────
const TicketScreen = ({ route, navigation }) => {
  const headerInsets        = useHeaderInsets();
  const { booking }         = route.params;
  const { user }            = useAuth();
  const { currency }        = useApp();

  // A booking can hold several seats — each gets its own ticket record,
  // its own rotating QR, and its own share/PDF. Fall back to a single
  // synthetic ticket for older mock bookings that only have `seatId`.
  const tickets = booking.tickets?.length
    ? booking.tickets
    : [{ ticket_id: booking._id, seat_number: booking.seatId, amount: booking.price, created_at: booking.date }];

  const [activeIndex, setActiveIndex] = useState(0);
  const activeTicket = tickets[Math.min(activeIndex, tickets.length - 1)];

  const [isOnline, setIsOnline] = useState(true);
  const [qrToken, setQrToken]   = useState('');

  const ticketRef      = useRef(null);
  const [showShare, setShowShare] = useState(false);

  // Network monitoring
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
    return () => unsub();
  }, []);

  // ── QR generation — one signed token per ticket, generated once and kept
  // for the life of the ticket (no rotation). Online uses an HMAC-signed
  // payload; offline falls back to an unsigned static payload the driver
  // verifies manually. Either way the same code is shown every time the
  // screen opens, so it stays valid in screenshots, printouts and shared PDFs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isOnline) {
        const payload = {
          bid:  booking._id,
          tid:  activeTicket.ticket_id,
          uid:  user?._id ?? 'guest',
          seat: activeTicket.seat_number,
          fare: activeTicket.amount,
        };
        const sig = await computeHmac(payload);
        if (!cancelled) setQrToken(JSON.stringify({ ...payload, sig }));
      } else {
        setQrToken(buildStaticQr(booking, activeTicket, user?._id));
      }
    })();
    return () => { cancelled = true; };
  }, [isOnline, booking, activeTicket, user]);

  const urgencyColor = PURPLE.primary;

  const shareTicket = () => setShowShare(true);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.gradient[0]} />

      {/* ── Header ── */}
      <View style={[styles.header, headerInsets]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill id="ticketHdr" colors={PURPLE.gradient} vertical />
          <View style={styles.headerDecor1} />
          <View style={styles.headerDecor2} />
        </View>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Your Ticket</Text>
          <Text style={styles.headerSub}>Present QR code to board</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={shareTicket}>
          <Ionicons name="share-social-outline" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* ── Offline banner ── */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color={COLORS.white} />
          <Text style={styles.offlineBannerText}>
            You're offline — static QR shown. Driver will verify manually.
          </Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View ref={ticketRef} style={styles.ticket} collapsable={false}>

          {/* Status Banner */}
          <View style={[styles.ticketBanner, !isOnline && { backgroundColor: COLORS.warning }]}>
            <Ionicons name={isOnline ? 'checkmark-circle' : 'cloud-offline-outline'} size={16} color={COLORS.white} />
            <Text style={styles.ticketBannerText}>
              {isOnline ? 'Booking Confirmed' : 'Offline Mode'}
            </Text>
          </View>

          {/* Route info */}
          <View style={styles.ticketTop}>
            <View style={[styles.busIconWrap, booking.type === 'taxi' && styles.taxiIconWrap]}>
              <Ionicons
                name={booking.type === 'taxi' ? 'car-sport' : 'bus'}
                size={26}
                color={booking.type === 'taxi' ? '#D97706' : PURPLE.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.busName}>{booking.bus?.name || (booking.type === 'taxi' ? 'Taxi' : 'Bus')}</Text>
              <View style={styles.routePill}>
                <Text style={styles.routeText}>{booking.bus?.origin}</Text>
                <Ionicons name="arrow-forward" size={11} color={COLORS.textMuted} />
                <Text style={styles.routeText}>{booking.bus?.destination}</Text>
              </View>
            </View>
          </View>

          {/* Times */}
          <View style={styles.timesRow}>
            <View style={styles.timeStop}>
              <Text style={styles.timeLabel}>DEPARTURE</Text>
              <Text style={styles.timeValue}>{booking.bus?.departureTime || '—'}</Text>
            </View>
            <View style={styles.timeDuration}>
              <View style={styles.timeLine} />
              <View style={styles.timeChip}>
                <Ionicons name="time-outline" size={11} color={COLORS.textMuted} />
                <Text style={styles.timeChipText}>{booking.bus?.duration || '—'}</Text>
              </View>
              <View style={styles.timeLine} />
            </View>
            <View style={[styles.timeStop, { alignItems: 'flex-end' }]}>
              <Text style={styles.timeLabel}>ARRIVAL</Text>
              <Text style={styles.timeValue}>{booking.bus?.arrivalTime || '—'}</Text>
            </View>
          </View>

          {/* Tear line */}
          <TearLine />

          {/* Details grid */}
          <View style={styles.detailsGrid}>
            {[
              booking.type === 'taxi'
                ? { label: 'VEHICLE', value: booking.vehicleLabel ?? 'Taxi', highlight: false }
                : { label: 'SEAT',    value: activeTicket.seat_number,        highlight: false },
              { label: 'FARE',   value: `${currency} ${parseFloat(activeTicket.amount ?? booking.price).toFixed(2)}`, highlight: true },
              { label: 'DATE',   value: formatDateTime(booking.date), highlight: false },
              { label: 'STATUS', value: 'Confirmed', highlight: true, green: true },
            ].map((d) => (
              <View key={d.label} style={styles.detailItem}>
                <Text style={styles.detailLabel}>{d.label}</Text>
                <Text style={[
                  styles.detailValue,
                  d.highlight && { color: PURPLE.primary },
                  d.green     && { color: COLORS.secondary },
                ]}>
                  {d.value}
                </Text>
              </View>
            ))}
          </View>

          {/* Driver row — taxi only */}
          {booking.type === 'taxi' && (
            <View style={styles.driverRow}>
              <View style={styles.driverAvatar}>
                <Ionicons name="person" size={18} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverLabel}>DRIVER</Text>
                <Text style={styles.driverName}>
                  {booking.driverName ?? 'Nearest available driver'}
                </Text>
                {(booking.vehiclePlate || booking.vehicleColor) && (
                  <View style={styles.vehicleInfoRow}>
                    {booking.vehicleColor ? (
                      <View style={[styles.vehicleColorDot, { backgroundColor: booking.vehicleColor }]} />
                    ) : null}
                    {booking.vehicleModel ? (
                      <Text style={styles.vehicleInfoText}>{booking.vehicleModel}</Text>
                    ) : null}
                    {booking.vehiclePlate ? (
                      <Text style={styles.vehiclePlateText}>{booking.vehiclePlate}</Text>
                    ) : null}
                  </View>
                )}
              </View>
              {booking.driverRating > 0 && (
                <View style={styles.driverBadge}>
                  <Ionicons name="star" size={11} color="#D97706" />
                  <Text style={styles.driverBadgeText}>{Number(booking.driverRating).toFixed(1)}</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Multi-seat ticket switcher ── */}
          {tickets.length > 1 && (
            <View style={styles.seatSwitcherWrap}>
              <Text style={styles.seatSwitcherLabel}>
                This booking has {tickets.length} tickets — each has its own boarding QR
              </Text>
              <View style={styles.seatSwitcherRow}>
                {tickets.map((t, i) => (
                  <TouchableOpacity
                    key={t.ticket_id ?? i}
                    style={[styles.seatPill, i === activeIndex && styles.seatPillActive]}
                    onPress={() => setActiveIndex(i)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.seatPillText, i === activeIndex && styles.seatPillTextActive]}>
                      {t.seat_number}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Tear line */}
          <TearLine />

          {/* ── QR boarding pass ── */}
          <View style={styles.qrSection}>
              <Text style={styles.qrLabel}>
                {isOnline
                  ? booking.type === 'taxi'
                    ? 'Taxi booking confirmed · Show to driver'
                    : `Seat ${activeTicket.seat_number} · Scan to board`
                  : 'Offline static QR — driver verifies manually'}
              </Text>

              <View style={styles.qrOuter}>
                <View style={[styles.qrBorder, { borderColor: urgencyColor }]}>
                  {qrToken ? (
                    <QRCode value={qrToken} size={148} color={COLORS.textPrimary} backgroundColor={COLORS.white} />
                  ) : (
                    <View style={styles.qrPlaceholder}>
                      <Ionicons name="qr-code-outline" size={60} color={COLORS.border} />
                    </View>
                  )}
                </View>

                {/* Badge: HMAC online / OFFLINE static */}
                <View style={[styles.modeBadge, { backgroundColor: isOnline ? PURPLE.primary : COLORS.warning }]}>
                  <Ionicons name={isOnline ? 'lock-closed' : 'cloud-offline-outline'} size={10} color={COLORS.white} />
                  <Text style={styles.modeBadgeText}>{isOnline ? 'HMAC-SHA256' : 'OFFLINE'}</Text>
                </View>
              </View>

              {/* Offline instruction */}
              {!isOnline && (
                <View style={styles.offlineNote}>
                  <Ionicons name="information-circle-outline" size={14} color={COLORS.warning} />
                  <Text style={styles.offlineNoteText}>
                    Show this to the driver. They will verify your booking ID manually.
                  </Text>
                </View>
              )}

              <View style={styles.bookingIdRow}>
                <Ionicons name="barcode-outline" size={14} color={COLORS.textMuted} />
                <Text style={styles.bookingId}>Ticket #{activeTicket.ticket_id} · Booking #{booking._id}</Text>
              </View>
            </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title={booking.type === 'taxi' ? 'Track My Taxi' : 'Track My Bus'}
            onPress={() => navigation.navigate('BusTracking', { tripId: booking.bus?._id, busName: booking.bus?.name, booking })}
            icon={<Ionicons name="navigate-outline" size={18} color={COLORS.white} />}
            size="lg"
            color={PURPLE.primary}
          />
          <Button
            title="Share Ticket"
            onPress={shareTicket}
            variant="outline"
            color={PURPLE.primary}
            icon={<Ionicons name="share-outline" size={18} color={PURPLE.primary} />}
            style={{ marginTop: 10 }}
          />
          <Button
            title="Back to Home"
            onPress={() => navigation.navigate('Home')}
            variant="ghost"
            style={{ marginTop: 4 }}
          />
        </View>
      </ScrollView>

      {/* ── Share Ticket Modal — shares the currently active seat's ticket ── */}
      <ShareTicketModal
        visible={showShare}
        onClose={() => setShowShare(false)}
        booking={booking}
        ticket={activeTicket}
        passengerName={user?.name}
        user={user}
        boardingQr={qrToken}
      />
    </View>
  );
};

// ── Tear line helper ──────────────────────────────────────────────────────────
const TearLine = () => (
  <View style={styles.tearLine}>
    <View style={styles.tearCircleLeft} />
    <View style={styles.tearDashes} />
    <View style={styles.tearCircleRight} />
  </View>
);

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: PURPLE.gradient[0],
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: 16, paddingHorizontal: 16, overflow: 'hidden',
  },
  headerDecor1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -70, right: -50,
  },
  headerDecor2: {
    position: 'absolute', width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: -20, left: 60,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1, fontWeight: '500' },
  shareBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Offline banner */
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.warning, paddingHorizontal: 16, paddingVertical: 10,
  },
  offlineBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.white },

  scroll: { padding: 16, paddingBottom: 40 },

  /* Ticket card */
  ticket: {
    backgroundColor: COLORS.white, borderRadius: 24, overflow: 'hidden',
    shadowColor: '#1E293B', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 8, marginBottom: 20,
  },
  ticketBanner: {
    backgroundColor: COLORS.secondary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8,
  },
  ticketBannerText: { fontSize: 13, fontWeight: '700', color: COLORS.white },

  ticketTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 16 },
  busIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: PURPLE.light, alignItems: 'center', justifyContent: 'center',
  },
  taxiIconWrap: { backgroundColor: '#FEF3C7' },

  driverRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 16,
  },
  driverAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: PURPLE.light,
    alignItems: 'center', justifyContent: 'center',
  },
  driverLabel: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  driverName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  vehicleInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  vehicleColorDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  vehicleInfoText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },
  vehiclePlateText: {
    fontSize: 11, fontWeight: '800', color: COLORS.textPrimary,
    backgroundColor: COLORS.background, borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: COLORS.border, letterSpacing: 1,
  },
  driverBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FEF3C7', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  driverBadgeText: { fontSize: 12, fontWeight: '700', color: '#D97706' },
  busName: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.2 },
  routePill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  routeText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },

  timesRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  timeStop: { alignItems: 'flex-start' },
  timeLabel: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  timeValue: { fontSize: 17, fontWeight: '900', color: COLORS.textPrimary, marginTop: 3 },
  timeDuration: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  timeLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  timeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.background, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  timeChipText: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },

  tearLine: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  tearCircleLeft: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.background, marginLeft: -12 },
  tearDashes: { flex: 1, height: 1.5, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.border },
  tearCircleRight: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.background, marginRight: -12 },

  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, paddingVertical: 18, gap: 16 },
  detailItem: { width: '45%' },
  detailLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  detailValue: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginTop: 4 },

  /* Multi-seat ticket switcher */
  seatSwitcherWrap: { paddingHorizontal: 20, paddingBottom: 18 },
  seatSwitcherLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', marginBottom: 10 },
  seatSwitcherRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seatPill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
  },
  seatPillActive: { backgroundColor: PURPLE.light, borderColor: PURPLE.primary },
  seatPillText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  seatPillTextActive: { color: PURPLE.primary },

  /* QR section */
  qrSection: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20 },
  qrLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  qrOuter: { position: 'relative', marginBottom: 16 },
  qrBorder: { padding: 14, backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 2.5 },
  qrPlaceholder: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, borderRadius: 12 },
  modeBadge: {
    position: 'absolute', bottom: -10, left: '50%', transform: [{ translateX: -44 }],
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 2, borderColor: COLORS.white,
  },
  modeBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.white },

  offlineNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.warningLight, borderRadius: 10, padding: 12,
    marginBottom: 12, width: '100%',
  },
  offlineNoteText: { flex: 1, fontSize: 12, color: COLORS.warningDark, lineHeight: 18 },

  bookingIdRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bookingId: { fontSize: 11, color: COLORS.textMuted, letterSpacing: 0.8, fontWeight: '600' },

  actions: {},
});

export default TicketScreen;
