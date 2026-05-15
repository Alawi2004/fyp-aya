import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, ActivityIndicator, Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getStopsApi } from '../../api/stopsApi';
import { MOCK_STOPS, stopsWithDistance, formatDist } from '../../utils/mockStops';
import { COLORS } from '../../constants/colors';

const WALKING_RADIUS_KM = 1.5; // show stops within 1.5 km

// ── Route badge ───────────────────────────────────────────────────────────────
const RouteBadge = ({ route }) => (
  <View style={styles.routeBadge}>
    <Text style={styles.routeBadgeText}>{route}</Text>
  </View>
);

// ── Stop list item ────────────────────────────────────────────────────────────
const StopItem = ({ stop, selected, onPress, onPlanRoute }) => (
  <TouchableOpacity
    style={[styles.stopCard, selected && styles.stopCardSelected]}
    onPress={onPress}
    activeOpacity={0.78}
  >
    <View style={[styles.stopIconWrap, selected && { backgroundColor: COLORS.primary }]}>
      <Ionicons name="location" size={18} color={selected ? COLORS.white : COLORS.primary} />
    </View>
    <View style={styles.stopInfo}>
      <Text style={styles.stopName} numberOfLines={1}>{stop.stop_name}</Text>
      <View style={styles.stopMeta}>
        <Ionicons name="walk-outline" size={12} color={COLORS.textMuted} />
        <Text style={styles.stopMetaText}>
          {formatDist(stop.distKm)} · {stop.walkMins} min walk
        </Text>
      </View>
      {stop.routes?.length > 0 && (
        <View style={styles.routeRow}>
          {stop.routes.slice(0, 4).map((r) => <RouteBadge key={r} route={r} />)}
        </View>
      )}
    </View>
    <TouchableOpacity
      style={styles.planBtn}
      onPress={() => onPlanRoute(stop)}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons name="navigate-outline" size={14} color={COLORS.primary} />
      <Text style={styles.planBtnText}>Route</Text>
    </TouchableOpacity>
  </TouchableOpacity>
);

// ── Main screen ───────────────────────────────────────────────────────────────
const NearbyStopsScreen = ({ navigation }) => {
  const insets        = useSafeAreaInsets();
  const mapRef        = useRef(null);

  const [permStatus,    setPermStatus]    = useState(null);   // 'granted' | 'denied' | null
  const [userLocation,  setUserLocation]  = useState(null);
  const [stops,         setStops]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selectedId,    setSelectedId]    = useState(null);
  const [viewMode,      setViewMode]      = useState('both'); // 'both' | 'list'

  // Load stops + location concurrently
  useEffect(() => { bootstrap(); }, []);

  const bootstrap = async () => {
    const [locResult, stopsResult] = await Promise.allSettled([
      getLocation(),
      fetchStops(),
    ]);
    const loc    = locResult.status    === 'fulfilled' ? locResult.value    : null;
    const rawSt  = stopsResult.status  === 'fulfilled' ? stopsResult.value  : [];
    const src    = rawSt.length > 0 ? rawSt : MOCK_STOPS;

    if (loc) {
      setUserLocation(loc);
      const enriched = stopsWithDistance(src, loc.latitude, loc.longitude)
        .filter((s) => s.distKm <= WALKING_RADIUS_KM);
      setStops(enriched);
    } else {
      // No location: show all stops without distance
      setStops(src.map((s) => ({ ...s, distKm: null, walkMins: null })));
    }
    setLoading(false);
  };

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermStatus(status);
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  };

  const fetchStops = async () => {
    try {
      const res = await getStopsApi();
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  };

  const handleMarkerPress = useCallback((stop) => {
    setSelectedId(stop.stop_id);
    mapRef.current?.animateToRegion({
      latitude: stop.latitude,
      longitude: stop.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 350);
  }, []);

  const handlePlanRoute = useCallback((stop) => {
    navigation.navigate('TripPlanner', { initialFromStop: stop });
  }, [navigation]);

  const centerOnUser = () => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.animateToRegion(
      { ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 },
      350
    );
  };

  const mapRegion = userLocation
    ? { ...userLocation, latitudeDelta: 0.06, longitudeDelta: 0.06 }
    : { latitude: 33.8938, longitude: 35.5200, latitudeDelta: 0.18, longitudeDelta: 0.18 };

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nearby Stops</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Finding nearby stops…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Nearby Stops</Text>
          {permStatus === 'granted' && (
            <Text style={styles.headerSub}>
              {stops.length} within {WALKING_RADIUS_KM * 1000} m walk
            </Text>
          )}
        </View>
        {/* Map/List toggle */}
        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={() => setViewMode(v => v === 'both' ? 'list' : 'both')}
        >
          <Ionicons
            name={viewMode === 'both' ? 'list-outline' : 'map-outline'}
            size={20}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Permission denied banner */}
      {permStatus === 'denied' && (
        <View style={styles.permBanner}>
          <Ionicons name="location-outline" size={16} color={COLORS.warning} />
          <Text style={styles.permText}>
            Location permission denied — showing all stops without distance sorting.
          </Text>
        </View>
      )}

      {/* Map */}
      {viewMode === 'both' && (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={Platform.OS === 'android' ? 'google' : PROVIDER_DEFAULT}
            initialRegion={mapRegion}
            showsUserLocation={permStatus === 'granted'}
            showsMyLocationButton={false}
          >
            {stops.map((stop) => (
              <Marker
                key={stop.stop_id}
                coordinate={{ latitude: Number(stop.latitude), longitude: Number(stop.longitude) }}
                title={stop.stop_name}
                description={stop.distKm != null ? `${formatDist(stop.distKm)} · ${stop.walkMins} min` : undefined}
                pinColor={selectedId === stop.stop_id ? COLORS.secondary : COLORS.primary}
                onPress={() => handleMarkerPress(stop)}
              />
            ))}
          </MapView>

          {/* My location button */}
          {permStatus === 'granted' && (
            <TouchableOpacity style={styles.myLocBtn} onPress={centerOnUser}>
              <Ionicons name="locate-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          )}

          {/* Count badge */}
          <View style={styles.countBadge}>
            <Ionicons name="bus-outline" size={12} color={COLORS.white} />
            <Text style={styles.countBadgeText}>{stops.length} stops</Text>
          </View>
        </View>
      )}

      {/* Stop list */}
      {stops.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="location-outline" size={44} color={COLORS.border} />
          <Text style={styles.emptyTitle}>No stops nearby</Text>
          <Text style={styles.emptySub}>
            There are no stops within {WALKING_RADIUS_KM * 1000} m of your location.
          </Text>
        </View>
      ) : (
        <FlatList
          data={stops}
          keyExtractor={(s) => String(s.stop_id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => (
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                {permStatus === 'granted'
                  ? `Sorted by distance · walking at 5 km/h`
                  : 'All stops'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <StopItem
              stop={item}
              selected={selectedId === item.stop_id}
              onPress={() => handleMarkerPress(item)}
              onPlanRoute={handlePlanRoute}
            />
          )}
        />
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  headerSub: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', marginTop: 1 },
  toggleBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },

  permBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.warningLight, paddingHorizontal: 16, paddingVertical: 10,
  },
  permText: { flex: 1, fontSize: 12, color: COLORS.warningDark, lineHeight: 18 },

  /* Map */
  mapContainer: {
    height: 240, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    position: 'relative',
  },
  map: { flex: 1 },
  myLocBtn: {
    position: 'absolute', bottom: 12, right: 12,
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  countBadge: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primary, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  countBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.white },

  /* List */
  listContent: { padding: 12, paddingBottom: 32, gap: 8 },
  listHeader: { paddingBottom: 4 },
  listHeaderText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },

  /* Stop card */
  stopCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 14, borderWidth: 1.5, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  stopCardSelected: {
    borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight,
  },
  stopIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stopInfo: { flex: 1, gap: 3 },
  stopName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  stopMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stopMetaText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  routeRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  routeBadge: {
    backgroundColor: COLORS.primary, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  routeBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.white },

  planBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primaryLight, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.primaryMid,
  },
  planBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  /* Empty */
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  emptySub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21 },
});

export default NearbyStopsScreen;
