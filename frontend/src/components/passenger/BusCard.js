import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PURPLE } from '../../constants/colors';
import { THEME } from '../../constants/theme';
import apiClient from '../../api/apiClient';
import { useApp } from '../../context/AppContext';

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatRecurrence(recurrence, customDays) {
  if (!recurrence) return null;
  if (recurrence === 'daily')    return 'Daily';
  if (recurrence === 'weekdays') return 'Mon–Fri';
  if (recurrence === 'weekends') return 'Weekends';
  if (recurrence === 'custom') {
    try {
      const days = JSON.parse(customDays || '[]');
      return days.map((d) => DAY_NAMES[d] ?? '').filter(Boolean).join(', ') || 'Custom';
    } catch { return 'Custom'; }
  }
  return null;
}

const STATUS_CONFIG = {
  active:    { key: 'On Time',   bg: COLORS.secondaryLight, text: COLORS.secondary, dot: COLORS.secondary },
  boarding:  { key: 'Boarding',  bg: PURPLE.mid,     text: PURPLE.primary,   dot: PURPLE.primary   },
  delayed:   { key: 'Delayed',   bg: COLORS.warningLight,   text: COLORS.warning,   dot: COLORS.warning   },
  cancelled: { key: 'Cancelled', bg: COLORS.dangerLight,    text: COLORS.danger,    dot: COLORS.danger    },
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

const BusCard = ({ bus, onPress, fmtMoney, isFavorite = false, onToggleFavorite }) => {
  const { t, language } = useApp();
  const recurrenceLabel = formatRecurrence(bus.schedule_recurrence, bus.schedule_custom_days);
  const [photoUrl, setPhotoUrl] = useState(null);

  useEffect(() => {
    if (!bus.vehicle_id) return;
    apiClient.get(`/vehicles/${bus.vehicle_id}/photos`)
      .then(r => {
        const photos = Array.isArray(r.data) ? r.data : [];
        const pick = photos.find(p => p.slot === 'exterior') ?? photos[0];
        if (pick?.url) setPhotoUrl(pick.url);
      })
      .catch(() => {});
  }, [bus.vehicle_id]);

  const seatsLeft = bus.totalSeats - bus.bookedSeats;
  const seatPct = seatsLeft / bus.totalSeats;
  const seatColor = seatPct <= 0.1 ? COLORS.danger : seatPct <= 0.3 ? COLORS.warning : COLORS.secondary;
  const fillPct = ((bus.bookedSeats / bus.totalSeats) * 100).toFixed(0);
  const status = STATUS_CONFIG[bus.status] || STATUS_CONFIG.active;
  const vehicleIcon = TYPE_ICON[bus.type] || 'bus';
  const vehicleLabel = t(TYPE_LABEL[bus.type] || 'Bus');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>

      {/* Top row */}
      <View style={styles.topRow}>
        <View style={styles.busIconWrap}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.busPhoto} resizeMode="cover" />
          ) : (
            <Ionicons name={vehicleIcon} size={22} color={PURPLE.primary} />
          )}
        </View>
        <View style={styles.busInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.busName, { flex: 1 }]} numberOfLines={1}>{bus.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
              <Text style={[styles.statusText, { color: status.text }]}>{t(status.key)}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <View style={styles.typeTag}>
              <Text style={styles.typeTagText}>{vehicleLabel}</Text>
            </View>
            {recurrenceLabel && (
              <View style={styles.recurrenceBadge}>
                <Ionicons name="repeat-outline" size={10} color={COLORS.secondary} />
                <Text style={styles.recurrenceText}>{recurrenceLabel}</Text>
              </View>
            )}
          </View>
          <Text style={styles.busRoute} numberOfLines={1}>{bus.route}</Text>
        </View>
        {/* Duration badge — matches BookingScreen's durationBadge in header */}
        <View style={styles.durationBadge}>
          <Ionicons name="time-outline" size={12} color={PURPLE.primary} />
          <Text style={styles.durationText}>{bus.duration}</Text>
        </View>
        {onToggleFavorite && bus.schedule_recurrence && (
          <TouchableOpacity
            style={styles.heartBtn}
            onPress={() => onToggleFavorite(bus)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavorite ? COLORS.danger : COLORS.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Route row — FROM/TO swap in Arabic so reading order is right-to-left */}
      {(() => {
        const isArabic = language === 'ar';
        const left  = isArabic
          ? { label: t('TO'),   name: bus.destination, time: bus.arrivalTime,   align: 'flex-start' }
          : { label: t('FROM'), name: bus.origin,      time: bus.departureTime, align: 'flex-start' };
        const right = isArabic
          ? { label: t('FROM'), name: bus.origin,      time: bus.departureTime, align: 'flex-end' }
          : { label: t('TO'),   name: bus.destination, time: bus.arrivalTime,   align: 'flex-end' };
        return (
          <View style={styles.routeRow}>
            <View style={[styles.routeStop, { alignItems: left.align }]}>
              <Text style={styles.stopLabel}>{left.label}</Text>
              <Text style={styles.stopName}>{left.name}</Text>
              <Text style={styles.stopTime}>{left.time}</Text>
            </View>
            <View style={styles.routeMid}>
              <View style={styles.routeLineDash} />
              <View style={[styles.routeArrow, isArabic && { transform: [{ scaleX: -1 }] }]}>
                <Ionicons name="bus-outline" size={13} color={PURPLE.primary} />
              </View>
              <View style={styles.routeLineDash} />
            </View>
            <View style={[styles.routeStop, { alignItems: right.align }]}>
              <Text style={styles.stopLabel}>{right.label}</Text>
              <Text style={styles.stopName}>{right.name}</Text>
              <Text style={styles.stopTime}>{right.time}</Text>
            </View>
          </View>
        );
      })()}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={13} color={seatColor} />
            <Text style={[styles.metaText, { color: seatColor }]}>
              {seatsLeft === 0 ? t('Full') : `${seatsLeft} ${t('seats available')}`}
            </Text>
          </View>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceAmount}>{fmtMoney(bus.price)}</Text>
          <View style={styles.bookNowBtn}>
            <View style={styles.bookNowHighlight} pointerEvents="none" />
            <Ionicons name="arrow-forward" size={13} color={COLORS.white} />
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
    borderRadius: THEME.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  typeTag: {
    backgroundColor: PURPLE.light,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  typeTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: PURPLE.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recurrenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.secondaryLight,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  recurrenceText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heartBtn: {
    padding: 4,
    alignSelf: 'flex-start',
  },
  busIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: PURPLE.light,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  busPhoto: {
    width: 50,
    height: 50,
  },
  busInfo: { flex: 1, minWidth: 0 },
  busName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  busRoute: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.borderRadius.round,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: THEME.fontWeight.bold },

  /* Duration badge — pill in top row, matching BookingScreen's durationBadge */
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PURPLE.light,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  durationText: { fontSize: 12, fontWeight: '700', color: PURPLE.primary },

  /* Route row */
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  routeStop: {
    flex: 1,
  },
  stopLabel: {
    fontSize: 10,
    fontWeight: THEME.fontWeight.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stopName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  stopTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  routeMid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  /* Route line matches BookingScreen's journeyLine color (PURPLE.midStrong) */
  routeLineDash: {
    width: 14,
    height: 1.5,
    backgroundColor: PURPLE.midStrong,
  },
  /* Center bus chip matches BookingScreen's journeyBusChip sizing */
  routeArrow: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: PURPLE.light,
    alignItems: 'center',
    justifyContent: 'center',
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginBottom: 12,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  footerMeta: { flexDirection: 'row', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: {
    fontSize: 12,
    fontWeight: THEME.fontWeight.semibold,
    color: COLORS.textSecondary,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  priceAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: PURPLE.primary,
    letterSpacing: -0.5,
  },
  bookNowBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: PURPLE.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    overflow: 'hidden',
    shadowColor: PURPLE.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  bookNowHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
  },

  seatBar: {
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.borderLight,
    overflow: 'hidden',
  },
  seatBarFill: { height: '100%', borderRadius: 999 },
});

export default BusCard;
