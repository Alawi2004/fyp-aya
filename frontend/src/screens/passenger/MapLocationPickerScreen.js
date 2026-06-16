import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Animated,
  Easing,
} from "react-native";
import MapView from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, PURPLE } from "../../constants/colors";
import GradientFill from "../../components/common/GradientFill";
import PressableScale from "../../components/common/PressableScale";
import { setPickerResult } from "../../utils/locationPickerResult";

const DEFAULT_REGION = {
  latitude: 33.8938,
  longitude: 35.5018,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

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

/** Slow scale pulse — keeps attention on the confirm CTA. */
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

/** Pulsing opacity — the pickup/destination indicator dot. */
const Blink = ({ style }) => {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
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

const MapLocationPickerScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { field, title } = route?.params ?? {};
  const mapRef = useRef(null);

  const [region, setRegion] = useState(DEFAULT_REGION);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(true);
  const geocodeTimeout = useRef(null);

  // Pin lift/drop + landing ripple
  const pinLift = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(1)).current; // 1 = finished (invisible)
  const pinLifted = useRef(false);

  // Entrance
  const topAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(topAnim, {
      toValue: 1,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();
    Animated.sequence([
      Animated.delay(150),
      Animated.spring(sheetAnim, {
        toValue: 1,
        friction: 9,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start();
  }, [topAnim, sheetAnim]);

  const liftPin = useCallback(() => {
    if (pinLifted.current) return;
    pinLifted.current = true;
    Animated.spring(pinLift, {
      toValue: 1,
      friction: 6,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [pinLift]);

  const dropPin = useCallback(() => {
    if (!pinLifted.current) return;
    pinLifted.current = false;
    Animated.spring(pinLift, {
      toValue: 0,
      friction: 4,
      tension: 140,
      useNativeDriver: true,
    }).start();
    ripple.setValue(0);
    Animated.timing(ripple, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [pinLift, ripple]);

  // Jump to user's GPS position on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const r = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
          setRegion(r);
          mapRef.current?.animateToRegion(r, 600);
          reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        }
      } catch (_) {
      } finally {
        setLocating(false);
      }
    })();
  }, []);

  const reverseGeocode = useCallback(async (lat, lng) => {
    setLoading(true);
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });
      const r = results[0];
      if (r) {
        const parts = [r.name, r.street, r.district, r.city].filter(Boolean);
        setAddress(parts.join(", ") || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } else {
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch (_) {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce reverse geocoding while user pans
  const onRegionChangeComplete = useCallback(
    (r) => {
      dropPin();
      setRegion(r);
      clearTimeout(geocodeTimeout.current);
      geocodeTimeout.current = setTimeout(() => {
        reverseGeocode(r.latitude, r.longitude);
      }, 600);
    },
    [reverseGeocode, dropPin]
  );

  const goToMyLocation = async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const r = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      mapRef.current?.animateToRegion(r, 500);
    } catch (_) {}
  };

  const confirm = () => {
    setPickerResult({
      field,
      address,
      latLng: { latitude: region.latitude, longitude: region.longitude },
    });
    navigation.goBack();
  };

  const canConfirm = !!address && !loading;

  const pinTranslate = pinLift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -16],
  });
  const shadowScale = pinLift.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.45],
  });
  const shadowOpacity = pinLift.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.4],
  });
  const rippleScale = ripple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 2.4],
  });
  const rippleOpacity = ripple.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [0.5, 0.15, 0],
  });
  const topTranslate = topAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 0],
  });
  const sheetTranslate = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [240, 0],
  });

  const confirmButton = (
    <PressableScale
      style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
      onPress={() => {
        if (canConfirm) confirm();
      }}
      scaleTo={0.96}
    >
      {canConfirm && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill
            id="confirmLocation"
            colors={["#6D28D9", "#8B5CF6"]}
            vertical={false}
          />
        </View>
      )}
      <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
      <Text style={styles.confirmText}>Confirm Location</Text>
    </PressableScale>
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={DEFAULT_REGION}
        onRegionChange={liftPin}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
      />

      {/* Fixed center pin — lifts while panning, drops with a ripple on release */}
      <View style={styles.pinWrap} pointerEvents="none">
        <Animated.View
          style={[
            styles.pinRipple,
            { opacity: rippleOpacity, transform: [{ scale: rippleScale }] },
          ]}
        />
        <Animated.View style={{ transform: [{ translateY: pinTranslate }] }}>
          <Ionicons
            name="location"
            size={40}
            color={PURPLE.primary}
            style={styles.pinIcon}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.pinShadow,
            { opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] },
          ]}
        />
      </View>

      {/* Top bar */}
      <Animated.View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            opacity: topAnim,
            transform: [{ translateY: topTranslate }],
          },
        ]}
      >
        <PressableScale
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          scaleTo={0.88}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </PressableScale>
        <View style={styles.titleWrap}>
          <Text style={styles.titleText} numberOfLines={1}>
            {title ||
              (field === "pickup" ? "Set Pickup Location" : "Set Destination")}
          </Text>
        </View>
      </Animated.View>

      {/* Locating chip — shown during the initial GPS fix */}
      {locating && (
        <View
          style={[styles.locatingChip, { top: insets.top + 70 }]}
          pointerEvents="none"
        >
          <Ionicons name="navigate" size={13} color={PURPLE.primary} />
          <Text style={styles.locatingText}>Locating you</Text>
          <Dots color={PURPLE.primary} />
        </View>
      )}

      {/* My location button */}
      <PressableScale
        style={[styles.myLocBtn, { bottom: 200 + insets.bottom }]}
        onPress={goToMyLocation}
        scaleTo={0.88}
      >
        <Ionicons name="locate" size={20} color={PURPLE.primary} />
      </PressableScale>

      {/* Bottom sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: insets.bottom + 16,
            transform: [{ translateY: sheetTranslate }],
          },
        ]}
      >
        <View style={styles.sheetHandle} />
        <View style={styles.addressRow}>
          <Blink
            style={[
              styles.dotIndicator,
              {
                backgroundColor:
                  field === "pickup" ? COLORS.secondary : COLORS.danger,
              },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>
              {field === "pickup" ? "PICKUP" : "DESTINATION"}
            </Text>
            {loading || locating ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={PURPLE.primary} />
                <Text style={styles.addressLoading}>Finding address</Text>
                <Dots color={COLORS.textMuted} />
              </View>
            ) : (
              <Bump trigger={address}>
                <Text style={styles.addressText} numberOfLines={2}>
                  {address || "Move the map to position the pin"}
                </Text>
              </Bump>
            )}
          </View>
        </View>

        <Text style={styles.hint}>
          Pan the map to move the pin to your location
        </Text>

        {canConfirm ? <Breathe>{confirmButton}</Breathe> : confirmButton}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Top bar
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  backBtn: {
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
  titleWrap: {
    flex: 1,
    marginLeft: 10,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  titleText: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },

  // Locating chip
  locatingChip: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: PURPLE.deep,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  locatingText: { fontSize: 12, fontWeight: "700", color: PURPLE.primary },

  // Center pin
  pinWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -20,
    marginTop: -46,
    alignItems: "center",
    width: 40,
  },
  pinIcon: {
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  pinShadow: {
    width: 12,
    height: 6,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.25)",
    marginTop: -2,
  },
  pinRipple: {
    position: "absolute",
    bottom: -8,
    alignSelf: "center",
    width: 36,
    height: 18,
    borderRadius: 18,
    backgroundColor: PURPLE.primary,
  },

  // My location
  myLocBtn: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
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

  // Bottom sheet
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: PURPLE.deep,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: 10,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  dotIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 16,
    flexShrink: 0,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addressLoading: { fontSize: 14, color: COLORS.textMuted, fontWeight: "500" },
  addressText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
    lineHeight: 21,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "center",
    marginBottom: 14,
    fontWeight: "500",
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PURPLE.primary,
    borderRadius: 14,
    paddingVertical: 15,
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
  confirmText: { fontSize: 16, fontWeight: "800", color: COLORS.white },
});

export default MapLocationPickerScreen;
