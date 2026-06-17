import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  StatusBar,
  Animated,
  Easing,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, PURPLE } from "../../constants/colors";
import * as Location from "expo-location";
import GradientFill from "../../components/common/GradientFill";
import FadeInView from "../../components/common/FadeInView";
import PressableScale from "../../components/common/PressableScale";
import {
  createStopRequest,
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

const parseCoords = (text) => {
  const at = text.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
  const d = text.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (d) return { lat: parseFloat(d[1]), lng: parseFloat(d[2]) };
  const j = text.match(/"lat":(-?\d{1,3}\.\d+),"lng":(-?\d{1,3}\.\d+)/);
  if (j) return { lat: parseFloat(j[1]), lng: parseFloat(j[2]) };
  const q = text.match(/[?&](?:q|center|ll)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };
  return null;
};

const extractCoordsFromUrl = async (url) => {
  const direct = parseCoords(url);
  if (direct) return direct;
  try {
    const data = await apiExpandMapUrl(url);
    if (data?.lat != null && data?.lng != null)
      return { lat: data.lat, lng: data.lng };
  } catch {}
  return null;
};

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

const getBestLocation = () =>
  new Promise((resolve, reject) => {
    let best = null;
    let sub = null;
    let resolved = false;
    const finish = (coords) => {
      if (resolved) return;
      resolved = true;
      sub?.remove();
      resolve(coords);
    };
    const timer = setTimeout(() => {
      if (best) finish(best);
      else {
        sub?.remove();
        reject(new Error("GPS timeout"));
      }
    }, 8000);
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        maximumAge: 0,
        distanceInterval: 0,
      },
      (loc) => {
        const c = loc.coords;
        if (!best || c.accuracy < best.accuracy) best = c;
        if (c.accuracy <= 15) {
          clearTimeout(timer);
          finish(c);
        }
      }
    )
      .then((s) => {
        sub = s;
        if (resolved) s.remove();
      })
      .catch(reject);
  });

/* ────────────────────────── animation helpers ──────────────────────────
   All native-driver, module-level so they never remount with re-renders. */

/** Pops every time `trigger` changes value (but not on first render). */
const Bump = ({ trigger, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scale.setValue(0.8);
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 150,
      useNativeDriver: true,
    }).start();
  }, [trigger, scale]);
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
};

/** Slow scale pulse — the submit CTA when it's actionable. */
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

/** One-shot celebration: icon springs in while two purple rings burst outward. */
const SuccessBurst = ({ children }) => {
  const pop = useRef(new Animated.Value(0)).current;
  const r1 = useRef(new Animated.Value(0)).current;
  const r2 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, {
      toValue: 1,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start();
    Animated.stagger(220, [
      Animated.timing(r1, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(r2, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [pop, r1, r2]);
  const ring = (v) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
    transform: [
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.4] }) },
    ],
  });
  return (
    <View style={styles.successBurstWrap}>
      <Animated.View style={[styles.successRing, ring(r1)]} />
      <Animated.View style={[styles.successRing, ring(r2)]} />
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        {children}
      </Animated.View>
    </View>
  );
};

const AltOptions = ({ onMap, onLink }) => (
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
      <PressableScale style={altStyles.btn} onPress={onLink} scaleTo={0.95}>
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

export default function RequestStopScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [location, setLocation] = useState("");
  const [locationLatLng, setLocationLatLng] = useState(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Search modal state
  const [searchModal, setSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef(null);

  // GPS
  const [gpsLoading, setGpsLoading] = useState(false);

  // Maps link panel
  const [pastingLink, setPastingLink] = useState(false);
  const [mapsLink, setMapsLink] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);

  const heroAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(heroAnim, {
      toValue: 1,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [heroAnim]);

  // Pick-on-map return — the picker stores coordinates under `latLng`
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      const result = getPickerResult();
      if (result) {
        const lat = result.latLng?.latitude;
        const lng = result.latLng?.longitude;
        animateLayout();
        setLocation(
          result.address ||
            (lat != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "")
        );
        setLocationLatLng(result.latLng ?? null);
        clearPickerResult();
        setSearchModal(false);
      }
    });
    return unsubscribe;
  }, [navigation]);

  // Nominatim search with debounce
  useEffect(() => {
    if (!searchModal) return;
    clearTimeout(searchTimer.current);
    if (searchQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      const results = await searchNominatim(searchQuery);
      setSuggestions(results);
      setSearchLoading(false);
    }, 400);
  }, [searchQuery, searchModal]);

  const openSearch = () => {
    setSearchQuery("");
    setSuggestions([]);
    setPastingLink(false);
    setMapsLink("");
    setSearchModal(true);
  };

  const closeSearch = () => {
    setSearchModal(false);
    Keyboard.dismiss();
  };

  const handleSelectSuggestion = (item) => {
    animateLayout();
    setLocation(item.label);
    setLocationLatLng({ latitude: item.lat, longitude: item.lng });
    closeSearch();
  };

  const handleOpenMap = () => {
    closeSearch();
    navigation.navigate("MapLocationPicker", {
      field: "location",
      title: "Pick Stop Location",
    });
  };

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
      const latLng = { latitude: coords.lat, longitude: coords.lng };
      const address = await reverseGeocode(coords.lat, coords.lng);
      animateLayout();
      setLocation(
        address ?? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
      );
      setLocationLatLng(latLng);
      setMapsLink("");
      setPastingLink(false);
      closeSearch();
    } finally {
      setLinkLoading(false);
    }
  };

  const useMyLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission denied",
          "Enable location access in your device settings."
        );
        return;
      }
      const coords = await getBestLocation();
      const { latitude, longitude } = coords;
      const address = await reverseGeocode(latitude, longitude);
      animateLayout();
      setLocation(address ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      setLocationLatLng({ latitude, longitude });
    } catch {
      Alert.alert(
        "Error",
        "Could not get your location. Make sure GPS is enabled and try again outside if you are indoors."
      );
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!location.trim()) {
      Alert.alert(
        "Missing location",
        "Please select the location where you want a new stop."
      );
      return;
    }
    setSubmitting(true);
    try {
      await createStopRequest({
        address: location.trim(),
        lat: locationLatLng?.latitude ?? null,
        lng: locationLatLng?.longitude ?? null,
        description: description.trim() || null,
      });
      setSubmitted(true);
    } catch (err) {
      Alert.alert("Error", "Failed to submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!location.trim() && !submitting;

  // ── Success state ───────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={COLORS.background}
        />
        <View style={styles.successWrap}>
          <SuccessBurst>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={52} color={COLORS.white} />
            </View>
          </SuccessBurst>
          <FadeInView index={1}>
            <Text style={styles.successTitle}>Request Submitted!</Text>
          </FadeInView>
          <FadeInView index={2}>
            <Text style={styles.successSub}>
              Thank you. Our team will review your stop request and get back to
              you.
            </Text>
          </FadeInView>
          <FadeInView index={3}>
            <PressableScale
              style={styles.doneBtn}
              onPress={() => navigation.goBack()}
              scaleTo={0.95}
            >
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <GradientFill
                  id="doneStopRequest"
                  colors={["#6D28D9", "#8B5CF6"]}
                  vertical={false}
                />
              </View>
              <Text style={styles.doneBtnText}>Done</Text>
            </PressableScale>
          </FadeInView>
        </View>
      </View>
    );
  }

  const submitButton = (
    <PressableScale
      style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
      onPress={() => {
        if (canSubmit) handleSubmit();
      }}
      scaleTo={0.96}
    >
      {canSubmit && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill
            id="submitStopRequest"
            colors={["#6D28D9", "#8B5CF6"]}
            vertical={false}
          />
        </View>
      )}
      {submitting ? (
        <ActivityIndicator color={COLORS.white} />
      ) : (
        <>
          <Ionicons name="paper-plane-outline" size={18} color={COLORS.white} />
          <Text style={styles.submitBtnText}>Submit Request</Text>
        </>
      )}
    </PressableScale>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* ── Purple hero header ── */}
      <View style={styles.hero}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill
            id="stopRequestHero"
            colors={PURPLE.gradient}
            vertical
          />
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />
        </View>
        <Animated.View
          style={[
            styles.heroRow,
            { paddingTop: insets.top + 10 },
            {
              opacity: heroAnim,
              transform: [
                {
                  translateY: heroAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <PressableScale
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            scaleTo={0.88}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Request a Stop</Text>
            <Text style={styles.heroSub}>Help us grow the network</Text>
          </View>
          <View style={styles.heroChip}>
            <Ionicons name="flag" size={14} color={COLORS.white} />
          </View>
        </Animated.View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {/* Intro */}
        <FadeInView index={0}>
          <View style={styles.introBanner}>
            <Ionicons name="bus-outline" size={22} color={PURPLE.primary} />
            <Text style={styles.introText}>
              Tell us where you'd like a new bus stop. We'll review your request
              and consider it for future route updates.
            </Text>
          </View>
        </FadeInView>

        {/* Location field */}
        <FadeInView index={1}>
          <Text style={styles.label}>
            Requested Stop Location <Text style={styles.required}>*</Text>
          </Text>
          <PressableScale
            style={styles.locationRow}
            onPress={openSearch}
            scaleTo={0.98}
          >
            <View style={styles.locationIconWrap}>
              <Ionicons name="location" size={18} color={PURPLE.primary} />
            </View>
            <Bump trigger={location} style={{ flex: 1 }}>
              <Text
                style={[
                  styles.locationText,
                  !location && styles.locationPlaceholder,
                ]}
                numberOfLines={2}
              >
                {location || "Search or pick location"}
              </Text>
            </Bump>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={COLORS.textMuted}
            />
          </PressableScale>

          {/* GPS button */}
          <PressableScale
            style={styles.gpsBtn}
            onPress={() => {
              if (!gpsLoading) useMyLocation();
            }}
            scaleTo={0.95}
          >
            {gpsLoading ? (
              <ActivityIndicator size="small" color={PURPLE.primary} />
            ) : (
              <Ionicons
                name="navigate-outline"
                size={16}
                color={PURPLE.primary}
              />
            )}
            <Text style={styles.gpsBtnText}>
              {gpsLoading
                ? "Pinpointing your location…"
                : "Use My Current Location"}
            </Text>
          </PressableScale>
        </FadeInView>

        {/* Description */}
        <FadeInView index={2}>
          <Text style={[styles.label, { marginTop: 24 }]}>
            Why do you need a stop here?
          </Text>
          <TextInput
            style={styles.descInput}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. There's a hospital nearby with no bus access, many residents use this road daily..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text
            style={[
              styles.charCount,
              description.length > 450 && styles.charCountWarn,
            ]}
          >
            {description.length}/500
          </Text>
        </FadeInView>

        {/* Submit */}
        <FadeInView index={3}>
          {canSubmit ? <Breathe>{submitButton}</Breathe> : submitButton}
        </FadeInView>
      </ScrollView>

      {/* ── Search modal ─────────────────────────────────────────────────────── */}
      <Modal
        visible={searchModal}
        animationType="slide"
        onRequestClose={closeSearch}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: COLORS.background }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Modal header */}
          <View style={[styles.modalHeader, { paddingTop: insets.top + 8 }]}>
            <PressableScale
              onPress={closeSearch}
              style={styles.modalBackBtn}
              scaleTo={0.88}
            >
              <Ionicons
                name="arrow-back"
                size={22}
                color={COLORS.textPrimary}
              />
            </PressableScale>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search location in Lebanon..."
              placeholderTextColor={COLORS.textMuted}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchLoading && (
              <ActivityIndicator
                size="small"
                color={PURPLE.primary}
                style={{ marginLeft: 8 }}
              />
            )}
          </View>

          {/* Results */}
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            {searchLoading && suggestions.length === 0 ? (
              <View style={styles.searchingWrap}>
                <Text style={styles.noResults}>Searching</Text>
                <Dots color={COLORS.textMuted} />
              </View>
            ) : suggestions.length > 0 ? (
              suggestions.map((item, i) => (
                <FadeInView key={`${item.lat}-${item.lng}-${i}`} index={i}>
                  <PressableScale
                    style={styles.suggestionRow}
                    onPress={() => handleSelectSuggestion(item)}
                    scaleTo={0.98}
                  >
                    <View style={styles.suggIconWrap}>
                      <Ionicons
                        name="location-outline"
                        size={18}
                        color={PURPLE.primary}
                      />
                    </View>
                    <Text style={styles.suggestionText} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </PressableScale>
                </FadeInView>
              ))
            ) : searchQuery.trim().length >= 3 && !searchLoading ? (
              <Text style={styles.noResults}>No results found in Lebanon</Text>
            ) : null}
          </ScrollView>

          {/* Alt options / maps link panel */}
          {!pastingLink && (
            <AltOptions
              onMap={handleOpenMap}
              onLink={() => {
                animateLayout();
                setMapsLink("");
                setPastingLink(true);
              }}
            />
          )}
          {pastingLink && (
            <View style={styles.linkPanel}>
              <View style={styles.linkPanelHeader}>
                <Ionicons name="locate-outline" size={18} color="#EA4335" />
                <Text style={styles.linkPanelTitle}>Google Maps Link</Text>
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
              <Text style={styles.linkPanelHint}>
                In Google Maps, tap a location → Share → Copy link, then paste
                below.
              </Text>
              <View style={styles.linkInputRow}>
                <TextInput
                  style={styles.linkInput}
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
                  styles.linkBtn,
                  (!mapsLink.trim() || linkLoading) && { opacity: 0.5 },
                ]}
                onPress={() => {
                  if (mapsLink.trim() && !linkLoading) handlePasteLink();
                }}
                scaleTo={0.96}
              >
                {linkLoading ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.linkBtnText}>Use This Location</Text>
                )}
              </PressableScale>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

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

  body: { padding: 20, paddingBottom: 40 },

  introBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: PURPLE.light,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: PURPLE.midStrong,
  },
  introText: { flex: 1, fontSize: 13, color: PURPLE.primary, lineHeight: 19 },

  label: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  required: { color: "#EF4444" },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  locationIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PURPLE.light,
    alignItems: "center",
    justifyContent: "center",
  },
  locationText: { fontSize: 14, color: COLORS.textPrimary },
  locationPlaceholder: { color: COLORS.textMuted },

  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PURPLE.midStrong,
    backgroundColor: PURPLE.light,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  gpsBtnText: { fontSize: 13, fontWeight: "600", color: PURPLE.primary },

  descInput: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 14,
    fontSize: 14,
    color: COLORS.textPrimary,
    minHeight: 110,
  },
  charCount: {
    fontSize: 11,
    color: COLORS.textMuted,
    alignSelf: "flex-end",
    marginTop: 4,
  },
  charCountWarn: { color: "#F59E0B", fontWeight: "700" },

  submitBtn: {
    marginTop: 32,
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
  submitBtnDisabled: {
    backgroundColor: COLORS.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: { fontSize: 16, fontWeight: "700", color: COLORS.white },

  // Success
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  successBurstWrap: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successRing: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: PURPLE.primary,
  },
  successIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: PURPLE.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PURPLE.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: "center",
  },
  successSub: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  doneBtn: {
    backgroundColor: PURPLE.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 48,
    overflow: "hidden",
    alignSelf: "center",
    shadowColor: PURPLE.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  doneBtnText: { fontSize: 16, fontWeight: "700", color: COLORS.white },

  // Modal
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalBackBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    flex: 1,
    height: 40,
    marginLeft: 8,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: PURPLE.midStrong,
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  searchingWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 24,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  suggIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: PURPLE.light,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  suggestionText: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  noResults: {
    padding: 24,
    textAlign: "center",
    color: COLORS.textMuted,
    fontSize: 14,
  },

  // Link panel
  linkPanel: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 16,
    paddingBottom: 24,
  },
  linkPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  linkPanelTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  linkPanelHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 17,
    marginBottom: 12,
  },
  linkInputRow: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  linkInput: { height: 44, fontSize: 14, color: COLORS.textPrimary },
  linkBtn: {
    backgroundColor: PURPLE.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  linkBtnText: { fontSize: 14, fontWeight: "700", color: COLORS.white },
});
