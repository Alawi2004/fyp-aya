import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Share,
  Platform, StatusBar, TouchableOpacity,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/common/Button';
import { COLORS } from '../../constants/colors';
import { formatDateTime } from '../../utils/formatters';

const TicketScreen = ({ route, navigation }) => {
  const headerInsets = useHeaderInsets();
  const { booking } = route.params;
  const qrData = JSON.stringify({
    bookingId: booking._id,
    seatId: booking.seatId,
    price: booking.price,
  });

  const shareTicket = async () => {
    await Share.share({
      message: `My bus ticket: ${booking.bus?.name} | Seat ${booking.seatId} | ${formatDateTime(booking.date)}`,
    });
  };

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
              { label: 'SEAT', value: booking.seatId, highlight: false },
              { label: 'FARE', value: `$${booking.price}`, highlight: true },
              { label: 'DATE', value: formatDateTime(booking.date), highlight: false },
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

          {/* QR Code */}
          <View style={styles.qrSection}>
            <Text style={styles.qrLabel}>Scan to board</Text>
            <View style={styles.qrWrap}>
              <QRCode
                value={qrData}
                size={150}
                color={COLORS.textPrimary}
                backgroundColor={COLORS.white}
              />
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
    borderStyle: 'dashed', borderWidth: 1,
    borderColor: COLORS.border,
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
  detailValue: {
    fontSize: 16, fontWeight: '800',
    color: COLORS.textPrimary, marginTop: 4,
  },

  /* QR */
  qrSection: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  qrLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 16 },
  qrWrap: {
    padding: 14, backgroundColor: COLORS.white,
    borderRadius: 18, borderWidth: 1.5, borderColor: COLORS.border,
    marginBottom: 14,
  },
  bookingIdRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bookingId: { fontSize: 11, color: COLORS.textMuted, letterSpacing: 0.8, fontWeight: '600' },

  /* Actions */
  actions: {},
});

export default TicketScreen;
