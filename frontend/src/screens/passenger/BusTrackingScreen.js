import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Platform, StatusBar, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getTripEtaPredictions } from '../../api/etaApi';
import { fetchBusGps } from '../../api/apiClient';
import { COLORS } from '../../constants/colors';

const CAMERA_SERVER = 'http://localhost:9000';
const SEAT_POLL_MS  = 5_000;

function capacityFromBusId(busId = '') {
  const id = busId.toLowerCase();
  if (id.startsWith('taxi')) return 4;
  if (id.startsWith('van'))  return 12;
  if (id.startsWith('mini')) return 22;
  return 40;
}

const ROUTE_WAYPOINTS = [
  { latitude: 33.8880, longitude: 35.4950 },
  { latitude: 33.8910, longitude: 35.4990 },
  { latitude: 33.8938, longitude: 35.5018 },
  { latitude: 33.8970, longitude: 35.5080 },
  { latitude: 33.9010, longitude: 35.5150 },
  { latitude: 33.9050, longitude: 35.5220 },
];

// Mock stops used when ETA API is unavailable (frontend-only mode)
const MOCK_STOPS_ETA = [
  { stop_id: 'ms1', stop_name: 'Hamra Circle',    eta_min: 8,  eta_time: '—' },
  { stop_id: 'ms2', stop_name: 'Verdun Square',   eta_min: 14, eta_time: '—' },
  { stop_id: 'ms3', stop_name: 'Sassine Square',  eta_min: 21, eta_time: '—' },
];

const MOCK_DRIVER = {
  name: 'Ahmad Al-Hassan', rating: 4.8, trips: 1243,
  initials: 'AH', vehicle: 'Express 101 · White Bus', phone: '+961 70 000 000',
};

const ETA_POLL_MS = 30_000;
const GPS_POLL_MS = 3_000;

const TRAFFIC_COLOR = {
  low: '#10B981', moderate: '#84CC16', busy: '#F59E0B', heavy: '#F97316', severe: '#EF4444',
};

// ── Notification setup ────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const requestNotifPermission = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

const sendApproachingAlert = async (busName, etaMin, stopsAway) => {
  const body = stopsAway <= 2
    ? `${busName} is ${stopsAway} stop${stopsAway === 1 ? '' : 's'} away — get ready to board!`
    : `${busName} arrives in ~${Math.round(etaMin)} min — time to head to the stop.`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🚌 Bus Approaching',
      body,
      sound: true,
      data: { busName, etaMin, stopsAway },
    },
    trigger: null, // immediate
  });
};

// ── Confidence from GPS freshness ──────────────────────────────────────────────
const deriveConfidence = (isLive, timeSinceUpdate, hasEtaData) => {
  if (!isLive || timeSinceUpdate === null)  return { level: 'low',    label: 'Low',    color: COLORS.danger  };
  if (timeSinceUpdate > 120)               return { level: 'low',    label: 'Low',    color: COLORS.danger  };
  if (timeSinceUpdate > 30 || !hasEtaData) return { level: 'medium', label: 'Medium', color: COLORS.warning };
  return                                          { level: 'high',   label: 'High',  color: COLORS.secondary };
};

// ── Component ─────────────────────────────────────────────────────────────────
const BusTrackingScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { busId = 'bus1', busName = 'Express 101', tripId } = route.params || {};
  const { getBusLocation } = useApp();
  const mapRef      = useRef(null);
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const panelSlide  = useRef(new Animated.Value(0)).current;
  const gpsInterval = useRef(null);
  const etaInterval = useRef(null);
  const alertSent   = useRef(false);         // prevent duplicate alerts
  const notifGranted = useRef(false);

  const [busLocation, setBusLocation]   = useState(
    getBusLocation?.(busId) || { latitude: 33.8938, longitude: 35.5018 }
  );
  const [isLive, setIsLive]             = useState(false);
  const [lastUpdated, setLastUpdated]   = useState(null);
  const [etaData, setEtaData]           = useState(null);
  const [etaLoading, setEtaLoading]     = useState(false);

  // Mock ETA offset — decrements 1 min every 30 s so demo alert fires
  const [mockOffset, setMockOffset]     = useState(0);

  // Seat availability
  const capacity = capacityFromBusId(busId);
  const [seatInfo, setSeatInfo]         = useState({ capacity, occupied: 0, available: capacity });
  const seatInterval                    = useRef(null);

  // ── Derived stop list (real or mock) ──────────────────────────────────────
  const stopsList = useMemo(() => {
    if (etaData?.stops?.length > 0) return etaData.stops;
    return MOCK_STOPS_ETA.map((s) => ({
      ...s,
      eta_min: Math.max(0, s.eta_min - mockOffset),
    }));
  }, [etaData, mockOffset]);

  const nextStop   = stopsList[0];
  const etaDisplay = nextStop
    ? nextStop.eta_min < 1  ? 'Arriving'
    : nextStop.eta_min < 60 ? `${Math.round(nextStop.eta_min)} min`
    : `${Math.floor(nextStop.eta_min / 60)}h ${Math.round(nextStop.eta_min % 60)}m`
    : '— min';

  const trafficColor = etaData?.traffic ? TRAFFIC_COLOR[etaData.traffic.severity] || COLORS.warning : COLORS.textMuted;
  const trafficLabel = etaData?.traffic?.label || 'No data';

  const timeSinceUpdate = lastUpdated
    ? Math.floor((new Date() - new Date(lastUpdated)) / 1000)
    : null;

  const confidence = deriveConfidence(isLive, timeSinceUpdate, !!etaData);

  // ── Approaching alert logic ────────────────────────────────────────────────
  useEffect(() => {
    if (alertSent.current || !nextStop) return;
    const stopsAway = stopsList.length;
    const shouldAlert = nextStop.eta_min <= 5 || stopsAway <= 2;
    if (shouldAlert) {
      alertSent.current = true;
      if (notifGranted.current) {
        sendApproachingAlert(busName, nextStop.eta_min, stopsAway);
      } else {
        // In-app fallback if notification permission not granted
        Alert.alert(
          '🚌 Bus Approaching',
          stopsAway <= 2
            ? `${busName} is ${stopsAway} stop${stopsAway === 1 ? '' : 's'} away!`
            : `${busName} arrives in ~${Math.round(nextStop.eta_min)} min.`
        );
      }
    }
  }, [stopsList, nextStop, busName]);

  const fetchSeatInfo = useCallback(async () => {
    try {
      const res = await fetch(`${CAMERA_SERVER}/api/counter/${busId}`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data    = await res.json();
        const occupied = data.on_bus ?? 0;
        setSeatInfo({ capacity, occupied, available: Math.max(0, capacity - occupied) });
      }
    } catch { /* camera server may be offline */ }
  }, [busId, capacity]);

  const fetchEta = useCallback(async () => {
    if (!tripId) return;
    setEtaLoading(true);
    try {
      const resp = await getTripEtaPredictions(tripId);
      setEtaData(resp.data);
    } catch { /* keep previous data */ }
    finally { setEtaLoading(false); }
  }, [tripId]);

  useEffect(() => {
    // Request notification permission
    requestNotifPermission().then((granted) => { notifGranted.current = granted; });

    // Entrance animations
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ])
    ).start();
    Animated.timing(panelSlide, { toValue: 1, duration: 600, delay: 300, useNativeDriver: true }).start();

    // GPS polling — real API, falls back to AppContext mock on error
    const pollGps = async () => {
      try {
        const loc = await fetchBusGps(busId);
        if (loc?.latitude != null) {
          setBusLocation({ latitude: loc.latitude, longitude: loc.longitude });
          setLastUpdated(loc.updatedAt || new Date().toISOString());
          setIsLive(true);
          mapRef.current?.animateToRegion(
            { latitude: loc.latitude, longitude: loc.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 },
            1000
          );
        }
      } catch {
        const loc = getBusLocation?.(busId);
        if (loc) {
          setBusLocation({ latitude: loc.latitude, longitude: loc.longitude });
          setLastUpdated(loc.updatedAt);
        }
      }
    };
    pollGps();
    gpsInterval.current = setInterval(pollGps, GPS_POLL_MS);

    // ETA polling
    fetchEta();
    etaInterval.current = setInterval(fetchEta, ETA_POLL_MS);

    // Seat availability polling
    fetchSeatInfo();
    seatInterval.current = setInterval(fetchSeatInfo, SEAT_POLL_MS);

    // Mock ETA countdown (decreases by 1 min every 30 s for demo)
    const mockTimer = setInterval(() => setMockOffset((o) => o + 1), 30_000);

    return () => {
      clearInterval(gpsInterval.current);
      clearInterval(etaInterval.current);
      clearInterval(seatInterval.current);
      clearInterval(mockTimer);
    };
  }, [busId, fetchEta]);

  const centerOnBus = () => {
    mapRef.current?.animateToRegion(
      { ...busLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      800
    );
  };

  const panelTranslate = panelSlide.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Full-screen Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ ...busLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        <Polyline coordinates={ROUTE_WAYPOINTS} strokeColor={COLORS.primary} strokeWidth={4} lineDashPattern={[1]} />
        <Marker coordinate={busLocation} title={busName} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.busMarkerWrap}>
            <Animated.View style={[styles.busPulse, { transform: [{ scale: pulseAnim }] }]} />
            <View style={styles.busMarker}>
              <Ionicons name="bus" size={18} color={COLORS.white} />
            </View>
          </View>
        </Marker>
        {stopsList.map((stop, i) => (
          <Marker
            key={`stop-${stop.stop_id ?? i}`}
            coordinate={ROUTE_WAYPOINTS[Math.min(i + 1, ROUTE_WAYPOINTS.length - 1)]}
            title={stop.stop_name}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.stopMarker}>
              <View style={[styles.stopDot, i === 0 && styles.stopDotNext]} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.topBarTitle}>
          <Text style={styles.topBarName}>{busName}</Text>
          <View style={styles.liveRow}>
            <View style={[styles.liveDot, { backgroundColor: isLive ? COLORS.secondary : COLORS.warning }]} />
            <Text style={styles.liveText}>
              {isLive
                ? timeSinceUpdate !== null ? `Updated ${timeSinceUpdate}s ago` : 'Live Tracking'
                : 'Connecting...'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={centerOnBus}>
          <Ionicons name="locate" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Slide-up bottom panel */}
      <Animated.View style={[styles.panel, { transform: [{ translateY: panelTranslate }] }]}>
        <View style={styles.panelHandle} />

        {/* Traffic badge */}
        {etaData?.traffic && (
          <View style={[styles.trafficBadge, { backgroundColor: trafficColor + '18', borderColor: trafficColor + '55' }]}>
            <View style={[styles.trafficDot, { backgroundColor: trafficColor }]} />
            <Text style={[styles.trafficLabel, { color: trafficColor }]}>
              {trafficLabel} traffic · {etaData.traffic.delay_description}
            </Text>
          </View>
        )}

        {/* ── ETA + Confidence + Distance row ── */}
        <View style={styles.etaRow}>
          {/* ETA */}
          <View style={styles.etaItem}>
            <View style={[styles.etaIconWrap, { backgroundColor: COLORS.primaryLight }]}>
              <Ionicons name="time-outline" size={20} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.etaValue}>{etaDisplay}</Text>
              <Text style={styles.etaLabel}>
                {nextStop ? `to ${nextStop.stop_name.split(' ')[0]}` : 'ETA'}
              </Text>
            </View>
          </View>

          <View style={styles.etaDivider} />

          {/* ETA Confidence */}
          <View style={styles.etaItem}>
            <View style={[styles.etaIconWrap, { backgroundColor: confidence.color + '20' }]}>
              <Ionicons
                name={confidence.level === 'high' ? 'cellular' : 'cellular-outline'}
                size={20}
                color={confidence.color}
              />
            </View>
            <View>
              <View style={[styles.confidencePill, { backgroundColor: confidence.color + '18', borderColor: confidence.color + '55' }]}>
                <View style={[styles.confidenceDot, { backgroundColor: confidence.color }]} />
                <Text style={[styles.confidenceLabel, { color: confidence.color }]}>
                  {confidence.label}
                </Text>
              </View>
              <Text style={styles.etaLabel}>GPS confidence</Text>
            </View>
          </View>

          <View style={styles.etaDivider} />

          {/* Distance */}
          <View style={styles.etaItem}>
            <View style={[styles.etaIconWrap, { backgroundColor: COLORS.secondaryLight }]}>
              <Ionicons name="navigate-outline" size={20} color={COLORS.secondary} />
            </View>
            <View>
              <Text style={styles.etaValue}>
                {nextStop && nextStop.distance_m ? `${(nextStop.distance_m / 1000).toFixed(1)} km` : '— km'}
              </Text>
              <Text style={styles.etaLabel}>Road dist.</Text>
            </View>
          </View>
        </View>

        {/* Approaching alert banner (shown when close) */}
        {!alertSent.current && nextStop && (nextStop.eta_min <= 5 || stopsList.length <= 2) && (
          <View style={styles.approachingBanner}>
            <Ionicons name="notifications" size={16} color={COLORS.white} />
            <Text style={styles.approachingText}>
              {stopsList.length <= 2
                ? `Bus is ${stopsList.length} stop${stopsList.length === 1 ? '' : 's'} away — get ready!`
                : `Arriving in ~${Math.round(nextStop.eta_min)} min — head to your stop.`}
            </Text>
          </View>
        )}

        {/* Seat Availability */}
        {(() => {
          const pct       = Math.round((seatInfo.occupied / seatInfo.capacity) * 100);
          const seatColor = pct > 90 ? '#EF4444' : pct > 70 ? '#F59E0B' : '#10B981';
          const seatLabel = seatInfo.available === 0 ? 'Full' : pct > 90 ? 'Almost full' : pct > 70 ? 'Getting busy' : 'Seats available';
          return (
            <View style={styles.seatSection}>
              <View style={styles.seatHeader}>
                <Ionicons name="people-outline" size={14} color="#64748B" />
                <Text style={styles.seatTitle}>Seat Availability</Text>
                <Text style={[styles.seatCount, { color: seatColor }]}>
                  {seatInfo.available === 0 ? 'Full' : `${seatInfo.available} free`}
                </Text>
              </View>
              <View style={styles.seatBarBg}>
                <View style={[styles.seatBarFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: seatColor }]} />
              </View>
              <View style={styles.seatFooter}>
                <Text style={styles.seatSubtext}>{seatInfo.occupied}/{seatInfo.capacity} seats occupied</Text>
                <Text style={[styles.seatStatus, { color: seatColor }]}>{seatLabel}</Text>
              </View>
            </View>
          );
        })()}

        {/* Upcoming stops */}
        {stopsList.length > 0 && (
          <View style={styles.stopsSection}>
            <Text style={styles.stopsSectionTitle}>Upcoming Stops</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stopsScroll}>
              {stopsList.slice(0, 5).map((stop, i) => (
                <View key={`chip-${stop.stop_id ?? i}`} style={styles.stopChip}>
                  <View style={[styles.stopChipDot, i === 0 && styles.stopChipDotNext]} />
                  <Text style={[styles.stopChipName, i === 0 && styles.stopChipNameNext]} numberOfLines={1}>
                    {stop.stop_name}
                  </Text>
                  <Text style={[styles.stopChipEta, i === 0 && { color: COLORS.primary }]}>
                    {stop.eta_min < 1 ? 'Now' : `${Math.round(stop.eta_min)}m`}
                  </Text>
                  {stop.eta_time !== '—' && (
                    <Text style={styles.stopChipTime}>{stop.eta_time}</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Driver Card */}
        <View style={styles.driverCard}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverAvatarText}>{MOCK_DRIVER.initials}</Text>
          </View>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{MOCK_DRIVER.name}</Text>
            <Text style={styles.driverVehicle}>{MOCK_DRIVER.vehicle}</Text>
            <View style={styles.driverRatingRow}>
              <Ionicons name="star" size={13} color={COLORS.warning} />
              <Text style={styles.driverRating}>{MOCK_DRIVER.rating}</Text>
              <Text style={styles.driverTrips}>· {MOCK_DRIVER.trips} trips</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.callBtn}>
            <Ionicons name="call" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.emergencyBtn} activeOpacity={0.85}>
          <Ionicons name="warning-outline" size={18} color={COLORS.danger} />
          <Text style={styles.emergencyText}>Report an Issue</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  busMarkerWrap: { alignItems: 'center', justifyContent: 'center' },
  busPulse: {
    position: 'absolute', width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(37,99,235,0.2)',
  },
  busMarker: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: COLORS.white,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  stopMarker: { alignItems: 'center', justifyContent: 'center' },
  stopDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: COLORS.border, borderWidth: 2, borderColor: COLORS.white,
  },
  stopDotNext: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryDark },

  topBar: {
    position: 'absolute', top: 0, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  topBarTitle: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 14,
    paddingVertical: 8, paddingHorizontal: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  topBarName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },

  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 16,
  },
  panelHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginTop: 12, marginBottom: 12,
  },

  trafficBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
    marginBottom: 12, alignSelf: 'flex-start',
  },
  trafficDot: { width: 7, height: 7, borderRadius: 4 },
  trafficLabel: { fontSize: 11, fontWeight: '700' },

  /* ETA row */
  etaRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
    backgroundColor: COLORS.background, borderRadius: 16, padding: 14,
  },
  etaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  etaIconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  etaValue: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  etaLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 1, fontWeight: '500' },
  etaDivider: { width: 1, height: 36, backgroundColor: COLORS.border, marginHorizontal: 2 },

  /* Confidence pill */
  confidencePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2, marginBottom: 2,
    alignSelf: 'flex-start',
  },
  confidenceDot: { width: 6, height: 6, borderRadius: 3 },
  confidenceLabel: { fontSize: 11, fontWeight: '700' },

  /* Approaching banner */
  approachingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  approachingText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.white },

  /* Seats */
  seatSection: {
    backgroundColor: COLORS.background, borderRadius: 12, padding: 12, marginBottom: 14,
  },
  seatHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  seatTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.textMuted,
    flex: 1, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  seatCount: { fontSize: 13, fontWeight: '800' },
  seatBarBg: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  seatBarFill: { height: '100%', borderRadius: 4 },
  seatFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  seatSubtext: { fontSize: 10, color: COLORS.textMuted },
  seatStatus: { fontSize: 10, fontWeight: '700' },

  /* Stop chips */
  stopsSection: { marginBottom: 14 },
  stopsSectionTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  stopsScroll: { flexGrow: 0 },
  stopChip: { alignItems: 'center', marginRight: 14, width: 70 },
  stopChipDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.border, borderWidth: 2, borderColor: COLORS.border, marginBottom: 4,
  },
  stopChipDotNext: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stopChipName: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', fontWeight: '600', marginBottom: 2 },
  stopChipNameNext: { color: COLORS.primary },
  stopChipEta: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
  stopChipTime: { fontSize: 10, color: COLORS.textMuted, fontWeight: '500' },

  /* Driver */
  driverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.background, borderRadius: 16, padding: 14, marginBottom: 12,
  },
  driverAvatar: {
    width: 48, height: 48, borderRadius: 15,
    backgroundColor: COLORS.primaryMid, alignItems: 'center', justifyContent: 'center',
  },
  driverAvatarText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  driverVehicle: { fontSize: 12, color: COLORS.textMuted, marginTop: 1, fontWeight: '500' },
  driverRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  driverRating: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  driverTrips: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  callBtn: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.secondary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },

  emergencyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.dangerLight, borderRadius: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: COLORS.dangerMid,
  },
  emergencyText: { fontSize: 14, fontWeight: '700', color: COLORS.danger },
});

export default BusTrackingScreen;
