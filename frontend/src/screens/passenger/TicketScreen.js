import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Share,
  Platform, StatusBar, TouchableOpacity, Animated,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import QRCode from 'react-native-qrcode-svg';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { formatDateTime } from '../../utils/formatters';

// In production this secret lives server-side; the QR token would be fetched via API
const HMAC_SECRET = 'yalla-transit-qr-secret-2026';
const QR_WINDOW_SECS = 60;

const computeHmac = async (payload) => {
  const message = `${payload.bid}:${payload.uid}:${payload.seat}:${payload.exp}`;
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${HMAC_SECRET}:${message}`,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return digest.slice(0, 32);
};

const secondsLeftInWindow = () => QR_WINDOW_SECS - (Math.floor(Date.now() / 1000) % QR_WINDOW_SECS);
const currentWindowExp   = () => Math.floor(Date.now() / (QR_WINDOW_SECS * 1000)) * (QR_WINDOW_SECS * 1000) + QR_WINDOW_SECS * 1000;

const TicketScreen = ({ route, navigation }) => {
  const headerInsets = useHeaderInsets();
  const { booking } = route.params;
  const { user } = useAuth();

  const [qrToken, setQrToken]         = useState('');
  const [secondsLeft, setSecondsLeft] = useState(secondsLeftInWindow());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const flashAnim  = useRef(new Animated.Value(1)).current;
  const lastWindow = useRef(currentWindowExp());

  const generateToken = useCallback(async () => {
    setIsRefreshing(true);
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const payload = {
      bid:  booking._id,
      uid:  user?._id ?? 'guest',
      seat: booking.seatId,
      fare: booking.price,
      exp:  currentWindowExp(),
    };
    const sig = await computeHmac(payload);
    setQrToken(JSON.stringify({ ...payload, sig }));
    setIsRefreshing(false);
    lastWindow.current = currentWindowExp();
  }, [booking, user]);

  // Countdown ticker — regenerate when window rolls over
  useEffect(() => {
    generateToken();
    const tick = setInterval(() => {
      const secs = secondsLeftInWindow();
      setSecondsLeft(secs);
      if (currentWindowExp() !== lastWindow.current) {
        generateToken();
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [generateToken]);

  // Subtle pulse on countdown <= 10
  useEffect(() => {
    if (secondsLeft <= 10) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.03, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [secondsLeft <= 10]);

  const urgencyColor = secondsLeft <= 10 ? COLORS.danger : secondsLeft <= 20 ? COLORS.warning : COLORS.secondary;

  const shareTicket = async () => {
    await Share.share({
      message: `My bus ticket: ${booking.bus?.name} | Seat ${booking.seatId} | ${formatDateTime(booking.date)}`,
    });
  };

  const progressArc = Math.max(0, Math.min(1, secondsLeft / QR_WINDOW_SECS));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      {/* Header */}
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
          <Text style={styles.headerSub}>Scan QR code to board</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={shareTicket}>
          <Ionicons name="share-social-outline" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Ticket Card */}
        <View style={styles.ticket}>

          {/* Status Banner */}
          <View style={styles.ticketBanner}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
            <Text style={styles.ticketBannerText}>Booking Confirmed</Text>
          </View>

          {/* Ticket Top */}
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

          {/* Times row */}
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
          <View style={styles.tearLine}>
            <View style={styles.tearCircleLeft} />
            <View style={styles.tearDashes} />
            <View style={styles.tearCircleRight} />
          </View>

          {/* Details Grid */}
          <View style={styles.detailsGrid}>
            {[
              { label: 'SEAT',   value: booking.seatId,              highlight: false },
              { label: 'FARE',   value: `$${booking.price}`,         highlight: true  },
              { label: 'DATE',   value: formatDateTime(booking.date), highlight: false },
              { label: 'STATUS', value: 'Confirmed', highlight: true, green: true },
            ].map(d => (
              <View key={d.label} style={styles.detailItem}>
                <Text style={styles.detailLabel}>{d.label}</Text>
                <Text style={[
                  styles.detailValue,
                  d.highlight && { color: COLORS.primary },
                  d.green && { color: COLORS.secondary },
                ]}>
                  {d.value}
                </Text>
              </View>
            ))}
          </View>

          {/* Tear line */}
          <View style={styles.tearLine}>
            <View style={styles.tearCircleLeft} />
            <View style={styles.tearDashes} />
            <View style={styles.tearCircleRight} />
          </View>

          {/* ── Rotating HMAC QR Section ── */}
          <View style={styles.qrSection}>
            <Text style={styles.qrLabel}>Scan to board · Rotates every 60 s</Text>

            {/* QR + animated border */}
            <Animated.View style={[styles.qrOuter, { transform: [{ scale: pulseAnim }], opacity: flashAnim }]}>
              <View style={[styles.qrBorder, { borderColor: urgencyColor }]}>
                {qrToken ? (
                  <QRCode
                    value={qrToken}
                    size={148}
                    color={COLORS.textPrimary}
                    backgroundColor={COLORS.white}
                  />
                ) : (
                  <View style={styles.qrPlaceholder}>
                    <Ionicons name="qr-code-outline" size={60} color={COLORS.border} />
                  </View>
                )}
              </View>

              {/* Lock icon overlay — shows HMAC-signed */}
              <View style={styles.hmacBadge}>
                <Ionicons name="lock-closed" size={10} color={COLORS.white} />
                <Text style={styles.hmacBadgeText}>HMAC-SHA256</Text>
              </View>
            </Animated.View>

            {/* Countdown progress bar */}
            <View style={styles.countdownWrap}>
              <View style={styles.countdownBar}>
                <Animated.View
                  style={[
                    styles.countdownFill,
                    { width: `${progressArc * 100}%`, backgroundColor: urgencyColor },
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

            <View style={styles.bookingIdRow}>
              <Ionicons name="barcode-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.bookingId}>#{booking._id}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Track My Bus"
            onPress={() => navigation.navigate('BusTracking', {
              busId: booking.bus?._id || 'bus1',
              busName: booking.bus?.name,
            })}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Header */
  header: {
    backgroundColor: COLORS.headerBg,
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: 16, paddingHorizontal: 16,
    overflow: 'hidden',
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
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1, fontWeight: '500' },
  shareBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: { padding: 16, paddingBottom: 40 },

  /* Ticket */
  ticket: {
    backgroundColor: COLORS.white,
    borderRadius: 24, overflow: 'hidden',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 8,
    marginBottom: 20,
  },
  ticketBanner: {
    backgroundColor: COLORS.secondary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8,
  },
  ticketBannerText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  ticketTop: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, padding: 20, paddingBottom: 16,
  },
  busIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  busName: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.2 },
  routePill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  routeText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },

  /* Times */
  timesRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  timeStop: { alignItems: 'flex-start' },
  timeLabel: {
    fontSize: 9, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  timeValue: { fontSize: 17, fontWeight: '900', color: COLORS.textPrimary, marginTop: 3 },
  timeDuration: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  timeLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  timeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.background, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  timeChipText: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },

  /* Tear line */
  tearLine: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  tearCircleLeft: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.background, marginLeft: -12,
  },
  tearDashes: {
    flex: 1, height: 1.5,
    borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.border,
  },
  tearCircleRight: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.background, marginRight: -12,
  },

  /* Details grid */
  detailsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 20, paddingVertical: 18, gap: 16,
  },
  detailItem: { width: '45%' },
  detailLabel: {
    fontSize: 10, color: COLORS.textMuted,
    fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8,
  },
  detailValue: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginTop: 4 },

  /* QR section */
  qrSection: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20 },
  qrLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 16 },

  qrOuter: { position: 'relative', marginBottom: 16 },
  qrBorder: {
    padding: 14,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 2.5,
  },
  qrPlaceholder: {
    width: 148, height: 148,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  hmacBadge: {
    position: 'absolute',
    bottom: -10, left: '50%',
    transform: [{ translateX: -44 }],
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 2, borderColor: COLORS.white,
  },
  hmacBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.white },

  /* Countdown */
  countdownWrap: { width: '90%', marginTop: 8, marginBottom: 14 },
  countdownBar: {
    height: 5, borderRadius: 4,
    backgroundColor: COLORS.border, overflow: 'hidden',
    marginBottom: 8,
  },
  countdownFill: { height: '100%', borderRadius: 4 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  countdownText: { fontSize: 12, fontWeight: '700' },

  bookingIdRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bookingId: { fontSize: 11, color: COLORS.textMuted, letterSpacing: 0.8, fontWeight: '600' },

  /* Actions */
  actions: {},
});

export default TicketScreen;
