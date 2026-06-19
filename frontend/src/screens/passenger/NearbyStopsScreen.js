import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
  LayoutAnimation,
  UIManager,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getStopsApi } from "../../api/stopsApi";
import { stopsWithDistance, formatDist } from "../../utils/mockStops";
import { COLORS, PURPLE } from "../../constants/colors";
import GradientFill from "../../components/common/GradientFill";
import FadeInView from "../../components/common/FadeInView";
import PressableScale from "../../components/common/PressableScale";
import { useApp } from "../../context/AppContext";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RADIUS_OPTIONS = [0.5, 1, 1.5, 3]; // km
const DEFAULT_RADIUS = 1.5;

const animateLayout = () =>
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

const radiusLabel = (km) => (km < 1 ? `${km * 1000} m` : `${km} km`);

/* ────────────────────────── animation helpers ──────────────────────────
   All native-driver, module-level so they never remount with re-renders. */

/** Springs in whenever `active` flips on — selection pop for chips and cards. */
const PopIn = ({ active, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) return;
    scale.setValue(0.9);
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
};

/** Pops every time `trigger` changes value (but not on first render). */
const Bump = ({ trigger, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scale.setValue(0.75);
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 160,
      useNativeDriver: true,
    }).start();
  }, [trigger, scale]);
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
};

/** Horizontal shake on mount — the permission-denied banner. */
const Shake = ({ style, children }) => {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(300),
      Animated.timing(x, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(x, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(x, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(x, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [x]);
  const translateX = x.interpolate({
    inputRange: [-1, 1],
    outputRange: [-6, 6],
  });
  return (
    <Animated.View style={[style, { transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
};

/** Gentle vertical bob — empty-state icon. */
const Float = ({ style, children }) => {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [y]);
  const translateY = y.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });
  return (
    <Animated.View style={[style, { transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

/** Three pulsing dots — loading indicator. */
const Dots = ({ color }) => {
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const loops = anims.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.3,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.delay((2 - i) * 150),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims]);
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {anims.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: color,
            opacity: v,
          }}
        />
      ))}
    </View>
  );
};

/** Expanding rings around a walking icon — "scanning around you". */
const Radar = () => {
  const r1 = useRef(new Animated.Value(0)).current;
  const r2 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const ring = (v) =>
      Animated.loop(
        Animated.timing(v, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      );
    const l1 = ring(r1);
    const l2 = ring(r2);
    l1.start();
    const t = setTimeout(() => l2.start(), 900);
    return () => {
      l1.stop();
      l2.stop();
      clearTimeout(t);
    };
  }, [r1, r2]);
  const ringStyle = (v) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
    transform: [
      {
        scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 2.1] }),
      },
    ],
  });
  return (
    <View style={styles.radarWrap}>
      <Animated.View style={[styles.radarRing, ringStyle(r1)]} />
      <Animated.View style={[styles.radarRing, ringStyle(r2)]} />
      <View style={styles.radarCore}>
        <Ionicons name="walk" size={26} color={COLORS.white} />
      </View>
    </View>
  );
};

// ── Route badge ───────────────────────────────────────────────────────────────
const RouteBadge = ({ route }) => (
  <View style={styles.routeBadge}>
    <Text style={styles.routeBadgeText}>{route}</Text>
  </View>
);

// ── Stop list item ────────────────────────────────────────────────────────────
const StopItem = ({ stop, selected, onPress, onPlanRoute }) => {
  const { t } = useApp();
  return (
  <PopIn active={selected}>
    <PressableScale
      style={[styles.stopCard, selected && styles.stopCardSelected]}
      onPress={onPress}
      scaleTo={0.98}
    >
      <View
        style={[
          styles.stopIconWrap,
          selected && { backgroundColor: PURPLE.primary },
        ]}
      >
        <Ionicons
          name="location"
          size={18}
          color={selected ? COLORS.white : PURPLE.primary}
        />
      </View>
      <View style={styles.stopInfo}>
        <Text style={styles.stopName} numberOfLines={1}>
          {stop.stop_name}
        </Text>
        {stop.distKm != null && (
          <View style={styles.stopMeta}>
            <Ionicons name="walk-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.stopMetaText}>
              {formatDist(stop.distKm)} · {stop.walkMins} {t('min walk')}
            </Text>
          </View>
        )}
        {stop.routes?.length > 0 && (
          <View style={styles.routeRow}>
            {stop.routes.slice(0, 4).map((r) => (
              <RouteBadge key={r} route={r} />
            ))}
          </View>
        )}
      </View>
      <PressableScale
        style={styles.planBtn}
        onPress={() => onPlanRoute(stop)}
        scaleTo={0.9}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="navigate-outline" size={14} color={PURPLE.primary} />
        <Text style={styles.planBtnText}>{t('Route')}</Text>
      </PressableScale>
    </PressableScale>
  </PopIn>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────────
const NearbyStopsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { t } = useApp();
  const mapRef = useRef(null);

  const [permStatus, setPermStatus] = useState(null); // 'granted' | 'denied' | null
  const [userLocation, setUserLocation] = useState(null);
  const [allStops, setAllStops] = useState([]); // distance-enriched (or plain, without location)
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [viewMode, setViewMode] = useState("both"); // 'both' | 'list'
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS);

  const heroAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(heroAnim, {
      toValue: 1,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [heroAnim]);

  // With a location: filter by selected radius, but always show the 5 nearest
  // stops as a fallback so the screen is never empty when stops exist.
  const { stops, usingFallback } = useMemo(() => {
    if (!userLocation) return { stops: allStops, usingFallback: false };
    const inRadius = allStops.filter((s) => s.distKm != null && s.distKm <= radiusKm);
    if (inRadius.length > 0) return { stops: inRadius, usingFallback: false };
    // Nothing within radius — show 5 nearest so the screen isn't blank
    const nearest = allStops
      .filter((s) => s.distKm != null)
      .slice(0, 5);
    return { stops: nearest, usingFallback: nearest.length > 0 };
  }, [allStops, userLocation, radiusKm]);

  // Load stops + location concurrently
  useEffect(() => {
    bootstrap();
  }, []);

  const bootstrap = async () => {
    const [locResult, stopsResult] = await Promise.allSettled([
      getLocation(),
      fetchStops(),
    ]);
    const loc = locResult.status === "fulfilled" ? locResult.value : null;
    const rawSt = stopsResult.status === "fulfilled" ? stopsResult.value : [];

    if (loc) {
      setUserLocation(loc);
      setAllStops(stopsWithDistance(rawSt, loc.latitude, loc.longitude));
    } else {
      // No location: show all stops without distance
      setAllStops(rawSt.map((s) => ({ ...s, distKm: null, walkMins: null })));
    }
    setLoading(false);
  };

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermStatus(status);
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  };

  const fetchStops = async () => {
    try {
      const res = await getStopsApi();
      return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      console.warn('[NearbyStops] fetchStops failed:', err?.message);
      return [];
    }
  };

  const handleMarkerPress = useCallback((stop) => {
    setSelectedId(stop.stop_id);
    mapRef.current?.animateToRegion(
      {
        latitude: Number(stop.latitude),
        longitude: Number(stop.longitude),
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      350
    );
  }, []);

  const handlePlanRoute = useCallback(
    (stop) => {
      navigation.navigate("TripPlanner", { initialFromStop: stop });
    },
    [navigation]
  );

  const centerOnUser = () => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.animateToRegion(
      { ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 },
      350
    );
  };

  const toggleView = () => {
    animateLayout();
    setViewMode((v) => (v === "both" ? "list" : "both"));
  };

  const selectRadius = (km) => {
    animateLayout();
    setRadiusKm(km);
  };

  const mapRegion = userLocation
    ? { ...userLocation, latitudeDelta: 0.06, longitudeDelta: 0.06 }
    : {
        latitude: 33.8938,
        longitude: 35.52,
        latitudeDelta: 0.18,
        longitudeDelta: 0.18,
      };

  const heroEntrance = {
    opacity: heroAnim,
    transform: [
      {
        translateY: heroAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-18, 0],
        }),
      },
    ],
  };

  const hero = (
    <View style={styles.hero}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <GradientFill id="nearbyHero" colors={PURPLE.gradient} vertical />
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
      </View>
      <Animated.View
        style={[styles.heroRow, { paddingTop: insets.top + 10 }, heroEntrance]}
      >
        <PressableScale
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          scaleTo={0.88}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.white} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>{t('Nearby Stops')}</Text>
          {permStatus === "granted" && !loading && (
            <Bump
              trigger={`${stops.length}-${radiusKm}`}
              style={{ alignSelf: "flex-start" }}
            >
              <Text style={styles.heroSub}>
                {usingFallback
                  ? `${stops.length} nearest stops`
                  : `${stops.length} within ${radiusLabel(radiusKm)} walk`}
              </Text>
            </Bump>
          )}
        </View>
        <Bump trigger={viewMode}>
          <PressableScale
            style={styles.toggleBtn}
            onPress={toggleView}
            scaleTo={0.88}
          >
            <Ionicons
              name={viewMode === "both" ? "list-outline" : "map-outline"}
              size={20}
              color={COLORS.white}
            />
          </PressableScale>
        </Bump>
      </Animated.View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />
        {hero}
        <View style={styles.loadingWrap}>
          <Radar />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.loadingText}>{t('Finding nearby stops')}</Text>
            <Dots color={PURPLE.primary} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {hero}

      {/* Permission denied banner */}
      {permStatus === "denied" && (
        <Shake style={styles.permBanner}>
          <Ionicons name="location-outline" size={16} color={COLORS.warning} />
          <Text style={styles.permText}>
            Location permission denied — showing all stops without distance
            sorting.
          </Text>
        </Shake>
      )}

      {/* Radius selector — only meaningful with a location */}
      {permStatus === "granted" && (
        <FadeInView index={0}>
          <View style={styles.radiusRow}>
            <Ionicons name="walk-outline" size={14} color={COLORS.textMuted} />
            {RADIUS_OPTIONS.map((km) => {
              const on = radiusKm === km;
              return (
                <PopIn key={km} active={on}>
                  <PressableScale
                    style={[styles.radiusChip, on && styles.radiusChipOn]}
                    onPress={() => selectRadius(km)}
                    scaleTo={0.92}
                  >
                    <Text
                      style={[
                        styles.radiusChipText,
                        on && styles.radiusChipTextOn,
                      ]}
                    >
                      {radiusLabel(km)}
                    </Text>
                  </PressableScale>
                </PopIn>
              );
            })}
          </View>
        </FadeInView>
      )}

      {/* Map */}
      {viewMode === "both" && (
        <FadeInView index={1}>
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={Platform.OS === "android" ? "google" : PROVIDER_DEFAULT}
              initialRegion={mapRegion}
              showsUserLocation={permStatus === "granted"}
              showsMyLocationButton={false}
            >
              {stops.map((stop) => {
                const active = selectedId === stop.stop_id;
                return (
                  <Marker
                    key={stop.stop_id}
                    coordinate={{
                      latitude: Number(stop.latitude),
                      longitude: Number(stop.longitude),
                    }}
                    title={stop.stop_name}
                    description={
                      stop.distKm != null
                        ? `${formatDist(stop.distKm)} · ${stop.walkMins} min`
                        : undefined
                    }
                    onPress={() => handleMarkerPress(stop)}
                    anchor={{ x: 0.5, y: 1 }}
                    tracksViewChanges={Platform.OS === "ios" ? active : true}
                  >
                    <View style={styles.markerWrap}>
                      <View
                        style={[
                          styles.markerPin,
                          active && styles.markerPinActive,
                        ]}
                      >
                        <Ionicons name="bus" size={13} color={COLORS.white} />
                      </View>
                      <View
                        style={[
                          styles.markerTip,
                          active && { borderTopColor: COLORS.secondary },
                        ]}
                      />
                    </View>
                  </Marker>
                );
              })}
            </MapView>

            {/* My location button */}
            {permStatus === "granted" && (
              <PressableScale
                style={styles.myLocBtn}
                onPress={centerOnUser}
                scaleTo={0.88}
              >
                <Ionicons
                  name="locate-outline"
                  size={20}
                  color={PURPLE.primary}
                />
              </PressableScale>
            )}

            {/* Count badge */}
            <Bump trigger={stops.length} style={styles.countBadge}>
              <Ionicons name="bus-outline" size={12} color={COLORS.white} />
              <Text style={styles.countBadgeText}>{stops.length} {t('stops')}</Text>
            </Bump>
          </View>
        </FadeInView>
      )}

      {/* Stop list */}
      {stops.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Float>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name="location-outline"
                size={40}
                color={PURPLE.primary}
              />
            </View>
          </Float>
          <Text style={styles.emptyTitle}>{t('No stops nearby')}</Text>
          <Text style={styles.emptySub}>
            {allStops.length === 0
              ? "Could not load stops. Check your connection and try again."
              : permStatus === "granted"
              ? `No stops within ${radiusLabel(radiusKm)}. Try a wider radius.`
              : "Enable location to see stops near you."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={stops}
          keyExtractor={(s) => String(s.stop_id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                {permStatus === "granted"
                  ? usingFallback
                    ? `No stops within ${radiusLabel(radiusKm)} — showing ${stops.length} nearest`
                    : t('Sorted by distance · walking at 5 km/h')
                  : t('All stops')}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            // key includes radius so changing it replays the cascade
            <FadeInView
              key={`${radiusKm}-${item.stop_id}`}
              index={Math.min(index, 8)}
            >
              <StopItem
                stop={item}
                selected={selectedId === item.stop_id}
                onPress={() => handleMarkerPress(item)}
                onPlanRoute={handlePlanRoute}
              />
            </FadeInView>
          )}
        />
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  /* Hero */
  hero: {
    backgroundColor: PURPLE.deep,
    overflow: "hidden",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  heroDecor1: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -70,
    right: -40,
  },
  heroDecor2: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.05)",
    bottom: -40,
    left: -30,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.white,
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
    fontWeight: "600",
    marginTop: 1,
  },
  toggleBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Loading radar */
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
  },
  loadingText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: "500" },
  radarWrap: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  radarRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PURPLE.primary,
  },
  radarCore: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PURPLE.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PURPLE.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },

  permBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  permText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.warningDark,
    lineHeight: 18,
  },

  /* Radius selector */
  radiusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  radiusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  radiusChipOn: {
    backgroundColor: PURPLE.primary,
    borderColor: PURPLE.primary,
  },
  radiusChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  radiusChipTextOn: { color: COLORS.white },

  /* Map */
  mapContainer: {
    height: 240,
    borderRadius: 20,
    overflow: "hidden",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    position: "relative",
    shadowColor: PURPLE.deep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  map: { flex: 1 },
  myLocBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  countBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(124,58,237,0.95)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countBadgeText: { fontSize: 12, fontWeight: "600", color: COLORS.white },

  /* Custom map markers */
  markerWrap: { alignItems: "center" },
  markerPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: PURPLE.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  markerPinActive: {
    backgroundColor: COLORS.secondary,
    transform: [{ scale: 1.15 }],
  },
  markerTip: {
    width: 0,
    height: 0,
    marginTop: -3,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: PURPLE.primary,
  },

  /* List */
  listContent: { padding: 16, paddingTop: 10, paddingBottom: 32, gap: 8 },
  listHeader: { paddingBottom: 4 },
  listHeaderText: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600" },

  /* Stop card */
  stopCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    shadowColor: PURPLE.deep,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  stopCardSelected: {
    borderColor: PURPLE.primary,
    backgroundColor: PURPLE.light,
  },
  stopIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: PURPLE.light,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stopInfo: { flex: 1, gap: 3 },
  stopName: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  stopMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  stopMetaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  routeRow: { flexDirection: "row", gap: 5, flexWrap: "wrap" },
  routeBadge: {
    backgroundColor: PURPLE.primary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  routeBadgeText: { fontSize: 10, fontWeight: "800", color: COLORS.white },

  planBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: PURPLE.light,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: PURPLE.midStrong,
  },
  planBtnText: { fontSize: 12, fontWeight: "700", color: PURPLE.primary },

  /* Empty */
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: PURPLE.light,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  emptySub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
});

export default NearbyStopsScreen;
