import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Switch, Platform, StatusBar, Animated, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useLocation } from '../../hooks/useLocation';
import { markStopArrivalApi, getRouteWaypointsApi } from '../../api/driverApi';

// Fallback route — Lebanese coordinates (Beirut → Jounieh, Route 12A)
const MOCK_ROUTE = [
  { latitude: 33.8938, longitude: 35.5018 },
  { latitude: 33.9100, longitude: 35.5150 },
  { latitude: 33.9280, longitude: 35.5340 },
  { latitude: 33.9566, longitude: 35.5901 },
  { latitude: 33.9806, longitude: 35.6178 },
];

const INITIAL_STOPS = [
  { id: 1, name: 'Hamra Station',    lat: 33.8938, lng: 35.5018, done: true  },
  { id: 2, name: 'Adliyeh Junction', lat: 33.9280, lng: 35.5340, done: true  },
  { id: 3, name: 'Jounieh Highway',  lat: 33.9566, lng: 35.5901, done: false },
  { id: 4, name: 'Jounieh Terminal', lat: 33.9806, lng: 35.6178, done: false },
];

const TRIP_INFO = {
  route: 'Route A — City Center',
  busNumber: 'BUS-101',
  totalStops: 4,
};

const ARRIVAL_RADIUS_M   = 50;   // auto-mark arrived within 50 m
const APPROACH_RADIUS_M  = 200;  // show "Approaching" indicator within 200 m
const DEVIATION_RADIUS_M = 150;  // warn if driver is more than 150 m from any route waypoint

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const DriverMapScreen = ({ navigation, route }) => {
  const tripId  = route?.params?.tripId  ?? null;
  const routeId = route?.params?.routeId ?? null;
  const insets = useSafeAreaInsets();
  const mapRef      = useRef(null);
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const panelAnim   = useRef(new Animated.Value(100)).current;
  const routeAnim   = useRef(new Animated.Value(0)).current;
  const triggeredRef = useRef(new Set()); // stop IDs already auto-marked
  const [routeWaypoints, setRouteWaypoints] = useState(MOCK_ROUTE);
  const [location, setLocation]         = useState(MOCK_ROUTE[0]);
  const [broadcasting, setBroadcasting] = useState(true);
  const [stops, setStops]               = useState(INITIAL_STOPS);
  const [approaching, setApproaching]         = useState(false);
  const [deviating, setDeviating]             = useState(false);
  const [deviationDismissed, setDeviationDismissed] = useState(false);
  const [speed]      = useState(38);
  const [onBoard]    = useState(18);
  const [etaMins]    = useState(12);
  const [distanceKm] = useState(2.1);
  useLocation({ tripId, broadcasting, onLocationUpdate: setLocation });

  // Fetch real route waypoints when a routeId is provided
  useEffect(() => {
    if (!routeId) return;
    getRouteWaypointsApi(routeId)
      .then(data => {
        if (Array.isArray(data) && data.length >= 2) {
          setRouteWaypoints(
            data.map(w => ({ latitude: parseFloat(w.latitude), longitude: parseFloat(w.longitude) }))
          );
        }
      })
      .catch(() => { /* keep MOCK_ROUTE fallback on error */ });
  }, [routeId]);

  const nextStop  = stops.find(s => !s.done);
  const doneStops = stops.filter(s => s.done).length;

  // Auto-detect arrival by geofence whenever location updates
  useEffect(() => {
    if (!nextStop) { setApproaching(false); return; }
    const dist = haversine(
      location.latitude, location.longitude,
      nextStop.lat, nextStop.lng,
    );
    setApproaching(dist <= APPROACH_RADIUS_M);
    if (dist <= ARRIVAL_RADIUS_M && !triggeredRef.current.has(nextStop.id)) {
      triggeredRef.current.add(nextStop.id);
      setStops(prev => prev.map(s => s.id === nextStop.id ? { ...s, done: true } : s));
      if (tripId) markStopArrivalApi(tripId, nextStop.id).catch(() => {});
    }
  }, [location, nextStop?.id]);

  // Route deviation: flag when driver is >150 m from every waypoint on the planned route
  useEffect(() => {
    if (!routeWaypoints.length) return;
    const minDist = Math.min(
      ...routeWaypoints.map(pt =>
        haversine(location.latitude, location.longitude, pt.latitude, pt.longitude)
      )
    );
    const offRoute = minDist > DEVIATION_RADIUS_M;
    setDeviating(offRoute);
    if (!offRoute) setDeviationDismissed(false); // reset dismiss once back on route
  }, [location, routeWaypoints]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(panelAnim,  { toValue: 0,   duration: 500, useNativeDriver: true }),
      Animated.timing(routeAnim,  { toValue: 1,   duration: 1200, useNativeDriver: false }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.7, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Full-screen Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.022,
          longitudeDelta: 0.022,
        }}
        showsUserLocation={false}
        showsCompass={false}
        showsMyLocationButton={false}
        showsTraffic
      >
        <Polyline
          coordinates={routeWaypoints}
          strokeColor={COLORS.primary}
          strokeWidth={5}
        />
        {/* Completed portion up to first undone stop */}
        <Polyline
          coordinates={routeWaypoints.slice(0, Math.max(2, stops.filter(s => s.done).length))}
          strokeColor={COLORS.secondary}
          strokeWidth={5}
        />

        {/* Bus Marker */}
        <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.markerWrap}>
            <Animated.View style={[styles.markerPulse, { transform: [{ scale: pulseAnim }] }]} />
            <View style={styles.markerCore}>
              <Ionicons name="bus" size={15} color={COLORS.white} />
            </View>
          </View>
        </Marker>

        {/* Stop Markers */}
        {stops.map(stop => (
          <Marker key={stop.id} coordinate={{ latitude: stop.lat, longitude: stop.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.stopPin, stop.done && styles.stopPinDone]}>
              {stop.done
                ? <Ionicons name="checkmark" size={9} color={COLORS.white} />
                : <View style={styles.stopInnerDot} />}
            </View>
          </Marker>
        ))}
      </MapView>

      {/* ─── Top Overlay ─── */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.topBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Text style={styles.topRoute}>{TRIP_INFO.route}</Text>
          <Text style={styles.topBus}>{TRIP_INFO.busNumber} · {doneStops}/{TRIP_INFO.totalStops} stops</Text>
        </View>
        <View style={[styles.etaBadge, { backgroundColor: broadcasting ? COLORS.secondaryLight : COLORS.dangerLight }]}>
          <View style={[styles.etaDot, { backgroundColor: broadcasting ? COLORS.secondary : COLORS.danger }]} />
          <Text style={[styles.etaLabel, { color: broadcasting ? COLORS.secondary : COLORS.danger }]}>
            {etaMins} min
          </Text>
        </View>
      </View>

      {/* ─── Stats Row ─── */}
      <View style={styles.statsBar}>
        {[
          { icon: 'speedometer-outline', val: `${speed}`,      unit: 'km/h',     color: COLORS.primary   },
          { icon: 'people-outline',      val: `${onBoard}`,    unit: 'on board',  color: COLORS.secondary },
          { icon: 'navigate-outline',    val: `${distanceKm}`, unit: 'km left',   color: COLORS.warning   },
          { icon: 'time-outline',        val: `${etaMins}`,    unit: 'min ETA',   color: COLORS.primary   },
        ].map((s, i) => (
          <View key={i} style={[styles.statCell, i < 3 && styles.statCellBorder]}>
            <Ionicons name={s.icon} size={13} color={s.color} />
            <Text style={styles.statVal}>{s.val}</Text>
            <Text style={styles.statUnit}>{s.unit}</Text>
          </View>
        ))}
      </View>

      {/* ─── Route Deviation Banner ─── */}
      {deviating && !deviationDismissed && (
        <View style={[styles.deviationBanner, {
          top: Platform.OS === 'ios' ? 170 : (StatusBar.currentHeight ?? 24) + 124,
        }]}>
          <Ionicons name="warning" size={16} color={COLORS.white} />
          <Text style={styles.deviationText}>Off Route — You have left the planned path</Text>
          <TouchableOpacity onPress={() => setDeviationDismissed(true)} style={styles.deviationClose}>
            <Ionicons name="close" size={14} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Bottom Panel ─── */}
      <Animated.View style={[styles.panel, { transform: [{ translateY: panelAnim }] }]}>

        {/* Next Stop */}
        {nextStop && (
          <View style={styles.nextStopCard}>
            <View style={styles.nextStopLeft}>
              <View style={styles.nextStopIconWrap}>
                <Ionicons name="location" size={15} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.nextStopLbl}>Next Stop</Text>
                <Text style={styles.nextStopName}>{nextStop.name}</Text>
              </View>
            </View>
            <View style={styles.nextStopRight}>
              <View style={styles.nextEtaBadge}>
                <Text style={styles.nextEtaText}>{etaMins} min</Text>
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

        {/* Route progress */}
        <View style={styles.progressRow}>
          {stops.map((stop, i) => (
            <View key={stop.id} style={styles.progressItem}>
              <View style={[
                styles.progressDot,
                stop.done && styles.progressDotDone,
                !stop.done && i === doneStops && styles.progressDotActive,
              ]}>
                {stop.done && <Ionicons name="checkmark" size={9} color={COLORS.white} />}
                {!stop.done && i === doneStops && <View style={styles.progressInner} />}
              </View>
              <Text style={[styles.progressLabel, stop.done && { color: COLORS.secondary }]} numberOfLines={1}>
                {stop.name.split(' ')[0]}
              </Text>
              {i < stops.length - 1 && (
                <View style={[styles.progressLine, stop.done && styles.progressLineDone]} />
              )}
            </View>
          ))}
        </View>

        {/* Broadcast toggle */}
        <View style={styles.broadcastRow}>
          <View style={styles.broadcastInfo}>
            <View style={[styles.broadcastIconWrap, { backgroundColor: broadcasting ? COLORS.secondaryLight : COLORS.surfaceAlt }]}>
              <Ionicons name={broadcasting ? 'radio' : 'radio-outline'} size={16}
                color={broadcasting ? COLORS.secondary : COLORS.textMuted} />
            </View>
            <View>
              <Text style={styles.broadcastTitle}>Location Broadcast</Text>
              <Text style={styles.broadcastSub}>
                {broadcasting ? 'Passengers can track you live' : 'Broadcasting is paused'}
              </Text>
            </View>
          </View>
          <Switch
            value={broadcasting}
            onValueChange={setBroadcasting}
            trackColor={{ false: COLORS.border, true: COLORS.secondaryMid }}
            thumbColor={broadcasting ? COLORS.secondary : COLORS.textMuted}
          />
        </View>

        {/* Action buttons */}
        <View style={[styles.actionRow, { gap: 6 }]}>
          <TouchableOpacity style={styles.actionSecondary} onPress={() => navigation.navigate('PassengerList')}>
            <Ionicons name="people" size={14} color={COLORS.primary} />
            <Text style={styles.actionSecText}>Manifest</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionSecondary} onPress={() => navigation.navigate('PassengerVerify')}>
            <Ionicons name="qr-code" size={14} color={COLORS.primary} />
            <Text style={styles.actionSecText}>Scan QR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionSecondary} onPress={() => navigation.navigate('DelayReport', { tripId })}>
            <Ionicons name="time" size={14} color={COLORS.warning} />
            <Text style={[styles.actionSecText, { color: COLORS.warning }]}>Delay</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionSecondary} onPress={() => navigation.navigate('IssueReport')}>
            <Ionicons name="document-text" size={14} color={COLORS.warning} />
            <Text style={[styles.actionSecText, { color: COLORS.warning }]}>Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionDanger} onPress={() => navigation.navigate('Emergency')}>
            <Ionicons name="warning" size={14} color={COLORS.white} />
            <Text style={styles.actionDangerText}>SOS</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Top bar */
  topBar: {
    position: 'absolute',
    top: 0,
    left: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  topBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  topCenter: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 13,
    paddingHorizontal: 12, paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  topRoute: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
  topBus: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', marginTop: 1 },
  etaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  etaDot: { width: 6, height: 6, borderRadius: 3 },
  etaLabel: { fontSize: 12, fontWeight: '800' },

  /* Stats bar */
  statsBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 108 : (StatusBar.currentHeight ?? 24) + 62,
    left: 14, right: 14,
    flexDirection: 'row',
    backgroundColor: COLORS.white, borderRadius: 14,
    paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statCellBorder: { borderRightWidth: 1, borderRightColor: COLORS.border },
  statVal: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
  statUnit: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },

  /* Marker */
  markerWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  markerPulse: {
    position: 'absolute', width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(37,99,235,0.2)',
  },
  markerCore: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: COLORS.white,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 8,
  },
  stopPin: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  stopPinDone: { backgroundColor: COLORS.secondary },
  stopInnerDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.white },

  /* Bottom panel */
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 20,
  },

  /* Next stop */
  nextStopCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primaryLight, borderRadius: 14,
    padding: 13, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.primaryMid,
  },
  nextStopLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  nextStopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextStopIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
  },
  nextStopLbl: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase' },
  nextStopName: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2 },
  nextEtaBadge: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  nextEtaText: { fontSize: 13, fontWeight: '800', color: COLORS.white },
  approachingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.warning, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  approachingText: { fontSize: 11, fontWeight: '800', color: COLORS.white },

  /* Deviation banner */
  deviationBanner: {
    position: 'absolute',
    left: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.danger, borderRadius: 13,
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: COLORS.danger, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },
  deviationText: {
    flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.white,
  },
  deviationClose: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Route progress */
  progressRow: { flexDirection: 'row', marginBottom: 14 },
  progressItem: { flex: 1, alignItems: 'center', position: 'relative' },
  progressDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  progressDotDone: { backgroundColor: COLORS.secondary },
  progressDotActive: {
    backgroundColor: COLORS.white,
    borderWidth: 2.5, borderColor: COLORS.primary,
  },
  progressInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  progressLabel: { fontSize: 9, fontWeight: '600', color: COLORS.textMuted, textAlign: 'center' },
  progressLine: {
    position: 'absolute', top: 9, left: '60%', right: '-60%',
    height: 2, backgroundColor: COLORS.border,
  },
  progressLineDone: { backgroundColor: COLORS.secondary },

  /* Broadcast */
  broadcastRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  broadcastInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  broadcastIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  broadcastTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  broadcastSub: { fontSize: 10, color: COLORS.textMuted, fontWeight: '500', marginTop: 1 },

  /* Actions */
  actionRow: { flexDirection: 'row', gap: 8 },
  actionSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: COLORS.primaryLight, borderRadius: 12, paddingVertical: 11,
  },
  actionSecText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  actionDanger: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: COLORS.danger, borderRadius: 12, paddingVertical: 11,
  },
  actionDangerText: { fontSize: 11, fontWeight: '700', color: COLORS.white },
});

export default DriverMapScreen;
