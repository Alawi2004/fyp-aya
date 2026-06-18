import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Animated,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Linking,
  Modal,
  Share,
  Dimensions,
  Easing,
  Pressable,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import * as Print from "expo-print";
import QRCode from "react-native-qrcode-svg";
import Svg, {
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Rect,
  Circle,
  Line,
} from "react-native-svg";
import useHeaderInsets from "../../hooks/useHeaderInsets";
import { Ionicons } from "@expo/vector-icons";
import {
  getWalletApi,
  getWalletTransactionsApi,
  getTopUpLocationsApi,
} from "../../api/walletApi";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { COLORS, PURPLE } from "../../constants/colors";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = SCREEN_W - 32;

const animateLayout = () =>
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

const MAP_REGION = {
  latitude: 33.8938,
  longitude: 35.52,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const hasCoords = (loc) => {
  const lat = Number(loc?.latitude);
  const lng = Number(loc?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
};

const TX_FILTERS = [
  { key: "all", label: "All", icon: "apps-outline" },
  { key: "credit", label: "Top-Ups", icon: "arrow-down-outline" },
  { key: "debit", label: "Payments", icon: "arrow-up-outline" },
];

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

// "Today" / "Yesterday" / "Mon, Jun 3" header label for a transaction group
const dayLabel = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

// Group an already date-sorted list into [{ label, total, items }]
const groupByDay = (txs) => {
  const groups = [];
  let current = null;
  for (const t of txs) {
    const label = dayLabel(t.created_at);
    if (!current || current.label !== label) {
      current = { label, total: 0, items: [] };
      groups.push(current);
    }
    current.items.push(t);
    const amt = parseFloat(t.amount ?? 0);
    current.total += t.type === "credit" ? amt : -amt;
  }
  return groups;
};

// Friendly title shown on the transaction row
const txTitle = (t) =>
  t.type === "credit"
    ? "Wallet Top-Up"
    : t.description && !/^In-person recharge/i.test(t.description)
    ? t.description
    : "Trip Payment";

const txSubtitle = (t) =>
  t.type === "credit"
    ? [t.location_name, t.processed_by].filter(Boolean).join("  ·  ") ||
      "In-person recharge"
    : "Fare deducted from wallet";

// ── Reusable SVG gradient fill (rounded rect) ────────────────────────────────
// Measures its own box with onLayout and renders the SVG at explicit pixel
// sizes — react-native-svg does NOT reliably honour width="100%" on iOS, which
// otherwise leaves the gradient covering only part of the card.
const GradientFill = ({ id, colors, radius = 24 }) => {
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((p) =>
          p.w === width && p.h === height ? p : { w: width, h: height }
        );
      }}
    >
      {box.w > 0 && box.h > 0 && (
        <Svg width={box.w} height={box.h}>
          <Defs>
            <SvgGradient
              id={id}
              x1="0"
              y1="0"
              x2={box.w}
              y2={box.h}
              gradientUnits="userSpaceOnUse"
            >
              {colors.map((c, i) => (
                <Stop
                  key={i}
                  offset={`${i / (colors.length - 1)}`}
                  stopColor={c}
                />
              ))}
            </SvgGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={box.w}
            height={box.h}
            rx={radius}
            ry={radius}
            fill={`url(#${id})`}
          />
        </Svg>
      )}
    </View>
  );
};

// ── Premium decorative pattern for the balance card (concentric rings + lines) ─
const CardPattern = ({ w, h }) => (
  <Svg
    width={w}
    height={h}
    style={StyleSheet.absoluteFill}
    pointerEvents="none"
  >
    <Circle
      cx={w - 24}
      cy={34}
      r={62}
      stroke="rgba(255,255,255,0.12)"
      strokeWidth={1.4}
      fill="none"
    />
    <Circle
      cx={w - 24}
      cy={34}
      r={104}
      stroke="rgba(255,255,255,0.08)"
      strokeWidth={1.4}
      fill="none"
    />
    <Circle
      cx={w - 24}
      cy={34}
      r={150}
      stroke="rgba(255,255,255,0.05)"
      strokeWidth={1.4}
      fill="none"
    />
    <Circle
      cx={26}
      cy={h - 16}
      r={70}
      stroke="rgba(255,255,255,0.06)"
      strokeWidth={1.2}
      fill="none"
    />
    <Line
      x1={0}
      y1={h - 44}
      x2={w}
      y2={h - 96}
      stroke="rgba(255,255,255,0.06)"
      strokeWidth={1}
    />
    <Line
      x1={0}
      y1={h - 22}
      x2={w}
      y2={h - 74}
      stroke="rgba(255,255,255,0.045)"
      strokeWidth={1}
    />
  </Svg>
);

// ── Press-to-scale wrapper for tactile buttons ───────────────────────────────
// The Pressable itself carries the style + transform so it works correctly as a
// flex child (e.g. flex:1 buttons in a row).
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const Bounce = ({
  children,
  onPress,
  style,
  scaleTo = 0.96,
  disabled,
  hitSlop,
}) => {
  const s = useRef(new Animated.Value(1)).current;
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() =>
        Animated.spring(s, {
          toValue: scaleTo,
          useNativeDriver: true,
          speed: 50,
          bounciness: 0,
        }).start()
      }
      onPressOut={() =>
        Animated.spring(s, {
          toValue: 1,
          useNativeDriver: true,
          speed: 20,
          bounciness: 8,
        }).start()
      }
      style={[style, { transform: [{ scale: s }] }]}
    >
      {children}
    </AnimatedPressable>
  );
};

/* ────────────────────────── animation helpers ──────────────────────────
   All native-driver, module-level so they never remount with re-renders. */

/** Fade + slide on mount, staggered by `index`. Key it to replay. */
const Reveal = ({ index = 0, style, children }) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 70),
      Animated.spring(a, {
        toValue: 1,
        friction: 9,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [a, index]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: a,
          transform: [
            {
              translateY: a.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

/** Springs in whenever `active` flips on — selection pop for toggles and pills. */
const PopSel = ({ active, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) return;
    scale.setValue(0.88);
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

/** Horizontal shake on mount — the frozen-wallet banner. */
const Shake = ({ style, children }) => {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(400),
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
    outputRange: [0, -7],
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

/** Purple laser line sweeping over the QR code — "scan me". */
const ScanLine = () => {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 1600,
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
    outputRange: [0, 168],
  });
  return (
    <View style={styles.scanClip} pointerEvents="none">
      <Animated.View
        style={[styles.scanLine, { transform: [{ translateY }] }]}
      />
    </View>
  );
};

// ── Count-up balance (isolated so re-renders don't touch the whole screen) ───
const AnimatedBalance = ({ value, style, currency = 'USD', decimals = 2 }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(v));
    Animated.timing(anim, {
      toValue: value ?? 0,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value]);
  const parts = display.toFixed(decimals).split(".");
  return (
    <Text style={style}>
      <Text>{currency} </Text>
      {parts[0]}
      {decimals > 0 && <Text style={{ fontSize: 18 }}>.{parts[1]}</Text>}
    </Text>
  );
};

const WalletScreen = () => {
  const navigation = useNavigation();
  const headerInsets = useHeaderInsets(12);
  const insets = useSafeAreaInsets();
  const { walletBalance, updateBalance, currency, exchangeRate, fmtMoney, t, walletLimits } = useApp();
  const { user } = useAuth();
  const [walletId, setWalletId] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState("map");
  const [selectedStation, setSelectedStation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locPermission, setLocPermission] = useState(null);
  const [walletFrozen, setWalletFrozen] = useState(false);
  const [freezeReason, setFreezeReason] = useState(null);
  const [showCashier, setShowCashier] = useState(false);
  const [txFilter, setTxFilter] = useState("all");
  const [selectedTx, setSelectedTx] = useState(null);

  const mapRef = useRef(null);

  // Identity the staff portal searches / scans against.
  const userId =
    user?.user_id ??
    (user?._id && /^\d+$/.test(String(user._id)) ? user._id : null);
  const qrValue = userId ? `YALLA-USER-${userId}` : user?.email ?? "";
  const userName = user?.full_name ?? user?.name ?? "Passenger";
  // Real wallet_id from the DB (falls back to user_id only until the wallet row loads)
  const last4 = String(walletId ?? userId ?? "0000")
    .padStart(4, "0")
    .slice(-4);

  // ── Animations ─────────────────────────────────────────────────────────────
  const intro = useRef([...Array(6)].map(() => new Animated.Value(0))).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const cashierAnim = useRef(new Animated.Value(0)).current;
  const receiptAnim = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(
      85,
      intro.map((a) =>
        Animated.spring(a, {
          toValue: 1,
          useNativeDriver: true,
          friction: 9,
          tension: 60,
        })
      )
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(2200),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // QR modal reveal + glow pulse
  useEffect(() => {
    if (showCashier) {
      cashierAnim.setValue(0);
      Animated.spring(cashierAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 55,
      }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      glow.stopAnimation();
    }
  }, [showCashier]);

  useEffect(() => {
    if (selectedTx) {
      receiptAnim.setValue(0);
      Animated.spring(receiptAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 65,
      }).start();
    }
  }, [selectedTx]);

  // Animated dismissals — the card shrinks away / the sheet slides down,
  // then the modal actually unmounts.
  const closeCashier = () => {
    glow.stopAnimation();
    Animated.timing(cashierAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => setShowCashier(false));
  };

  const closeReceipt = () => {
    Animated.timing(receiptAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setSelectedTx(null));
  };

  const sect = (i) => ({
    opacity: intro[i],
    transform: [
      {
        translateY: intro[i].interpolate({
          inputRange: [0, 1],
          outputRange: [28, 0],
        }),
      },
    ],
  });

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocPermission(status);
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      }
    } catch (_) {}
  };

  const loadData = useCallback(async () => {
    try {
      const [walletRes, txRes, locRes] = await Promise.allSettled([
        getWalletApi(),
        getWalletTransactionsApi(),
        getTopUpLocationsApi(),
      ]);
      if (walletRes.status === "fulfilled") {
        updateBalance(walletRes.value.data.balance ?? 0);
        setWalletId(walletRes.value.data.wallet_id ?? null);
        setWalletFrozen(!!walletRes.value.data.is_frozen);
        setFreezeReason(walletRes.value.data.freeze_reason ?? null);
      }
      if (txRes.status === "fulfilled") setTransactions(txRes.value.data ?? []);
      const apiLocations =
        locRes.status === "fulfilled" ? locRes.value.data ?? [] : [];
      setLocations(apiLocations);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const totalSpent = transactions
    .filter((t) => t.type === "debit")
    .reduce((sum, t) => sum + parseFloat(t.amount ?? 0), 0);
  const tripsPaid = transactions.filter((t) => t.type === "debit").length;

  const filteredTx =
    txFilter === "all"
      ? transactions
      : transactions.filter((t) => t.type === txFilter);

  const switchView = (mode) => {
    animateLayout();
    setViewMode(mode);
  };
  const selectFilter = (key) => {
    animateLayout();
    setTxFilter(key);
  };

  const shareReceipt = async (t) => {
    if (!t) return;
    const isCredit = t.type === "credit";
    const lines = [
      "🧾 YALLA TRANSIT — WALLET RECEIPT",
      `Type: ${isCredit ? "Top-Up (Credit)" : "Payment (Debit)"}`,
      `Amount: ${isCredit ? "+" : "-"}${fmtMoney(parseFloat(t.amount))}`,
      `Description: ${t.description ?? "—"}`,
      t.location_name ? `Location: ${t.location_name}` : null,
      t.tx_ref ? `Reference: ${t.tx_ref}` : null,
      t.processed_by ? `Processed by: ${t.processed_by}` : null,
      `Date: ${fmtDateTime(t.created_at)}`,
      t.transaction_id ? `Transaction #${t.transaction_id}` : null,
      "",
      "Yalla Transit — Smart Transit System",
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join("\n") });
    } catch (_) {}
  };

  const printReceipt = async (t) => {
    if (!t) return;
    const isCredit = t.type === "credit";
    const accent = isCredit ? "#059669" : "#DC2626";
    const row = (l, v) =>
      v ? `<tr><td class="l">${l}</td><td class="v">${v}</td></tr>` : "";
    const html = `
      <html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        * { font-family: -apple-system, Helvetica, Arial, sans-serif; }
        body { padding: 32px; color: #1E293B; }
        .brand { text-align:center; font-size:13px; letter-spacing:3px; color:#64748B; font-weight:700; }
        .title { text-align:center; font-size:22px; font-weight:800; margin:6px 0 24px; }
        .amt { text-align:center; font-size:40px; font-weight:900; color:${accent}; }
        .type { text-align:center; font-size:14px; color:#64748B; margin-bottom:24px; }
        table { width:100%; border-collapse:collapse; margin-top:8px; }
        td { padding:11px 4px; border-bottom:1px solid #E2E8F0; font-size:14px; vertical-align:top; }
        td.l { color:#64748B; width:42%; font-weight:600; }
        td.v { color:#0F172A; font-weight:700; text-align:right; }
        .foot { text-align:center; color:#94A3B8; font-size:12px; margin-top:28px; }
      </style></head>
      <body>
        <div class="brand">YALLA WALLET</div>
        <div class="title">Transaction Receipt</div>
        <div class="amt">${isCredit ? "+" : "-"}${fmtMoney(parseFloat(t.amount))}</div>
        <div class="type">${
          isCredit ? "Wallet Top-Up" : "Trip Payment"
        } · Completed</div>
        <table>
          ${row("Description", t.description)}
          ${row("Location", t.location_name)}
          ${row("Processed by", t.processed_by)}
          ${row("Reference", t.tx_ref)}
          ${row("Date &amp; Time", fmtDateTime(t.created_at))}
          ${row(
            "Transaction ID",
            t.transaction_id ? "#" + t.transaction_id : null
          )}
          ${row("Wallet ID", walletId != null ? "#" + walletId : null)}
          ${row("Cardholder", userName)}
        </table>
        <div class="foot">Yalla Transit — Smart Transit System</div>
      </body></html>`;
    try {
      await Print.printAsync({ html });
    } catch (_) {}
  };

  const handleMarkerPress = (loc) => {
    setSelectedStation(loc.location_id);
    if (viewMode === "map" && hasCoords(loc)) {
      // Fly to a tilted close-up of the station
      mapRef.current?.animateCamera(
        {
          center: {
            latitude: Number(loc.latitude),
            longitude: Number(loc.longitude),
          },
          pitch: 60,
          heading: 30,
          altitude: 600,
          zoom: 17.5,
        },
        { duration: 800 }
      );
    }
  };

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateCamera(
        {
          center: userLocation,
          pitch: 50,
          heading: 0,
          altitude: 900,
          zoom: 16.5,
        },
        { duration: 700 }
      );
    }
  };

  // Tilted fly-in once the map is ready
  const onMapReady = () => {
    const first = locations.find(hasCoords);
    const center =
      userLocation ??
      (first
        ? {
            latitude: Number(first.latitude),
            longitude: Number(first.longitude),
          }
        : { latitude: MAP_REGION.latitude, longitude: MAP_REGION.longitude });
    mapRef.current?.animateCamera(
      { center, pitch: 50, heading: 12, altitude: 1300, zoom: 15.5 },
      { duration: 1400 }
    );
  };

  // Manual zoom — works on both Apple (altitude) and Google (zoom) cameras
  const zoomBy = async (dir) => {
    const camera = await mapRef.current?.getCamera().catch(() => null);
    if (!camera) return;
    if (typeof camera.zoom === "number") {
      camera.zoom = Math.max(
        3,
        Math.min(20, camera.zoom + (dir === "in" ? 1 : -1))
      );
    } else if (typeof camera.altitude === "number") {
      camera.altitude =
        dir === "in" ? camera.altitude / 2 : camera.altitude * 2;
    }
    mapRef.current?.animateCamera(camera, { duration: 300 });
  };

  const shimmerTranslate = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-CARD_W * 0.7, CARD_W * 1.1],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PURPLE.primary}
            colors={[PURPLE.primary]}
          />
        }
      >
        {/* ── Top bar ── */}
        <View style={[styles.topBar, { paddingTop: headerInsets.paddingTop }]}>
          {navigation.canGoBack() ? (
            <Bounce onPress={() => navigation.goBack()} style={styles.iconBtn}>
              <Ionicons
                name="chevron-back"
                size={22}
                color={COLORS.textPrimary}
              />
            </Bounce>
          ) : (
            <View style={styles.iconBtn} />
          )}
          <Text style={styles.topTitle}>{t('Yalla Wallet')}</Text>
          <Bounce onPress={onRefresh} style={styles.iconBtn}>
            <Ionicons name="refresh" size={19} color={COLORS.textPrimary} />
          </Bounce>
        </View>

        {/* ── Gradient balance card ── */}
        <Animated.View style={[styles.cardWrap, sect(0)]}>
          <View style={styles.card}>
            {/* clipped background layer (gradient + pattern + shimmer) — kept
                separate so the card's coloured shadow isn't clipped on iOS */}
            <View style={styles.cardBg} pointerEvents="none">
              <GradientFill
                id="balCard"
                colors={["#4C1D95", "#6D28D9", "#8B5CF6"]}
                radius={26}
              />
              <CardPattern w={CARD_W} h={210} />
              <View style={styles.shimmerClip}>
                <Animated.View
                  style={[
                    styles.shimmerBand,
                    {
                      transform: [
                        { translateX: shimmerTranslate },
                        { rotate: "18deg" },
                      ],
                    },
                  ]}
                />
              </View>
            </View>

            {/* card top row */}
            <View style={styles.cardTopRow}>
              <View style={styles.cardBrand}>
                <View style={styles.chip}>
                  <View style={styles.chipLine} />
                  <View style={styles.chipLine} />
                </View>
                <Text style={styles.cardBrandText}>YALLA WALLET</Text>
              </View>
              {walletFrozen ? (
                <View style={styles.frozenChip}>
                  <Ionicons name="snow" size={12} color="#fff" />
                  <Text style={styles.frozenChipText}>Frozen</Text>
                </View>
              ) : (
                <Ionicons
                  name="wifi"
                  size={18}
                  color="rgba(255,255,255,0.65)"
                  style={{ transform: [{ rotate: "90deg" }] }}
                />
              )}
            </View>

            {/* balance */}
            <View style={styles.balanceBlock}>
              <Text style={styles.balanceLabel}>{t('Available Balance')}</Text>
              <AnimatedBalance
                value={walletBalance * exchangeRate}
                style={styles.balanceAmount}
                currency={currency}
                decimals={exchangeRate >= 100 ? 0 : 2}
              />
            </View>

            {/* card bottom row */}
            <View style={styles.cardBottomRow}>
              <View>
                <Text style={styles.cardFootLabel}>CARDHOLDER</Text>
                <Text style={styles.cardFootValue} numberOfLines={1}>
                  {userName}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.cardFootLabel}>WALLET ID</Text>
                <Text style={styles.cardFootValue}>•••• {last4}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Low-balance warning ── */}
        {!walletFrozen && walletBalance < walletLimits.lowBalanceAlert && walletLimits.lowBalanceAlert > 0 && (
          <Animated.View style={[{ paddingHorizontal: 16, marginTop: 10 }, sect(1)]}>
            <View style={styles.lowBalanceBanner}>
              <Ionicons name="warning-outline" size={16} color="#92400E" />
              <Text style={styles.lowBalanceBannerText}>
                Low balance — you have {currency} {(walletBalance * exchangeRate).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} remaining. Top up to continue using transit services.
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ── Floating stat cards ── */}
        <Animated.View style={[styles.statsRow, sect(1)]}>
          <View style={styles.statCard}>
            <View
              style={[styles.statIcon, { backgroundColor: COLORS.dangerLight }]}
            >
              <Ionicons name="trending-up" size={16} color={COLORS.danger} />
            </View>
            <Bump trigger={totalSpent} style={{ alignSelf: "flex-start" }}>
              <Text style={styles.statValue}>{fmtMoney(totalSpent)}</Text>
            </Bump>
            <Text style={styles.statLabel}>{t('Total Spent')}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: PURPLE.light }]}>
              <Ionicons name="bus" size={16} color={PURPLE.primary} />
            </View>
            <Bump trigger={tripsPaid} style={{ alignSelf: "flex-start" }}>
              <Text style={styles.statValue}>{tripsPaid}</Text>
            </Bump>
            <Text style={styles.statLabel}>{t('Trips Paid')}</Text>
          </View>
        </Animated.View>

        {/* ── Primary action ── */}
        <Animated.View style={[styles.actionWrap, sect(2)]}>
          <Bounce
            onPress={() => setShowCashier(true)}
            style={styles.cashierCta}
            scaleTo={0.97}
          >
            <View style={styles.cashierCtaBg} pointerEvents="none">
              <GradientFill
                id="ctaGrad"
                colors={["#6D28D9", "#8B5CF6"]}
                radius={18}
              />
            </View>
            <View style={styles.cashierCtaInner}>
              <View style={styles.cashierCtaIcon}>
                <Ionicons name="qr-code" size={22} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cashierCtaTitle}>{t('Show to Cashier')}</Text>
                <Text style={styles.cashierCtaSub}>
                  {t('Scan your code to top up instantly')}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color="rgba(255,255,255,0.8)"
              />
            </View>
          </Bounce>
        </Animated.View>

        <View style={styles.body}>
          {/* ── Frozen banner ── */}
          {walletFrozen && (
            <Animated.View style={sect(3)}>
              <Shake style={styles.frozenBanner}>
                <View style={styles.frozenIcon}>
                  <Ionicons
                    name="lock-closed"
                    size={20}
                    color={COLORS.danger}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.frozenTitle}>{t('Wallet Frozen')}</Text>
                  <Text style={styles.frozenText}>
                    {freezeReason
                      ? `Temporarily frozen: ${freezeReason}. Payments are paused — contact support.`
                      : "Your wallet is temporarily frozen. Payments are paused — please contact support."}
                  </Text>
                </View>
              </Shake>
            </Animated.View>
          )}

          {/* ── Top-Up Stations ── */}
          <Animated.View style={sect(4)}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionDot} />
                <Text style={styles.sectionTitle}>{t('Top-Up Stations')}</Text>
              </View>
              <View style={styles.viewToggle}>
                {["map", "list"].map((mode) => {
                  const active = viewMode === mode;
                  return (
                    <PopSel key={mode} active={active}>
                      <Bounce
                        style={[
                          styles.toggleBtn,
                          active && styles.toggleBtnActive,
                        ]}
                        onPress={() => switchView(mode)}
                        scaleTo={0.92}
                      >
                        <Ionicons
                          name={mode}
                          size={13}
                          color={active ? COLORS.white : COLORS.textMuted}
                        />
                        <Text
                          style={[
                            styles.toggleText,
                            active && styles.toggleTextActive,
                          ]}
                        >
                          {mode === "map" ? t("Map") : t("List")}
                        </Text>
                      </Bounce>
                    </PopSel>
                  );
                })}
              </View>
            </View>

            {/* In-person notice */}
            <View style={styles.noticePill}>
              <Ionicons
                name="information-circle"
                size={16}
                color={PURPLE.primary}
              />
              <Text style={styles.noticePillText}>
                Top-ups are handled in person — show your code above, or visit a
                station below.
              </Text>
            </View>

            {viewMode === "map" && (
              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  provider={
                    Platform.OS === "android" ? "google" : PROVIDER_DEFAULT
                  }
                  onMapReady={onMapReady}
                  initialCamera={{
                    center: userLocation ?? {
                      latitude: MAP_REGION.latitude,
                      longitude: MAP_REGION.longitude,
                    },
                    pitch: 45,
                    heading: 0,
                    altitude: 2400,
                    zoom: 14.5,
                  }}
                  showsBuildings
                  showsUserLocation={locPermission === "granted"}
                  showsMyLocationButton={false}
                  showsPointsOfInterest={false}
                  showsCompass={false}
                  pitchEnabled
                  rotateEnabled
                >
                  {locations.filter(hasCoords).map((loc, i) => {
                    const active = selectedStation === loc.location_id;
                    return (
                      <Marker
                        key={`marker-${loc.location_id ?? i}`}
                        coordinate={{
                          latitude: Number(loc.latitude),
                          longitude: Number(loc.longitude),
                        }}
                        onPress={() => handleMarkerPress(loc)}
                        anchor={{ x: 0.5, y: 1 }}
                        tracksViewChanges={
                          Platform.OS === "ios" ? active : true
                        }
                      >
                        <View style={styles.markerWrap}>
                          <View
                            style={[
                              styles.markerPin,
                              active && styles.markerPinActive,
                            ]}
                          >
                            <Ionicons
                              name="storefront"
                              size={15}
                              color={COLORS.white}
                            />
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

                {/* top scrim so the badge reads on any map tile */}
                <View style={styles.mapScrim} pointerEvents="none" />

                <View style={styles.stationBadge}>
                  <Ionicons name="location" size={12} color={COLORS.white} />
                  <Text style={styles.stationBadgeText}>
                    {locations.length} stations nearby
                  </Text>
                </View>

                {/* Map controls: zoom + recenter */}
                <View style={styles.mapControls}>
                  <Bounce
                    style={styles.mapCtrlBtn}
                    onPress={() => zoomBy("in")}
                  >
                    <Ionicons name="add" size={22} color={COLORS.textPrimary} />
                  </Bounce>
                  <View style={styles.mapCtrlDivider} />
                  <Bounce
                    style={styles.mapCtrlBtn}
                    onPress={() => zoomBy("out")}
                  >
                    <Ionicons
                      name="remove"
                      size={22}
                      color={COLORS.textPrimary}
                    />
                  </Bounce>
                </View>
                {locPermission === "granted" && (
                  <Bounce style={styles.myLocBtn} onPress={centerOnUser}>
                    <Ionicons name="locate" size={20} color={PURPLE.primary} />
                  </Bounce>
                )}

                {/* floating selected-station info card */}
                {(() => {
                  const sel = locations.find(
                    (l) => l.location_id === selectedStation
                  );
                  if (!sel) return null;
                  return (
                    <Reveal
                      key={`info-${sel.location_id}`}
                      style={styles.mapInfoCard}
                    >
                      <View style={styles.mapInfoIcon}>
                        <Ionicons
                          name="storefront"
                          size={18}
                          color={COLORS.white}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mapInfoName} numberOfLines={1}>
                          {sel.name}
                        </Text>
                        <Text style={styles.mapInfoAddr} numberOfLines={1}>
                          {sel.address}, {sel.city}
                        </Text>
                      </View>
                      {sel.phone ? (
                        <Bounce
                          style={styles.mapInfoCall}
                          onPress={() =>
                            Linking.openURL(`tel:${sel.phone}`).catch(() => {})
                          }
                        >
                          <Ionicons
                            name="call"
                            size={16}
                            color={COLORS.white}
                          />
                        </Bounce>
                      ) : null}
                    </Reveal>
                  );
                })()}
              </View>
            )}

            {locations.length === 0 ? (
              <View style={styles.emptyLocations}>
                <Ionicons
                  name="location-outline"
                  size={28}
                  color={COLORS.textMuted}
                />
                <Text style={styles.emptyText}>No locations found</Text>
              </View>
            ) : (
              locations.map((loc, i) => (
                <Reveal
                  key={`loc-${loc.location_id ?? i}`}
                  index={Math.min(i, 5)}
                >
                  <Bounce
                    scaleTo={0.98}
                    onPress={() => {
                      handleMarkerPress(loc);
                      switchView("map");
                    }}
                    style={[
                      styles.locationCard,
                      selectedStation === loc.location_id &&
                        styles.locationCardSelected,
                    ]}
                  >
                    <View
                      style={[
                        styles.locationIconWrap,
                        selectedStation === loc.location_id && {
                          backgroundColor: COLORS.secondary,
                        },
                      ]}
                    >
                      <Ionicons
                        name="storefront"
                        size={17}
                        color={
                          selectedStation === loc.location_id
                            ? COLORS.white
                            : PURPLE.primary
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.locationName}>{loc.name}</Text>
                      <Text style={styles.locationAddress}>
                        {loc.address}, {loc.city}
                      </Text>
                      {loc.hours ? (
                        <View style={styles.locationMetaRow}>
                          <Ionicons
                            name="time-outline"
                            size={12}
                            color={COLORS.textMuted}
                          />
                          <Text style={styles.locationMeta}>{loc.hours}</Text>
                        </View>
                      ) : null}
                      {loc.phone ? (
                        <Bounce
                          style={styles.locationMetaRow}
                          onPress={() =>
                            Linking.openURL(`tel:${loc.phone}`).catch(() => {})
                          }
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons
                            name="call-outline"
                            size={12}
                            color={PURPLE.primary}
                          />
                          <Text
                            style={[
                              styles.locationMeta,
                              styles.locationPhoneLink,
                            ]}
                          >
                            {loc.phone}
                          </Text>
                        </Bounce>
                      ) : null}
                    </View>
                    <Ionicons
                      name="navigate-circle-outline"
                      size={20}
                      color={COLORS.textMuted}
                    />
                  </Bounce>
                </Reveal>
              ))
            )}
          </Animated.View>

          {/* ── Transaction History ── */}
          <Animated.View style={[sect(5), { marginTop: 8 }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionDot} />
                <Text style={styles.sectionTitle}>Transactions</Text>
              </View>
              <Bump trigger={transactions.length}>
                <Text style={styles.txCount}>
                  {transactions.length} records
                </Text>
              </Bump>
            </View>

            {/* Filter pills */}
            <View style={styles.filterRow}>
              {TX_FILTERS.map((f) => {
                const active = txFilter === f.key;
                return (
                  <PopSel key={f.key} active={active}>
                    <Bounce
                      style={[
                        styles.filterChip,
                        active && styles.filterChipActive,
                      ]}
                      onPress={() => selectFilter(f.key)}
                      scaleTo={0.92}
                    >
                      <Ionicons
                        name={f.icon}
                        size={13}
                        color={active ? COLORS.white : COLORS.textSecondary}
                      />
                      <Text
                        style={[
                          styles.filterChipText,
                          active && styles.filterChipTextActive,
                        ]}
                      >
                        {t(f.label)}
                      </Text>
                    </Bounce>
                  </PopSel>
                );
              })}
            </View>

            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={PURPLE.primary} />
                <Text style={styles.loadingText}>Loading transactions</Text>
                <Dots color={COLORS.textMuted} />
              </View>
            ) : filteredTx.length === 0 ? (
              <View style={styles.emptyTx}>
                <Float>
                  <View style={styles.emptyTxIcon}>
                    <Ionicons
                      name="receipt-outline"
                      size={32}
                      color={PURPLE.primary}
                    />
                  </View>
                </Float>
                <Text style={styles.emptyTxText}>
                  {txFilter === "all"
                    ? "No transactions yet"
                    : "No matching transactions"}
                </Text>
                <Text style={styles.emptyTxSub}>
                  {txFilter === "credit"
                    ? "Top-ups will appear here"
                    : txFilter === "debit"
                    ? "Trip payments will appear here"
                    : "Your payment history will appear here"}
                </Text>
              </View>
            ) : (
              // key={txFilter} replays the group cascade when the filter changes
              <View key={txFilter}>
                {groupByDay(filteredTx).map((group, gi) => (
                  <Reveal
                    key={group.label}
                    index={Math.min(gi, 5)}
                    style={styles.txGroup}
                  >
                    <View style={styles.txGroupHeader}>
                      <Text style={styles.txGroupLabel}>{t(group.label)}</Text>
                      <Text
                        style={[
                          styles.txGroupTotal,
                          {
                            color:
                              group.total >= 0
                                ? COLORS.secondary
                                : COLORS.textMuted,
                          },
                        ]}
                      >
                        {group.total >= 0 ? "+" : "−"}{fmtMoney(Math.abs(group.total))}
                      </Text>
                    </View>
                    <View style={styles.txGroupCard}>
                      {group.items.map((tx, idx) => {
                        const isCredit = tx.type === "credit";
                        return (
                          <Bounce
                            key={tx.transaction_id ?? idx}
                            scaleTo={0.99}
                            onPress={() => setSelectedTx(tx)}
                            style={[
                              styles.txRow,
                              idx < group.items.length - 1 &&
                                styles.txRowDivider,
                            ]}
                          >
                            <View
                              style={[
                                styles.txIconWrap,
                                {
                                  backgroundColor: isCredit
                                    ? COLORS.secondaryLight
                                    : COLORS.dangerLight,
                                },
                              ]}
                            >
                              <Ionicons
                                name={isCredit ? "arrow-down" : "arrow-up"}
                                size={18}
                                color={
                                  isCredit ? COLORS.secondary : COLORS.danger
                                }
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.txTitle} numberOfLines={1}>
                                {t(txTitle(tx))}
                              </Text>
                              <Text style={styles.txSub} numberOfLines={1}>
                                {t(txSubtitle(tx))}
                              </Text>
                            </View>
                            <View style={{ alignItems: "flex-end" }}>
                              <Text
                                style={[
                                  styles.txAmount,
                                  {
                                    color: isCredit
                                      ? COLORS.secondary
                                      : COLORS.danger,
                                  },
                                ]}
                              >
                                {isCredit ? "+" : "-"}{fmtMoney(parseFloat(tx.amount))}
                              </Text>
                              <Text style={styles.txTime}>
                                {fmtTime(tx.created_at)}
                              </Text>
                            </View>
                          </Bounce>
                        );
                      })}
                    </View>
                  </Reveal>
                ))}
              </View>
            )}
          </Animated.View>
        </View>
      </ScrollView>

      {/* ══ Show-to-Cashier Modal ══ */}
      <Modal
        visible={showCashier}
        transparent
        animationType="fade"
        onRequestClose={closeCashier}
      >
        <Pressable style={styles.modalOverlay} onPress={closeCashier}>
          <Animated.View
            style={[
              styles.cashierCard,
              {
                opacity: cashierAnim,
                transform: [
                  {
                    scale: cashierAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.85, 1],
                    }),
                  },
                  {
                    translateY: cashierAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable>
              {/* gradient header */}
              <View style={styles.cashierHeader}>
                <GradientFill
                  id="cashierHead"
                  colors={["#6D28D9", "#8B5CF6"]}
                  radius={0}
                />
                <View style={styles.cashierHeaderRow}>
                  <Text style={styles.cashierHeaderTitle}>
                    {t('Top Up at a Counter')}
                  </Text>
                  <Bounce onPress={closeCashier} style={styles.cashierClose}>
                    <Ionicons name="close" size={18} color={COLORS.white} />
                  </Bounce>
                </View>
                <Text style={styles.cashierHeaderSub}>
                  Show this code to the cashier — they’ll scan it to add funds
                  instantly.
                </Text>
              </View>

              <View style={styles.cashierBody}>
                {/* glowing QR with sweeping scanline */}
                <View style={styles.qrShell}>
                  <Animated.View
                    style={[
                      styles.qrGlow,
                      {
                        opacity: glow.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.15, 0.5],
                        }),
                        transform: [
                          {
                            scale: glow.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.95, 1.08],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                  <View style={styles.qrBox}>
                    {qrValue ? (
                      <>
                        <QRCode
                          value={qrValue}
                          size={172}
                          color={COLORS.textPrimary}
                          backgroundColor={COLORS.white}
                        />
                        <ScanLine />
                      </>
                    ) : (
                      <View style={styles.qrPlaceholder}>
                        <Ionicons
                          name="qr-code-outline"
                          size={70}
                          color={COLORS.border}
                        />
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.cashierIdPill}>
                  <Ionicons
                    name="finger-print"
                    size={15}
                    color={PURPLE.primary}
                  />
                  <Text style={styles.cashierIdText}>
                    User ID: {userId ?? "—"}
                  </Text>
                </View>

                <View style={styles.cashierInfo}>
                  <View style={styles.cashierInfoRow}>
                    <Ionicons
                      name="person-outline"
                      size={15}
                      color={COLORS.textMuted}
                    />
                    <Text style={styles.cashierInfoText} numberOfLines={1}>
                      {userName}
                    </Text>
                  </View>
                  {user?.email ? (
                    <View style={styles.cashierInfoRow}>
                      <Ionicons
                        name="mail-outline"
                        size={15}
                        color={COLORS.textMuted}
                      />
                      <Text style={styles.cashierInfoText} numberOfLines={1}>
                        {user.email}
                      </Text>
                    </View>
                  ) : null}
                  {user?.phone ? (
                    <View style={styles.cashierInfoRow}>
                      <Ionicons
                        name="call-outline"
                        size={15}
                        color={COLORS.textMuted}
                      />
                      <Text style={styles.cashierInfoText}>{user.phone}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.cashierHintRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={14}
                    color={COLORS.textMuted}
                  />
                  <Text style={styles.cashierHint}>
                    No scanner? The cashier can search by your ID, email, or
                    phone.
                  </Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ══ Receipt Modal ══ */}
      <Modal
        visible={!!selectedTx}
        transparent
        animationType="none"
        onRequestClose={closeReceipt}
      >
        {/* backdrop fades with the sheet */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(15,23,42,0.6)", opacity: receiptAnim },
          ]}
          pointerEvents="none"
        />
        <Pressable style={styles.modalOverlayEnd} onPress={closeReceipt}>
          <Animated.View
            style={[
              styles.receiptCard,
              {
                paddingBottom: insets.bottom + 18,
                maxHeight: "92%",
                transform: [
                  {
                    translateY: receiptAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [400, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable>
              {selectedTx &&
                (() => {
                  const isCredit = selectedTx.type === "credit";
                  return (
                    <>
                      <View style={styles.sheetHandle} />

                      {/* gradient amount header */}
                      <View style={styles.receiptHeader}>
                        <GradientFill
                          id="receiptHead"
                          colors={
                            isCredit
                              ? ["#10B981", "#059669"]
                              : ["#F87171", "#DC2626"]
                          }
                          radius={22}
                        />
                        <View style={styles.receiptHeaderIcon}>
                          <Ionicons
                            name={isCredit ? "arrow-down" : "arrow-up"}
                            size={24}
                            color={COLORS.white}
                          />
                        </View>
                        <Text style={styles.receiptHeaderAmount}>
                          {isCredit ? "+" : "-"}{fmtMoney(parseFloat(selectedTx.amount))}
                        </Text>
                        <Text style={styles.receiptHeaderType}>
                          {isCredit ? "Wallet Top-Up" : "Trip Payment"}
                        </Text>
                        <View style={styles.receiptStatusPill}>
                          <Ionicons
                            name="checkmark-circle"
                            size={13}
                            color={COLORS.white}
                          />
                          <Text style={styles.receiptStatusText}>
                            Completed
                          </Text>
                        </View>
                      </View>

                      {/* detail rows — cascade in */}
                      <View style={styles.receiptDetails}>
                        {[
                          {
                            icon: "document-text-outline",
                            label: "Description",
                            value: selectedTx.description,
                          },
                          selectedTx.location_name
                            ? {
                                icon: "storefront-outline",
                                label: "Location",
                                value: selectedTx.location_name,
                              }
                            : null,
                          selectedTx.processed_by
                            ? {
                                icon: "person-circle-outline",
                                label: "Processed by",
                                value: selectedTx.processed_by,
                              }
                            : null,
                          selectedTx.tx_ref
                            ? {
                                icon: "barcode-outline",
                                label: "Reference",
                                value: selectedTx.tx_ref,
                                mono: true,
                              }
                            : null,
                          {
                            icon: "time-outline",
                            label: "Date & Time",
                            value: fmtDateTime(selectedTx.created_at),
                          },
                          selectedTx.transaction_id
                            ? {
                                icon: "receipt-outline",
                                label: "Transaction ID",
                                value: `#${selectedTx.transaction_id}`,
                                mono: true,
                              }
                            : null,
                        ]
                          .filter(Boolean)
                          .map((r, i, arr) => (
                            <Reveal key={r.label} index={i}>
                              <DetailRow
                                icon={r.icon}
                                label={r.label}
                                value={r.value}
                                mono={r.mono}
                                last={i === arr.length - 1}
                              />
                            </Reveal>
                          ))}
                      </View>

                      <View style={styles.receiptBtnRow}>
                        <Bounce
                          onPress={() => shareReceipt(selectedTx)}
                          style={styles.shareBtn}
                          scaleTo={0.95}
                        >
                          <Ionicons
                            name="share-social-outline"
                            size={18}
                            color={COLORS.white}
                          />
                          <Text style={styles.shareBtnText}>Share</Text>
                        </Bounce>
                        <Bounce
                          onPress={() => printReceipt(selectedTx)}
                          style={styles.printBtn}
                          scaleTo={0.95}
                        >
                          <Ionicons
                            name="print-outline"
                            size={18}
                            color={PURPLE.primary}
                          />
                          <Text style={styles.printBtnText}>Print PDF</Text>
                        </Bounce>
                      </View>
                      <Bounce
                        onPress={closeReceipt}
                        style={styles.receiptCloseBtn}
                        scaleTo={0.97}
                      >
                        <Text style={styles.receiptCloseText}>Close</Text>
                      </Bounce>
                    </>
                  );
                })()}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
};

const DetailRow = ({ icon, label, value, mono, last }) => (
  <View style={[styles.detailRow, last && { borderBottomWidth: 0 }]}>
    <View style={styles.detailIcon}>
      <Ionicons name={icon} size={16} color={PURPLE.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.detailValueMono]}>
        {value ?? "—"}
      </Text>
    </View>
  </View>
);

const CARD_SHADOW = {
  shadowColor: "#1E293B",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.1,
  shadowRadius: 16,
  elevation: 4,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  topTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },

  /* Balance card */
  cardWrap: { paddingHorizontal: 16, marginTop: 6 },
  card: {
    height: 210,
    borderRadius: 26,
    padding: 22,
    justifyContent: "space-between",
    shadowColor: "#6D28D9",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 10,
  },
  cardBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    overflow: "hidden",
  },
  shimmerClip: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  shimmerBand: {
    position: "absolute",
    top: -40,
    bottom: -40,
    width: 70,
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardBrand: { flexDirection: "row", alignItems: "center", gap: 10 },
  chip: {
    width: 34,
    height: 26,
    borderRadius: 6,
    backgroundColor: "#F6D38A",
    padding: 5,
    justifyContent: "space-between",
  },
  chipLine: {
    height: 2.5,
    borderRadius: 2,
    backgroundColor: "rgba(120,80,0,0.35)",
  },
  cardBrandText: {
    fontSize: 13,
    fontWeight: "800",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 1.5,
  },
  frozenChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239,68,68,0.9)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  frozenChipText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  balanceBlock: { marginTop: 4 },
  balanceLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
    marginBottom: 2,
  },
  balanceAmount: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.white,
    letterSpacing: -1,
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  cardFootLabel: {
    fontSize: 9,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 3,
  },
  cardFootValue: {
    fontSize: 14,
    color: COLORS.white,
    fontWeight: "700",
    maxWidth: SCREEN_W * 0.5,
  },

  /* Stat cards */
  statsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    ...CARD_SHADOW,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "500",
    marginTop: 1,
  },

  /* Primary action */
  actionWrap: { paddingHorizontal: 16, marginTop: 14 },
  cashierCta: {
    borderRadius: 18,
    shadowColor: "#6D28D9",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 7,
  },
  cashierCtaBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    overflow: "hidden",
  },
  cashierCtaInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  cashierCtaIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  cashierCtaTitle: { fontSize: 16, fontWeight: "800", color: COLORS.white },
  cashierCtaSub: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 },

  /* Body */
  body: { paddingHorizontal: 16, marginTop: 20 },

  /* Low-balance warning banner */
  lowBalanceBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  lowBalanceBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
    lineHeight: 17,
  },

  /* Frozen banner */
  frozenBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: COLORS.dangerLight,
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.dangerMid,
  },
  frozenIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  frozenTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.dangerDark,
    marginBottom: 3,
  },
  frozenText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },

  /* Section header */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionDot: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: PURPLE.primary,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },

  /* Notice pill */
  noticePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: PURPLE.light,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  noticePillText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },

  /* View toggle */
  viewToggle: {
    flexDirection: "row",
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 11,
    padding: 3,
    gap: 2,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleBtnActive: { backgroundColor: PURPLE.primary },
  toggleText: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted },
  toggleTextActive: { color: COLORS.white },

  /* Map */
  mapContainer: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 14,
    height: 290,
    position: "relative",
    ...CARD_SHADOW,
    shadowOpacity: 0.12,
  },
  map: { flex: 1 },
  mapScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "rgba(15,23,42,0.16)",
  },
  mapControls: {
    position: "absolute",
    top: 12,
    right: 12,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  mapCtrlBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  mapCtrlDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 6,
  },
  myLocBtn: {
    position: "absolute",
    top: 110,
    right: 12,
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  stationBadge: {
    position: "absolute",
    top: 14,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(124,58,237,0.95)",
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  stationBadgeText: { fontSize: 12, fontWeight: "700", color: COLORS.white },

  /* Custom map markers */
  markerWrap: { alignItems: "center" },
  markerPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: PURPLE.primary,
  },

  /* Floating selected-station info card on the map */
  mapInfoCard: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    ...CARD_SHADOW,
    shadowOpacity: 0.18,
  },
  mapInfoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  mapInfoName: { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary },
  mapInfoAddr: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  mapInfoCall: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: PURPLE.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Locations */
  emptyLocations: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, fontWeight: "500" },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "transparent",
    ...CARD_SHADOW,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  locationCardSelected: {
    borderColor: COLORS.secondary,
    backgroundColor: COLORS.secondaryLight,
  },
  locationIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: PURPLE.light,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  locationName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 3,
  },
  locationMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  locationMeta: { fontSize: 11, color: COLORS.textMuted },
  locationPhoneLink: { color: PURPLE.primary, fontWeight: "600" },

  /* Filter pills */
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: PURPLE.primary,
    borderColor: PURPLE.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  filterChipTextActive: { color: COLORS.white },

  /* Transactions */
  txCount: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600" },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
  },
  loadingText: { fontSize: 13, color: COLORS.textMuted, fontWeight: "500" },
  emptyTx: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyTxIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: PURPLE.light,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTxText: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  emptyTxSub: { fontSize: 13, color: COLORS.textMuted },
  txGroup: { marginBottom: 16 },
  txGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  txGroupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  txGroupTotal: { fontSize: 12, fontWeight: "800" },
  txGroupCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    paddingHorizontal: 14,
    ...CARD_SHADOW,
    shadowOpacity: 0.07,
    elevation: 2,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  txRowDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  txIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  txTitle: { fontSize: 14.5, fontWeight: "700", color: COLORS.textPrimary },
  txSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: "900" },
  txTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 3,
    fontWeight: "500",
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalOverlayEnd: { flex: 1, justifyContent: "flex-end" },

  /* Cashier modal */
  cashierCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: COLORS.white,
    borderRadius: 26,
    overflow: "hidden",
  },
  cashierHeader: { padding: 20, paddingBottom: 18, overflow: "hidden" },
  cashierHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cashierHeaderTitle: { fontSize: 18, fontWeight: "800", color: COLORS.white },
  cashierClose: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  cashierHeaderSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 18,
    marginTop: 8,
  },
  cashierBody: { padding: 22, paddingTop: 18, alignItems: "center" },
  qrShell: { alignItems: "center", justifyContent: "center", marginBottom: 18 },
  qrGlow: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 40,
    backgroundColor: PURPLE.primary,
  },
  qrBox: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...CARD_SHADOW,
  },
  qrPlaceholder: {
    width: 172,
    height: 172,
    alignItems: "center",
    justifyContent: "center",
  },
  scanClip: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    bottom: 16,
    overflow: "hidden",
    borderRadius: 4,
  },
  scanLine: {
    height: 2.5,
    borderRadius: 2,
    backgroundColor: PURPLE.primary,
    opacity: 0.55,
    shadowColor: PURPLE.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  cashierIdPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PURPLE.light,
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  cashierIdText: { fontSize: 14, fontWeight: "800", color: PURPLE.primary },
  cashierInfo: {
    alignSelf: "stretch",
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 14,
    gap: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  cashierInfoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cashierInfoText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textPrimary,
    flex: 1,
  },
  cashierHintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    alignSelf: "stretch",
  },
  cashierHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 17,
    flex: 1,
  },

  /* Receipt sheet */
  receiptCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 34,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: 14,
  },
  receiptHeader: {
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 18,
  },
  receiptHeaderIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  receiptHeaderAmount: {
    fontSize: 40,
    fontWeight: "900",
    color: COLORS.white,
    letterSpacing: -0.8,
  },
  receiptHeaderType: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
    marginTop: 2,
  },
  receiptStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  receiptStatusText: { fontSize: 12, fontWeight: "700", color: COLORS.white },
  receiptDetails: {
    backgroundColor: COLORS.background,
    borderRadius: 18,
    paddingHorizontal: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: PURPLE.light,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textMuted,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
    lineHeight: 19,
  },
  detailValueMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "600",
    fontSize: 13,
  },
  receiptBtnRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  receiptCloseBtn: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  receiptCloseText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PURPLE.primary,
    borderRadius: 16,
    paddingVertical: 15,
  },
  shareBtnText: { fontSize: 15, fontWeight: "800", color: COLORS.white },
  printBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PURPLE.light,
    borderWidth: 1.5,
    borderColor: PURPLE.midStrong,
    borderRadius: 16,
    paddingVertical: 15,
  },
  printBtnText: { fontSize: 15, fontWeight: "800", color: PURPLE.primary },
});

export default WalletScreen;
