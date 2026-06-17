import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  Alert, Platform, StatusBar, Animated, ActivityIndicator, RefreshControl,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { COLORS, PURPLE } from '../../constants/colors';
import { getDriverTripsApi, startTripApi, completeTripApi, cancelTripApi } from '../../api/driverApi';
import { useGpsTracking } from '../../hooks/useGpsTracking';

const TRIP_STATUS = [
  { key: 'idle',       label: 'Not Started', icon: 'ellipse-outline',    color: COLORS.textMuted   },
  { key: 'active',     label: 'Trip Active',  icon: 'radio-button-on',   color: COLORS.secondary   },
  { key: 'break',      label: 'On Break',     icon: 'pause-circle',      color: COLORS.warning     },
  { key: 'completed',  label: 'Completed',    icon: 'checkmark-circle',  color: PURPLE.primary     },
];

function formatTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d) ? dateStr : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function normaliseTrip(t) {
  return {
    _id:           String(t.trip_id ?? t._id ?? ''),
    trip_id:       t.trip_id,
    routeName:     t.route_name  ?? t.routeName  ?? 'Route',
    busNumber:     t.plate_number ?? t.busNumber ?? (t.vehicle_model ?? 'Bus'),
    origin:        t.start_location ?? t.origin      ?? '—',
    destination:   t.end_location   ?? t.destination ?? '—',
    departureTime: formatTime(t.start_time ?? t.departureTime),
    arrivalTime:   formatTime(t.end_time   ?? t.arrivalTime),
    passengers:    t.passengers   ?? 0,
    totalSeats:    t.totalSeats   ?? t.capacity ?? 30,
    status:        t.status       ?? 'upcoming',
    earnings:      parseFloat(t.earnings ?? 0),
    stops:         t.stops        ?? 0,
    route_id:      t.route_id,
    vehicle_id:    t.vehicle_id,
  };
}

const STATUS_CFG = {
  // real backend values
  confirmed: { label: 'Upcoming',  bg: PURPLE.light,   text: PURPLE.primary,   dot: PURPLE.primary   },
  boarded:   { label: 'Boarding',  bg: PURPLE.light,   text: PURPLE.primary,   dot: PURPLE.primary   },
  ongoing:   { label: 'Active',    bg: COLORS.secondaryLight, text: COLORS.secondary, dot: COLORS.secondary },
  completed: { label: 'Completed', bg: COLORS.surfaceAlt,     text: COLORS.textMuted, dot: COLORS.textMuted },
  cancelled: { label: 'Cancelled', bg: COLORS.dangerLight,    text: COLORS.danger,    dot: COLORS.danger    },
  // legacy / fallback values
  upcoming:  { label: 'Upcoming',  bg: PURPLE.light,   text: PURPLE.primary,   dot: PURPLE.primary   },
  active:    { label: 'Active',    bg: COLORS.secondaryLight, text: COLORS.secondary, dot: COLORS.secondary },
};

// Status classification helpers
const isActiveStatus    = (s) => ['ongoing', 'active', 'in_progress'].includes(s);
const isDoneStatus      = (s) => ['completed', 'cancelled', 'closed'].includes(s);
// anything else (confirmed, boarded, upcoming, pending, scheduled) → can be started

// ── Trip Detail Modal ────────────────────────────────────────────────────────
const TripDetailModal = ({ trip, actionLoading, insets, onClose, onStart, onEnd, onOpenMap, onCancel, onManifest }) => {
  // Hooks must come before any early return
  const sheetY    = useRef(new Animated.Value(600)).current;
  const dragBase  = useRef(0);

  useEffect(() => {
    Animated.spring(sheetY, {
      toValue:         0,
      useNativeDriver: false,
      friction:        10,
      tension:         60,
    }).start();
  }, [sheetY]);

  const swipePan = useRef(
    PanResponder.create({
      // Attached only to the handle strip — never fights the ScrollView
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        sheetY.stopAnimation((val) => { dragBase.current = val; });
      },
      onPanResponderMove: (_, { dy }) => {
        sheetY.setValue(Math.max(0, dragBase.current + dy));
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const projected = dragBase.current + dy;
        if (projected > 120 || vy > 0.4) {
          Animated.timing(sheetY, {
            toValue:         700,
            duration:        200,
            useNativeDriver: false,
          }).start(() => {
            sheetY.setValue(600);
            onClose();
          });
        } else {
          Animated.spring(sheetY, {
            toValue:         0,
            useNativeDriver: false,
            friction:        9,
            tension:         70,
          }).start();
        }
      },
    })
  ).current;

  if (!trip) return null;

  const isLoading = actionLoading === trip.trip_id;
  const cfg       = STATUS_CFG[trip.status] || STATUS_CFG.upcoming;
  const fill      = Math.min(trip.passengers / (trip.totalSeats || 1), 1);
  const barColor  = fill >= 0.9 ? COLORS.danger : fill >= 0.6 ? COLORS.warning : COLORS.secondary;
  const done      = isDoneStatus(trip.status);
  const active    = isActiveStatus(trip.status);

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Full-screen flex column: overlay (flex:1) + sheet at bottom */}
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>

        {/* Dim overlay — takes all space above the sheet */}
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Bottom sheet */}
        <Animated.View style={[modalStyles.sheet, { paddingBottom: (insets?.bottom ?? 0) + 20, transform: [{ translateY: sheetY }] }]}>
          <View style={modalStyles.handleArea} {...swipePan.panHandlers}>
            <View style={modalStyles.handle} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* Header row */}
            <View style={modalStyles.header}>
              <View style={modalStyles.busIcon}>
                <Ionicons name="bus" size={20} color={PURPLE.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.routeName}>{trip.routeName}</Text>
                <Text style={modalStyles.busNum}>{trip.busNumber} · {trip.stops} stops</Text>
              </View>
              <View style={[modalStyles.statusBadge, { backgroundColor: cfg.bg }]}>
                <View style={[modalStyles.statusDot, { backgroundColor: cfg.dot }]} />
                <Text style={[modalStyles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
              </View>
            </View>

            {/* Journey — vertical timeline */}
            <View style={modalStyles.journeyRow}>
              <View style={modalStyles.rail}>
                <View style={[modalStyles.journeyDot, { backgroundColor: COLORS.secondary }]} />
                <View style={modalStyles.railLine} />
                <View style={[modalStyles.journeyDot, { backgroundColor: COLORS.danger }]} />
              </View>
              <View style={modalStyles.journeyCol}>
                <View>
                  <Text style={modalStyles.journeyLbl}>FROM</Text>
                  <Text style={modalStyles.journeyPlace} numberOfLines={2}>{trip.origin}</Text>
                  <Text style={modalStyles.journeyTime}>{trip.departureTime}</Text>
                </View>
                <View>
                  <Text style={modalStyles.journeyLbl}>TO</Text>
                  <Text style={modalStyles.journeyPlace} numberOfLines={2}>{trip.destination}</Text>
                  <Text style={modalStyles.journeyTime}>{trip.arrivalTime}</Text>
                </View>
              </View>
            </View>

            {/* Stats */}
            <View style={modalStyles.statRow}>
              <View style={modalStyles.stat}>
                <Ionicons name="people-outline" size={14} color={COLORS.textMuted} />
                <Text style={modalStyles.statLbl}>Passengers</Text>
                <Text style={modalStyles.statVal}>{trip.passengers} / {trip.totalSeats}</Text>
              </View>
              <View style={modalStyles.stat}>
                <Ionicons name="cash-outline" size={14} color={COLORS.secondary} />
                <Text style={modalStyles.statLbl}>Earnings</Text>
                <Text style={[modalStyles.statVal, { color: COLORS.secondary }]}>{fmtMoney(trip.earnings)}</Text>
              </View>
              <View style={modalStyles.stat}>
                <Ionicons name="map-outline" size={14} color={PURPLE.primary} />
                <Text style={modalStyles.statLbl}>Stops</Text>
                <Text style={modalStyles.statVal}>{trip.stops}</Text>
              </View>
            </View>

            {/* Passenger fill bar */}
            <View style={modalStyles.fillBarTrack}>
              <View style={[modalStyles.fillBarFill, { width: `${fill * 100}%`, backgroundColor: barColor }]} />
            </View>

            {/* ── Action buttons ── */}
            {done && (
              <View style={modalStyles.doneNote}>
                <Ionicons name="checkmark-done-circle" size={16} color={COLORS.textMuted} />
                <Text style={modalStyles.doneNoteText}>
                  Trip {trip.status}. No further actions available.
                </Text>
              </View>
            )}

            {active && !done && (
              <View style={modalStyles.actionRow}>
                <TouchableOpacity
                  style={modalStyles.mapBtn}
                  onPress={() => onOpenMap(trip)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="navigate" size={16} color={PURPLE.primary} />
                  <Text style={modalStyles.mapBtnText}>Open Map</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modalStyles.endBtn, isLoading && { opacity: 0.6 }]}
                  onPress={() => onEnd(trip)}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading
                    ? <ActivityIndicator size="small" color={COLORS.white} />
                    : <Ionicons name="stop-circle" size={20} color={COLORS.white} />
                  }
                  <Text style={modalStyles.endBtnText}>{isLoading ? 'Ending…' : 'End Trip'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {!active && !done && (
              <TouchableOpacity
                style={[modalStyles.startBtn, isLoading && { opacity: 0.6 }]}
                onPress={() => onStart(trip)}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <Ionicons name="play-circle" size={20} color={COLORS.white} />
                }
                <Text style={modalStyles.startBtnText}>{isLoading ? 'Starting…' : 'Start Trip'}</Text>
              </TouchableOpacity>
            )}

            {!done && (
              <TouchableOpacity
                style={[modalStyles.cancelBtn, isLoading && { opacity: 0.6 }]}
                onPress={() => onCancel(trip)}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <Ionicons name="close-circle-outline" size={18} color={COLORS.danger} />
                <Text style={modalStyles.cancelBtnText}>Cancel Trip</Text>
              </TouchableOpacity>
            )}

            {/* Manifest — always visible regardless of status */}
            <TouchableOpacity
              style={modalStyles.manifestBtn}
              onPress={() => onManifest(trip)}
              activeOpacity={0.85}
            >
              <Ionicons name="people-outline" size={16} color={PURPLE.primary} />
              <Text style={modalStyles.manifestBtnText}>View Passenger Manifest</Text>
            </TouchableOpacity>

            <View style={{ height: 8 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 16, paddingHorizontal: 20,
    maxHeight: '65%',
  },
  handleArea: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 20,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  busIcon: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: PURPLE.light, alignItems: 'center', justifyContent: 'center',
  },
  routeName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  busNum:    { fontSize: 12, color: COLORS.textMuted, fontWeight: '600', marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  journeyRow: {
    flexDirection: 'row', gap: 12,
    paddingVertical: 14, marginBottom: 14,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border,
  },
  rail: { width: 10, alignItems: 'center', paddingTop: 4 },
  railLine: { width: 2, flex: 1, minHeight: 16, backgroundColor: COLORS.border, marginVertical: 4, borderRadius: 1 },
  journeyCol: { flex: 1, gap: 12 },
  journeyDot:  { width: 9, height: 9, borderRadius: 5 },
  journeyLbl:  { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  journeyPlace:{ fontSize: 13, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2, lineHeight: 17 },
  journeyTime: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500', marginTop: 1 },

  statRow: { flexDirection: 'row', marginBottom: 12 },
  stat:    { flex: 1, alignItems: 'center', gap: 4 },
  statLbl: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  statVal: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },

  fillBarTrack: { height: 6, backgroundColor: COLORS.border, borderRadius: 99, overflow: 'hidden', marginBottom: 20 },
  fillBarFill:  { height: '100%', borderRadius: 99 },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.secondary, borderRadius: 14, paddingVertical: 16,
    shadowColor: COLORS.secondary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  startBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },

  actionRow: { flexDirection: 'row', gap: 10 },
  mapBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PURPLE.light, borderRadius: 14, paddingVertical: 15,
    borderWidth: 1.5, borderColor: PURPLE.primary,
  },
  mapBtnText: { fontSize: 14, fontWeight: '700', color: PURPLE.primary },
  endBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.danger, borderRadius: 14, paddingVertical: 15,
    shadowColor: COLORS.danger, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 5,
  },
  endBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  doneNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.background, borderRadius: 12, padding: 14,
  },
  doneNoteText: { flex: 1, fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },

  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.danger, borderRadius: 14, paddingVertical: 13,
    marginTop: 10, backgroundColor: COLORS.dangerLight,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.danger },

  manifestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: PURPLE.primary, borderRadius: 14, paddingVertical: 13,
    marginTop: 10, backgroundColor: PURPLE.light,
  },
  manifestBtnText: { fontSize: 14, fontWeight: '700', color: PURPLE.primary },
});

// ─────────────────────────────────────────────────────────────────────────────

const DriverDashboardScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { currency, fmtMoney } = useApp();
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(20)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const timerRef   = useRef(null);
  const [tripStatus, setTripStatus] = useState('active');
  const [trips,         setTrips]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedTrip,  setSelectedTrip]  = useState(null);

  const loadTrips = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await getDriverTripsApi();
      const data = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.trips) ? res.data.trips : []);
      setTrips(data.map(normaliseTrip));
    } catch {
      setTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleStartTrip = (trip) => {
    Alert.alert('Start Trip', `Start ${trip.routeName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start', onPress: async () => {
          setActionLoading(trip.trip_id);
          try {
            await startTripApi(trip.trip_id);
            setSelectedTrip(null);
            loadTrips(true);
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.error || 'Could not start trip.');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleEndTrip = (trip) => {
    Alert.alert('End Trip', `Mark ${trip.routeName} as completed?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Trip', style: 'destructive', onPress: async () => {
          setActionLoading(trip.trip_id);
          try {
            await completeTripApi(trip.trip_id);
            setSelectedTrip(null);
            loadTrips(true);
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.error || 'Could not complete trip.');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleCancelTrip = (trip) => {
    Alert.alert(
      'Cancel Trip',
      `Are you sure you want to cancel ${trip.routeName}? This cannot be undone.`,
      [
        { text: 'Keep Trip', style: 'cancel' },
        {
          text: 'Cancel Trip', style: 'destructive', onPress: async () => {
            setActionLoading(trip.trip_id);
            try {
              await cancelTripApi(trip.trip_id);
              setSelectedTrip(null);
              loadTrips(true);
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.error || 'Could not cancel trip.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();

    loadTrips();
    timerRef.current = setInterval(() => loadTrips(true), 30000);

    return () => { pulse.stop(); clearInterval(timerRef.current); };
  }, [loadTrips]);

  const activeTrip    = trips.find(t => isActiveStatus(t.status));
  useGpsTracking(activeTrip?.trip_id ?? null);
  const upcomingCount = trips.filter(t => !isActiveStatus(t.status) && !isDoneStatus(t.status)).length;
  const doneToday     = trips.filter(t => isDoneStatus(t.status)).length;
  const earnedToday   = trips.filter(t => isDoneStatus(t.status)).reduce((s, t) => s + t.earnings, 0);

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'DR';

  const currentStatus = TRIP_STATUS.find(s => s.key === tripStatus);

  const handleStatusChange = (key) => {
    if (key === 'completed') {
      Alert.alert('End Trip', 'Mark this trip as completed?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => setTripStatus(key) },
      ]);
    } else {
      setTripStatus(key);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* ─── Header ─── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerDecor1} />
        <View style={styles.headerDecor2} />

        {/* Top row */}
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerGreet}>Good morning,</Text>
            <Text style={styles.headerName}>{user?.name ?? 'Driver'}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => navigation.navigate('DriverNotifications')}
            >
              <Ionicons name="notifications-outline" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate('DriverProfile')} activeOpacity={0.8}>
              <Text style={styles.avatarText}>{initials}</Text>
              <View style={styles.avatarOnline} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Status control row — only when a trip is active */}
        {activeTrip && (
          <View style={styles.statusControl}>
            <View style={styles.statusLeft}>
              <Animated.View style={[styles.livePulse, { transform: [{ scale: pulseAnim }] }]} />
              <View style={[styles.statusDot, { backgroundColor: COLORS.secondary }]} />
              <View>
                <Text style={styles.statusLabel}>Trip Status</Text>
                <Text style={styles.statusValue}>Active</Text>
              </View>
            </View>
            <View style={styles.statusBtns}>
              {TRIP_STATUS.filter(s => s.key !== 'idle').map(s => (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.statusBtn, tripStatus === s.key && { backgroundColor: s.color }]}
                  onPress={() => handleStatusChange(s.key)}
                >
                  <Ionicons
                    name={s.icon}
                    size={13}
                    color={tripStatus === s.key ? COLORS.white : COLORS.textMuted}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* ─── Stats strip ─── */}
      <View style={styles.statsStrip}>
        {[
          { icon: 'radio-button-on', label: 'Active',   value: activeTrip ? '1' : '0', color: COLORS.secondary },
          { icon: 'time-outline',    label: 'Upcoming', value: String(upcomingCount),   color: PURPLE.primary   },
          { icon: 'checkmark-circle',label: 'Done',     value: String(doneToday),       color: PURPLE.primary   },
          { icon: 'cash-outline',    label: 'Earned',   value: fmtMoney(earnedToday), color: COLORS.secondary },
        ].map((s, i) => (
          <View key={s.label} style={[styles.statItem, i < 3 && styles.statBorder]}>
            <Ionicons name={s.icon} size={16} color={s.color} />
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {loading && trips.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PURPLE.primary ?? PURPLE.primary} />
        </View>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadTrips(true); }}
            colors={[PURPLE.primary]}
            tintColor={PURPLE.primary}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ─── Quick Actions ─── */}
          <View style={styles.actionsRow}>
            {[
              { icon: 'navigate',      label: 'Navigate',   color: PURPLE.primary,    bg: PURPLE.light,   onPress: () => navigation.navigate('TripChecklist')   },
              { icon: 'qr-code',       label: 'Scan QR',    color: COLORS.secondary,  bg: COLORS.secondaryLight, onPress: () => navigation.navigate('PassengerVerify', { tripId: activeTrip?.trip_id ?? null })  },
              { icon: 'calendar',      label: 'Schedule',   color: PURPLE.primary,    bg: PURPLE.light,   onPress: () => navigation.navigate('WeeklySchedule')   },
              { icon: 'warning',       label: 'Emergency',  color: COLORS.danger,     bg: COLORS.dangerLight,    onPress: () => navigation.navigate('Emergency')        },
            ].map(a => (
              <TouchableOpacity key={a.label} style={styles.actionBtn} activeOpacity={0.8} onPress={a.onPress}>
                <View style={[styles.actionIcon, { backgroundColor: a.bg }]}>
                  <Ionicons name={a.icon} size={22} color={a.color} />
                </View>
                <Text style={styles.actionLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ─── Active Trip Banner ─── */}
          {activeTrip && (
            <TouchableOpacity
              style={styles.activeBanner}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('DriverMap', {
                  tripId:    activeTrip._id,
                  routeId:   activeTrip.route_id,
                  routeName: activeTrip.routeName,
                  busNumber: activeTrip.busNumber,
                })}
            >
              <View style={styles.bannerLeft}>
                <View style={styles.bannerLiveDot} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.bannerTitle} numberOfLines={1}>Active Trip in Progress</Text>
                  <Text style={styles.bannerSub} numberOfLines={1}>{activeTrip.origin} → {activeTrip.destination}</Text>
                </View>
              </View>
              <View style={styles.bannerBtn}>
                <Ionicons name="map" size={13} color={COLORS.white} />
                <Text style={styles.bannerBtnText} numberOfLines={1}>Open Map</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* ─── Today's Schedule ─── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            <TouchableOpacity onPress={() => navigation.navigate('WeeklySchedule')}>
              <Text style={styles.sectionLink}>Week View</Text>
            </TouchableOpacity>
          </View>

          {trips.map(trip => {
            const cfg  = STATUS_CFG[trip.status] || STATUS_CFG.upcoming;
            const fill = Math.min(trip.passengers / trip.totalSeats, 1);
            const barColor = fill >= 0.9 ? COLORS.danger : fill >= 0.6 ? COLORS.warning : COLORS.secondary;

            return (
              <TouchableOpacity
                key={trip._id}
                style={styles.tripCard}
                activeOpacity={0.85}
                onPress={() => setSelectedTrip(trip)}
              >
                {/* Card header */}
                <View style={styles.tripCardHeader}>
                  <View style={styles.tripIconWrap}>
                    <Ionicons name="bus" size={18} color={PURPLE.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripRouteName}>{trip.routeName}</Text>
                    <Text style={styles.tripBusNum}>{trip.busNumber} · {trip.stops} stops</Text>
                  </View>
                  <View style={[styles.tripStatusBadge, { backgroundColor: cfg.bg }]}>
                    <View style={[styles.tripStatusDot, { backgroundColor: cfg.dot }]} />
                    <Text style={[styles.tripStatusText, { color: cfg.text }]}>{cfg.label}</Text>
                  </View>
                </View>

                {/* Journey — vertical timeline (responsive for long stop names) */}
                <View style={styles.journeyRow}>
                  <View style={styles.rail}>
                    <View style={[styles.journeyDot, { backgroundColor: COLORS.secondary }]} />
                    <View style={styles.railLine} />
                    <View style={[styles.journeyDot, { backgroundColor: COLORS.danger }]} />
                  </View>
                  <View style={styles.journeyCol}>
                    <View>
                      <Text style={styles.journeyLbl}>FROM</Text>
                      <Text style={styles.journeyPlace} numberOfLines={2}>{trip.origin}</Text>
                      <Text style={styles.journeyTime}>{trip.departureTime}</Text>
                    </View>
                    <View>
                      <Text style={styles.journeyLbl}>TO</Text>
                      <Text style={styles.journeyPlace} numberOfLines={2}>{trip.destination}</Text>
                      <Text style={styles.journeyTime}>{trip.arrivalTime}</Text>
                    </View>
                  </View>
                </View>

                {/* Footer */}
                <View style={styles.tripFooter}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.passengerMeta}>
                      <Ionicons name="people-outline" size={12} color={COLORS.textMuted} />
                      <Text style={styles.passengerMetaText}>{trip.passengers} / {trip.totalSeats} boarded</Text>
                    </View>
                    <View style={styles.fillBar}>
                      <View style={[styles.fillFill, { width: `${fill * 100}%`, backgroundColor: barColor }]} />
                    </View>
                  </View>
                  <View style={styles.earningsChip}>
                    <Ionicons name="cash-outline" size={12} color={COLORS.secondary} />
                    <Text style={styles.earningsText}>{fmtMoney(trip.earnings)}</Text>
                  </View>
                </View>

                {/* Tap hint */}
                <View style={styles.tripTapHint}>
                  <Ionicons name="information-circle-outline" size={12} color={COLORS.textMuted} />
                  <Text style={styles.tripTapHintText}>Tap to view details & actions</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={{ height: 32 }} />
        </Animated.View>
      </ScrollView>

      {/* ─── Trip Detail Modal ─── */}
      <TripDetailModal
        trip={selectedTrip}
        actionLoading={actionLoading}
        insets={insets}
        onClose={() => setSelectedTrip(null)}
        onStart={handleStartTrip}
        onEnd={handleEndTrip}
        onCancel={handleCancelTrip}
        onManifest={(trip) => {
          setSelectedTrip(null);
          navigation.navigate('PassengerList', { tripId: trip._id, routeName: trip.routeName });
        }}
        onOpenMap={(trip) => {
          setSelectedTrip(null);
          navigation.navigate('DriverMap', {
            tripId:    trip._id,
            routeId:   trip.route_id,
            routeName: trip.routeName,
            busNumber: trip.busNumber,
          });
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  /* Header */
  header: {
    backgroundColor: PURPLE.deep,
    paddingHorizontal: 20,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  headerDecor1: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerDecor2: {
    position: 'absolute', top: 20, right: 60,
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  headerGreet: { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  headerName: { fontSize: 20, fontWeight: '800', color: COLORS.white, marginTop: 2, letterSpacing: -0.2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: COLORS.white },
  avatarOnline: {
    position: 'absolute', bottom: 1, right: 1,
    width: 11, height: 11, borderRadius: 5.5,
    backgroundColor: COLORS.secondary, borderWidth: 2, borderColor: PURPLE.deep,
  },

  /* Status control */
  statusControl: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 12,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  livePulse: {
    position: 'absolute', left: -4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(16,185,129,0.3)',
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase' },
  statusValue: { fontSize: 13, fontWeight: '700', color: COLORS.white, marginTop: 1 },
  statusBtns: { flexDirection: 'row', gap: 6 },
  statusBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Stats strip */
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 3,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statBorder: { borderRightWidth: 1, borderRightColor: COLORS.border },
  statValue: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },

  /* Actions */
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 16, marginTop: 4 },
  actionBtn: { flex: 1, alignItems: 'center', gap: 7 },
  actionIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  actionLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, textAlign: 'center' },

  /* Active banner */
  activeBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: PURPLE.primary, borderRadius: 16, padding: 14, marginBottom: 16,
    shadowColor: PURPLE.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  bannerLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerLiveDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: COLORS.secondary, flexShrink: 0 },
  bannerTitle: { fontSize: 13, fontWeight: '800', color: COLORS.white },
  bannerSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: '500' },
  bannerBtn: {
    flexShrink: 0, marginLeft: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
  },
  bannerBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  /* Section header */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.2 },
  sectionLink: { fontSize: 12, fontWeight: '700', color: PURPLE.primary },

  /* Trip card */
  tripCard: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 15, marginBottom: 10,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  tripCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  tripIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: PURPLE.light, alignItems: 'center', justifyContent: 'center',
  },
  tripRouteName: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.1 },
  tripBusNum: { fontSize: 11, color: COLORS.textMuted, marginTop: 1, fontWeight: '600' },
  tripStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
  },
  tripStatusDot: { width: 5, height: 5, borderRadius: 2.5 },
  tripStatusText: { fontSize: 10, fontWeight: '700' },

  /* Journey — vertical timeline */
  journeyRow: {
    flexDirection: 'row', gap: 12,
    paddingBottom: 12, marginBottom: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rail: { width: 10, alignItems: 'center', paddingTop: 4 },
  railLine: { width: 2, flex: 1, minHeight: 16, backgroundColor: COLORS.border, marginVertical: 4, borderRadius: 1 },
  journeyCol: { flex: 1, gap: 12 },
  journeyDot: { width: 9, height: 9, borderRadius: 5 },
  journeyLbl: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  journeyPlace: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2, lineHeight: 17 },
  journeyTime: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500', marginTop: 1 },

  /* Footer */
  tripFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  passengerMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  passengerMetaText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  fillBar: { height: 4, backgroundColor: COLORS.border, borderRadius: 99, overflow: 'hidden' },
  fillFill: { height: '100%', borderRadius: 99 },
  earningsChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.secondaryLight, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  earningsText: { fontSize: 13, fontWeight: '800', color: COLORS.secondary },
  tripTapHint: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  tripTapHintText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },

});

export default DriverDashboardScreen;
