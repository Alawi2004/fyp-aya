import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Switch, Platform, StatusBar, Animated, ScrollView,
  ActivityIndicator, Alert, PanResponder, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ExpoLocation from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PURPLE } from '../../constants/colors';
import {
  markStopArrivalApi, getRouteWaypointsApi, getRouteStopsApi,
  getDriverTripsApi, startTripApi, completeTripApi, cancelTripApi,
  updateLocationApi,
} from '../../api/driverApi';

// ─── constants ────────────────────────────────────────────────────────────────
const SCREEN_H           = Dimensions.get('window').height;
const ARRIVAL_RADIUS_M   = 50;
const APPROACH_RADIUS_M  = 200;
const DEVIATION_RADIUS_M = 150;
const SPEED_KMH          = 25;
const BROADCAST_MS       = 10000;

// ─── helpers ──────────────────────────────────────────────────────────────────
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const r = d => d * Math.PI / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const calcEta = (fLat, fLon, toLat, toLon, dwellStops = 0) => {
  const dist = haversine(fLat, fLon, toLat, toLon);
  return Math.max(1, Math.round((dist / ((SPEED_KMH * 1000) / 3600) + dwellStops * 30) / 60));
};

const fmtTime = d => {
  if (!d) return '—';
  const t = new Date(d);
  return isNaN(t) ? String(d) : t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const normalise = t => ({
  _id:         String(t.trip_id ?? t._id ?? ''),
  trip_id:     t.trip_id,
  routeName:   t.route_name    ?? t.routeName   ?? 'Route',
  busNumber:   t.plate_number  ?? t.busNumber   ?? (t.vehicle_model ?? 'Bus'),
  origin:      t.start_location ?? t.origin     ?? '—',
  destination: t.end_location   ?? t.destination ?? '—',
  departureTime: fmtTime(t.start_time  ?? t.departureTime),
  arrivalTime:   fmtTime(t.end_time    ?? t.arrivalTime),
  status:      t.status ?? 'upcoming',
  route_id:    t.route_id,
});

const isActive = s => ['ongoing', 'active', 'in_progress'].includes(s);
const isDone   = s => ['completed', 'cancelled', 'closed'].includes(s);

const STATUS_CFG = {
  confirmed: { label: 'Upcoming', bg: PURPLE.light,    text: PURPLE.primary,   dot: PURPLE.primary   },
  boarded:   { label: 'Boarding', bg: PURPLE.light,    text: PURPLE.primary,   dot: PURPLE.primary   },
  ongoing:   { label: 'Active',   bg: COLORS.secondaryLight,  text: COLORS.secondary, dot: COLORS.secondary },
  completed: { label: 'Done',     bg: COLORS.surfaceAlt,      text: COLORS.textMuted, dot: COLORS.textMuted },
  cancelled: { label: 'Cancelled',bg: '#FEE2E2',              text: COLORS.danger,    dot: COLORS.danger    },
  upcoming:  { label: 'Upcoming', bg: PURPLE.light,    text: PURPLE.primary,   dot: PURPLE.primary   },
};

// ─── Trip Action Modal ─────────────────────────────────────────────────────────
const TripActionModal = ({ trip, loading, insets, onClose, onStart, onEnd, onCancel }) => {
  if (!trip) return null;
  const busy   = loading === trip.trip_id;
  const active = isActive(trip.status);
  const done   = isDone(trip.status);
  const cfg    = STATUS_CFG[trip.status] ?? STATUS_CFG.upcoming;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
          activeOpacity={1} onPress={onClose}
        />
        <View style={[mS.sheet, { paddingBottom: (insets?.bottom ?? 0) + 16 }]}>
          <View style={mS.handle} />

          <View style={mS.header}>
            <View style={mS.busIcon}>
              <Ionicons name="bus" size={20} color={PURPLE.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={mS.routeName}>{trip.routeName}</Text>
              <Text style={mS.routeSub}>{trip.origin} → {trip.destination}</Text>
            </View>
            <View style={[mS.badge, { backgroundColor: cfg.bg }]}>
              <View style={[mS.dot, { backgroundColor: cfg.dot }]} />
              <Text style={[mS.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
            </View>
          </View>

          <View style={mS.timeRow}>
            <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
            <Text style={mS.timeText}>{trip.departureTime} → {trip.arrivalTime}</Text>
            <Text style={mS.busNum}>{trip.busNumber}</Text>
          </View>

          {done && (
            <View style={mS.doneNote}>
              <Ionicons name="checkmark-done-circle" size={16} color={COLORS.textMuted} />
              <Text style={mS.doneText}>This trip is {trip.status}. No actions available.</Text>
            </View>
          )}

          {!active && !done && (
            <TouchableOpacity
              style={[mS.startBtn, busy && { opacity: 0.6 }]}
              onPress={() => onStart(trip)} disabled={busy} activeOpacity={0.85}
            >
              {busy
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Ionicons name="play-circle" size={20} color={COLORS.white} />}
              <Text style={mS.startBtnText}>{busy ? 'Starting…' : 'Start Trip'}</Text>
            </TouchableOpacity>
          )}

          {active && !done && (
            <TouchableOpacity
              style={[mS.endBtn, busy && { opacity: 0.6 }]}
              onPress={() => onEnd(trip)} disabled={busy} activeOpacity={0.85}
            >
              {busy
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Ionicons name="stop-circle" size={20} color={COLORS.white} />}
              <Text style={mS.endBtnText}>{busy ? 'Ending…' : 'End Trip'}</Text>
            </TouchableOpacity>
          )}

          {!done && (
            <TouchableOpacity
              style={[mS.cancelBtn, busy && { opacity: 0.6 }]}
              onPress={() => onCancel(trip)} disabled={busy} activeOpacity={0.85}
            >
              <Ionicons name="close-circle-outline" size={18} color={COLORS.danger} />
              <Text style={mS.cancelBtnText}>Cancel Trip</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const mS = StyleSheet.create({
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 16, paddingHorizontal: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  busIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: PURPLE.light, alignItems: 'center', justifyContent: 'center' },
  routeName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  routeSub:  { fontSize: 11, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  dot:       { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  timeRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: COLORS.border },
  timeText:  { flex: 1, fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  busNum:    { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  doneNote:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.background, borderRadius: 12, padding: 14 },
  doneText:  { flex: 1, fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  startBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.secondary, borderRadius: 14, paddingVertical: 15 },
  startBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.white },
  endBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.danger, borderRadius: 14, paddingVertical: 15 },
  endBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.white },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: COLORS.danger, borderRadius: 14, paddingVertical: 13, marginTop: 10, backgroundColor: '#FEE2E2' },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.danger },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
const DriverMapScreen = ({ navigation, route }) => {
  // Params are only present when navigated from dashboard active banner
  const paramTripId    = route?.params?.tripId    ?? null;
  const paramRouteId   = route?.params?.routeId   ?? null;
  const paramRouteName = route?.params?.routeName ?? null;
  const paramBusNumber = route?.params?.busNumber ?? '';
  const insets         = useSafeAreaInsets();

  const mapRef       = useRef(null);
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const panelAnim    = useRef(new Animated.Value(100)).current;
  const triggeredRef = useRef(new Set());
  const broadcastRef = useRef(null);

  // ── Swipe-to-collapse panel (finger-following, spring snap) ──
  const panelDragY    = useRef(new Animated.Value(0)).current;
  const collapsedRef  = useRef(false);
  const collapseDist  = useRef(Math.round(SCREEN_H * 0.42));   // how far the panel drops when collapsed
  const [isCollapsed, setIsCollapsed] = useState(false);

  const panelPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 6,
      onPanResponderMove: (_, { dy }) => {
        const base = collapsedRef.current ? collapseDist.current : 0;
        panelDragY.setValue(Math.max(0, Math.min(collapseDist.current, base + dy)));
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const base      = collapsedRef.current ? collapseDist.current : 0;
        const projected = base + dy;
        const collapse  = projected > collapseDist.current / 2 || vy > 0.4;
        collapsedRef.current = collapse;
        setIsCollapsed(collapse);
        Animated.spring(panelDragY, {
          toValue:         collapse ? collapseDist.current : 0,
          useNativeDriver: false,
          friction:        9,
          tension:         70,
        }).start();
      },
    })
  ).current;

  // GPS
  const [location,  setLocation]  = useState(null);
  const [gpsError,  setGpsError]  = useState(false);

  // Route + stops (for active trip)
  const [routeWaypoints, setRouteWaypoints] = useState([]);
  const [stops,          setStops]          = useState([]);
  const [approaching,    setApproaching]    = useState(false);
  const [deviating,      setDeviating]      = useState(false);
  const [deviationDismissed, setDeviationDismissed] = useState(false);

  // Broadcast toggle
  const [broadcasting, setBroadcasting] = useState(true);

  // Trips list
  const [trips,         setTrips]         = useState([]);
  const [tripsLoading,  setTripsLoading]  = useState(true);
  const [selectedTrip,  setSelectedTrip]  = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Derive active trip from fetched list (prefer param tripId if known)
  const activeTrip = trips.find(t => isActive(t.status)) ?? null;
  const effectiveTripId  = paramTripId  ?? activeTrip?._id   ?? null;
  const effectiveRouteId = paramRouteId ?? activeTrip?.route_id ?? null;
  const displayRouteName = paramRouteName ?? activeTrip?.routeName ?? null;
  const displayBusNumber = paramBusNumber || activeTrip?.busNumber || '';

  // ── GPS: get location immediately, independent of tripId ──
  useEffect(() => {
    let sub;
    (async () => {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGpsError(true); return; }
      // Quick first fix at High accuracy, then watch at navigation-grade accuracy.
      const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      // Watch for updates — distanceInterval:0 so it fires on time alone even
      // when the bus is stationary (Android needs BOTH time + distance otherwise).
      // BestForNavigation forces the GPS chip (~5m) instead of wifi/cell (~100m+).
      sub = await ExpoLocation.watchPositionAsync(
        { accuracy: ExpoLocation.Accuracy.BestForNavigation, timeInterval: 5000, distanceInterval: 0 },
        l => {
          // Ignore coarse network fixes that would jump the pin far away
          if (l.coords.accuracy != null && l.coords.accuracy > 100) return;
          setLocation({ latitude: l.coords.latitude, longitude: l.coords.longitude });
        }
      );
    })();
    return () => sub?.remove();
  }, []);

  // ── Broadcasting: post to server every 10s when on an active trip ──
  useEffect(() => {
    if (broadcastRef.current) clearInterval(broadcastRef.current);
    if (!broadcasting || !effectiveTripId || !location) return;
    const post = () => updateLocationApi({ trip_id: effectiveTripId, latitude: location.latitude, longitude: location.longitude }).catch(() => {});
    post();
    broadcastRef.current = setInterval(post, BROADCAST_MS);
    return () => clearInterval(broadcastRef.current);
  }, [broadcasting, effectiveTripId, location?.latitude, location?.longitude]);

  // ── Load all trips ──
  const loadTrips = useCallback(async () => {
    try {
      const res  = await getDriverTripsApi();
      const raw  = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.trips) ? res.data.trips : []);
      setTrips(raw.map(normalise));
    } catch { setTrips([]); }
    finally  { setTripsLoading(false); }
  }, []);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  // ── Load route waypoints + stops when we know the route ──
  useEffect(() => {
    if (!effectiveRouteId) { setRouteWaypoints([]); setStops([]); return; }
    getRouteWaypointsApi(effectiveRouteId)
      .then(d => {
        if (Array.isArray(d) && d.length >= 2)
          setRouteWaypoints(d.map(w => ({ latitude: parseFloat(w.latitude), longitude: parseFloat(w.longitude) })));
      }).catch(() => {});
    getRouteStopsApi(effectiveRouteId)
      .then(d => {
        if (Array.isArray(d) && d.length > 0)
          setStops(d.map(s => ({ id: s.stop_id, name: s.stop_name, lat: parseFloat(s.latitude), lng: parseFloat(s.longitude), done: false })));
      }).catch(() => {});
  }, [effectiveRouteId]);

  const doneCount = stops.filter(s => s.done).length;
  const nextStop  = stops.find(s => !s.done);

  // ── Auto-arrive + approach detection ──
  useEffect(() => {
    if (!location || !nextStop) { setApproaching(false); return; }
    const dist = haversine(location.latitude, location.longitude, nextStop.lat, nextStop.lng);
    setApproaching(dist <= APPROACH_RADIUS_M);
    if (dist <= ARRIVAL_RADIUS_M && !triggeredRef.current.has(nextStop.id)) {
      triggeredRef.current.add(nextStop.id);
      setStops(prev => prev.map(s => s.id === nextStop.id ? { ...s, done: true } : s));
      if (effectiveTripId) markStopArrivalApi(effectiveTripId, nextStop.id).catch(() => {});
    }
  }, [location, nextStop?.id]);

  // ── Route deviation ──
  useEffect(() => {
    if (!location || !routeWaypoints.length) return;
    const minDist = Math.min(...routeWaypoints.map(pt => haversine(location.latitude, location.longitude, pt.latitude, pt.longitude)));
    const off = minDist > DEVIATION_RADIUS_M;
    setDeviating(off);
    if (!off) setDeviationDismissed(false);
  }, [location, routeWaypoints]);

  // ── Animations ──
  useEffect(() => {
    // non-native so it can combine with the drag value via Animated.add
    Animated.timing(panelAnim, { toValue: 0, duration: 500, useNativeDriver: false }).start();
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.7, duration: 1000, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, []);

  // ── Per-stop ETAs ──
  const stopsWithEta = stops.map((stop, idx) => {
    if (stop.done || !location) return { ...stop, eta: null };
    return { ...stop, eta: calcEta(location.latitude, location.longitude, stop.lat, stop.lng, stops.slice(0, idx).filter(s => !s.done).length) };
  });
  const nextStopEta = stopsWithEta.find(s => !s.done);

  // ── Trip action handlers ──
  const handleStart = trip => {
    Alert.alert('Start Trip', `Start ${trip.routeName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start', onPress: async () => {
        setActionLoading(trip.trip_id);
        try { await startTripApi(trip.trip_id); setSelectedTrip(null); loadTrips(); }
        catch (e) { Alert.alert('Error', e?.response?.data?.error ?? 'Could not start trip.'); }
        finally { setActionLoading(null); }
      }},
    ]);
  };

  const handleEnd = trip => {
    Alert.alert('End Trip', `Mark ${trip.routeName} as completed?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Trip', style: 'destructive', onPress: async () => {
        setActionLoading(trip.trip_id);
        try { await completeTripApi(trip.trip_id); setSelectedTrip(null); loadTrips(); }
        catch (e) { Alert.alert('Error', e?.response?.data?.error ?? 'Could not complete trip.'); }
        finally { setActionLoading(null); }
      }},
    ]);
  };

  const handleCancel = trip => {
    Alert.alert('Cancel Trip', `Cancel ${trip.routeName}? This cannot be undone.`, [
      { text: 'Keep Trip', style: 'cancel' },
      { text: 'Cancel Trip', style: 'destructive', onPress: async () => {
        setActionLoading(trip.trip_id);
        try { await cancelTripApi(trip.trip_id); setSelectedTrip(null); loadTrips(); }
        catch (e) { Alert.alert('Error', e?.response?.data?.error ?? 'Could not cancel trip.'); }
        finally { setActionLoading(null); }
      }},
    ]);
  };

  // Sort: active → upcoming → done
  const sortedTrips = [...trips].sort((a, b) => {
    const rank = t => isActive(t.status) ? 0 : isDone(t.status) ? 2 : 1;
    return rank(a) - rank(b);
  });

  // ── GPS permission error ──
  if (gpsError) {
    return (
      <View style={styles.gpsError}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <Ionicons name="location-outline" size={44} color={COLORS.danger} />
        <Text style={styles.gpsErrorTitle}>Location Access Needed</Text>
        <Text style={styles.gpsErrorSub}>Please enable location permissions for the Navigate screen to work.</Text>
      </View>
    );
  }

  // ── Show map + panel immediately (no blocking on GPS) ──
  const mapRegion = location
    ? { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.022, longitudeDelta: 0.022 }
    : { latitude: 33.8938, longitude: 35.5018, latitudeDelta: 0.1, longitudeDelta: 0.1 }; // fallback center

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* ── Map ── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={mapRegion}
        showsUserLocation={false}
        showsCompass={false}
        showsMyLocationButton={false}
        showsTraffic
      >
        {/* Planned route (dashed) */}
        {routeWaypoints.length >= 2 && (
          <Polyline coordinates={routeWaypoints} strokeColor={PURPLE.midStrong ?? '#93C5FD'} strokeWidth={4} lineDashPattern={[8, 4]} />
        )}
        {/* Completed portion */}
        {routeWaypoints.length >= 2 && doneCount > 0 && (
          <Polyline coordinates={routeWaypoints.slice(0, Math.max(2, doneCount))} strokeColor={PURPLE.primary} strokeWidth={5} />
        )}

        {/* Bus marker */}
        {location && (
          <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.markerWrap}>
              <Animated.View style={[styles.markerPulse, { transform: [{ scale: pulseAnim }] }]} />
              <View style={styles.markerCore}>
                <Ionicons name="bus" size={15} color={COLORS.white} />
              </View>
            </View>
          </Marker>
        )}

        {/* Stop markers */}
        {stopsWithEta.map(stop => {
          const isNext = !stop.done && stop.id === nextStopEta?.id;
          return (
            <Marker key={stop.id} coordinate={{ latitude: stop.lat, longitude: stop.lng }} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[styles.stopPin, stop.done && styles.stopPinDone, isNext && styles.stopPinNext]}>
                {stop.done
                  ? <Ionicons name="checkmark" size={9} color={COLORS.white} />
                  : isNext
                    ? <View style={styles.stopPinInnerNext} />
                    : <View style={styles.stopInnerDot} />}
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* GPS loading overlay (non-blocking — map still shows) */}
      {!location && (
        <View style={styles.gpsOverlay}>
          <ActivityIndicator size="small" color={PURPLE.primary} />
          <Text style={styles.gpsOverlayText}>Getting GPS…</Text>
        </View>
      )}

      {/* ── Top Bar ── */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.topBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Text style={styles.topRoute} numberOfLines={1}>
            {displayRouteName ?? "Today's Routes"}
          </Text>
          <Text style={styles.topBus}>
            {displayBusNumber ? `${displayBusNumber} · ` : ''}{doneCount}/{stops.length} stops
          </Text>
        </View>
        {nextStopEta && (
          <View style={[styles.etaBadge, { backgroundColor: broadcasting ? COLORS.secondaryLight : '#FEE2E2' }]}>
            <View style={[styles.etaDot, { backgroundColor: broadcasting ? COLORS.secondary : COLORS.danger }]} />
            <Text style={[styles.etaLabel, { color: broadcasting ? COLORS.secondary : COLORS.danger }]}>
              {nextStopEta.eta} min
            </Text>
          </View>
        )}
      </View>

      {/* ── Stats Bar ── */}
      <View style={styles.statsBar}>
        {[
          { icon: 'location-outline', val: String(doneCount),                                          unit: 'done',     color: COLORS.secondary },
          { icon: 'flag-outline',     val: String(stops.length - doneCount),                          unit: 'remaining',color: PURPLE.primary   },
          { icon: 'time-outline',     val: nextStopEta?.eta != null ? String(nextStopEta.eta) : '—',  unit: 'min next', color: COLORS.warning   },
          { icon: 'calendar-outline', val: String(trips.filter(t => !isDone(t.status)).length),       unit: 'trips',    color: PURPLE.primary   },
        ].map((s, i) => (
          <View key={i} style={[styles.statCell, i < 3 && styles.statCellBorder]}>
            <Ionicons name={s.icon} size={13} color={s.color} />
            <Text style={styles.statVal}>{s.val}</Text>
            <Text style={styles.statUnit}>{s.unit}</Text>
          </View>
        ))}
      </View>

      {/* ── Deviation Banner ── */}
      {deviating && !deviationDismissed && (
        <View style={[styles.deviationBanner, { top: Platform.OS === 'ios' ? 170 : (StatusBar.currentHeight ?? 24) + 124 }]}>
          <Ionicons name="warning" size={16} color={COLORS.white} />
          <Text style={styles.deviationText}>Off Route — You have left the planned path</Text>
          <TouchableOpacity onPress={() => setDeviationDismissed(true)} style={styles.deviationClose}>
            <Ionicons name="close" size={14} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Bottom Panel (swipe up/down to reveal the map) ── */}
      <Animated.View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          // collapse far enough to leave only the handle + next-stop card peeking
          collapseDist.current = Math.max(120, Math.round(h - 150));
        }}
        style={[
          styles.panel,
          {
            transform: [{ translateY: Animated.add(panelAnim, panelDragY) }],
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        {/* Drag handle — the only swipe target, so inner ScrollViews still work */}
        <View style={styles.handleArea} {...panelPan.panHandlers}>
          <View style={styles.handleBar} />
          <Ionicons
            name={isCollapsed ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={COLORS.textMuted}
            style={{ marginTop: 2 }}
          />
        </View>

        {/* Next Stop card — only when there's an active trip with stops */}
        {nextStopEta && activeTrip && (
          <View style={styles.nextStopCard}>
            <View style={styles.nextStopLeft}>
              <View style={styles.nextStopIconWrap}>
                <Ionicons name="location" size={15} color={PURPLE.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nextStopLbl}>Next Stop</Text>
                <Text style={styles.nextStopName} numberOfLines={1}>{nextStopEta.name}</Text>
              </View>
            </View>
            <View style={styles.nextStopRight}>
              <View style={styles.nextEtaBadge}>
                <Text style={styles.nextEtaText}>{nextStopEta.eta} min</Text>
              </View>
              {approaching && (
                <View style={styles.approachingBadge}>
                  <Ionicons name="radio-button-on" size={11} color={COLORS.white} />
                  <Text style={styles.approachingText}>Approaching</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Stop chips */}
        {stops.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
            {stopsWithEta.map(stop => {
              const isNext = !stop.done && stop.id === nextStopEta?.id;
              return (
                <View key={stop.id} style={[styles.stopChip, stop.done && styles.stopChipDone, isNext && styles.stopChipNext]}>
                  <Ionicons
                    name={stop.done ? 'checkmark-circle' : isNext ? 'radio-button-on' : 'ellipse-outline'}
                    size={12}
                    color={stop.done ? COLORS.secondary : isNext ? PURPLE.primary : COLORS.textMuted}
                  />
                  <Text style={[styles.stopChipName, stop.done && { color: COLORS.secondary }, isNext && { color: PURPLE.primary }]} numberOfLines={1}>
                    {stop.name}
                  </Text>
                  {!stop.done && stop.eta !== null && (
                    <View style={[styles.stopChipEtaPill, isNext && { backgroundColor: PURPLE.primary }]}>
                      <Text style={[styles.stopChipEtaText, isNext && { color: COLORS.white }]}>{stop.eta}m</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Broadcast toggle */}
        <View style={styles.broadcastRow}>
          <View style={styles.broadcastInfo}>
            <View style={[styles.broadcastIconWrap, { backgroundColor: broadcasting ? COLORS.secondaryLight : COLORS.surfaceAlt }]}>
              <Ionicons name={broadcasting ? 'radio' : 'radio-outline'} size={16} color={broadcasting ? COLORS.secondary : COLORS.textMuted} />
            </View>
            <View>
              <Text style={styles.broadcastTitle}>Location Broadcast</Text>
              <Text style={styles.broadcastSub}>{broadcasting ? 'Passengers can track you live' : 'Broadcasting is paused'}</Text>
            </View>
          </View>
          <Switch value={broadcasting} onValueChange={setBroadcasting} trackColor={{ false: COLORS.border, true: COLORS.secondaryMid }} thumbColor={broadcasting ? COLORS.secondary : COLORS.textMuted} />
        </View>

        {/* ── Today's Trips ── */}
        <Text style={styles.tripsHeader}>Today's Trips</Text>
        {tripsLoading ? (
          <ActivityIndicator color={PURPLE.primary} style={{ marginVertical: 12 }} />
        ) : sortedTrips.length === 0 ? (
          <Text style={styles.tripsEmpty}>No trips scheduled for today.</Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 190 }} nestedScrollEnabled>
            {sortedTrips.map(trip => {
              const cfg  = STATUS_CFG[trip.status] ?? STATUS_CFG.upcoming;
              const busy = actionLoading === trip.trip_id;
              return (
                <TouchableOpacity
                  key={trip._id}
                  style={[styles.tripRow, isActive(trip.status) && styles.tripRowActive]}
                  onPress={() => setSelectedTrip(trip)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.tripRowDot, { backgroundColor: cfg.dot }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripRowName} numberOfLines={1}>{trip.routeName}</Text>
                    <Text style={styles.tripRowSub}>{trip.departureTime} · {trip.origin}</Text>
                  </View>
                  <View style={[styles.tripRowBadge, { backgroundColor: cfg.bg }]}>
                    {busy
                      ? <ActivityIndicator size="small" color={cfg.text} />
                      : <Text style={[styles.tripRowBadgeText, { color: cfg.text }]}>{cfg.label}</Text>}
                  </View>
                  {!isDone(trip.status) && (
                    <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} style={{ marginLeft: 4 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </Animated.View>

      {/* ── Trip Action Modal ── */}
      <TripActionModal
        trip={selectedTrip}
        loading={actionLoading}
        insets={insets}
        onClose={() => setSelectedTrip(null)}
        onStart={handleStart}
        onEnd={handleEnd}
        onCancel={handleCancel}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  gpsError: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, padding: 32 },
  gpsErrorTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginTop: 12 },
  gpsErrorSub:   { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginTop: 6 },

  gpsOverlay: { position: 'absolute', top: 100, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.white, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 6 },
  gpsOverlayText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },

  topBar: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  topCenter: { flex: 1, backgroundColor: COLORS.white, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  topRoute: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
  topBus:   { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', marginTop: 1 },
  etaBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  etaDot:   { width: 6, height: 6, borderRadius: 3 },
  etaLabel: { fontSize: 12, fontWeight: '800' },

  statsBar: { position: 'absolute', top: Platform.OS === 'ios' ? 108 : (StatusBar.currentHeight ?? 24) + 62, left: 14, right: 14, flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 14, paddingVertical: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  statCell:       { flex: 1, alignItems: 'center', gap: 2 },
  statCellBorder: { borderRightWidth: 1, borderRightColor: COLORS.border },
  statVal:  { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
  statUnit: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },

  markerWrap:  { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  markerPulse: { position: 'absolute', width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(124,58,237,0.2)' },
  markerCore:  { width: 30, height: 30, borderRadius: 15, backgroundColor: PURPLE.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: COLORS.white, shadowColor: PURPLE.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 8 },

  stopPin:          { width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white },
  stopPinDone:      { backgroundColor: COLORS.secondary },
  stopPinNext:      { width: 22, height: 22, borderRadius: 11, backgroundColor: PURPLE.primary, borderWidth: 2.5 },
  stopPinInnerNext: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.white },
  stopInnerDot:     { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.textMuted },

  deviationBanner: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.danger, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10, shadowColor: COLORS.danger, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  deviationText:   { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.white },
  deviationClose:  { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  panel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  handleArea: { alignSelf: 'stretch', alignItems: 'center', paddingTop: 10, paddingBottom: 8, marginHorizontal: -16 },
  handleBar:  { width: 44, height: 5, borderRadius: 3, backgroundColor: COLORS.border },

  nextStopCard:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: PURPLE.light, borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: PURPLE.midStrong ?? '#93C5FD' },
  nextStopLeft:     { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  nextStopRight:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextStopIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  nextStopLbl:      { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase' },
  nextStopName:     { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2 },
  nextEtaBadge:     { backgroundColor: PURPLE.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  nextEtaText:      { fontSize: 13, fontWeight: '800', color: COLORS.white },
  approachingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.warning, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  approachingText:  { fontSize: 11, fontWeight: '800', color: COLORS.white },

  stopChip:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.surfaceAlt, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.border, maxWidth: 150 },
  stopChipDone:     { backgroundColor: COLORS.secondaryLight, borderColor: COLORS.secondary + '40' },
  stopChipNext:     { backgroundColor: PURPLE.light, borderColor: PURPLE.primary },
  stopChipName:     { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, flexShrink: 1 },
  stopChipEtaPill:  { backgroundColor: COLORS.border, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  stopChipEtaText:  { fontSize: 10, fontWeight: '800', color: COLORS.textMuted },

  broadcastRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  broadcastInfo:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  broadcastIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  broadcastTitle:    { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  broadcastSub:      { fontSize: 10, color: COLORS.textMuted, fontWeight: '500', marginTop: 1 },

  tripsHeader: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  tripsEmpty:  { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 10 },

  tripRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 6 },
  tripRowActive: { backgroundColor: COLORS.secondaryLight, borderWidth: 1, borderColor: COLORS.secondary + '40' },
  tripRowDot:    { width: 8, height: 8, borderRadius: 4 },
  tripRowName:   { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  tripRowSub:    { fontSize: 10, color: COLORS.textMuted, fontWeight: '500', marginTop: 2 },
  tripRowBadge:  { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  tripRowBadgeText: { fontSize: 10, fontWeight: '700' },
});

export default DriverMapScreen;
