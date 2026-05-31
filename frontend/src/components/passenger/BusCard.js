import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

const STATUS_CONFIG = {
  active:    { label: 'On Time',   bg: COLORS.secondaryLight, text: COLORS.secondary, dot: COLORS.secondary },
  boarding:  { label: 'Boarding',  bg: COLORS.primaryMid,     text: COLORS.primary,   dot: COLORS.primary   },
  delayed:   { label: 'Delayed',   bg: COLORS.warningLight,   text: COLORS.warning,   dot: COLORS.warning   },
  cancelled: { label: 'Cancelled', bg: COLORS.dangerLight,    text: COLORS.danger,    dot: COLORS.danger    },
};

const TYPE_ICON = {
  bus:    'bus',
  van:    'car',
  taxi:   'car-sport',
  tuktuk: 'bicycle',
};

const TYPE_LABEL = {
  bus:    'Bus',
  van:    'Van',
  taxi:   'Taxi',
  tuktuk: 'Tuktuk',
};

const BusCard = ({ bus, onPress }) => {
  const seatsLeft = bus.totalSeats - bus.bookedSeats;
  const seatPct = seatsLeft / bus.totalSeats;
  const seatColor = seatPct <= 0.1 ? COLORS.danger : seatPct <= 0.3 ? COLORS.warning : COLORS.secondary;
  const fillPct = ((bus.bookedSeats / bus.totalSeats) * 100).toFixed(0);
  const status = STATUS_CONFIG[bus.status] || STATUS_CONFIG.active;
  const vehicleIcon = TYPE_ICON[bus.type] || 'bus';
  const vehicleLabel = TYPE_LABEL[bus.type] || 'Bus';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>

      {/* Top row */}
      <View style={styles.topRow}>
        <View style={styles.busIconWrap}>
          <Ionicons name={vehicleIcon} size={22} color={COLORS.primary} />
        </View>
        <View style={styles.busInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.busName}>{bus.name}</Text>
            <View style={styles.typeTag}>
              <Text style={styles.typeTagText}>{vehicleLabel}</Text>
            </View>
          </View>
          <Text style={styles.busRoute}>{bus.route}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
          <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
        </View>
      </View>

      {/* Route */}
      <View style={styles.routeRow}>
        <View style={styles.routeStop}>
          <View style={styles.dotGreen} />
          <View>
            <Text style={styles.stopLabel}>FROM</Text>
            <Text style={styles.stopName}>{bus.origin}</Text>
            <Text style={styles.stopTime}>{bus.departureTime}</Text>
          </View>
        </View>
        <View style={styles.routeMid}>
          <View style={styles.routeLineDash} />
          <View style={styles.routeArrow}>
            <Ionicons name="bus-outline" size={14} color={COLORS.primary} />
          </View>
          <View style={styles.routeLineDash} />
        </View>
        <View style={[styles.routeStop, { alignItems: 'flex-end' }]}>
          <View style={[styles.dotGreen, { backgroundColor: COLORS.danger }]} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.stopLabel}>TO</Text>
            <Text style={styles.stopName}>{bus.destination}</Text>
            <Text style={styles.stopTime}>{bus.arrivalTime}</Text>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.metaText}>{bus.duration}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={13} color={seatColor} />
            <Text style={[styles.metaText, { color: seatColor }]}>
              {seatsLeft === 0 ? 'Full' : `${seatsLeft} seats`}
            </Text>
          </View>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceCurrency}>$</Text>
          <Text style={styles.priceAmount}>{bus.price}</Text>
          <View style={styles.bookNowBtn}>
            <Ionicons name="arrow-forward" size={14} color={COLORS.white} />
          </View>
        </View>
      </View>

      {/* Seat fill bar */}
      <View style={styles.seatBar}>
        <View style={[styles.seatBarFill, { width: `${fillPct}%`, backgroundColor: seatColor }]} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 14, gap: 10,
  },
  typeTag: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  typeTagText: { fontSize: 9, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.3 },
  busIconWrap: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  busInfo: { flex: 1 },
  busName: {
    fontSize: 16, fontWeight: '800',
    color: COLORS.textPrimary, letterSpacing: -0.2,
  },
  busRoute: {
    fontSize: 12, color: COLORS.textMuted,
    fontWeight: '500', marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  routeRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 14,
  },
  routeStop: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dotGreen: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.secondary, marginTop: 14,
  },
  stopLabel: {
    fontSize: 10, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  stopName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  stopTime: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500', marginTop: 1 },
  routeMid: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  routeLineDash: { width: 16, height: 1.5, backgroundColor: COLORS.border },
  routeArrow: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 12 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  footerMeta: { flexDirection: 'row', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  priceCurrency: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 2 },
  priceAmount: { fontSize: 20, fontWeight: '900', color: COLORS.primary },
  bookNowBtn: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginLeft: 6,
  },
  seatBar: {
    height: 3, borderRadius: 999,
    backgroundColor: COLORS.border, overflow: 'hidden',
  },
  seatBarFill: { height: '100%', borderRadius: 999 },
});

export default BusCard;
