import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Platform, StatusBar, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { COLORS } from '../../constants/colors';

const ROUTE_WAYPOINTS = [
  { latitude: 33.8880, longitude: 35.4950 },
  { latitude: 33.8910, longitude: 35.4990 },
  { latitude: 33.8938, longitude: 35.5018 },
  { latitude: 33.8970, longitude: 35.5080 },
  { latitude: 33.9010, longitude: 35.5150 },
  { latitude: 33.9050, longitude: 35.5220 },
];

const STOPS = [
  { name: 'Central Station', latitude: 33.8880, longitude: 35.4950 },
  { name: 'City Mall',        latitude: 33.8970, longitude: 35.5080 },
  { name: 'Airport',          latitude: 33.9050, longitude: 35.5220 },
];

const MOCK_DRIVER = {
  name: 'Ahmad Al-Hassan',
  rating: 4.8,
  trips: 1243,
  initials: 'AH',
  vehicle: 'Express 101 · White Bus',
  phone: '+961 70 000 000',
};

const BusTrackingScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { busId = 'bus1', busName = 'Express 101' } = route.params || {};
  const { getBusLocation } = useApp();
  const mapRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const panelSlide = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef(null);

  const [busLocation, setBusLocation] = useState(
    getBusLocation?.(busId) || { latitude: 33.8938, longitude: 35.5018 }
  );
  const [eta, setEta] = useState('8 min');
  const [speed, setSpeed] = useState(42);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    // Pulse animation for live dot
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();

    // Slide-up panel entrance
    Animated.timing(panelSlide, { toValue: 1, duration: 600, delay: 300, useNativeDriver: true }).start();

    // Poll for location
    intervalRef.current = setInterval(() => {
      const loc = getBusLocation?.(busId);
      if (loc) {
        setBusLocation({ latitude: loc.latitude, longitude: loc.longitude });
        setEta(loc.eta || '8 min');
        setSpeed(loc.speed || 42);
        setLastUpdated(loc.updatedAt);
        setIsLive(true);
        mapRef.current?.animateToRegion({
          latitude: loc.latitude,
          longitude: loc.longitude,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }, 1000);
      }
    }, 3000);

    return () => clearInterval(intervalRef.current);
  }, [busId]);

  const centerOnBus = () => {
    mapRef.current?.animateToRegion({
      ...busLocation,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 800);
  };

  const timeSinceUpdate = lastUpdated
    ? Math.floor((new Date() - new Date(lastUpdated)) / 1000)
    : null;

  const panelTranslate = panelSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Full-screen Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          ...busLocation,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* Route line */}
        <Polyline
          coordinates={ROUTE_WAYPOINTS}
          strokeColor={COLORS.primary}
          strokeWidth={4}
          lineDashPattern={[1]}
        />

        {/* Bus Marker */}
        <Marker coordinate={busLocation} title={busName} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.busMarkerWrap}>
            <Animated.View style={[styles.busPulse, { transform: [{ scale: pulseAnim }] }]} />
            <View style={styles.busMarker}>
              <Ionicons name="bus" size={18} color={COLORS.white} />
            </View>
          </View>
        </Marker>

        {/* Stop Markers */}
        {STOPS.map((stop, i) => (
          <Marker key={i} coordinate={stop} title={stop.name} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.stopMarker}>
              <View style={styles.stopDot} />
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

        {/* ETA + Speed row */}
        <View style={styles.etaRow}>
          <View style={styles.etaItem}>
            <View style={[styles.etaIconWrap, { backgroundColor: COLORS.primaryLight }]}>
              <Ionicons name="time-outline" size={20} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.etaValue}>{eta}</Text>
              <Text style={styles.etaLabel}>ETA to stop</Text>
            </View>
          </View>

          <View style={styles.etaDivider} />

          <View style={styles.etaItem}>
            <View style={[styles.etaIconWrap, { backgroundColor: COLORS.warningLight }]}>
              <Ionicons name="speedometer-outline" size={20} color={COLORS.warning} />
            </View>
            <View>
              <Text style={styles.etaValue}>{speed} km/h</Text>
              <Text style={styles.etaLabel}>Speed</Text>
            </View>
          </View>

          <View style={styles.etaDivider} />

          <View style={styles.etaItem}>
            <View style={[styles.etaIconWrap, { backgroundColor: COLORS.secondaryLight }]}>
              <Ionicons name="navigate-outline" size={20} color={COLORS.secondary} />
            </View>
            <View>
              <Text style={styles.etaValue}>2.4 km</Text>
              <Text style={styles.etaLabel}>Distance</Text>
            </View>
          </View>
        </View>

        {/* Route progress */}
        <View style={styles.stopsSection}>
          <Text style={styles.stopsSectionTitle}>Route Progress</Text>
          <View style={styles.stopsRow}>
            {STOPS.map((stop, i) => (
              <React.Fragment key={i}>
                <View style={styles.stopItem}>
                  <View style={[
                    styles.stopCircle,
                    i === 0 && styles.stopCircleDone,
                    i === 1 && styles.stopCircleCurrent,
                  ]}>
                    {i === 0 && <Ionicons name="checkmark" size={10} color={COLORS.white} />}
                    {i === 1 && <View style={styles.stopCircleInner} />}
                  </View>
                  <Text style={[styles.stopLabel, i === 1 && { color: COLORS.primary, fontWeight: '700' }]} numberOfLines={1}>
                    {stop.name.split(' ')[0]}
                  </Text>
                </View>
                {i < STOPS.length - 1 && (
                  <View style={[styles.stopLine, i === 0 && { backgroundColor: COLORS.secondary }]} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

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

        {/* Emergency */}
        <TouchableOpacity style={styles.emergencyBtn} activeOpacity={0.85}>
          <Ionicons name="warning-outline" size={18} color={COLORS.danger} />
          <Text style={styles.emergencyText}>Report an Issue</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Map overlays */
  busMarkerWrap: { alignItems: 'center', justifyContent: 'center' },
  busPulse: {
    position: 'absolute',
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(37,99,235,0.2)',
  },
  busMarker: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: COLORS.white,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  stopMarker: { alignItems: 'center', justifyContent: 'center' },
  stopDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: COLORS.primary,
    borderWidth: 2, borderColor: COLORS.white,
  },

  /* Top bar */
  topBar: {
    position: 'absolute', top: 0, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  topBarTitle: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  topBarName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },

  /* Bottom Panel */
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 16,
  },
  panelHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 18,
  },

  /* ETA row */
  etaRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 20,
    backgroundColor: COLORS.background,
    borderRadius: 16, padding: 14,
  },
  etaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  etaIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  etaValue: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  etaLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 1, fontWeight: '500' },
  etaDivider: { width: 1, height: 36, backgroundColor: COLORS.border, marginHorizontal: 4 },

  /* Stops progress */
  stopsSection: { marginBottom: 18 },
  stopsSectionTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12,
  },
  stopsRow: { flexDirection: 'row', alignItems: 'center' },
  stopItem: { alignItems: 'center', gap: 5 },
  stopCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stopCircleDone: { backgroundColor: COLORS.secondary },
  stopCircleCurrent: {
    backgroundColor: COLORS.white,
    borderWidth: 2.5, borderColor: COLORS.primary,
  },
  stopCircleInner: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  stopLabel: {
    fontSize: 10, color: COLORS.textMuted,
    maxWidth: 64, textAlign: 'center',
    fontWeight: '600',
  },
  stopLine: {
    flex: 1, height: 2.5,
    backgroundColor: COLORS.border,
    marginBottom: 16, marginHorizontal: 2,
  },

  /* Driver card */
  driverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.background,
    borderRadius: 16, padding: 14, marginBottom: 12,
  },
  driverAvatar: {
    width: 48, height: 48, borderRadius: 15,
    backgroundColor: COLORS.primaryMid,
    alignItems: 'center', justifyContent: 'center',
  },
  driverAvatarText: {
    fontSize: 16, fontWeight: '800', color: COLORS.primary,
  },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  driverVehicle: { fontSize: 12, color: COLORS.textMuted, marginTop: 1, fontWeight: '500' },
  driverRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  driverRating: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  driverTrips: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  callBtn: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },

  /* Emergency */
  emergencyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.dangerLight,
    borderRadius: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: COLORS.dangerMid,
  },
  emergencyText: { fontSize: 14, fontWeight: '700', color: COLORS.danger },
});

export default BusTrackingScreen;
