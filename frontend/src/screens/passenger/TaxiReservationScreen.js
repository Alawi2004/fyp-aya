import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Modal,
  FlatList,
  StatusBar,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, PURPLE } from "../../constants/colors";
import * as Location from "expo-location";
import { useApp } from "../../context/AppContext";
import GradientFill from "../../components/common/GradientFill";
import FadeInView from "../../components/common/FadeInView";
import PressableScale from "../../components/common/PressableScale";
import apiClient, {
  getAvailableDrivers,
  createTaxiReservation,
  expandMapUrl as apiExpandMapUrl,
} from "../../api/apiClient";
import {
  getPickerResult,
  clearPickerResult,
} from "../../utils/locationPickerResult";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NOM = "https://nominatim.openstreetmap.org";
const nomHeaders = () => ({
  "User-Agent": "FYP-AYA Transit App (student project)",
  "Accept-Language": apiClient.defaults.headers.common?.['Accept-Language'] || 'en',
});

const animateLayout = () =>
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

// ── Extract lat/lng from any text (URL or HTML body) ─────────────────────────
const parseCoords = (text) => {
  // @lat,lng — standard share/place URL format (most common)
  let m = text.match(/@(-?(?:1[0-7]\d|\d{1,2})\.\d+),(-?(?:1[0-7]\d|\d{1,2})\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  // !3dlat!4dlng — directions / embed / data= field
  m = text.match(/!3d(-?(?:1[0-7]\d|\d{1,2})\.\d+)!4d(-?(?:1[0-7]\d|\d{1,2})\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  // "lat":X,"lng":Y or "latitude":X,"longitude":Y — JSON embedded in HTML
  m = text.match(/"lat(?:itude)?":(-?\d{1,3}\.\d+),"lng|lon(?:gitude)?":(-?\d{1,3}\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  // ?q=, ?center=, ?ll=, ?query= with numeric coords
  m = text.match(/[?&](?:q|center|ll|query)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return null;
};

// ── Fetch a Google Maps URL and extract coordinates ───────────────────────────
// Proxies through backend — server-side Node fetch bypasses Google bot detection
const extractCoordsFromUrl = async (url) => {
  // 1. Try parsing the raw URL directly (works for full google.com/maps links)
  const direct = parseCoords(url);
  if (direct) return direct;

  // 2. Ask backend to expand and extract — avoids React Native fetch being blocked
  try {
    const data = await apiExpandMapUrl(url);
    if (data?.lat != null && data?.lng != null)
      return { lat: data.lat, lng: data.lng };
  } catch {}
  return null;
};

// ── Nominatim address search (Lebanon only) ────────────────────────────────────
const searchNominatim = async (query) => {
  if (!query || query.trim().length < 3) return [];
  try {
    const url = `${NOM}/search?q=${encodeURIComponent(
      query.trim()
    )}&format=json&limit=6&addressdetails=1&countrycodes=lb`;
    const res = await fetch(url, { headers: nomHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((p) => ({
      label: p.display_name,
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lon),
    }));
  } catch {
    return [];
  }
};

// ── Nominatim reverse geocode ──────────────────────────────────────────────────
const reverseGeocode = async (lat, lng) => {
  try {
    const url = `${NOM}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const res = await fetch(url, { headers: nomHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.display_name ?? null;
  } catch {
    return null;
  }
};

/* ────────────────────────── animation helpers ──────────────────────────
   All native-driver, module-level so they never remount with re-renders. */

/** Springs in whenever `active` flips on — selection pop for chips and rows. */
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

/** Slow scale pulse — the confirm CTA when it's actionable. */
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

/** Pulsing opacity — driver availability dots. */
const Blink = ({ style }) => {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[style, { opacity }]} />;
};

/** Three pulsing dots — "working on it" indicator. */
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

// ── "Or choose another way" buttons shown inside search modal ─────────────────
const AltOptions = ({ onMap, onCoords }) => (
  <View style={altStyles.wrap}>
    <View style={altStyles.dividerRow}>
      <View style={altStyles.line} />
      <Text style={altStyles.orText}>or choose another way</Text>
      <View style={altStyles.line} />
    </View>
    <View style={altStyles.btnRow}>
      <PressableScale style={altStyles.btn} onPress={onMap} scaleTo={0.95}>
        <Ionicons name="map-outline" size={18} color={PURPLE.primary} />
        <Text style={altStyles.btnText}>Pick on Map</Text>
      </PressableScale>
      <PressableScale style={altStyles.btn} onPress={onCoords} scaleTo={0.95}>
        <Ionicons name="locate-outline" size={18} color="#EA4335" />
        <Text style={altStyles.btnText}>Google Maps Link</Text>
      </PressableScale>
    </View>
  </View>
);

const altStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  line: { flex: 1, height: 1, backgroundColor: COLORS.border },
  orText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  btnRow: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  btnText: { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary },
});

// ── Drum Wheel Picker ──────────────────────────────────────────────────────────

const ITEM_H = 52;
const VISIBLE = 5; // must be odd
const PAD = Math.floor(VISIBLE / 2); // 2

const WheelColumn = ({ data, selected, onChange, width = 80 }) => {
  const ref = useRef(null);
  const idx = data.indexOf(selected);
  // Pad top and bottom so first/last items can reach center
  const allData = [...Array(PAD).fill(null), ...data, ...Array(PAD).fill(null)];

  // Scroll to the selected item on mount
  useEffect(() => {
    const offset = Math.max(0, idx) * ITEM_H;
    // Small delay so the FlatList has rendered
    setTimeout(
      () => ref.current?.scrollToOffset({ offset, animated: false }),
      50
    );
  }, []);

  const handleScrollEnd = useCallback(
    (e) => {
      const rawIdx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
      const clamped = Math.max(0, Math.min(rawIdx, data.length - 1));
      if (data[clamped] !== selected) {
        onChange(data[clamped]);
      }
      // Snap cleanly
      ref.current?.scrollToOffset({ offset: clamped * ITEM_H, animated: true });
    },
    [data, selected, onChange]
  );

  return (
    <View style={{ width, height: ITEM_H * VISIBLE, overflow: "hidden" }}>
      {/* Selection highlight band */}
      <View
        style={[styles.wheelHighlight, { top: ITEM_H * PAD }]}
        pointerEvents="none"
      />
      <FlatList
        ref={ref}
        data={allData}
        keyExtractor={(_, i) => String(i)}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, i) => ({
          length: ITEM_H,
          offset: ITEM_H * i,
          index: i,
        })}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        renderItem={({ item, index }) => {
          const dataIdx = index - PAD;
          const isSelected =
            item !== null && dataIdx >= 0 && data[dataIdx] === selected;
          return (
            <View style={styles.wheelItem}>
              {item !== null ? (
                <Text
                  style={[
                    styles.wheelText,
                    isSelected && styles.wheelTextSelected,
                  ]}
                >
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

const HOURS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, " ")
);
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0")
);

const TimePickerModal = ({
  visible,
  hour,
  minute,
  ampm,
  onHour,
  onMinute,
  onAmpm,
  onDone,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.timeOverlay}>
        <View style={[styles.timeSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.timeHeader}>
            <PressableScale
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.timeCancelText}>Cancel</Text>
            </PressableScale>
            <Text style={styles.timeTitle}>Select Time</Text>
            <PressableScale
              onPress={onDone}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.timeDoneText}>Done</Text>
            </PressableScale>
          </View>

          <View style={styles.wheelRow}>
            {/* Hours */}
            <WheelColumn
              data={HOURS}
              selected={hour}
              onChange={onHour}
              width={70}
            />
            {/* Colon */}
            <Text style={styles.wheelColon}>:</Text>
            {/* Minutes */}
            <WheelColumn
              data={MINUTES}
              selected={minute}
              onChange={onMinute}
              width={70}
            />
            {/* AM / PM */}
            <View style={styles.ampmCol}>
              {["AM", "PM"].map((v) => (
                <PopIn key={v} active={ampm === v}>
                  <PressableScale
                    style={[styles.ampmBtn, ampm === v && styles.ampmBtnActive]}
                    onPress={() => onAmpm(v)}
                    scaleTo={0.92}
                  >
                    <Text
                      style={[
                        styles.ampmText,
                        ampm === v && styles.ampmTextActive,
                      ]}
                    >
                      {v}
                    </Text>
                  </PressableScale>
                </PopIn>
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
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const today = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      key: d.toISOString().slice(0, 10),
      day: labels[d.getDay()],
      date: d.getDate(),
      month: months[d.getMonth()],
      short: i === 0 ? "Today" : i === 1 ? "Tomorrow" : null,
    };
  });
}

const DAYS = buildDays();

const RECURRENCE = [
  { key: "once", label: "One Time", icon: "checkmark-circle-outline" },
  { key: "daily", label: "Daily", icon: "repeat-outline" },
  { key: "weekdays", label: "Weekdays", icon: "calendar-outline" },
  { key: "weekly", label: "Weekly", icon: "sync-outline" },
];

const VEHICLE_TYPES = [
  {
    key: "sedan",
    label: "Sedan",
    icon: "car-outline",
    base: 5.0,
    perKm: 1.5,
    seats: 4,
    color: "#7C3AED",
  },
  {
    key: "suv",
    label: "SUV",
    icon: "car-sport-outline",
    base: 8.0,
    perKm: 2.0,
    seats: 6,
    color: "#7C3AED",
  },
  {
    key: "van",
    label: "Van / XL",
    icon: "bus-outline",
    base: 12.0,
    perKm: 2.5,
    seats: 8,
    color: "#EA580C",
  },
  {
    key: "tuktuk",
    label: "Tuk-Tuk",
    icon: "bicycle-outline",
    base: 3.0,
    perKm: 1.0,
    seats: 3,
    color: "#16A34A",
  },
];

// ── Main Screen ────────────────────────────────────────────────────────────────

const TaxiReservationScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { refreshBookings, updateBalance, walletBalance, currency, fmtMoney } = useApp();
  const { fromStop, toStop, tripSummary } = route?.params ?? {};

  const [pickup, setPickup] = useState(fromStop?.stop_name ?? "");
  const [dest, setDest] = useState(toStop?.stop_name ?? "");
  const [pickupLatLng, setPickupLatLng] = useState(null);
  const [destLatLng, setDestLatLng] = useState(null);
  // Intermediate stops: [{address: string, latLng: {latitude, longitude} | null}]
  const [stops, setStops] = useState([]);
  const [bookNow, setBookNow] = useState(true);
  const [selDay, setSelDay] = useState(DAYS[0].key);
  const [hour, setHour] = useState("08");
  const [minute, setMinute] = useState("00");
  const [ampm, setAmpm] = useState("AM");
  const [recurr, setRecurr] = useState("once");
  const [notes, setNotes] = useState("");
  const [timeMod, setTimeMod] = useState(false);
  const [vehicleType, setVehicleType] = useState("sedan");
  const [drivers, setDrivers] = useState(null);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driverVehiclePhotos, setDriverVehiclePhotos] = useState({});
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const fetchTimerRef = useRef(null);

  const heroAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(heroAnim, {
      toValue: 1,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [heroAnim]);

  // ── Address search modal state ─────────────────────────────────────────────
  const [searchModal, setSearchModal] = useState(false); // modal open
  const [searchField, setSearchField] = useState(null); // 'pickup' | 'dest' | 'stop_N'
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Helper — apply a resolved address+latLng to whichever field is active
  const applyFieldValue = (field, label, latLng) => {
    if (field === "pickup") {
      setPickup(label);
      setPickupLatLng(latLng);
    } else if (field === "dest") {
      setDest(label);
      setDestLatLng(latLng);
    } else if (field?.startsWith("stop_")) {
      const idx = parseInt(field.slice(5), 10);
      setStops((prev) =>
        prev.map((s, i) => (i === idx ? { address: label, latLng } : s))
      );
    }
  };

  const addStop = () => {
    animateLayout();
    setStops((prev) => [...prev, { address: "", latLng: null }]);
  };
  const removeStop = (idx) => {
    animateLayout();
    setStops((prev) => prev.filter((_, i) => i !== idx));
  };

  const openSearch = (field) => {
    setSearchField(field);
    let currentVal = "";
    if (field === "pickup") currentVal = pickup;
    else if (field === "dest") currentVal = dest;
    else if (field?.startsWith("stop_"))
      currentVal = stops[parseInt(field.slice(5), 10)]?.address ?? "";
    setSearchQuery(currentVal);
    setSuggestions([]);
    setSearchModal(true);
    setTimeout(() => searchInputRef.current?.focus(), 120);
  };

  const closeSearch = () => {
    setSearchModal(false);
    setSearchQuery("");
    setSuggestions([]);
    setPastingLink(false);
    setMapsLink("");
    clearTimeout(searchTimerRef.current);
  };

  const onSearchChange = (text) => {
    setSearchQuery(text);
    clearTimeout(searchTimerRef.current);
    if (text.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchNominatim(text);
      setSuggestions(results);
      setSearchLoading(false);
    }, 500);
  };

  const selectSuggestion = (item) => {
    animateLayout();
    applyFieldValue(searchField, item.label, {
      latitude: item.lat,
      longitude: item.lng,
    });
    closeSearch();
  };

  // ── "Pick on Map" ─────────────────────────────────────────────────────────
  const handleOpenMap = () => {
    const field = searchField;
    closeSearch();
    const title =
      field === "pickup"
        ? "Set Pickup Location"
        : field === "dest"
        ? "Set Destination"
        : `Set Stop ${parseInt(field?.slice(5) ?? "0", 10) + 1}`;
    setTimeout(() => {
      navigation.navigate("MapLocationPicker", { field, title });
    }, 300);
  };

  // Receive result back from MapLocationPickerScreen
  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      const r = getPickerResult();
      if (!r) return;
      animateLayout();
      applyFieldValue(r.field, r.address, r.latLng ?? null);
      clearPickerResult();
    });
    return unsub;
  }, [navigation, stops]); // stops in deps so applyFieldValue closure is fresh

  // ── "Google Maps link or Coordinates" ────────────────────────────────────
  const [pastingLink, setPastingLink] = useState(false);
  const [mapsLink, setMapsLink] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);

  const handlePasteLink = async () => {
    const raw = mapsLink.trim();
    if (!raw) return;
    setLinkLoading(true);
    try {
      const coords = await extractCoordsFromUrl(raw);
      if (!coords) {
        Alert.alert(
          "Could not read link",
          'Could not extract coordinates from this link.\n\nMake sure you copied the "Share" link from Google Maps. You can also use "Pick on Map".'
        );
        return;
      }
      const { lat, lng } = coords;

      const latLng = { latitude: lat, longitude: lng };
      const address = await reverseGeocode(lat, lng);
      const label = address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      applyFieldValue(searchField, label, latLng);
      setMapsLink("");
      setPastingLink(false);
      closeSearch();
    } finally {
      setLinkLoading(false);
    }
  };

  const openPasteLink = () => {
    animateLayout();
    setMapsLink("");
    setPastingLink(true);
  };

  // ── GPS "Use My Location" ──────────────────────────────────────────────────
  const [gpsLoading, setGpsLoading] = useState(false);

  const useMyLocation = async (field = "pickup") => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission denied",
          "Location access is required to use this feature. Please enable it in your device settings."
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = loc.coords;
      const address = await reverseGeocode(latitude, longitude);
      animateLayout();
      applyFieldValue(
        field,
        address ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        { latitude, longitude }
      );
    } catch {
      Alert.alert(
        "Error",
        "Could not get your location. Make sure GPS is enabled."
      );
    } finally {
      setGpsLoading(false);
    }
  };

  // Build the ISO datetime string for scheduled mode
  const getScheduledDatetime = useCallback(() => {
    const selDayObj = DAYS.find((d) => d.key === selDay);
    if (!selDayObj) return null;
    let h = parseInt(hour.trim(), 10);
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${selDay}T${String(h).padStart(2, "0")}:${minute}:00`;
  }, [selDay, hour, minute, ampm]);

  const fetchDrivers = useCallback(async () => {
    setDriversLoading(true);
    try {
      const mode = bookNow ? "now" : "scheduled";
      const datetime = bookNow ? undefined : getScheduledDatetime();
      const res = await getAvailableDrivers(mode, datetime);
      const list = res.drivers || [];
      animateLayout();
      setDrivers(list);
      // Clear selection if chosen driver is no longer in the list
      if (
        selectedDriverId &&
        !list.find((d) => d.driver_id === selectedDriverId)
      ) {
        setSelectedDriverId(null);
      }
      // Fetch vehicle exterior photos for each driver that has a vehicle
      const photoMap = {};
      await Promise.all(
        list
          .filter((d) => d.vehicle_id)
          .map(async (d) => {
            try {
              const pr = await apiClient.get(`/vehicles/${d.vehicle_id}/photos`);
              const photos = Array.isArray(pr.data) ? pr.data : [];
              const pick = photos.find((p) => p.slot === 'exterior') ?? photos[0];
              if (pick?.url) photoMap[d.driver_id] = pick.url;
            } catch {}
          })
      );
      setDriverVehiclePhotos(photoMap);
    } catch {
      setDrivers([]);
    } finally {
      setDriversLoading(false);
    }
  }, [bookNow, getScheduledDatetime, selectedDriverId]);

  // Re-fetch when mode or scheduled time changes (debounced 600 ms for schedule changes)
  useEffect(() => {
    clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(fetchDrivers, bookNow ? 0 : 600);
    return () => clearTimeout(fetchTimerRef.current);
  }, [bookNow, selDay, hour, minute, ampm]); // eslint-disable-line

  const toggleBookNow = (value) => {
    animateLayout();
    setBookNow(value);
  };

  const timeLabel = `${hour.trim()}:${minute} ${ampm}`;
  const canConfirm =
    pickup.trim() && dest.trim() && (bookNow || minute !== null);

  const selVehicle =
    VEHICLE_TYPES.find((v) => v.key === vehicleType) ?? VEHICLE_TYPES[0];

  // Haversine distance in km between two lat/lng points
  const haversineKm = (a, b) => {
    if (!a || !b) return null;
    const R = 6371;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.latitude * Math.PI) / 180) *
        Math.cos((b.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  };
  // Sum haversine distance through all waypoints: pickup → stop1 → ... → dest
  const distanceKm = (() => {
    const pts = [pickupLatLng, ...stops.map((s) => s.latLng), destLatLng];
    if (!pts[0] || !pts[pts.length - 1]) return null;
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = haversineKm(pts[i - 1], pts[i]);
      if (d == null) return null;
      total += d;
    }
    return total;
  })();
  const estimatedFare =
    distanceKm != null ? selVehicle.base + selVehicle.perKm * distanceKm : null;

  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!canConfirm) {
      Alert.alert(
        "Missing info",
        "Please fill in pickup and destination" +
          (!bookNow ? ", and select a time" : "") +
          "."
      );
      return;
    }
    const selDayObjNow = DAYS.find((d) => d.key === selDay);
    const when = bookNow
      ? "Now"
      : `${selDayObjNow?.short ?? selDayObjNow?.day} ${selDayObjNow?.date} ${
          selDayObjNow?.month
        } at ${hour.trim()}:${minute} ${ampm}`;
    const selDriver =
      drivers?.find((d) => d.driver_id === selectedDriverId) ?? null;
    const fare = estimatedFare ?? selVehicle.base;

    setConfirming(true);
    try {
      const data = await createTaxiReservation({
        vehicle_type: selVehicle.key,
        pickup_address: pickup,
        pickup_lat: pickupLatLng?.latitude ?? null,
        pickup_lng: pickupLatLng?.longitude ?? null,
        dest_address: dest,
        dest_lat: destLatLng?.latitude ?? null,
        dest_lng: destLatLng?.longitude ?? null,
        distance_km: distanceKm ?? null,
        estimated_fare: fare,
        driver_id: selectedDriverId ?? null,
        driver_name: selDriver?.name ?? null,
        scheduled_for: when,
        recurrence: recurr,
        notes: notes || null,
        stops: stops
          .filter((s) => s.address.trim())
          .map((s) => ({
            address: s.address,
            lat: s.latLng?.latitude ?? null,
            lng: s.latLng?.longitude ?? null,
          })),
      });

      // Update wallet balance in context from the server's authoritative value
      if (typeof data.newBalance === "number") {
        updateBalance(data.newBalance);
      }

      // Build the booking object for the Ticket screen from the server response
      const resData = data.reservation ?? {};
      const newBooking = {
        _id: `taxi_${resData.reservation_id}`,
        type: "taxi",
        bus: {
          name: `${selVehicle.label} Taxi`,
          origin: pickup,
          destination: dest,
        },
        seatId: null,
        seats: [],
        vehicleType: selVehicle.key,
        vehicleLabel: selVehicle.label,
        price: fare,
        distanceKm,
        perKm: selVehicle.perKm,
        driverRequest: selectedDriverId,
        driverName: selDriver?.name ?? null,
        driverRating: selDriver?.avg_rating ?? null,
        vehiclePlate: selDriver?.plate_number ?? null,
        vehicleColor: selDriver?.color ?? null,
        vehicleModel: selDriver?.model ?? null,
        date: new Date().toISOString(),
        status: "upcoming",
        scheduledFor: when,
        recurrence: recurr,
        notes,
      };
      // Refresh from DB so TripHistory is up to date immediately after booking
      await refreshBookings();
      navigation.replace("Ticket", { booking: newBooking });
    } catch (err) {
      console.error("[handleConfirm taxi]", err);
      const serverMsg = err?.response?.data?.error;
      // Surface specific backend errors (insufficient balance, frozen wallet) clearly
      if (err?.response?.status === 402 || err?.response?.status === 403) {
        Alert.alert("Booking Failed", serverMsg);
      } else if (err?.response?.status === 400) {
        Alert.alert(
          "Booking Failed",
          serverMsg ?? "Could not save your reservation."
        );
      } else {
        Alert.alert(
          "Error",
          "Could not save your reservation. Please try again."
        );
      }
    } finally {
      setConfirming(false);
    }
  };

  const confirmDisabled = !canConfirm || confirming;
  const confirmButton = (
    <PressableScale
      style={[styles.confirmBtn, confirmDisabled && styles.confirmBtnDisabled]}
      onPress={() => {
        if (!confirmDisabled) handleConfirm();
      }}
      scaleTo={0.97}
    >
      {!confirmDisabled && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill
            id="confirmTaxi"
            colors={["#6D28D9", "#8B5CF6"]}
            vertical={false}
          />
        </View>
      )}
      {confirming ? (
        <ActivityIndicator size="small" color={COLORS.white} />
      ) : (
        <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
      )}
      <Text style={styles.confirmBtnText}>
        {confirming
          ? "Saving…"
          : bookNow
          ? "Confirm Booking"
          : "Confirm Reservation"}
      </Text>
    </PressableScale>
  );

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

  // ── Booking form ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* ── Purple hero header ── */}
      <View style={styles.hero}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill id="taxiHero" colors={PURPLE.gradient} vertical />
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />
        </View>
        <Animated.View
          style={[
            styles.heroRow,
            { paddingTop: insets.top + 10 },
            heroEntrance,
          ]}
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
            <Text style={styles.heroTitle}>Reserve a Taxi</Text>
            <Text style={styles.heroSub}>Door to door, on your schedule</Text>
          </View>
          <View style={styles.heroChip}>
            <Ionicons name="car-sport" size={14} color={COLORS.white} />
          </View>
        </Animated.View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Trip summary badge from TripPlanner */}
        {tripSummary ? (
          <FadeInView index={0}>
            <View style={styles.tripBadge}>
              <Ionicons
                name="git-branch-outline"
                size={14}
                color={PURPLE.primary}
              />
              <Text style={styles.tripBadgeText}>
                Planned trip · {tripSummary}
              </Text>
            </View>
          </FadeInView>
        ) : null}

        {/* ── Location Card ── */}
        <FadeInView index={1}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Where are you going?</Text>

            {/* Pickup */}
            <PressableScale
              style={styles.locRow}
              onPress={() => openSearch("pickup")}
              scaleTo={0.98}
            >
              <View
                style={[styles.locDot, { backgroundColor: COLORS.secondary }]}
              />
              <View style={styles.locTextWrap}>
                <Text style={styles.locLabel}>PICKUP</Text>
                <Bump trigger={pickup}>
                  <Text
                    style={[styles.locValue, !pickup && styles.locPlaceholder]}
                    numberOfLines={1}
                  >
                    {pickup || "Search pickup location…"}
                  </Text>
                </Bump>
              </View>
              <View style={styles.searchBtn}>
                <Ionicons
                  name="search-outline"
                  size={16}
                  color={PURPLE.primary}
                />
              </View>
            </PressableScale>

            {/* Use My Location button */}
            <PressableScale
              style={styles.gpsBtn}
              onPress={() => {
                if (!gpsLoading) useMyLocation("pickup");
              }}
              scaleTo={0.95}
            >
              {gpsLoading ? (
                <ActivityIndicator size="small" color={COLORS.secondary} />
              ) : (
                <Ionicons name="navigate" size={15} color={COLORS.secondary} />
              )}
              <Text style={styles.gpsBtnText}>
                {gpsLoading ? "Getting location…" : "Use my current location"}
              </Text>
            </PressableScale>

            <View style={styles.locDivider} />

            {/* Destination */}
            <PressableScale
              style={styles.locRow}
              onPress={() => openSearch("dest")}
              scaleTo={0.98}
            >
              <View
                style={[styles.locDot, { backgroundColor: COLORS.danger }]}
              />
              <View style={styles.locTextWrap}>
                <Text style={styles.locLabel}>DESTINATION</Text>
                <Bump trigger={dest}>
                  <Text
                    style={[styles.locValue, !dest && styles.locPlaceholder]}
                    numberOfLines={1}
                  >
                    {dest || "Search destination…"}
                  </Text>
                </Bump>
              </View>
              <View style={styles.searchBtn}>
                <Ionicons
                  name="search-outline"
                  size={16}
                  color={PURPLE.primary}
                />
              </View>
            </PressableScale>
          </View>
        </FadeInView>

        {/* ── Intermediate Stops ── */}
        {stops.map((stop, i) => (
          <PopIn key={`stop-card-${i}`} active>
            <View style={styles.stopCard}>
              <View style={styles.stopCardLeft}>
                <View style={styles.stopNumberBadge}>
                  <Text style={styles.stopNumberText}>{i + 1}</Text>
                </View>
                <View style={styles.stopCardLine} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stopCardLabel}>Stop {i + 1}</Text>
                <PressableScale
                  style={styles.stopCardField}
                  onPress={() => openSearch(`stop_${i}`)}
                  scaleTo={0.98}
                >
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color="#F59E0B"
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.stopCardValue,
                      !stop.address && styles.locPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {stop.address || "Search stop location…"}
                  </Text>
                  <View style={styles.searchBtn}>
                    <Ionicons
                      name="search-outline"
                      size={15}
                      color={PURPLE.primary}
                    />
                  </View>
                </PressableScale>
              </View>
              <PressableScale
                onPress={() => removeStop(i)}
                style={styles.removeStopBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={22} color={COLORS.danger} />
              </PressableScale>
            </View>
          </PopIn>
        ))}

        {/* ── Add Stop button ── */}
        {stops.length < 3 && (
          <FadeInView index={2}>
            <PressableScale
              style={styles.addStopBtn}
              onPress={addStop}
              scaleTo={0.97}
            >
              <View style={styles.addStopIconWrap}>
                <Ionicons name="add" size={18} color={PURPLE.primary} />
              </View>
              <View>
                <Text style={styles.addStopText}>Add a Stop</Text>
                <Text style={styles.addStopSub}>
                  Add a waypoint along your route
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={PURPLE.primary}
                style={{ marginLeft: "auto" }}
              />
            </PressableScale>
          </FadeInView>
        )}

        {/* ── Vehicle Type Card ── */}
        <FadeInView index={3}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Choose your ride</Text>
            {VEHICLE_TYPES.map((v) => {
              const active = vehicleType === v.key;
              return (
                <PopIn key={v.key} active={active}>
                  <PressableScale
                    style={[
                      styles.vehicleRow,
                      active && styles.vehicleRowActive,
                    ]}
                    onPress={() => setVehicleType(v.key)}
                    scaleTo={0.97}
                  >
                    <View
                      style={[
                        styles.vehicleIconWrap,
                        {
                          backgroundColor: active ? v.color : COLORS.background,
                        },
                      ]}
                    >
                      <Ionicons
                        name={v.icon}
                        size={20}
                        color={active ? "#fff" : v.color}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.vehicleLabel,
                          active && { color: v.color },
                        ]}
                      >
                        {v.label}
                      </Text>
                      <Text style={styles.vehicleSeats}>
                        Up to {v.seats} passengers
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={[
                          styles.vehiclePrice,
                          active && { color: v.color },
                        ]}
                      >
                        from {fmtMoney(v.base)}
                      </Text>
                      <Text style={styles.vehiclePerKm}>
                        {fmtMoney(v.perKm)}/km
                      </Text>
                    </View>
                    {active && (
                      <View
                        style={[
                          styles.vehicleCheck,
                          { backgroundColor: v.color },
                        ]}
                      >
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    )}
                  </PressableScale>
                </PopIn>
              );
            })}
          </View>
        </FadeInView>

        {/* ── Fare Estimate Card ── */}
        <FadeInView index={4}>
          {(() => {
            const fare = estimatedFare ?? selVehicle.base;
            const insufficient = walletBalance < fare;
            const fareText =
              estimatedFare != null
                ? fmtMoney(estimatedFare)
                : `${fmtMoney(selVehicle.base)} + ${fmtMoney(selVehicle.perKm)}/km`;
            return (
              <View
                style={[
                  styles.fareCard,
                  { borderColor: selVehicle.color + "40" },
                ]}
              >
                <View
                  style={[
                    styles.fareIconWrap,
                    { backgroundColor: selVehicle.color + "18" },
                  ]}
                >
                  <Ionicons
                    name="wallet-outline"
                    size={20}
                    color={selVehicle.color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fareLabel}>
                    {estimatedFare != null ? "Estimated Fare" : "Starting Fare"}
                  </Text>
                  <Bump trigger={fareText} style={{ alignSelf: "flex-start" }}>
                    <Text
                      style={[styles.fareValue, { color: selVehicle.color }]}
                    >
                      {fareText}
                    </Text>
                  </Bump>
                  {distanceKm != null && (
                    <Text style={styles.fareDistance}>
                      {distanceKm.toFixed(1)} km · {currency} {selVehicle.base.toFixed(2)}{" "}
                      base + {currency} {(selVehicle.perKm * distanceKm).toFixed(2)}
                    </Text>
                  )}
                  <View style={styles.fareBalanceRow}>
                    <Ionicons
                      name="card-outline"
                      size={11}
                      color={insufficient ? COLORS.danger : COLORS.textMuted}
                    />
                    <Text
                      style={[
                        styles.fareBalanceText,
                        insufficient && styles.fareBalanceInsufficient,
                      ]}
                    >
                      Wallet: {currency} {walletBalance.toFixed(2)}
                      {insufficient ? "  ⚠ Insufficient" : ""}
                    </Text>
                  </View>
                </View>
                <View style={styles.fareNote}>
                  <Text style={styles.fareNoteText}>
                    {distanceKm != null
                      ? "Deducted from wallet"
                      : "Select locations to calculate"}
                  </Text>
                </View>
              </View>
            );
          })()}
        </FadeInView>

        {/* ── When Card ── */}
        <FadeInView index={5}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>When?</Text>

            <View style={styles.whenTabs}>
              {[
                { now: true, icon: "flash", label: "Book Now" },
                { now: false, icon: "calendar", label: "Schedule" },
              ].map((t) => {
                const on = bookNow === t.now;
                return (
                  <PopIn key={t.label} active={on} style={{ flex: 1 }}>
                    <PressableScale
                      style={[styles.whenTab, on && styles.whenTabActive]}
                      onPress={() => toggleBookNow(t.now)}
                      scaleTo={0.94}
                    >
                      <Ionicons
                        name={t.icon}
                        size={15}
                        color={on ? COLORS.white : COLORS.textMuted}
                      />
                      <Text
                        style={[
                          styles.whenTabText,
                          on && styles.whenTabTextActive,
                        ]}
                      >
                        {t.label}
                      </Text>
                    </PressableScale>
                  </PopIn>
                );
              })}
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
                  {DAYS.map((d) => (
                    <PopIn key={d.key} active={selDay === d.key}>
                      <PressableScale
                        style={[
                          styles.dayChip,
                          selDay === d.key && styles.dayChipActive,
                        ]}
                        onPress={() => setSelDay(d.key)}
                        scaleTo={0.93}
                      >
                        <Text
                          style={[
                            styles.dayChipTop,
                            selDay === d.key && styles.dayChipActiveText,
                          ]}
                        >
                          {d.short ?? d.day}
                        </Text>
                        <Text
                          style={[
                            styles.dayChipBot,
                            selDay === d.key && styles.dayChipActiveText,
                          ]}
                        >
                          {d.date} {d.month}
                        </Text>
                      </PressableScale>
                    </PopIn>
                  ))}
                </ScrollView>

                {/* Time selector — drum picker */}
                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Time</Text>
                <PressableScale
                  style={styles.timeRow}
                  onPress={() => setTimeMod(true)}
                  scaleTo={0.98}
                >
                  <View style={styles.timeIconWrap}>
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color={PURPLE.primary}
                    />
                  </View>
                  <Bump trigger={timeLabel} style={{ flex: 1 }}>
                    <Text style={styles.timeValue}>{timeLabel}</Text>
                  </Bump>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={COLORS.textMuted}
                  />
                </PressableScale>

                {/* Repeat */}
                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                  Repeat
                </Text>
                <View style={styles.recurrRow}>
                  {RECURRENCE.map((r) => (
                    <PopIn key={r.key} active={recurr === r.key}>
                      <PressableScale
                        style={[
                          styles.recurrChip,
                          recurr === r.key && styles.recurrChipActive,
                        ]}
                        onPress={() => setRecurr(r.key)}
                        scaleTo={0.93}
                      >
                        <Ionicons
                          name={r.icon}
                          size={13}
                          color={
                            recurr === r.key ? PURPLE.primary : COLORS.textMuted
                          }
                        />
                        <Text
                          style={[
                            styles.recurrText,
                            recurr === r.key && styles.recurrTextActive,
                          ]}
                        >
                          {r.label}
                        </Text>
                      </PressableScale>
                    </PopIn>
                  ))}
                </View>
              </>
            )}
          </View>
        </FadeInView>

        {/* ── Driver Selection Card ── */}
        <FadeInView index={6}>
          <View style={styles.card}>
            <View style={styles.driverCardHeader}>
              <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
                Choose a driver
              </Text>
              {driversLoading && (
                <ActivityIndicator size="small" color={PURPLE.primary} />
              )}
            </View>

            {!driversLoading && drivers === null ? null : driversLoading &&
              drivers === null ? (
              <View style={styles.driverLoadingWrap}>
                <ActivityIndicator size="large" color={PURPLE.primary} />
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Text style={styles.driverLoadingText}>
                    Finding available drivers
                  </Text>
                  <Dots color={PURPLE.primary} />
                </View>
              </View>
            ) : drivers?.length === 0 ? (
              <View style={styles.driverEmpty}>
                <Ionicons
                  name="car-outline"
                  size={32}
                  color={COLORS.textMuted}
                />
                <Text style={styles.driverEmptyTitle}>
                  No drivers available
                </Text>
                <Text style={styles.driverEmptyHint}>
                  {bookNow
                    ? "All drivers are currently on a trip. Try scheduling for later."
                    : "No drivers are free at that time. Try a different slot."}
                </Text>
                <PressableScale
                  style={styles.driverRetryBtn}
                  onPress={fetchDrivers}
                  scaleTo={0.93}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={14}
                    color={PURPLE.primary}
                  />
                  <Text style={styles.driverRetryText}>Refresh</Text>
                </PressableScale>
              </View>
            ) : (
              <>
                {/* Any driver — default option */}
                <PopIn active={selectedDriverId === null}>
                  <PressableScale
                    style={[
                      styles.driverRow,
                      selectedDriverId === null && styles.driverRowSelected,
                    ]}
                    onPress={() => setSelectedDriverId(null)}
                    scaleTo={0.97}
                  >
                    <View style={[styles.driverAvatar, styles.driverAvatarAny]}>
                      <Ionicons
                        name="shuffle-outline"
                        size={18}
                        color={COLORS.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.driverName}>
                        Any available driver
                      </Text>
                      <Text style={styles.driverSub}>
                        We'll assign the nearest driver
                      </Text>
                    </View>
                    {selectedDriverId === null && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={PURPLE.primary}
                      />
                    )}
                  </PressableScale>
                </PopIn>

                {(drivers ?? []).map((d, di) => {
                  const initials = d.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  const isSelected = selectedDriverId === d.driver_id;
                  const driverDist =
                    pickupLatLng && d.current_lat != null
                      ? haversineKm(pickupLatLng, {
                          latitude: d.current_lat,
                          longitude: d.current_lng,
                        })
                      : null;
                  const driverEtaMin =
                    driverDist != null
                      ? Math.max(1, Math.round((driverDist / 30) * 60))
                      : null;
                  const vehiclePhoto = driverVehiclePhotos[d.driver_id] ?? null;
                  return (
                    <FadeInView key={d.driver_id} index={Math.min(di, 6)}>
                      <PopIn active={isSelected}>
                        <PressableScale
                          style={[
                            styles.driverRow,
                            isSelected && styles.driverRowSelected,
                          ]}
                          onPress={() => setSelectedDriverId(d.driver_id)}
                          scaleTo={0.97}
                        >
                          <View
                            style={[
                              styles.driverAvatar,
                              isSelected && styles.driverAvatarSelected,
                            ]}
                          >
                            {vehiclePhoto ? (
                              <Image
                                source={{ uri: vehiclePhoto }}
                                style={styles.driverVehiclePhoto}
                                resizeMode="cover"
                              />
                            ) : (
                              <Text
                                style={[
                                  styles.driverInitials,
                                  isSelected && { color: COLORS.white },
                                ]}
                              >
                                {initials}
                              </Text>
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.driverName}>{d.name}</Text>
                            <View style={styles.driverMeta}>
                              {d.avg_rating > 0 ? (
                                <>
                                  <Ionicons
                                    name="star"
                                    size={11}
                                    color="#D97706"
                                  />
                                  <Text style={styles.driverRating}>
                                    {Number(d.avg_rating).toFixed(1)}
                                  </Text>
                                  <Text style={styles.driverRatingCount}>
                                    ({d.total_ratings} trips)
                                  </Text>
                                </>
                              ) : (
                                <Text style={styles.driverRating}>
                                  New driver
                                </Text>
                              )}
                              {d.plate_number ? (
                                <>
                                  <Text style={styles.driverRatingCount}>
                                    {" "}
                                    ·{" "}
                                  </Text>
                                  {d.color ? (
                                    <View
                                      style={[
                                        styles.colorDot,
                                        { backgroundColor: d.color },
                                      ]}
                                    />
                                  ) : null}
                                  <Text style={styles.driverPlate}>
                                    {d.plate_number}
                                  </Text>
                                </>
                              ) : null}
                            </View>
                            {driverDist != null ? (
                              <View style={styles.driverDistRow}>
                                <Ionicons
                                  name="navigate"
                                  size={10}
                                  color={PURPLE.primary}
                                />
                                <Text style={styles.driverDistText}>
                                  {driverDist < 1
                                    ? `${Math.round(driverDist * 1000)} m away`
                                    : `${driverDist.toFixed(1)} km away`}
                                  {" · ~"}
                                  {driverEtaMin} min
                                </Text>
                              </View>
                            ) : pickupLatLng ? (
                              <View style={styles.driverDistRow}>
                                <Ionicons
                                  name="radio-outline"
                                  size={10}
                                  color={COLORS.textMuted}
                                />
                                <Text style={styles.driverDistTextMuted}>
                                  Location unavailable
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          {isSelected ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={20}
                              color={PURPLE.primary}
                            />
                          ) : (
                            <Blink style={styles.driverAvailDot} />
                          )}
                        </PressableScale>
                      </PopIn>
                    </FadeInView>
                  );
                })}
              </>
            )}
          </View>
        </FadeInView>

        {/* ── Notes Card ── */}
        <FadeInView index={7}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notes for driver</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. I have luggage, please wait at gate 2…"
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </FadeInView>

        {/* ── Confirm ── */}
        <FadeInView index={8}>
          {!confirmDisabled ? (
            <Breathe>{confirmButton}</Breathe>
          ) : (
            confirmButton
          )}
        </FadeInView>
      </ScrollView>

      {/* ── Address Search Modal ── */}
      <Modal
        visible={searchModal}
        animationType="slide"
        onRequestClose={closeSearch}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: COLORS.background }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[styles.searchModalHeader, { paddingTop: insets.top + 8 }]}
          >
            <PressableScale
              onPress={closeSearch}
              style={styles.searchBackBtn}
              scaleTo={0.88}
            >
              <Ionicons
                name="arrow-back"
                size={22}
                color={COLORS.textPrimary}
              />
            </PressableScale>
            <View style={styles.searchInputWrap}>
              <View
                style={[
                  styles.searchDotSmall,
                  {
                    backgroundColor:
                      searchField === "pickup"
                        ? COLORS.secondary
                        : searchField?.startsWith("stop_")
                        ? "#F59E0B"
                        : COLORS.danger,
                  },
                ]}
              />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={onSearchChange}
                placeholder={
                  searchField === "pickup"
                    ? "Search pickup location…"
                    : searchField?.startsWith("stop_")
                    ? "Search stop location…"
                    : "Search destination…"
                }
                placeholderTextColor={COLORS.textMuted}
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <PressableScale
                  onPress={() => onSearchChange("")}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={COLORS.textMuted}
                  />
                </PressableScale>
              )}
            </View>
          </View>

          {/* ── Results area (flex:1 so it doesn't push alt options off-screen) ── */}
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {searchLoading ? (
              <View style={styles.searchCenterWrap}>
                <ActivityIndicator size="large" color={PURPLE.primary} />
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Text style={styles.searchHint}>Searching</Text>
                  <Dots color={COLORS.textMuted} />
                </View>
              </View>
            ) : suggestions.length > 0 ? (
              suggestions.map((item, i) => (
                <FadeInView key={`${item.lat}-${item.lng}-${i}`} index={i}>
                  <PressableScale
                    style={styles.suggRow}
                    onPress={() => selectSuggestion(item)}
                    scaleTo={0.98}
                  >
                    <View style={styles.suggIconWrap}>
                      <Ionicons
                        name="location-outline"
                        size={18}
                        color={PURPLE.primary}
                      />
                    </View>
                    <Text style={styles.suggText} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </PressableScale>
                  {i < suggestions.length - 1 && (
                    <View style={styles.suggDivider} />
                  )}
                </FadeInView>
              ))
            ) : searchQuery.length >= 3 ? (
              <View style={styles.searchCenterWrap}>
                <Ionicons
                  name="search-outline"
                  size={36}
                  color={COLORS.textMuted}
                />
                <Text style={styles.searchHint}>
                  No results found for Lebanon
                </Text>
              </View>
            ) : (
              <View style={styles.searchCenterWrap}>
                <Ionicons
                  name="map-outline"
                  size={40}
                  color={COLORS.textMuted}
                />
                <Text style={styles.searchHint}>
                  Type at least 3 characters to search
                </Text>
              </View>
            )}
          </ScrollView>

          {/* ── Alt options — always anchored at the bottom, never overlapping ── */}
          {!pastingLink && (
            <AltOptions onMap={handleOpenMap} onCoords={openPasteLink} />
          )}

          {/* ── Enter coordinates panel — replaces alt options when active ── */}
          {pastingLink && (
            <View style={styles.pasteLinkPanel}>
              <View style={styles.pasteLinkHeader}>
                <Ionicons name="locate-outline" size={18} color="#EA4335" />
                <Text style={styles.pasteLinkTitle}>Google Maps Link</Text>
                <PressableScale
                  onPress={() => {
                    animateLayout();
                    setPastingLink(false);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color={COLORS.textMuted} />
                </PressableScale>
              </View>
              <Text style={styles.pasteLinkHint}>
                In Google Maps, tap a location → Share → Copy link, then paste
                below.
              </Text>
              <View style={styles.pasteLinkInputRow}>
                <TextInput
                  style={styles.pasteLinkInput}
                  value={mapsLink}
                  onChangeText={setMapsLink}
                  placeholder="https://maps.app.goo.gl/…"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handlePasteLink}
                />
              </View>
              <PressableScale
                style={[
                  styles.pasteLinkBtn,
                  (!mapsLink.trim() || linkLoading) && { opacity: 0.5 },
                ]}
                onPress={() => {
                  if (mapsLink.trim() && !linkLoading) handlePasteLink();
                }}
                scaleTo={0.96}
              >
                {linkLoading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={COLORS.white}
                  />
                )}
                <Text style={styles.pasteLinkBtnText}>
                  {linkLoading ? "Looking up location…" : "Use This Location"}
                </Text>
              </PressableScale>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

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

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Hero */
  hero: {
    backgroundColor: PURPLE.deep,
    overflow: "hidden",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  heroDecor1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -80,
    right: -50,
  },
  heroDecor2: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
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
  heroChip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48, gap: 14 },

  tripBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: PURPLE.light,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: PURPLE.midStrong,
  },
  tripBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: PURPLE.primary,
    flex: 1,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    shadowColor: PURPLE.deep,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 14,
  },

  // Location rows
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  locDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  locTextWrap: { flex: 1 },
  locLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locValue: { fontSize: 15, fontWeight: "600", color: COLORS.textPrimary },
  locPlaceholder: { color: COLORS.textMuted, fontWeight: "400" },
  searchBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: PURPLE.light,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Search modal ──────────────────────────────────────────────────────────
  searchModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  searchBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PURPLE.midStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchDotSmall: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: "500",
    padding: 0,
  },
  searchCenterWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 60,
  },
  searchHint: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  suggRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
  },
  suggIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: PURPLE.light,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  suggText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: "500",
    lineHeight: 20,
  },
  suggDivider: { height: 1, backgroundColor: COLORS.border, marginLeft: 64 },

  // ── Paste Google Maps link panel ───────────────────────────────────────────
  pasteLinkPanel: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 16,
  },
  pasteLinkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  pasteLinkTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  pasteLinkHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "500",
    lineHeight: 17,
    marginBottom: 12,
  },
  pasteLinkInputRow: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  pasteLinkInput: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: "500",
    minHeight: 42,
  },
  pasteLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PURPLE.primary,
    borderRadius: 14,
    paddingVertical: 13,
  },
  pasteLinkBtnText: { fontSize: 14, fontWeight: "800", color: COLORS.white },
  locDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
    marginLeft: 24,
  },
  removeStopBtn: { paddingLeft: 8, paddingVertical: 4 },

  // Stop card (between location card and vehicle card) — amber = waypoint identity
  stopCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#FEF3C7",
    padding: 14,
    marginBottom: 8,
  },
  stopCardLeft: { alignItems: "center", marginRight: 12, paddingTop: 2 },
  stopNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
  },
  stopNumberText: { fontSize: 11, fontWeight: "800", color: COLORS.white },
  stopCardLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#FDE68A",
    marginTop: 4,
    minHeight: 16,
  },
  stopCardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400E",
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  stopCardField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  stopCardValue: { flex: 1, fontSize: 14, color: COLORS.textPrimary },

  // Add stop button
  addStopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PURPLE.midStrong,
    borderStyle: "dashed",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  addStopIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PURPLE.light,
    alignItems: "center",
    justifyContent: "center",
  },
  addStopText: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  addStopSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },

  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    marginLeft: 24,
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.secondaryLight,
    borderWidth: 1,
    borderColor: COLORS.secondary + "50",
  },
  gpsBtnText: { fontSize: 12, fontWeight: "700", color: COLORS.secondary },

  // When tabs — flex: 1 lives on the PopIn wrapper
  whenTabs: { flexDirection: "row", gap: 10, marginBottom: 16 },
  whenTab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  whenTabActive: {
    backgroundColor: PURPLE.primary,
    borderColor: PURPLE.primary,
  },
  whenTabText: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted },
  whenTabTextActive: { color: COLORS.white },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: 8,
  },

  // Day chips
  dayScroll: { gap: 8, paddingRight: 4 },
  dayChip: {
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    minWidth: 72,
  },
  dayChipActive: { backgroundColor: PURPLE.light, borderColor: PURPLE.primary },
  dayChipTop: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  dayChipBot: { fontSize: 13, fontWeight: "800", color: COLORS.textPrimary },
  dayChipActiveText: { color: PURPLE.primary },

  // Time row
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: PURPLE.midStrong,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: PURPLE.light,
  },
  timeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  timeValue: { fontSize: 18, fontWeight: "800", color: PURPLE.primary },

  // Recurrence
  recurrRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  recurrChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  recurrChipActive: {
    borderColor: PURPLE.primary,
    backgroundColor: PURPLE.light,
  },
  recurrText: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted },
  recurrTextActive: { color: PURPLE.primary },

  // Vehicle type
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    backgroundColor: COLORS.background,
    position: "relative",
  },
  vehicleRowActive: {
    borderColor: PURPLE.primary,
    backgroundColor: PURPLE.light,
  },
  vehicleIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleLabel: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  vehicleSeats: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
    marginTop: 1,
  },
  vehiclePrice: { fontSize: 15, fontWeight: "800", color: COLORS.textPrimary },
  vehiclePerKm: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
    marginTop: 1,
  },
  vehicleCheck: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.white,
  },

  // Fare estimate
  fareCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    shadowColor: PURPLE.deep,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  fareIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fareLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fareValue: { fontSize: 17, fontWeight: "800", marginTop: 2 },
  fareDistance: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
    marginTop: 2,
  },
  fareNote: { alignItems: "flex-end" },
  fareNoteText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "500",
    textAlign: "right",
    maxWidth: 90,
  },
  fareBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  fareBalanceText: { fontSize: 11, color: COLORS.textMuted, fontWeight: "500" },
  fareBalanceInsufficient: { color: COLORS.danger, fontWeight: "700" },

  // Driver selection
  driverCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  driverLoadingWrap: { alignItems: "center", paddingVertical: 24, gap: 10 },
  driverLoadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  driverEmpty: { alignItems: "center", paddingVertical: 24, gap: 6 },
  driverEmptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  driverEmptyHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  driverRetryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: PURPLE.midStrong,
    backgroundColor: PURPLE.light,
  },
  driverRetryText: { fontSize: 13, fontWeight: "700", color: PURPLE.primary },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    marginBottom: 8,
  },
  driverRowSelected: {
    borderColor: PURPLE.primary,
    backgroundColor: PURPLE.light,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  driverVehiclePhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  driverAvatarAny: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  driverAvatarSelected: { backgroundColor: PURPLE.primary },
  driverInitials: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  driverName: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  driverSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
    marginTop: 1,
  },
  driverMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  driverRating: { fontSize: 11, fontWeight: "700", color: "#D97706" },
  driverRatingCount: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  colorDot: { width: 8, height: 8, borderRadius: 4, marginRight: 2 },
  driverPlate: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  driverAvailDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
  },
  driverDistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  driverDistText: { fontSize: 11, fontWeight: "600", color: PURPLE.primary },
  driverDistTextMuted: {
    fontSize: 11,
    fontWeight: "500",
    color: COLORS.textMuted,
  },

  // Notes
  notesInput: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    minHeight: 70,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },

  // Confirm — purple gradient CTA
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: PURPLE.primary,
    borderRadius: 16,
    paddingVertical: 16,
    overflow: "hidden",
    shadowColor: PURPLE.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  confirmBtnDisabled: {
    backgroundColor: COLORS.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmBtnText: { fontSize: 16, fontWeight: "800", color: COLORS.white },

  // ── Wheel picker ─────────────────────────────────────────────────────────────
  timeOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  timeSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
  },
  timeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  timeTitle: { fontSize: 17, fontWeight: "800", color: COLORS.textPrimary },
  timeCancelText: { fontSize: 15, fontWeight: "600", color: COLORS.textMuted },
  timeDoneText: { fontSize: 15, fontWeight: "700", color: PURPLE.primary },

  wheelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 4,
  },
  wheelHighlight: {
    position: "absolute",
    left: 0,
    right: 0,
    height: ITEM_H,
    backgroundColor: PURPLE.light,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderTopColor: PURPLE.midStrong,
    borderBottomColor: PURPLE.midStrong,
  },
  wheelItem: {
    height: ITEM_H,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelText: {
    fontSize: 20,
    fontWeight: "400",
    color: COLORS.textMuted,
  },
  wheelTextSelected: {
    fontSize: 26,
    fontWeight: "700",
    color: PURPLE.primary,
  },
  wheelColon: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.textPrimary,
    paddingBottom: 6,
    marginHorizontal: 2,
  },
  ampmCol: { marginLeft: 16, gap: 10, justifyContent: "center" },
  ampmBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  ampmBtnActive: {
    backgroundColor: PURPLE.primary,
    borderColor: PURPLE.primary,
  },
  ampmText: { fontSize: 15, fontWeight: "700", color: COLORS.textMuted },
  ampmTextActive: { color: COLORS.white },
});

export default TaxiReservationScreen;
