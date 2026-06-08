import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  StatusBar, TouchableOpacity, Animated,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/common/Button';
import ShareTicketModal from '../../components/passenger/ShareTicketModal';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { formatDateTime } from '../../utils/formatters';

// expo-crypto — optional; falls back to a simpler digest if unavailable
let Crypto = null;
try { Crypto = require('expo-crypto'); } catch (_) {}

const HMAC_SECRET    = 'yalla-transit-qr-secret-2026';
const QR_WINDOW_SECS = 60;

// ── HMAC helpers ─────────────────────────────────────────────────────────────
const computeHmac = async (payload) => {
  const msg = `${payload.bid}:${payload.uid}:${payload.seat}:${payload.exp}`;
  if (Crypto) {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${HMAC_SECRET}:${msg}`,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    return digest.slice(0, 32);
  }
  return `${msg.length.toString(16).padStart(8, '0')}${payload.exp.toString(16)}`.slice(0, 32);
};

const secondsLeftInWindow = () => QR_WINDOW_SECS - (Math.floor(Date.now() / 1000) % QR_WINDOW_SECS);
const currentWindowExp    = () =>
  Math.floor(Date.now() / (QR_WINDOW_SECS * 1000)) * (QR_WINDOW_SECS * 1000) + QR_WINDOW_SECS * 1000;

// ── Static QR payload (offline, no expiry) ───────────────────────────────────
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

  // A booking can hold several seats — each gets its own ticket record,
  // its own rotating QR, and its own share/PDF. Fall back to a single
  // synthetic ticket for older mock bookings that only have `seatId`.
  const tickets = booking.tickets?.length
    ? booking.tickets
    : [{ ticket_id: booking._id, seat_number: booking.seatId, amount: booking.price, created_at: booking.date }];

  const [activeIndex, setActiveIndex] = useState(0);
  const activeTicket = tickets[Math.min(activeIndex, tickets.length - 1)];

  const [isOnline, setIsOnline]         = useState(true);
  const [qrToken, setQrToken]           = useState('');
  const [secondsLeft, setSecondsLeft]   = useState(secondsLeftInWindow());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pulseAnim      = useRef(new Animated.Value(1)).current;
  const flashAnim      = useRef(new Animated.Value(1)).current;
  const lastWindow     = useRef(currentWindowExp());
  const ticketRef      = useRef(null);
  const [showShare, setShowShare] = useState(false);

  // Network monitoring
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
    return () => unsub();
  }, []);

  // ── Online: rotating HMAC QR — unique per ticket (includes ticket_id) ───
  const generateToken = useCallback(async () => {
    if (!isOnline) return;
    setIsRefreshing(true);
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    const payload = {
      bid:  booking._id,
      tid:  activeTicket.ticket_id,
      uid:  user?._id ?? 'guest',
      seat: activeTicket.seat_number,
      fare: activeTicket.amount,
      exp:  currentWindowExp(),
    };
    const sig = await computeHmac(payload);
    setQrToken(JSON.stringify({ ...payload, sig }));
    setIsRefreshing(false);
    lastWindow.current = currentWindowExp();
  }, [booking, activeTicket, user, isOnline]);

  // ── Offline: static QR ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOnline) {
      setQrToken(buildStaticQr(booking, activeTicket, user?._id));
    }
  }, [isOnline, booking, activeTicket, user]);

  // Online countdown & token rotation — restarts whenever the active ticket changes
  useEffect(() => {
    if (!isOnline) return;
    generateToken();
    const tick = setInterval(() => {
      const secs = secondsLeftInWindow();
      setSecondsLeft(secs);
      if (currentWindowExp() !== lastWindow.current) generateToken();
    }, 1000);
    return () => clearInterval(tick);
  }, [generateToken, isOnline]);

  // Pulse animation near expiry (online only)
  useEffect(() => {
    if (!isOnline || secondsLeft > 10) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      return;
    }
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 400, useNativeDriver: true }),
      ])
    ).start();
  }, [secondsLeft <= 10, isOnline]);

  const urgencyColor = isOnline
    ? (secondsLeft <= 10 ? COLORS.danger : secondsLeft <= 20 ? COLORS.warning : COLORS.secondary)
    : COLORS.warning;

  const shareTicket = () => setShowShare(true);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      {/* ── Header ── */}
      <View style={[styles.header, headerInsets]}>
        <View style={styles.headerDecor} />
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('Home')}
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
            <View style={styles.busIconWrap}>
              <Ionicons name="bus" size={26} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.busName}>{booking.bus?.name || 'Bus'}</Text>
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
              { label: 'SEAT',   value: activeTicket.seat_number, highlight: false },
              { label: 'FARE',   value: `$${parseFloat(activeTicket.amount ?? booking.price).toFixed(2)}`, highlight: true },
              { label: 'DATE',   value: formatDateTime(booking.date), highlight: false },
              { label: 'STATUS', value: 'Confirmed', highlight: true, green: true },
            ].map((d) => (
              <View key={d.label} style={styles.detailItem}>
                <Text style={styles.detailLabel}>{d.label}</Text>
                <Text style={[
                  styles.detailValue,
                  d.highlight && { color: COLORS.primary },
                  d.green     && { color: COLORS.secondary },
                ]}>
                  {d.value}
                </Text>
              </View>
            ))}
          </View>

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
                  ? `Seat ${activeTicket.seat_number} · Scan to board · Rotates every 60s`
                  : 'Offline static QR — driver verifies manually'}
              </Text>

              <Animated.View style={[
                styles.qrOuter,
                { transform: [{ scale: isOnline ? pulseAnim : 1 }], opacity: isOnline ? flashAnim : 1 },
              ]}>
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
                <View style={[styles.modeBadge, { backgroundColor: isOnline ? COLORS.primary : COLORS.warning }]}>
                  <Ionicons name={isOnline ? 'lock-closed' : 'cloud-offline-outline'} size={10} color={COLORS.white} />
                  <Text style={styles.modeBadgeText}>{isOnline ? 'HMAC-SHA256' : 'OFFLINE'}</Text>
                </View>
              </Animated.View>

              {/* Online countdown bar */}
              {isOnline && (
                <View style={styles.countdownWrap}>
                  <View style={styles.countdownBar}>
                    <View
                      style={[
                        styles.countdownFill,
                        {
                          width: `${(secondsLeft / QR_WINDOW_SECS) * 100}%`,
                          backgroundColor: urgencyColor,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.countdownRow}>
                    <Ionicons name="refresh-outline" size={12} color={urgencyColor} />
                    <Text style={[styles.countdownText, { color: urgencyColor }]}>
                      {isRefreshing ? 'Refreshing…' : `Refreshes in ${secondsLeft}s`}
                    </Text>
                  </View>
                </View>
              )}

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
            title="Track My Bus"
            onPress={() => navigation.navigate('BusTracking', { tripId: booking.bus?._id, busName: booking.bus?.name })}
            icon={<Ionicons name="navigate-outline" size={18} color={COLORS.white} />}
            size="lg"
          />
          <Button
            title="Share Ticket"
            onPress={shareTicket}
            variant="outline"
            icon={<Ionicons name="share-outline" size={18} color={COLORS.primary} />}
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
    backgroundColor: COLORS.headerBg,
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: 16, paddingHorizontal: 16, overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.05)', top: -60, right: -40,
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
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
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
  seatPillActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  seatPillText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  seatPillTextActive: { color: COLORS.primary },

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

  countdownWrap: { width: '90%', marginTop: 8, marginBottom: 14 },
  countdownBar: { height: 5, borderRadius: 4, backgroundColor: COLORS.border, overflow: 'hidden', marginBottom: 8 },
  countdownFill: { height: '100%', borderRadius: 4 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  countdownText: { fontSize: 12, fontWeight: '700' },

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
