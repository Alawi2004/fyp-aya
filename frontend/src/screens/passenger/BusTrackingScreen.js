import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Easing,
  PanResponder,
  Dimensions,
  Platform,
  StatusBar,
  ScrollView,
  Alert,
  Linking,
} from "react-native";

const SCREEN_H         = Dimensions.get("window").height;
const PANEL_COLLAPSE_Y = Math.round(SCREEN_H * 0.46);
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../../context/AppContext";
import { getTripEtaPredictions } from "../../api/etaApi";
import { useGpsWebSocket } from "../../hooks/useGpsWebSocket";
import { COLORS, PURPLE } from "../../constants/colors";
import GradientFill from "../../components/common/GradientFill";
import FadeInView from "../../components/common/FadeInView";
import PressableScale from "../../components/common/PressableScale";
import apiClient from "../../api/apiClient";

const CAMERA_SERVER = "http://localhost:9000";
const SEAT_POLL_MS = 5_000;
const ETA_POLL_MS = 15_000;

const EMPTY_STOPS = [];

// Camera-only framing for the brief window before we know the trip's real
// position — never used to place the bus marker itself.
const DEFAULT_REGION = { latitude: 33.8938, longitude: 35.5018 };

const TAXI_AMBER = "#D97706";

const TRAFFIC_COLOR = {
  low: "#10B981",
  moderate: "#84CC16",
  busy: "#F59E0B",
  heavy: "#F97316",
  severe: "#EF4444",
};

// ── Notification setup ────────────────────────────────────────────────────────
// Local notifications still work in Expo Go; only remote push was removed in SDK 53.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

if (!IS_EXPO_GO) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const requestNotifPermission = async () => {
  if (IS_EXPO_GO) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
};

const sendApproachingAlert = async (
  busName,
  etaMin,
  stopsAway,
  isTaxi = false
) => {
  if (IS_EXPO_GO) return;
  const body =
    stopsAway <= 2
      ? `${busName} is ${stopsAway} stop${
          stopsAway === 1 ? "" : "s"
        } away — get ready to board!`
      : `${busName} arrives in ~${Math.round(
          etaMin
        )} min — time to head to the stop.`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: isTaxi ? "🚕 Taxi Approaching" : "🚌 Bus Approaching",
      body,
      sound: true,
      data: { busName, etaMin, stopsAway },
    },
    trigger: null,
  });
};

// ── Confidence from GPS freshness ──────────────────────────────────────────────
const deriveConfidence = (isLive, timeSinceUpdate, hasEtaData) => {
  if (!isLive && timeSinceUpdate === null)
    return { level: "waiting", label: "Waiting", color: "#9ca3af" };
  if (!isLive || timeSinceUpdate === null)
    return { level: "low", label: "Low", color: COLORS.danger };
  if (timeSinceUpdate > 120)
    return { level: "low", label: "Low", color: COLORS.danger };
  if (timeSinceUpdate > 30 || !hasEtaData)
    return { level: "medium", label: "Medium", color: COLORS.warning };
  return { level: "high", label: "High", color: COLORS.secondary };
};

/* ────────────────────────── animation helpers ──────────────────────────
   All native-driver (except the seat bar, which animates width),
   module-level so they never remount with re-renders. */

/** Pops every time `trigger` changes value (but not on first render). */
const Bump = ({ trigger, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scale.setValue(0.7);
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

/** Slow scale pulse — keeps attention on a banner or CTA. */
const Breathe = ({ style, children, to = 1.02 }) => {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: to,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, to]);
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
};

/** Pulsing opacity — the "live" indicator dot. */
const Blink = ({ style }) => {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.25,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[style, { opacity }]} />;
};

/** Continuous rotation — refresh-in-flight indicator. */
const Spin = ({ children }) => {
  const r = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(r, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [r]);
  const rotate = r.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      {children}
    </Animated.View>
  );
};

/** Two staggered expanding rings around the vehicle map marker. */
const MarkerPulse = ({ color }) => {
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
    backgroundColor: color,
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) },
    ],
  });
  return (
    <>
      <Animated.View style={[styles.busPulse, ringStyle(r1)]} />
      <Animated.View style={[styles.busPulse, ringStyle(r2)]} />
    </>
  );
};

/** Seat-occupancy bar that eases to its new width (width can't use the native driver). */
const SeatBar = ({ pct, color }) => {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, {
      toValue: Math.min(pct, 100),
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, w]);
  const width = w.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });
  return (
    <View style={styles.seatBarBg}>
      <Animated.View
        style={[styles.seatBarFill, { width, backgroundColor: color }]}
      />
    </View>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────
const BusTrackingScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { t } = useApp();
  const { tripId, busName = "Bus", booking } = route.params || {};
  const isTaxi = booking?.type === "taxi";
  const vehicleId = String(tripId ?? "");
  const mapRef = useRef(null);
  const panelSlide   = useRef(new Animated.Value(0)).current;
  const topSlide     = useRef(new Animated.Value(0)).current;
  const panelDragY   = useRef(new Animated.Value(0)).current;
  const collapsedRef = useRef(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const etaInterval = useRef(null);
  const alertSent = useRef(false);
  const notifGranted = useRef(false);

  const panelPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 6,
      onPanResponderMove: (_, { dy }) => {
        const base = collapsedRef.current ? PANEL_COLLAPSE_Y : 0;
        panelDragY.setValue(Math.max(0, Math.min(PANEL_COLLAPSE_Y, base + dy)));
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const base      = collapsedRef.current ? PANEL_COLLAPSE_Y : 0;
        const projected = base + dy;
        const collapse  = projected > PANEL_COLLAPSE_Y / 2 || vy > 0.4;
        collapsedRef.current = collapse;
        setIsCollapsed(collapse);
        Animated.spring(panelDragY, {
          toValue:          collapse ? PANEL_COLLAPSE_Y : 0,
          useNativeDriver:  false,
          friction:         9,
          tension:          70,
        }).start();
      },
    })
  ).current;

  // WebSocket GPS stream (with HTTP polling fallback built in) — no fake
  // default location; until a real fix arrives we fall back to the trip's
  // actual starting point via etaData.current_position below.
  const {
    location: wsLocation,
    isLive: wsIsLive,
    lastUpdated: wsLastUpdated,
  } = useGpsWebSocket(vehicleId);

  const [busLocation, setBusLocation] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [etaData, setEtaData] = useState(null);
  const [etaLoading, setEtaLoading] = useState(false);
  const [etaError, setEtaError] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [vehiclePhoto, setVehiclePhoto] = useState(null);

  // Seat availability (capacity updated when driver info loads)
  const [seatInfo, setSeatInfo] = useState({
    capacity: 40,
    occupied: 0,
    available: 40,
  });
  const seatInterval = useRef(null);

  // Re-render once a second so "Updated Xs ago" and GPS confidence stay current.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setClockTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Load driver info — from booking directly for taxi, from API for bus
  useEffect(() => {
    if (isTaxi) {
      if (booking?.driverName) {
        const initials = booking.driverName
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        const vehicleParts = [
          booking.vehicleColor,
          booking.vehicleModel,
          booking.vehiclePlate,
        ].filter(Boolean);
        setDriverInfo({
          name: booking.driverName,
          initials,
          vehicle: vehicleParts.join(" · ") || "Taxi",
          rating: booking.driverRating
            ? Number(booking.driverRating).toFixed(1)
            : null,
          trips: null,
          phone: null,
          plate: booking.vehiclePlate ?? null,
          color: booking.vehicleColor ?? null,
        });
      }
      return;
    }
    if (!tripId) return;
    apiClient
      .get(`/buses/${tripId}`)
      .then((r) => {
        const d = r.data;
        if (!d) return;
        if (d.driver_name) {
          const initials = d.driver_name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          setDriverInfo({
            name: d.driver_name,
            initials,
            vehicle: `${d.name ?? ""} · ${d.plate_number ?? ""}`
              .trim()
              .replace(/^·\s*/, ""),
            rating: parseFloat(d.driver_rating ?? 0).toFixed(1),
            trips: d.driver_trips ?? 0,
            phone: d.driver_phone ?? null,
            plate: d.plate_number ?? null,
            color: null,
          });
        }
        if (d.totalSeats) {
          const cap = parseInt(d.totalSeats, 10);
          const occ = parseInt(d.bookedSeats || 0, 10);
          setSeatInfo({
            capacity:  cap,
            occupied:  occ,
            available: Math.max(0, cap - occ),
          });
        }
        if (d.vehicle_id) {
          apiClient
            .get(`/vehicles/${d.vehicle_id}/photos`)
            .then((pr) => {
              const exterior = (Array.isArray(pr.data) ? pr.data : [])
                .find((p) => p.slot === 'exterior' || p.slot === 'photo');
              if (exterior?.url) setVehiclePhoto(exterior.url);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [tripId, isTaxi]);

  // ── Derived stop list (real or empty) ────────────────────────────────────
  const stopsList = useMemo(() => {
    if (etaData?.stops?.length > 0) return etaData.stops;
    return EMPTY_STOPS;
  }, [etaData]);

  // Pick the first stop with a meaningful ETA (> 1 min ahead).
  // When the bus is at the first stop (eta_min ≈ 0 → "Arriving"), skip to the
  // next stop so the ETA card shows something useful to the passenger.
  const nextStop =
    stopsList.find((s) => s.eta_min > 1) ??
    stopsList[0] ??
    null;

  const etaDisplay = nextStop
    ? nextStop.eta_min < 1
      ? "Arriving"
      : nextStop.eta_min < 60
      ? `${Math.round(nextStop.eta_min)} min`
      : `${Math.floor(nextStop.eta_min / 60)}h ${Math.round(
          nextStop.eta_min % 60
        )}m`
    : "— min";

  const trafficColor = etaData?.traffic
    ? TRAFFIC_COLOR[etaData.traffic.severity] || COLORS.warning
    : COLORS.textMuted;
  const trafficLabel = etaData?.traffic?.label || "No data";

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
        sendApproachingAlert(busName, nextStop.eta_min, stopsAway, isTaxi);
      } else {
        Alert.alert(
          isTaxi ? "🚕 Taxi Approaching" : "🚌 Bus Approaching",
          stopsAway <= 2
            ? `${busName} is ${stopsAway} stop${
                stopsAway === 1 ? "" : "s"
              } away!`
            : `${busName} arrives in ~${Math.round(nextStop.eta_min)} min.`
        );
      }
    }
  }, [stopsList, nextStop, busName]);

  const fetchSeatInfo = useCallback(async () => {
    try {
      const res = await fetch(`${CAMERA_SERVER}/api/counter/${vehicleId}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        const occupied = data.on_bus ?? 0;
        setSeatInfo((s) => ({
          ...s,
          occupied,
          available: Math.max(0, s.capacity - occupied),
        }));
      }
    } catch {
      /* camera server may be offline */
    }
  }, [vehicleId]);

  const fetchEta = useCallback(async () => {
    if (!tripId) {
      console.log('[ETA] no tripId — skipping');
      return;
    }
    setEtaLoading(true);
    try {
      const resp = await getTripEtaPredictions(tripId);
      setEtaData(resp.data);
      setEtaError(null);
    } catch (err) {
      const status = err?.response?.status;
      const msg    = err?.response?.data?.error ?? err?.message ?? 'Network error';
      console.warn(`[ETA] fetch failed (trip ${tripId}) HTTP ${status}:`, msg);
      setEtaError(`${status ?? '—'}: ${msg}`);
    } finally {
      setEtaLoading(false);
    }
  }, [tripId]);

  // Sync WebSocket / polling location into component state and map
  useEffect(() => {
    if (wsLocation?.latitude == null) return;
    setBusLocation({
      latitude: wsLocation.latitude,
      longitude: wsLocation.longitude,
    });
    setIsLive(wsIsLive);
    if (wsLastUpdated) setLastUpdated(wsLastUpdated);
    mapRef.current?.animateToRegion(
      {
        latitude: wsLocation.latitude,
        longitude: wsLocation.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      },
      600
    );
  }, [wsLocation, wsIsLive, wsLastUpdated]);

  // No live GPS yet — fall back to the trip's real current position (latest
  // GPS log or, if the trip hasn't started, the route's actual first stop).
  // This replaces showing a meaningless hardcoded coordinate.
  useEffect(() => {
    if (isLive || !etaData?.current_position) return;
    const { latitude, longitude } = etaData.current_position;
    if (latitude == null || longitude == null) return;
    setBusLocation({ latitude, longitude });
    mapRef.current?.animateToRegion(
      { latitude, longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 },
      600
    );
  }, [etaData, isLive]);

  useEffect(() => {
    // Request notification permission
    requestNotifPermission().then((granted) => {
      notifGranted.current = granted;
    });

    // Entrance animations: top bar drops in, panel springs up after a beat
    Animated.spring(topSlide, {
      toValue: 1,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();
    Animated.sequence([
      Animated.delay(250),
      Animated.spring(panelSlide, {
        toValue: 1,
        friction: 9,
        tension: 40,
        useNativeDriver: false,
      }),
    ]).start();

    // ETA polling
    fetchEta();
    etaInterval.current = setInterval(fetchEta, ETA_POLL_MS);

    // Seat availability polling
    fetchSeatInfo();
    seatInterval.current = setInterval(fetchSeatInfo, SEAT_POLL_MS);

    return () => {
      clearInterval(etaInterval.current);
      clearInterval(seatInterval.current);
    };
  }, [tripId, fetchEta, fetchSeatInfo, topSlide, panelSlide]);

  const centerOnBus = () => {
    if (!busLocation) return;
    mapRef.current?.animateToRegion(
      { ...busLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      800
    );
  };

  const panelTranslate = panelSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });
  const panelTotalY = Animated.add(panelTranslate, panelDragY);
  const topTranslate = topSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [-90, 0],
  });

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Full-screen Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          ...(busLocation || DEFAULT_REGION),
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {busLocation && (
          <Marker
            coordinate={busLocation}
            title={busName}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.busMarkerWrap}>
              <MarkerPulse
                color={isTaxi ? "rgba(217,119,6,0.45)" : "rgba(139,92,246,0.45)"}
              />
              <View style={[styles.busMarker, isTaxi && styles.taxiMarker]}>
                <Ionicons
                  name={isTaxi ? "car-sport" : "bus"}
                  size={18}
                  color={COLORS.white}
                />
              </View>
            </View>
          </Marker>
        )}
        {stopsList.map((stop, i) =>
          stop.latitude && stop.longitude ? (
            <Marker
              key={`stop-${stop.stop_id ?? i}`}
              coordinate={{
                latitude: parseFloat(stop.latitude),
                longitude: parseFloat(stop.longitude),
              }}
              title={stop.stop_name}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.stopMarker}>
                <View style={[styles.stopDot, i === 0 && styles.stopDotNext]} />
              </View>
            </Marker>
          ) : null
        )}
      </MapView>

      {/* Top bar */}
      <Animated.View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 12,
            opacity: topSlide,
            transform: [{ translateY: topTranslate }],
          },
        ]}
      >
        <PressableScale
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          scaleTo={0.88}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </PressableScale>
        <View style={styles.topBarTitle}>
          <Text style={styles.topBarName}>{busName}</Text>
          <View style={styles.liveRow}>
            <Blink
              style={[
                styles.liveDot,
                { backgroundColor: isLive ? COLORS.secondary : COLORS.warning },
              ]}
            />
            <Text style={styles.liveText}>
              {isLive
                ? timeSinceUpdate !== null
                  ? `Updated ${timeSinceUpdate}s ago`
                  : t("Live Tracking")
                : t("Connecting...")}
            </Text>
          </View>
        </View>
        <PressableScale
          style={styles.iconBtn}
          onPress={centerOnBus}
          scaleTo={0.88}
        >
          <Ionicons name="locate" size={20} color={PURPLE.primary} />
        </PressableScale>
      </Animated.View>

      {/* Slide-up bottom panel */}
      <Animated.View
        style={[styles.panel, { transform: [{ translateY: panelTotalY }] }]}
      >
        <View style={styles.panelHandleArea} {...panelPan.panHandlers}>
          <View style={styles.panelHandle} />
          <Ionicons
            name={isCollapsed ? "chevron-up" : "chevron-down"}
            size={16}
            color={COLORS.textMuted}
          />
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
        >

        {/* ── ETA card (2 cols: ETA | Distance) + traffic strip ── */}
        <FadeInView index={0}>
          <View style={styles.etaCard}>
            {/* ETA column */}
            <View style={styles.etaCol}>
              <View style={[styles.etaIconWrap, { backgroundColor: PURPLE.light }]}>
                <Ionicons name="time-outline" size={18} color={PURPLE.primary} />
              </View>
              <Bump trigger={etaDisplay}>
                <Text style={styles.etaValue}>{etaDisplay}</Text>
              </Bump>
              <Text style={styles.etaLabel}>
                {nextStop ? `to ${nextStop.stop_name.split(" ")[0]}` : "ETA"}
              </Text>
            </View>

            <View style={styles.etaDivider} />

            {/* Distance column */}
            <View style={styles.etaCol}>
              <View style={[styles.etaIconWrap, { backgroundColor: COLORS.secondaryLight }]}>
                <Ionicons name="navigate-outline" size={18} color={COLORS.secondary} />
              </View>
              <Bump trigger={nextStop?.distance_m}>
                <Text style={styles.etaValue}>
                  {nextStop == null
                    ? "— km"
                    : nextStop.distance_m > 100
                    ? `${(nextStop.distance_m / 1000).toFixed(1)} km`
                    : nextStop.distance_m != null
                    ? "At stop"
                    : "— km"}
                </Text>
              </Bump>
              <Text style={styles.etaLabel}>{t('Road dist.')}</Text>
            </View>

            <View style={styles.etaDivider} />

            {/* GPS signal column */}
            <View style={styles.etaCol}>
              <View style={[styles.etaIconWrap, { backgroundColor: confidence.color + "20" }]}>
                <Ionicons
                  name={confidence.level === "high" ? "cellular" : "cellular-outline"}
                  size={18}
                  color={confidence.color}
                />
              </View>
              <Text style={[styles.etaValue, { color: confidence.color, fontSize: 14 }]}>
                {confidence.label}
              </Text>
              <Text style={styles.etaLabel}>{t('GPS signal')}</Text>
            </View>
          </View>

          {/* Traffic strip — only shown when data available */}
          {etaData?.traffic ? (
            <View style={[styles.trafficStrip, { backgroundColor: trafficColor + "14", borderColor: trafficColor + "45" }]}>
              <View style={[styles.trafficDot, { backgroundColor: trafficColor }]} />
              <Text style={[styles.trafficStripText, { color: trafficColor }]}>
                {trafficLabel} traffic · {etaData.traffic.delay_description}
              </Text>
              {etaLoading && (
                <Spin>
                  <Ionicons name="sync" size={10} color={trafficColor} style={{ marginLeft: 4 }} />
                </Spin>
              )}
            </View>
          ) : etaError ? (
            <View style={styles.etaErrorStrip}>
              <Ionicons name="warning-outline" size={13} color={COLORS.warning} />
              <Text style={styles.etaErrorText} numberOfLines={2}>ETA unavailable · {etaError}</Text>
            </View>
          ) : etaLoading ? (
            <View style={styles.etaErrorStrip}>
              <Spin><Ionicons name="sync" size={13} color={COLORS.textMuted} /></Spin>
              <Text style={styles.etaErrorText}>Loading ETA…</Text>
            </View>
          ) : null}
        </FadeInView>

        {/* Approaching alert banner (shown when close) */}
        {!alertSent.current &&
          nextStop &&
          (nextStop.eta_min <= 5 || stopsList.length <= 2) && (
            <FadeInView index={2}>
              <Breathe>
                <View style={styles.approachingBanner}>
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <GradientFill
                      id="approachBanner"
                      colors={["#6D28D9", "#8B5CF6"]}
                      vertical={false}
                    />
                  </View>
                  <Ionicons
                    name="notifications"
                    size={16}
                    color={COLORS.white}
                  />
                  <Text style={styles.approachingText}>
                    {stopsList.length <= 2
                      ? `Bus is ${stopsList.length} stop${
                          stopsList.length === 1 ? "" : "s"
                        } away — get ready!`
                      : `Arriving in ~${Math.round(
                          nextStop.eta_min
                        )} min — head to your stop.`}
                  </Text>
                </View>
              </Breathe>
            </FadeInView>
          )}

        {/* Taxi waiting banner — shown when no live GPS yet */}
        {isTaxi && !isLive && (
          <FadeInView index={2}>
            <View style={styles.taxiWaitBanner}>
              <Ionicons name="car-sport-outline" size={16} color={TAXI_AMBER} />
              <Text style={styles.taxiWaitText}>
                Waiting for driver to accept · Live tracking starts when driver
                is en route
              </Text>
            </View>
          </FadeInView>
        )}

        {/* Seat Availability — bus only */}
        {!isTaxi &&
          (() => {
            const pct = Math.round(
              (seatInfo.occupied / seatInfo.capacity) * 100
            );
            const seatColor =
              pct > 90 ? "#EF4444" : pct > 70 ? "#F59E0B" : "#10B981";
            const seatLabel =
              seatInfo.available === 0
                ? "Full"
                : pct > 90
                ? "Almost full"
                : pct > 70
                ? "Getting busy"
                : "Seats available";
            return (
              <FadeInView index={3}>
                <View style={styles.seatSection}>
                  <View style={styles.seatHeader}>
                    <Ionicons name="people-outline" size={14} color="#64748B" />
                    <Text style={styles.seatTitle}>{t('Seat Availability')}</Text>
                    <Bump trigger={seatInfo.available}>
                      <Text style={[styles.seatCount, { color: seatColor }]}>
                        {seatInfo.available === 0
                          ? t("Full")
                          : `${seatInfo.available} ${t("free")}`}
                      </Text>
                    </Bump>
                  </View>
                  <SeatBar pct={pct} color={seatColor} />
                  <View style={styles.seatFooter}>
                    <Text style={styles.seatSubtext}>
                      {seatInfo.occupied}/{seatInfo.capacity} seats occupied
                    </Text>
                    <Text style={[styles.seatStatus, { color: seatColor }]}>
                      {seatLabel}
                    </Text>
                  </View>
                </View>
              </FadeInView>
            );
          })()}

        {/* Upcoming stops — bus only */}
        {!isTaxi && stopsList.length > 0 && (
          <FadeInView index={4}>
            <View style={styles.stopsSection}>
              <View style={styles.stopsHeaderRow}>
                <Text style={styles.stopsSectionTitle}>{t('Upcoming Stops')}</Text>
                {etaLoading && (
                  <Spin>
                    <Ionicons name="sync" size={12} color={PURPLE.primary} />
                  </Spin>
                )}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.stopsScroll}
              >
                {stopsList.slice(0, 5).map((stop, i) => (
                  <FadeInView key={`chip-${stop.stop_id ?? i}`} index={i}>
                    <View style={styles.stopChip}>
                      <View
                        style={[
                          styles.stopChipDot,
                          i === 0 && styles.stopChipDotNext,
                        ]}
                      />
                      <Text
                        style={[
                          styles.stopChipName,
                          i === 0 && styles.stopChipNameNext,
                        ]}
                        numberOfLines={1}
                      >
                        {stop.stop_name}
                      </Text>
                      <Text
                        style={[
                          styles.stopChipEta,
                          i === 0 && { color: PURPLE.primary },
                        ]}
                      >
                        {stop.eta_min < 1
                          ? t("Now")
                          : `${Math.round(stop.eta_min)}${t("min")}`}
                      </Text>
                      {stop.eta_time !== "—" && (
                        <Text style={styles.stopChipTime}>{stop.eta_time}</Text>
                      )}
                    </View>
                  </FadeInView>
                ))}
              </ScrollView>
            </View>
          </FadeInView>
        )}

        {/* Vehicle Photo */}
        {vehiclePhoto && (
          <FadeInView index={5}>
            <View style={styles.vehiclePhotoWrap}>
              <Image
                source={{ uri: vehiclePhoto }}
                style={styles.vehiclePhoto}
                resizeMode="cover"
              />
            </View>
          </FadeInView>
        )}

        {/* Driver Card */}
        {driverInfo && (
          <FadeInView index={vehiclePhoto ? 6 : 5}>
            <View style={[styles.driverCard, isTaxi && styles.taxiDriverCard]}>
              <View
                style={[styles.driverAvatar, isTaxi && styles.taxiDriverAvatar]}
              >
                <Text
                  style={[
                    styles.driverAvatarText,
                    isTaxi && styles.taxiDriverAvatarText,
                  ]}
                >
                  {driverInfo.initials}
                </Text>
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{driverInfo.name}</Text>
                {/* Vehicle info row with color swatch for taxi */}
                <View style={styles.driverVehicleRow}>
                  {driverInfo.color ? (
                    <View
                      style={[
                        styles.vehicleColorSwatch,
                        { backgroundColor: driverInfo.color },
                      ]}
                    />
                  ) : null}
                  <Text style={styles.driverVehicle}>{driverInfo.vehicle}</Text>
                </View>
                {driverInfo.plate ? (
                  <Text style={styles.driverPlate}>{driverInfo.plate}</Text>
                ) : null}
                <View style={styles.driverRatingRow}>
                  {driverInfo.rating ? (
                    <>
                      <Ionicons name="star" size={13} color={COLORS.warning} />
                      <Text style={styles.driverRating}>
                        {driverInfo.rating}
                      </Text>
                    </>
                  ) : null}
                  {driverInfo.trips != null ? (
                    <Text style={styles.driverTrips}>
                      · {driverInfo.trips} trips
                    </Text>
                  ) : null}
                </View>
              </View>
              <PressableScale
                style={[styles.callBtn, isTaxi && styles.taxiCallBtn]}
                scaleTo={0.88}
                onPress={() => {
                  if (!driverInfo.phone) {
                    Alert.alert(
                      "Unavailable",
                      "No contact number on file for this driver."
                    );
                    return;
                  }
                  Linking.openURL(`tel:${driverInfo.phone}`);
                }}
              >
                <Ionicons name="call" size={18} color={COLORS.white} />
              </PressableScale>
            </View>
          </FadeInView>
        )}

        <FadeInView index={vehiclePhoto ? 7 : 6}>
          <PressableScale style={styles.emergencyBtn} scaleTo={0.97}>
            <Ionicons name="warning-outline" size={18} color={COLORS.danger} />
            <Text style={styles.emergencyText}>{t('Report an Issue')}</Text>
          </PressableScale>
        </FadeInView>
        </ScrollView>
      </Animated.View>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  busMarkerWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 52,
    height: 52,
  },
  busPulse: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  busMarker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: PURPLE.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowColor: PURPLE.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  taxiMarker: { backgroundColor: TAXI_AMBER, shadowColor: TAXI_AMBER },
  stopMarker: { alignItems: "center", justifyContent: "center" },
  stopDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.border,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  stopDotNext: { backgroundColor: PURPLE.primary, borderColor: PURPLE.dark },

  topBar: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  topBarTitle: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  topBarName: { fontSize: 15, fontWeight: "800", color: COLORS.textPrimary },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "500" },

  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "70%",
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    shadowColor: PURPLE.deep,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 16,
  },
  panelHandleArea: {
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 10,
  },
  panelHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: 8,
  },

  scrollContent: { paddingBottom: 28 },

  /* ETA card */
  etaCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  etaCol: { flex: 1, alignItems: "center", gap: 5 },
  etaIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  etaValue: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary },
  etaLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "500",
    textAlign: "center",
  },
  etaDivider: {
    width: 1,
    height: 44,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },

  /* Traffic strip */
  trafficStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
  },
  trafficDot: { width: 7, height: 7, borderRadius: 4 },
  trafficStripText: { flex: 1, fontSize: 11, fontWeight: "700" },

  etaErrorStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
  },
  etaErrorText: { flex: 1, fontSize: 11, color: COLORS.textMuted, fontWeight: "500" },

  /* Approaching banner */
  approachingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: PURPLE.primary,
    borderRadius: 12,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    shadowColor: PURPLE.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  approachingText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.white,
  },

  /* Seats */
  seatSection: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  seatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  seatTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    flex: 1,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  seatCount: { fontSize: 13, fontWeight: "800" },
  seatBarBg: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  seatBarFill: { height: "100%", borderRadius: 4 },
  seatFooter: { flexDirection: "row", justifyContent: "space-between" },
  seatSubtext: { fontSize: 10, color: COLORS.textMuted },
  seatStatus: { fontSize: 10, fontWeight: "700" },

  /* Stop chips */
  stopsSection: { marginBottom: 14 },
  stopsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  stopsSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  stopsScroll: { flexGrow: 0 },
  stopChip: { alignItems: "center", marginRight: 14, width: 70 },
  stopChipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.border,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: 4,
  },
  stopChipDotNext: {
    backgroundColor: PURPLE.primary,
    borderColor: PURPLE.primary,
  },
  stopChipName: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 2,
  },
  stopChipNameNext: { color: PURPLE.primary },
  stopChipEta: { fontSize: 13, fontWeight: "800", color: COLORS.textPrimary },
  stopChipTime: { fontSize: 10, color: COLORS.textMuted, fontWeight: "500" },

  /* Driver */
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  taxiDriverCard: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: PURPLE.light,
    alignItems: "center",
    justifyContent: "center",
  },
  taxiDriverAvatar: { backgroundColor: "#FEF3C7" },
  driverAvatarText: { fontSize: 16, fontWeight: "800", color: PURPLE.primary },
  taxiDriverAvatarText: { color: TAXI_AMBER },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 15, fontWeight: "800", color: COLORS.textPrimary },
  driverVehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  vehicleColorSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
  },
  driverVehicle: { fontSize: 12, color: COLORS.textMuted, fontWeight: "500" },
  driverPlate: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.textPrimary,
    letterSpacing: 1,
    marginTop: 2,
    backgroundColor: COLORS.white,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignSelf: "flex-start",
  },
  driverRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  driverRating: { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary },
  driverTrips: { fontSize: 12, color: COLORS.textMuted, fontWeight: "500" },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: COLORS.secondary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  taxiCallBtn: { backgroundColor: TAXI_AMBER, shadowColor: TAXI_AMBER },

  /* Taxi waiting banner */
  taxiWaitBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  taxiWaitText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
    lineHeight: 17,
  },

  emergencyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.dangerLight,
    borderRadius: 14,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: COLORS.dangerMid,
  },
  emergencyText: { fontSize: 14, fontWeight: "700", color: COLORS.danger },

  vehiclePhotoWrap: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    height: 160,
  },
  vehiclePhoto: {
    width: "100%",
    height: "100%",
  },
});

export default BusTrackingScreen;
