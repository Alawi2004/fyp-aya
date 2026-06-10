import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, FlatList,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_ABB = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_FULL  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

// Trip templates per weekday: index 0=Mon … 6=Sun
const SCHEDULE = [
  [ // Monday
    { id: 'm1', time: '07:00', end: '08:15', route: 'Route A — City Center', bus: 'BUS-101', from: 'Terminal North',  to: 'City Mall',         pax: 22, seats: 30 },
    { id: 'm2', time: '14:30', end: '15:45', route: 'Route C — Airport',     bus: 'BUS-303', from: 'Downtown Hub',    to: 'Airport',           pax: 28, seats: 30 },
  ],
  [ // Tuesday
    { id: 't1', time: '08:00', end: '09:00', route: 'Route B — University',  bus: 'BUS-202', from: 'Central Station', to: 'University Campus', pax: 19, seats: 30 },
  ],
  [ // Wednesday
    { id: 'w1', time: '07:00', end: '08:15', route: 'Route A — City Center', bus: 'BUS-101', from: 'Terminal North',  to: 'City Mall',         pax: 24, seats: 30 },
    { id: 'w2', time: '10:30', end: '11:30', route: 'Route D — Industrial',  bus: 'BUS-404', from: 'City Center',     to: 'Industrial Park',   pax: 17, seats: 30 },
    { id: 'w3', time: '15:00', end: '16:15', route: 'Route A — City Center', bus: 'BUS-101', from: 'City Mall',       to: 'Terminal North',    pax: 21, seats: 30 },
  ],
  [ // Thursday
    { id: 'h1', time: '07:30', end: '08:30', route: 'Route B — University',  bus: 'BUS-202', from: 'Central Station', to: 'University Campus', pax: 20, seats: 30 },
    { id: 'h2', time: '13:00', end: '14:00', route: 'Route C — Airport',     bus: 'BUS-303', from: 'Downtown Hub',    to: 'Airport',           pax: 26, seats: 30 },
  ],
  [ // Friday
    { id: 'f1', time: '06:00', end: '07:00', route: 'Route C — Airport',     bus: 'BUS-303', from: 'Airport',         to: 'Downtown Hub',      pax: 25, seats: 30 },
    { id: 'f2', time: '09:00', end: '10:15', route: 'Route A — City Center', bus: 'BUS-101', from: 'Terminal North',  to: 'City Mall',         pax: 18, seats: 30 },
  ],
  [], // Saturday — rest
  [], // Sunday   — rest
];

const STATUS_CFG = {
  completed: { label: 'Done',     bg: COLORS.secondaryLight, text: COLORS.secondary, icon: 'checkmark-circle' },
  upcoming:  { label: 'Upcoming', bg: COLORS.primaryLight,   text: COLORS.primary,   icon: 'time-outline'     },
};

const getWeekDays = () => {
  const today  = new Date();
  const dow    = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

const tripStatus = (dayDate, time) => {
  const now = new Date();
  const eod = new Date(dayDate); eod.setHours(23, 59, 59, 999);
  const sod = new Date(dayDate); sod.setHours(0, 0, 0, 0);
  if (now > eod) return 'completed';
  if (now < sod) return 'upcoming';
  const [h, m] = time.split(':').map(Number);
  const dt = new Date(dayDate); dt.setHours(h, m, 0, 0);
  return now > dt ? 'completed' : 'upcoming';
};

const WeeklyScheduleScreen = ({ navigation }) => {
  const headerInsets  = useHeaderInsets();
  const weekScrollRef = useRef(null);
  const weekDays      = useMemo(() => getWeekDays(), []);

  const todayIdx = useMemo(() => {
    const t = new Date();
    const idx = weekDays.findIndex(
      d => d.getDate() === t.getDate() && d.getMonth() === t.getMonth()
    );
    return idx < 0 ? 0 : idx;
  }, [weekDays]);

  const [selectedIdx, setSelectedIdx] = useState(todayIdx);

  useEffect(() => {
    if (weekScrollRef.current && todayIdx > 1) {
      setTimeout(() => {
        weekScrollRef.current?.scrollTo({ x: (todayIdx - 1) * 74, animated: true });
      }, 350);
    }
  }, [todayIdx]);

  const selectedDay = weekDays[selectedIdx];

  const dayTrips = useMemo(() =>
    SCHEDULE[selectedIdx].map(t => ({
      ...t,
      status:    tripStatus(selectedDay, t.time),
      actualPax: tripStatus(selectedDay, t.time) === 'completed' ? t.pax : 0,
    })),
  [selectedIdx, selectedDay]);

  const totalTrips = SCHEDULE.reduce((sum, d) => sum + d.length, 0);
  const workDays   = SCHEDULE.filter(d => d.length > 0).length;

  const isToday = (idx) => {
    const t = new Date();
    return weekDays[idx].getDate() === t.getDate() && weekDays[idx].getMonth() === t.getMonth();
  };
  const isPast = (idx) => {
    const sod = new Date(); sod.setHours(0, 0, 0, 0);
    return weekDays[idx] < sod;
  };

  const dayLabel = `${DAY_FULL[selectedIdx]}, ${selectedDay.getDate()} ${MONTH_ABB[selectedDay.getMonth()]}`;

  const renderTrip = ({ item, index }) => {
    const cfg  = STATUS_CFG[item.status];
    const fill = item.seats > 0 ? item.actualPax / item.seats : 0;

    return (
      <View style={[styles.tripCard, index === dayTrips.length - 1 && { marginBottom: 0 }]}>
        {/* Time column */}
        <View style={styles.timeCol}>
          <Text style={styles.timeStart}>{item.time}</Text>
          <View style={styles.timeLine} />
          <Text style={styles.timeEnd}>{item.end}</Text>
        </View>

        {/* Content */}
        <View style={styles.tripContent}>
          {/* Top row */}
          <View style={styles.tripTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripRoute} numberOfLines={1}>{item.route}</Text>
              <Text style={styles.tripBus}>{item.bus}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={10} color={cfg.text} />
              <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
            </View>
          </View>

          {/* Journey */}
          <View style={styles.journey}>
            <View style={styles.journeyStop}>
              <View style={[styles.journeyDot, { backgroundColor: COLORS.secondary }]} />
              <Text style={styles.journeyPlace} numberOfLines={1}>{item.from}</Text>
            </View>
            <View style={styles.journeyArrow}>
              <View style={styles.journeyLine} />
              <Ionicons name="arrow-forward" size={10} color={COLORS.textMuted} />
            </View>
            <View style={[styles.journeyStop, { flex: 1 }]}>
              <View style={[styles.journeyDot, { backgroundColor: COLORS.danger }]} />
              <Text style={styles.journeyPlace} numberOfLines={1}>{item.to}</Text>
            </View>
          </View>

          {/* Pills */}
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Ionicons name="people-outline" size={10} color={COLORS.textMuted} />
              <Text style={styles.pillText}>
                {item.status === 'completed' ? `${item.actualPax}/${item.seats} pax` : `${item.seats} seats`}
              </Text>
            </View>
            {item.status === 'completed' && item.actualPax > 0 && (
              <View style={[styles.pill, { backgroundColor: COLORS.secondaryLight }]}>
                <Ionicons name="trending-up-outline" size={10} color={COLORS.secondary} />
                <Text style={[styles.pillText, { color: COLORS.secondary }]}>
                  {Math.round(fill * 100)}% full
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      {/* Header */}
      <View style={[styles.header, headerInsets]}>
        <View style={styles.headerDecor} />
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Weekly Schedule</Text>
            <Text style={styles.headerSub}>{totalTrips} trips · {workDays} working days</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Week day strip */}
        <ScrollView
          ref={weekScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekStrip}
        >
          {weekDays.map((day, idx) => {
            const count    = SCHEDULE[idx].length;
            const selected = selectedIdx === idx;
            const today    = isToday(idx);
            const past     = isPast(idx);

            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.dayChip,
                  selected && styles.dayChipSelected,
                  today && !selected && styles.dayChipToday,
                ]}
                onPress={() => setSelectedIdx(idx)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.dayAbbr,
                  selected && { color: COLORS.white },
                  past && !selected && { color: COLORS.secondary },
                ]}>
                  {DAY_ABBR[idx]}
                </Text>
                <Text style={[
                  styles.dayNum,
                  selected && { color: COLORS.white },
                  past && !selected && { color: COLORS.secondary },
                ]}>
                  {day.getDate()}
                </Text>
                {count > 0 ? (
                  <View style={[
                    styles.tripCountBadge,
                    selected && { backgroundColor: 'rgba(255,255,255,0.25)' },
                    past && !selected && { backgroundColor: COLORS.secondaryMid },
                  ]}>
                    <Text style={[
                      styles.tripCountText,
                      past && !selected && { color: COLORS.secondary },
                    ]}>{count}</Text>
                  </View>
                ) : (
                  <Text style={styles.offText}>Off</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Day header bar */}
      <View style={styles.dayBar}>
        <View>
          <Text style={styles.dayBarDate}>{dayLabel}</Text>
          {isToday(selectedIdx) && (
            <Text style={styles.dayBarToday}>Today</Text>
          )}
        </View>
        <View style={[
          styles.dayBarBadge,
          dayTrips.length === 0 && { backgroundColor: COLORS.surfaceAlt },
        ]}>
          <Text style={[
            styles.dayBarBadgeText,
            dayTrips.length === 0 && { color: COLORS.textMuted },
          ]}>
            {dayTrips.length > 0 ? `${dayTrips.length} trip${dayTrips.length !== 1 ? 's' : ''}` : 'Rest day'}
          </Text>
        </View>
      </View>

      {/* Trip list */}
      <FlatList
        data={dayTrips}
        keyExtractor={item => item.id}
        renderItem={renderTrip}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="bed-outline" size={36} color={COLORS.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Rest day</Text>
            <Text style={styles.emptySub}>No trips scheduled — enjoy your day off!</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Header */
  header: { backgroundColor: COLORS.headerBg, overflow: 'hidden' },
  headerDecor: {
    position: 'absolute', top: -50, right: -50,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '500' },

  /* Week strip */
  weekStrip: { paddingHorizontal: 14, paddingBottom: 14, gap: 6 },
  dayChip: {
    width: 64, alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  dayChipSelected: { backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.4)' },
  dayChipToday:    { borderColor: 'rgba(255,255,255,0.45)' },
  dayAbbr: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.4 },
  dayNum:  { fontSize: 19, fontWeight: '900', color: 'rgba(255,255,255,0.9)' },
  tripCountBadge: {
    minWidth: 22, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tripCountText: { fontSize: 10, fontWeight: '800', color: COLORS.white },
  offText: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.25)', paddingVertical: 2 },

  /* Day bar */
  dayBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  dayBarDate:  { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  dayBarToday: { fontSize: 11, fontWeight: '700', color: COLORS.primary, marginTop: 1 },
  dayBarBadge: {
    backgroundColor: COLORS.primaryLight, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  dayBarBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  /* List */
  list: { padding: 14, paddingBottom: 30 },

  /* Trip card */
  tripCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white, borderRadius: 18,
    marginBottom: 10, overflow: 'hidden',
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },

  /* Time column */
  timeCol: {
    width: 58, alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 6,
    backgroundColor: COLORS.primaryLight,
  },
  timeStart: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  timeLine:  { flex: 1, width: 2, backgroundColor: COLORS.primaryMid, marginVertical: 4, borderRadius: 1 },
  timeEnd:   { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },

  /* Content */
  tripContent: { flex: 1, padding: 12, gap: 8 },
  tripTopRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tripRoute:   { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.1 },
  tripBus:     { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0,
  },
  statusText: { fontSize: 9, fontWeight: '800' },

  /* Journey */
  journey: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  journeyStop:  { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  journeyDot:   { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  journeyPlace: { fontSize: 11, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  journeyArrow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5 },
  journeyLine:  { width: 10, height: 1.5, backgroundColor: COLORS.border },

  /* Pills */
  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surfaceAlt, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  pillText: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },

  /* Empty state */
  emptyWrap: { alignItems: 'center', paddingTop: 70, gap: 10 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  emptySub:   { fontSize: 13, color: COLORS.textMuted, fontWeight: '500', textAlign: 'center', paddingHorizontal: 32 },
});

export default WeeklyScheduleScreen;
