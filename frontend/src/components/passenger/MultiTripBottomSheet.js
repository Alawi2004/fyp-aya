import React, { useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

const iconForSegment = (type) => {
  if (type === 'walk') return 'walk-outline';
  if (type === 'van') return 'car-outline';
  return 'bus-outline';
};

const money = (value) => {
  const amount = Number(value || 0);
  return `${amount.toLocaleString()} LBP`;
};

const openDirections = (segment) => {
  const query = encodeURIComponent(`${segment.to || ''}`);
  const url = Platform.select({
    ios: `http://maps.apple.com/?q=${query}`,
    android: `geo:0,0?q=${query}`,
    default: `https://www.google.com/maps/search/?api=1&query=${query}`,
  });
  Linking.openURL(url);
};

const SummaryPill = ({ icon, label, value }) => (
  <View style={styles.summaryPill}>
    <Ionicons name={icon} size={15} color={COLORS.primary} />
    <View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  </View>
);

const TimelineDot = ({ segment, active }) => (
  <View style={styles.timelineColumn}>
    <View style={[styles.timelineDot, active && styles.timelineDotActive]}>
      <Ionicons name={iconForSegment(segment.type)} size={14} color={active ? COLORS.white : COLORS.primary} />
    </View>
    <View style={styles.timelineLine} />
  </View>
);

const SegmentCard = ({ segment, index, active }) => {
  const [expanded, setExpanded] = useState(index === 0);
  const isWalk = segment.type === 'walk';

  return (
    <View style={styles.segmentRow}>
      <TimelineDot segment={segment} active={active} />
      <View style={styles.segmentBody}>
        <TouchableOpacity
          activeOpacity={0.84}
          style={[styles.segmentCard, active && styles.segmentCardActive]}
          onPress={() => setExpanded((value) => !value)}
        >
          <View style={styles.segmentHeader}>
            <View style={styles.segmentTitleWrap}>
              <Text style={styles.segmentKicker}>{isWalk ? 'Walk' : segment.type}</Text>
              <Text style={styles.segmentTitle} numberOfLines={1}>
                {isWalk ? `${segment.from} to ${segment.to}` : `${segment.line} · ${segment.route_name || 'Route'}`}
              </Text>
            </View>
            <View style={styles.segmentMeta}>
              <Text style={styles.segmentTime}>{segment.estimated_time_min} min</Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textMuted} />
            </View>
          </View>

          {!isWalk && (
            <View style={styles.stopLineCompact}>
              <Text style={styles.stopText} numberOfLines={1}>{segment.from}</Text>
              <Ionicons name="arrow-forward" size={13} color={COLORS.textMuted} />
              <Text style={styles.stopText} numberOfLines={1}>{segment.to}</Text>
            </View>
          )}

          {segment.transfer_from_previous_min ? (
            <View style={styles.transferNote}>
              <Ionicons name="swap-horizontal-outline" size={13} color={COLORS.warningDark} />
              <Text style={styles.transferText}>Transfer time: {segment.transfer_from_previous_min} min</Text>
            </View>
          ) : null}

          {expanded && (
            <View style={styles.details}>
              {isWalk ? (
                <>
                  <Text style={styles.detailText}>Distance: {segment.distance_m || 0} m</Text>
                  <Text style={styles.detailText}>Walking time: {segment.estimated_time_min} min</Text>
                  <TouchableOpacity style={styles.directionsButton} onPress={() => openDirections(segment)}>
                    <Ionicons name="navigate-outline" size={15} color={COLORS.white} />
                    <Text style={styles.directionsText}>Directions</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.detailText}>Board at {segment.from}</Text>
                  <Text style={styles.detailText}>Get off at {segment.to}</Text>
                  <Text style={styles.detailText}>{segment.stops} stops · {money(segment.price)}</Text>
                  {segment.boarding_instruction ? (
                    <Text style={styles.instructionText}>{segment.boarding_instruction}</Text>
                  ) : null}
                </>
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const MultiTripBottomSheet = ({ trip, mode = 'fastest', activeSegmentIndex = 0, onModeChange, embedded = false }) => {
  const segments = trip?.segments || [];
  const modes = useMemo(() => ['fastest', 'easiest', 'cheapest'], []);

  if (!trip) return null;

  const SegmentList = embedded ? View : ScrollView;
  const segmentListProps = embedded ? {} : { style: styles.segmentList, showsVerticalScrollIndicator: false };

  return (
    <View style={[styles.sheet, embedded && styles.sheetEmbedded]}>
      {!embedded && <View style={styles.handle} />}

      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.routeSummary} numberOfLines={1}>{trip.summary}</Text>
          <Text style={styles.routeSub}>
            {trip.route_type === 'direct' ? 'Direct route' : `${trip.total_transfers} transfers`}
          </Text>
        </View>
        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeText}>{trip.mode || mode}</Text>
        </View>
      </View>

      <View style={styles.modeRow}>
        {modes.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.modeButton, mode === item && styles.modeButtonActive]}
            onPress={() => onModeChange?.(item)}
            activeOpacity={0.82}
          >
            <Text style={[styles.modeText, mode === item && styles.modeTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.summaryGrid}>
        <SummaryPill icon="cash-outline" label="Price" value={money(trip.total_price)} />
        <SummaryPill icon="time-outline" label="Duration" value={`${trip.total_duration_min} min`} />
        <SummaryPill icon="git-branch-outline" label="Transfers" value={trip.total_transfers} />
        <SummaryPill icon="walk-outline" label="Walking" value={`${trip.walking_time_min} min`} />
      </View>

      <SegmentList {...segmentListProps}>
        {segments.map((segment, index) => (
          <SegmentCard
            key={`${segment.type}-${segment.from_stop_id || segment.from}-${segment.to_stop_id || segment.to}-${index}`}
            segment={segment}
            index={index}
            active={index === activeSegmentIndex}
          />
        ))}
      </SegmentList>
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 18,
    maxHeight: '82%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 14,
  },
  sheetEmbedded: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    maxHeight: undefined,
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  routeSummary: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  routeSub: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modeBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modeBadgeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  modeTextActive: {
    color: COLORS.white,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  summaryPill: {
    width: '48.7%',
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  segmentList: {
    marginTop: 2,
  },
  segmentRow: {
    flexDirection: 'row',
  },
  timelineColumn: {
    width: 34,
    alignItems: 'center',
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryMid,
  },
  timelineDotActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    minHeight: 58,
    backgroundColor: COLORS.border,
  },
  segmentBody: {
    flex: 1,
    paddingBottom: 10,
  },
  segmentCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 12,
  },
  segmentCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  segmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  segmentTitleWrap: {
    flex: 1,
  },
  segmentKicker: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  segmentTitle: {
    marginTop: 1,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  segmentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  segmentTime: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  stopLineCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  stopText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  transferNote: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.warningLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  transferText: {
    fontSize: 12,
    color: COLORS.warningDark,
    fontWeight: '700',
  },
  details: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  instructionText: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 17,
  },
  directionsButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  directionsText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
});

export default MultiTripBottomSheet;
