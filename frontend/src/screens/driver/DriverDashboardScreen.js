import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Platform, StatusBar, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';

const TRIP_STATUS = [
  { key: 'idle',       label: 'Not Started', icon: 'ellipse-outline',    color: COLORS.textMuted   },
  { key: 'active',     label: 'Trip Active',  icon: 'radio-button-on',   color: COLORS.secondary   },
  { key: 'break',      label: 'On Break',     icon: 'pause-circle',      color: COLORS.warning     },
  { key: 'completed',  label: 'Completed',    icon: 'checkmark-circle',  color: COLORS.primary     },
];

const MOCK_TRIPS = [
  {
    _id: '1', routeName: 'Route A — City Center', busNumber: 'BUS-101',
    origin: 'Terminal North', destination: 'City Mall',
    departureTime: '08:00', arrivalTime: '09:15',
    passengers: 18, totalSeats: 30, status: 'active', earnings: 54.00,
    stops: 6,
  },
  {
    _id: '2', routeName: 'Route B — University', busNumber: 'BUS-202',
    origin: 'Central Station', destination: 'University Campus',
    departureTime: '10:30', arrivalTime: '11:20',
    passengers: 24, totalSeats: 30, status: 'upcoming', earnings: 72.00,
    stops: 4,
  },
  {
    _id: '3', routeName: 'Route C — Airport Express', busNumber: 'BUS-303',
    origin: 'Downtown Hub', destination: 'International Airport',
    departureTime: '06:00', arrivalTime: '07:00',
    passengers: 28, totalSeats: 30, status: 'completed', earnings: 84.00,
    stops: 3,
  },
];

const STATUS_CFG = {
  active:    { label: 'Active',    bg: COLORS.secondaryLight, text: COLORS.secondary, dot: COLORS.secondary },
  upcoming:  { label: 'Upcoming',  bg: COLORS.primaryLight,   text: COLORS.primary,   dot: COLORS.primary   },
  completed: { label: 'Completed', bg: COLORS.surfaceAlt,     text: COLORS.textMuted, dot: COLORS.textMuted },
  cancelled: { label: 'Cancelled', bg: COLORS.dangerLight,    text: COLORS.danger,    dot: COLORS.danger    },
};

const DriverDashboardScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(20)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const [tripStatus, setTripStatus] = useState('active');
  const [trips] = useState(MOCK_TRIPS);

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
    return () => pulse.stop();
  }, []);

  const activeTrip    = trips.find(t => t.status === 'active');
  const upcomingCount = trips.filter(t => t.status === 'upcoming').length;
  const doneToday     = trips.filter(t => t.status === 'completed').length;
  const earnedToday   = trips.filter(t => t.status === 'completed').reduce((s, t) => s + t.earnings, 0);

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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

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
              onPress={() => Alert.alert('No new notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate('DriverProfile')} activeOpacity={0.8}>
              <Text style={styles.avatarText}>{initials}</Text>
              <View style={styles.avatarOnline} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Status control row */}
        <View style={styles.statusControl}>
          <View style={styles.statusLeft}>
            {tripStatus === 'active' && (
              <Animated.View style={[styles.livePulse, { transform: [{ scale: pulseAnim }] }]} />
            )}
            <View style={[styles.statusDot, { backgroundColor: currentStatus.color }]} />
            <View>
              <Text style={styles.statusLabel}>Trip Status</Text>
              <Text style={styles.statusValue}>{currentStatus.label}</Text>
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
      </View>

      {/* ─── Stats strip ─── */}
      <View style={styles.statsStrip}>
        {[
          { icon: 'radio-button-on', label: 'Active',   value: activeTrip ? '1' : '0', color: COLORS.secondary },
          { icon: 'time-outline',    label: 'Upcoming', value: String(upcomingCount),   color: COLORS.primary   },
          { icon: 'checkmark-circle',label: 'Done',     value: String(doneToday),       color: COLORS.primary   },
          { icon: 'cash-outline',    label: 'Earned',   value: `$${earnedToday.toFixed(0)}`, color: COLORS.secondary },
        ].map((s, i) => (
          <View key={s.label} style={[styles.statItem, i < 3 && styles.statBorder]}>
            <Ionicons name={s.icon} size={16} color={s.color} />
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ─── Quick Actions ─── */}
          <View style={styles.actionsRow}>
            {[
              { icon: 'navigate',      label: 'Navigate',   color: COLORS.primary,    bg: COLORS.primaryLight,  onPress: () => navigation.navigate('TripChecklist')  },
              { icon: 'qr-code',       label: 'Scan QR',    color: COLORS.secondary,  bg: COLORS.secondaryLight, onPress: () => navigation.navigate('PassengerVerify') },
              { icon: 'people',        label: 'Passengers', color: COLORS.primary,    bg: COLORS.primaryLight,  onPress: () => navigation.navigate('PassengerList')   },
              { icon: 'warning',       label: 'Emergency',  color: COLORS.danger,     bg: COLORS.dangerLight,   onPress: () => navigation.navigate('Emergency')       },
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
              onPress={() => navigation.navigate('DriverMap')}
            >
              <View style={styles.bannerLeft}>
                <View style={styles.bannerLiveDot} />
                <View>
                  <Text style={styles.bannerTitle}>Active Trip in Progress</Text>
                  <Text style={styles.bannerSub}>{activeTrip.origin} → {activeTrip.destination}</Text>
                </View>
              </View>
              <View style={styles.bannerBtn}>
                <Ionicons name="map" size={13} color={COLORS.white} />
                <Text style={styles.bannerBtnText}>Open Map</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* ─── Today's Schedule ─── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            <TouchableOpacity onPress={() => navigation.navigate('DriverTripHistory')}>
              <Text style={styles.sectionLink}>View All</Text>
            </TouchableOpacity>
          </View>

          {trips.map(trip => {
            const cfg  = STATUS_CFG[trip.status] || STATUS_CFG.upcoming;
            const fill = trip.passengers / trip.totalSeats;
            const barColor = fill >= 0.9 ? COLORS.danger : fill >= 0.6 ? COLORS.warning : COLORS.secondary;

            return (
              <TouchableOpacity
                key={trip._id}
                style={styles.tripCard}
                activeOpacity={0.85}
                onPress={() => {
                  if (trip.status === 'active') navigation.navigate('DriverMap', { tripId: trip._id });
                  else if (trip.status === 'upcoming') navigation.navigate('TripChecklist', { tripId: trip._id, tripInfo: trip });
                }}
              >
                {/* Card header */}
                <View style={styles.tripCardHeader}>
                  <View style={styles.tripIconWrap}>
                    <Ionicons name="bus" size={18} color={COLORS.primary} />
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

                {/* Journey */}
                <View style={styles.journeyRow}>
                  <View style={styles.journeyStop}>
                    <View style={[styles.journeyDot, { backgroundColor: COLORS.secondary }]} />
                    <View>
                      <Text style={styles.journeyLbl}>FROM</Text>
                      <Text style={styles.journeyPlace}>{trip.origin}</Text>
                      <Text style={styles.journeyTime}>{trip.departureTime}</Text>
                    </View>
                  </View>
                  <View style={styles.journeyMid}>
                    <View style={styles.jLine} />
                    <View style={styles.jChip}>
                      <Ionicons name="bus-outline" size={11} color={COLORS.primary} />
                    </View>
                    <View style={styles.jLine} />
                  </View>
                  <View style={[styles.journeyStop, { alignItems: 'flex-end' }]}>
                    <View style={[styles.journeyDot, { backgroundColor: COLORS.danger }]} />
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.journeyLbl}>TO</Text>
                      <Text style={styles.journeyPlace}>{trip.destination}</Text>
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
                    <Text style={styles.earningsText}>${trip.earnings.toFixed(2)}</Text>
                  </View>
                </View>

                {trip.status === 'active' && (
                  <View style={styles.openMapRow}>
                    <Ionicons name="navigate-circle" size={13} color={COLORS.primary} />
                    <Text style={styles.openMapText}>Tap to open live navigation</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* ─── Sign Out ─── */}
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => Alert.alert('Sign Out', 'Sign out of your account?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: logout },
            ])}
          >
            <Ionicons name="log-out-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },

  /* Header */
  header: {
    backgroundColor: COLORS.headerBg,
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
    backgroundColor: COLORS.secondary, borderWidth: 2, borderColor: COLORS.headerBg,
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
    backgroundColor: COLORS.primary, borderRadius: 16, padding: 14, marginBottom: 16,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerLiveDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: COLORS.secondary },
  bannerTitle: { fontSize: 13, fontWeight: '800', color: COLORS.white },
  bannerSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: '500' },
  bannerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
  },
  bannerBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  /* Section header */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.2 },
  sectionLink: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  /* Trip card */
  tripCard: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 15, marginBottom: 10,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  tripCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  tripIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  tripRouteName: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.1 },
  tripBusNum: { fontSize: 11, color: COLORS.textMuted, marginTop: 1, fontWeight: '600' },
  tripStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
  },
  tripStatusDot: { width: 5, height: 5, borderRadius: 2.5 },
  tripStatusText: { fontSize: 10, fontWeight: '700' },

  /* Journey */
  journeyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: 12, marginBottom: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  journeyStop: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  journeyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 13 },
  journeyLbl: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  journeyPlace: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2 },
  journeyTime: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500', marginTop: 1 },
  journeyMid: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  jLine: { width: 12, height: 1.5, backgroundColor: COLORS.border },
  jChip: {
    width: 22, height: 22, borderRadius: 7,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },

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
  openMapRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  openMapText: { fontSize: 11, color: COLORS.primary, fontWeight: '700' },

  /* Sign out */
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, marginTop: 8,
    backgroundColor: COLORS.surfaceAlt,
  },
  signOutText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
});

export default DriverDashboardScreen;
