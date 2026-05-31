import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, FlatList, StatusBar, Alert, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { getPickerResult, clearPickerResult } from '../../utils/locationPickerResult';
import { useApp } from '../../context/AppContext';

// ── Drum Wheel Picker ──────────────────────────────────────────────────────────

const ITEM_H = 52;
const VISIBLE = 5; // must be odd
const PAD = Math.floor(VISIBLE / 2); // 2

const WheelColumn = ({ data, selected, onChange, width = 80 }) => {
  const ref    = useRef(null);
  const idx    = data.indexOf(selected);
  // Pad top and bottom so first/last items can reach center
  const allData = [...Array(PAD).fill(null), ...data, ...Array(PAD).fill(null)];

  // Scroll to the selected item on mount
  useEffect(() => {
    const offset = Math.max(0, idx) * ITEM_H;
    // Small delay so the FlatList has rendered
    setTimeout(() => ref.current?.scrollToOffset({ offset, animated: false }), 50);
  }, []);

  const handleScrollEnd = useCallback((e) => {
    const rawIdx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(rawIdx, data.length - 1));
    if (data[clamped] !== selected) {
      onChange(data[clamped]);
    }
    // Snap cleanly
    ref.current?.scrollToOffset({ offset: clamped * ITEM_H, animated: true });
  }, [data, selected, onChange]);

  return (
    <View style={{ width, height: ITEM_H * VISIBLE, overflow: 'hidden' }}>
      {/* Selection highlight band */}
      <View style={[styles.wheelHighlight, { top: ITEM_H * PAD }]} pointerEvents="none" />
      <FlatList
        ref={ref}
        data={allData}
        keyExtractor={(_, i) => String(i)}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * i, index: i })}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        renderItem={({ item, index }) => {
          const dataIdx = index - PAD;
          const isSelected = item !== null && dataIdx >= 0 && data[dataIdx] === selected;
          return (
            <View style={styles.wheelItem}>
              {item !== null ? (
                <Text style={[styles.wheelText, isSelected && styles.wheelTextSelected]}>
                  {item}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
};

// ── Time Picker Modal ──────────────────────────────────────────────────────────

const HOURS   = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, ' '));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

const TimePickerModal = ({ visible, hour, minute, ampm, onHour, onMinute, onAmpm, onDone, onClose }) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.timeOverlay}>
        <View style={[styles.timeSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.timeHeader}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.timeCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.timeTitle}>Select Time</Text>
            <TouchableOpacity onPress={onDone} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.timeDoneText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.wheelRow}>
            {/* Hours */}
            <WheelColumn data={HOURS} selected={hour} onChange={onHour} width={70} />
            {/* Colon */}
            <Text style={styles.wheelColon}>:</Text>
            {/* Minutes */}
            <WheelColumn data={MINUTES} selected={minute} onChange={onMinute} width={70} />
            {/* AM / PM */}
            <View style={styles.ampmCol}>
              {['AM', 'PM'].map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.ampmBtn, ampm === v && styles.ampmBtnActive]}
                  onPress={() => onAmpm(v)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.ampmText, ampm === v && styles.ampmTextActive]}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ── Date chips (next 14 days) ──────────────────────────────────────────────────

function buildDays() {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today  = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      key:   d.toISOString().slice(0, 10),
      day:   labels[d.getDay()],
      date:  d.getDate(),
      month: months[d.getMonth()],
      short: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : null,
    };
  });
}

const DAYS = buildDays();

const RECURRENCE = [
  { key: 'once',     label: 'One Time',  icon: 'checkmark-circle-outline' },
  { key: 'daily',    label: 'Daily',     icon: 'repeat-outline'           },
  { key: 'weekdays', label: 'Weekdays',  icon: 'calendar-outline'         },
  { key: 'weekly',   label: 'Weekly',    icon: 'sync-outline'             },
];

// ── Main Screen ────────────────────────────────────────────────────────────────

const TaxiReservationScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { addBooking } = useApp();
  const { fromStop, toStop, tripSummary } = route?.params ?? {};

  const [pickup,    setPickup]  = useState(fromStop?.stop_name ?? '');
  const [dest,      setDest]    = useState(toStop?.stop_name   ?? '');
  const [bookNow,   setBookNow] = useState(true);
  const [selDay,    setSelDay]  = useState(DAYS[0].key);
  const [hour,      setHour]    = useState('08');
  const [minute,    setMinute]  = useState('00');
  const [ampm,      setAmpm]    = useState('AM');
  const [recurr,    setRecurr]  = useState('once');
  const [notes,     setNotes]   = useState('');
  const [timeMod,   setTimeMod] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Receive picked location from MapLocationPickerScreen via module store
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      const r = getPickerResult();
      if (!r) return;
      if (r.field === 'pickup') setPickup(r.address);
      else setDest(r.address);
      clearPickerResult();
    });
    return unsub;
  }, [navigation]);

  const openMap = (field) => {
    navigation.navigate('MapLocationPicker', {
      field,
      title: field === 'pickup' ? 'Set Pickup Location' : 'Set Destination',
    });
  };

  const timeLabel = `${hour.trim()}:${minute} ${ampm}`;
  const selDayObj  = DAYS.find(d => d.key === selDay);
  const canConfirm = pickup.trim() && dest.trim() && (bookNow || minute !== null);

  const handleConfirm = () => {
    if (!canConfirm) {
      Alert.alert('Missing info', 'Please fill in pickup and destination' + (!bookNow ? ', and select a time' : '') + '.');
      return;
    }
    const selDayObjNow = DAYS.find(d => d.key === selDay);
    const when = bookNow
      ? 'Now'
      : `${selDayObjNow?.short ?? selDayObjNow?.day} ${selDayObjNow?.date} ${selDayObjNow?.month} at ${hour.trim()}:${minute} ${ampm}`;
    addBooking({
      _id: Date.now().toString(),
      type: 'taxi',
      bus: { name: 'Taxi Reservation', origin: pickup, destination: dest },
      seatId: null,
      seats: [],
      price: 0,
      date: new Date().toISOString(),
      status: 'upcoming',
      scheduledFor: when,
      recurrence: recurr,
      notes,
    });
    setConfirmed(true);
  };

  // ── Success screen ────────────────────────────────────────────────────────────
  if (confirmed) {
    const when = bookNow
      ? 'Now'
      : `${selDayObj?.short ?? selDayObj?.day} ${selDayObj?.date} ${selDayObj?.month} at ${timeLabel}`;
    const repeatLabel = RECURRENCE.find(r => r.key === recurr)?.label;

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirmed</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.successWrap} showsVerticalScrollIndicator={false}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={52} color={COLORS.white} />
          </View>
          <Text style={styles.successTitle}>
            {bookNow ? 'Taxi Booked!' : 'Reservation Placed!'}
          </Text>
          <Text style={styles.successSub}>
            {bookNow
              ? 'Your taxi is being arranged. You will be notified when a driver accepts.'
              : `Scheduled for ${when}${recurr !== 'once' ? ` · Repeats ${repeatLabel}` : ''}.`}
          </Text>

          <View style={styles.summaryCard}>
            <SummaryRow icon="location-outline" label="Pickup"      value={pickup} />
            <SummaryRow icon="flag-outline"     label="Destination" value={dest} />
            <SummaryRow icon="time-outline"     label="When"        value={bookNow ? 'Immediately' : when} />
            {!bookNow && recurr !== 'once' && (
              <SummaryRow icon="sync-outline" label="Recurring" value={repeatLabel} />
            )}
            {notes.trim() ? (
              <SummaryRow icon="chatbubble-outline" label="Driver notes" value={notes} />
            ) : null}
          </View>

          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => { setConfirmed(false); setPickup(''); setDest(''); setBookNow(true); setRecurr('once'); setNotes(''); }}
            activeOpacity={0.85}
          >
            <Text style={styles.newBtnText}>Make Another Reservation</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Booking form ──────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reserve a Taxi</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Trip summary badge from TripPlanner */}
        {tripSummary ? (
          <View style={styles.tripBadge}>
            <Ionicons name="git-branch-outline" size={14} color={COLORS.primary} />
            <Text style={styles.tripBadgeText}>Planned trip · {tripSummary}</Text>
          </View>
        ) : null}

        {/* ── Location Card ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Where are you going?</Text>

          {/* Pickup */}
          <TouchableOpacity style={styles.locRow} onPress={() => openMap('pickup')} activeOpacity={0.8}>
            <View style={[styles.locDot, { backgroundColor: COLORS.secondary }]} />
            <View style={styles.locTextWrap}>
              <Text style={styles.locLabel}>PICKUP</Text>
              <Text style={[styles.locValue, !pickup && styles.locPlaceholder]} numberOfLines={1}>
                {pickup || 'Tap to select on map'}
              </Text>
            </View>
            <View style={styles.mapBtn}>
              <Ionicons name="map-outline" size={16} color={COLORS.primary} />
            </View>
          </TouchableOpacity>

          <View style={styles.locDivider} />

          {/* Destination */}
          <TouchableOpacity style={styles.locRow} onPress={() => openMap('destination')} activeOpacity={0.8}>
            <View style={[styles.locDot, { backgroundColor: COLORS.danger }]} />
            <View style={styles.locTextWrap}>
              <Text style={styles.locLabel}>DESTINATION</Text>
              <Text style={[styles.locValue, !dest && styles.locPlaceholder]} numberOfLines={1}>
                {dest || 'Tap to select on map'}
              </Text>
            </View>
            <View style={styles.mapBtn}>
              <Ionicons name="map-outline" size={16} color={COLORS.primary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── When Card ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>When?</Text>

          <View style={styles.whenTabs}>
            <TouchableOpacity
              style={[styles.whenTab, bookNow && styles.whenTabActive]}
              onPress={() => setBookNow(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="flash" size={15} color={bookNow ? COLORS.white : COLORS.textMuted} />
              <Text style={[styles.whenTabText, bookNow && styles.whenTabTextActive]}>Book Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.whenTab, !bookNow && styles.whenTabActive]}
              onPress={() => setBookNow(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar" size={15} color={!bookNow ? COLORS.white : COLORS.textMuted} />
              <Text style={[styles.whenTabText, !bookNow && styles.whenTabTextActive]}>Schedule</Text>
            </TouchableOpacity>
          </View>

          {!bookNow && (
            <>
              {/* Date chips */}
              <Text style={styles.fieldLabel}>Date</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dayScroll}
              >
                {DAYS.map(d => (
                  <TouchableOpacity
                    key={d.key}
                    style={[styles.dayChip, selDay === d.key && styles.dayChipActive]}
                    onPress={() => setSelDay(d.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dayChipTop, selDay === d.key && styles.dayChipActiveText]}>
                      {d.short ?? d.day}
                    </Text>
                    <Text style={[styles.dayChipBot, selDay === d.key && styles.dayChipActiveText]}>
                      {d.date} {d.month}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Time selector — drum picker */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Time</Text>
              <TouchableOpacity style={styles.timeRow} onPress={() => setTimeMod(true)} activeOpacity={0.8}>
                <View style={styles.timeIconWrap}>
                  <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                </View>
                <Text style={styles.timeValue}>{timeLabel}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>

              {/* Repeat */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Repeat</Text>
              <View style={styles.recurrRow}>
                {RECURRENCE.map(r => (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.recurrChip, recurr === r.key && styles.recurrChipActive]}
                    onPress={() => setRecurr(r.key)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={r.icon}
                      size={13}
                      color={recurr === r.key ? COLORS.primary : COLORS.textMuted}
                    />
                    <Text style={[styles.recurrText, recurr === r.key && styles.recurrTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        {/* ── Notes Card ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notes for driver</Text>
          <TouchableOpacity style={styles.notesInput} activeOpacity={1}>
            <Ionicons name="chatbubble-outline" size={16} color={COLORS.textMuted} style={{ marginTop: 2 }} />
            <Text style={[styles.notesText, !notes && styles.notesPlaceholder]}>
              {notes || 'e.g. I have luggage, please wait at gate 2…'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Confirm ── */}
        <TouchableOpacity
          style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!canConfirm}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
          <Text style={styles.confirmBtnText}>
            {bookNow ? 'Confirm Booking' : 'Confirm Reservation'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Drum Wheel Time Picker Modal ── */}
      <TimePickerModal
        visible={timeMod}
        hour={hour}
        minute={minute}
        ampm={ampm}
        onHour={setHour}
        onMinute={setMinute}
        onAmpm={setAmpm}
        onDone={() => setTimeMod(false)}
        onClose={() => setTimeMod(false)}
      />
    </View>
  );
};

// ── Summary row (success screen) ──────────────────────────────────────────────
const SummaryRow = ({ icon, label, value }) => (
  <View style={styles.sumRow}>
    <View style={styles.sumIcon}>
      <Ionicons name={icon} size={14} color={COLORS.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={styles.sumValue}>{value}</Text>
    </View>
  </View>
);

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: COLORS.headerBg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white, letterSpacing: -0.2 },

  scroll:       { flex: 1 },
  scrollContent:{ padding: 16, paddingBottom: 48, gap: 14 },

  tripBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primaryLight, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.primaryMid,
  },
  tripBadgeText: { fontSize: 13, fontWeight: '600', color: COLORS.primary, flex: 1 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 16,
    shadowColor: '#1E293B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 14 },

  // Location rows
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  locDot:  { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  locTextWrap: { flex: 1 },
  locLabel: {
    fontSize: 10, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  locValue: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  locPlaceholder: { color: COLORS.textMuted, fontWeight: '400' },
  mapBtn: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  locDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8, marginLeft: 24 },

  // When tabs
  whenTabs: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  whenTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
  },
  whenTabActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  whenTabText:       { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  whenTabTextActive: { color: COLORS.white },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8 },

  // Day chips
  dayScroll:   { gap: 8, paddingRight: 4 },
  dayChip: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 12, backgroundColor: COLORS.background,
    borderWidth: 1.5, borderColor: COLORS.border, minWidth: 72,
  },
  dayChipActive:     { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  dayChipTop:        { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, marginBottom: 2 },
  dayChipBot:        { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
  dayChipActiveText: { color: COLORS.primary },

  // Time row
  timeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: COLORS.primaryMid, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: COLORS.primaryLight,
  },
  timeIconWrap: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
  },
  timeValue: { flex: 1, fontSize: 18, fontWeight: '800', color: COLORS.primary },

  // Recurrence
  recurrRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recurrChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  recurrChipActive:  { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  recurrText:        { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  recurrTextActive:  { color: COLORS.primary },

  // Notes
  notesInput: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: COLORS.background, minHeight: 70,
  },
  notesText:        { flex: 1, fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  notesPlaceholder: { color: COLORS.textMuted },

  // Confirm
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.warning ?? '#D97706', borderRadius: 16, paddingVertical: 16,
    shadowColor: COLORS.warning ?? '#D97706',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  confirmBtnDisabled: { backgroundColor: COLORS.border, shadowOpacity: 0 },
  confirmBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },

  // ── Wheel picker ─────────────────────────────────────────────────────────────
  timeOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  timeSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 8,
  },
  timeHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  timeTitle:      { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  timeCancelText: { fontSize: 15, fontWeight: '600', color: COLORS.textMuted },
  timeDoneText:   { fontSize: 15, fontWeight: '700', color: COLORS.primary },

  wheelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 20, paddingVertical: 16, gap: 4,
  },
  wheelHighlight: {
    position: 'absolute', left: 0, right: 0,
    height: ITEM_H,
    backgroundColor: COLORS.primaryLight,
    borderTopWidth: 1.5,    borderBottomWidth: 1.5,
    borderTopColor: COLORS.primaryMid, borderBottomColor: COLORS.primaryMid,
  },
  wheelItem: {
    height: ITEM_H, alignItems: 'center', justifyContent: 'center',
  },
  wheelText: {
    fontSize: 20, fontWeight: '400', color: COLORS.textMuted,
  },
  wheelTextSelected: {
    fontSize: 26, fontWeight: '700', color: COLORS.textPrimary,
  },
  wheelColon: {
    fontSize: 28, fontWeight: '800', color: COLORS.textPrimary,
    paddingBottom: 6, marginHorizontal: 2,
  },
  ampmCol: { marginLeft: 16, gap: 10, justifyContent: 'center' },
  ampmBtn: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  ampmBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  ampmText:      { fontSize: 15, fontWeight: '700', color: COLORS.textMuted },
  ampmTextActive:{ color: COLORS.white },

  // ── Success screen ────────────────────────────────────────────────────────────
  successWrap: { alignItems: 'center', padding: 24, paddingTop: 40 },
  successCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    shadowColor: COLORS.secondary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  successTitle: { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  successSub: {
    fontSize: 14, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 21, marginBottom: 28,
  },
  summaryCard: {
    width: '100%', backgroundColor: COLORS.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, gap: 12, marginBottom: 28,
  },
  sumRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sumIcon: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sumLabel: {
    fontSize: 10, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1,
  },
  sumValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  doneBtn: {
    width: '100%', backgroundColor: COLORS.primary,
    borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 12,
  },
  doneBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  newBtn:    { paddingVertical: 10 },
  newBtnText:{ fontSize: 14, fontWeight: '700', color: COLORS.textMuted },
});

export default TaxiReservationScreen;
