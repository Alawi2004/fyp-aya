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
  TextInput,
  RefreshControl,
  StatusBar,
  Animated,
  Easing,
  ScrollView,
  LayoutAnimation,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import BusCard from "../../components/passenger/BusCard";
import EmptyState from "../../components/common/EmptyState";
import GradientFill from "../../components/common/GradientFill";
import FadeInView from "../../components/common/FadeInView";
import PressableScale from "../../components/common/PressableScale";
import { SkeletonCardList } from "../../components/common/Skeleton";
import CountUp from "../../components/common/CountUp";
import { getBusesApi } from "../../api/busApi";
import { getFavoriteRoutes } from "../../api/apiClient";
import { COLORS, PURPLE } from "../../constants/colors";

// setLayoutAnimationEnabledExperimental is a no-op in the New Architecture (SDK 53+)

const VEHICLE_TYPES = [
  { key: "all", label: "All", icon: "apps-outline" },
  { key: "bus", label: "Bus", icon: "bus-outline" },
  { key: "van", label: "Van", icon: "car-outline" },
  { key: "taxi", label: "Taxi", icon: "car-sport-outline" },
  { key: "tuktuk", label: "Tuktuk", icon: "bicycle-outline" },
];

const STATUS_FILTERS = ["All", "Active", "Boarding", "Delayed"];

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

/* ────────────────────────── animation helpers ──────────────────────────
   All native-driver, all defined at module level so they never remount
   with the screen's re-renders. */

/** Springs in whenever `active` flips on — selection pop for filter chips. */
const PopIn = ({ active, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) return;
    scale.setValue(0.82);
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
    scale.setValue(0.55);
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 170,
      useNativeDriver: true,
    }).start();
  }, [trigger, scale]);
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
};

/** Two expanding, fading rings around a solid dot — the "live" indicator. */
const LivePulse = () => {
  const r1 = useRef(new Animated.Value(0)).current;
  const r2 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const ring = (v) =>
      Animated.loop(
        Animated.timing(v, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      );
    const l1 = ring(r1);
    const l2 = ring(r2);
    l1.start();
    const t = setTimeout(() => l2.start(), 800);
    return () => {
      l1.stop();
      l2.stop();
      clearTimeout(t);
    };
  }, [r1, r2]);
  const ringStyle = (v) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.65, 0] }),
    transform: [
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2] }) },
    ],
  });
  return (
    <View style={styles.activeRidePulseWrap}>
      <Animated.View style={[styles.activeRidePulse, ringStyle(r1)]} />
      <Animated.View style={[styles.activeRidePulse, ringStyle(r2)]} />
      <View style={styles.activeRideDot} />
    </View>
  );
};

/** Light sweep that crosses the wallet card on a loop. */
const Shimmer = () => {
  const x = useRef(new Animated.Value(-90)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, {
          toValue: 420,
          duration: 1700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(2400),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.shimmer,
        { transform: [{ translateX: x }, { rotate: "18deg" }] },
      ]}
    />
  );
};

/** Gently waving hand next to the greeting. */
const WaveEmoji = () => {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1100),
        Animated.timing(rot, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(rot, {
          toValue: -1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(rot, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(rot, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.delay(2800),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [rot]);
  const rotate = rot.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-16deg", "16deg"],
  });
  return (
    <Animated.Text style={[styles.wave, { transform: [{ rotate }] }]}>
      👋
    </Animated.Text>
  );
};

/** Periodic bell shake on the notification button. */
const BellWiggle = ({ children }) => {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const tick = (d) =>
      Animated.timing(rot, { toValue: d, duration: 90, useNativeDriver: true });
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(4500),
        tick(1),
        tick(-1),
        tick(1),
        tick(-1),
        tick(0),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [rot]);
  const rotate = rot.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-12deg", "12deg"],
  });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      {children}
    </Animated.View>
  );
};

/* ─────────────────────────────── screen ─────────────────────────────── */

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { walletBalance, bookings, currency, exchangeRate } = useApp();

  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeType, setActiveType] = useState("all");
  const [favCount, setFavCount] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showTop, setShowTop] = useState(false);
  // Bumped on filter changes so list cards remount and replay their cascade.
  const [wave, setWave] = useState(0);

  const listRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const fabAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const heroAnims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "P";
  const firstName = (user?.name || "Passenger").split(" ")[0];

  const activeBooking = bookings?.find((b) => b.status === "upcoming");

  // ── Quick actions (deliberately the actions NOT already in the bottom tabs) ──
  const QUICK_ACTIONS = useMemo(
    () => [
      {
        key: "plan",
        label: "Plan Trip",
        icon: "git-branch",
        color: PURPLE.primary,
        bg: PURPLE.light,
        onPress: () => navigation.navigate("TripPlanner"),
      },
      {
        key: "taxi",
        label: "Reserve Taxi",
        icon: "car-sport",
        color: COLORS.warning,
        bg: COLORS.warningLight,
        onPress: () => navigation.navigate("TaxiReservation"),
      },
      {
        key: "nearby",
        label: "Nearby Stops",
        icon: "walk",
        color: COLORS.secondary,
        bg: COLORS.secondaryLight,
        onPress: () => navigation.navigate("NearbyStops"),
      },
      {
        key: "saved",
        label: "Saved",
        icon: "heart",
        color: COLORS.danger,
        bg: "#FFEBEE",
        badge: favCount,
        onPress: () =>
          navigation.navigate("ProfileStack", { screen: "FavoriteRoutes" }),
      },
    ],
    [favCount, navigation]
  );

  // ── Data ────────────────────────────────────────────────────────────────────
  const loadBuses = useCallback(async () => {
    try {
      const res = await getBusesApi();
      setBuses(res.data.buses ?? []);
    } catch {
      setBuses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadFavCount = useCallback(async () => {
    try {
      const data = await getFavoriteRoutes();
      setFavCount(Array.isArray(data) ? data.length : 0);
    } catch {
      /* best-effort */
    }
  }, []);

  useEffect(() => {
    loadBuses();
    loadFavCount();
  }, [loadBuses, loadFavCount]);


  // Hero entrance: greeting row → wallet → search, staggered springs.
  useEffect(() => {
    Animated.stagger(
      110,
      heroAnims.map((v) =>
        Animated.spring(v, {
          toValue: 1,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [heroAnims]);

  // Keep the saved-routes count fresh when returning to Home
  useFocusEffect(
    useCallback(() => {
      loadFavCount();
    }, [loadFavCount])
  );

  // Search bar focus glow
  useEffect(() => {
    Animated.spring(searchAnim, {
      toValue: searchFocused ? 1 : 0,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [searchFocused, searchAnim]);

  // Scroll-to-top FAB visibility
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => setShowTop(value > 420));
    return () => scrollY.removeListener(id);
  }, [scrollY]);

  useEffect(() => {
    Animated.spring(fabAnim, {
      toValue: showTop ? 1 : 0,
      friction: 6,
      useNativeDriver: true,
    }).start();
  }, [showTop, fabAnim]);

  // ── Filtering (pure derivation — no extra state, no extra render) ───────────
  const filtered = useMemo(() => {
    let data = buses;
    if (activeType !== "all") data = data.filter((b) => b.type === activeType);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (b) =>
          (b.name || "").toLowerCase().includes(q) ||
          (b.origin || "").toLowerCase().includes(q) ||
          (b.destination || "").toLowerCase().includes(q) ||
          (b.route || "").toLowerCase().includes(q)
      );
    }
    if (activeFilter !== "All")
      data = data.filter((b) => b.status === activeFilter.toLowerCase());
    return data;
  }, [buses, search, activeType, activeFilter]);

  // Filter taps animate the list reflow and replay the card cascade.
  const selectType = (key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveType(key);
    setWave((w) => w + 1);
  };
  const selectStatus = (f) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveFilter(f);
    setWave((w) => w + 1);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadBuses();
    loadFavCount();
  }, [loadBuses, loadFavCount]);

  const scrollToTop = () => {
    const node = listRef.current?.getNode
      ? listRef.current.getNode()
      : listRef.current;
    node?.scrollToOffset({ offset: 0, animated: true });
  };

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  // Hero decor circles drift as the list scrolls (parallax).
  const decorShift1 = scrollY.interpolate({
    inputRange: [0, 160],
    outputRange: [0, -30],
    extrapolate: "clamp",
  });
  const decorShift2 = scrollY.interpolate({
    inputRange: [0, 160],
    outputRange: [0, 22],
    extrapolate: "clamp",
  });

  const heroEntrance = (i) => ({
    opacity: heroAnims[i],
    transform: [
      {
        translateY: heroAnims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [22, 0],
        }),
      },
    ],
  });

  // ── Scrolling content above the ride list ────────────────────────────────────
  // Returned as a plain element (not a nested component) so it reconciles by
  // position on re-render — otherwise the FadeInViews would re-animate on every
  // search keystroke.
  const renderHeader = () => (
    <View>
      {/* Active ride */}
      {activeBooking && (
        <FadeInView index={0}>
          <PressableScale
            style={styles.activeRide}
            onPress={() =>
              navigation.navigate("BusTracking", {
                tripId: activeBooking.bus?._id,
                busName: activeBooking.bus?.name,
              })
            }
            scaleTo={0.98}
          >
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <GradientFill
                id="activeRide"
                colors={["#6D28D9", "#8B5CF6"]}
                vertical={false}
              />
            </View>
            <LivePulse />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeRideLabel}>ACTIVE RIDE</Text>
              <Text style={styles.activeRideName} numberOfLines={1}>
                {activeBooking.bus?.name}
              </Text>
              <Text style={styles.activeRideRoute} numberOfLines={1}>
                {activeBooking.bus?.origin} → {activeBooking.bus?.destination}
              </Text>
            </View>
            <View style={styles.activeRideTrackBtn}>
              <Ionicons name="navigate" size={15} color={COLORS.white} />
              <Text style={styles.activeRideTrackText}>Track</Text>
            </View>
          </PressableScale>
        </FadeInView>
      )}

      {/* Quick actions */}
      <FadeInView index={1}>
        <View style={styles.quickRow}>
          {QUICK_ACTIONS.map((a) => (
            <PressableScale
              key={a.key}
              style={styles.quickTile}
              onPress={a.onPress}
              scaleTo={0.93}
            >
              <View style={[styles.quickIcon, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon} size={22} color={a.color} />
                {a.badge > 0 && (
                  <Bump trigger={a.badge} style={styles.quickBadge}>
                    <Text style={styles.quickBadgeText}>
                      {a.badge > 9 ? "9+" : a.badge}
                    </Text>
                  </Bump>
                )}
              </View>
              <Text style={styles.quickLabel}>{a.label}</Text>
            </PressableScale>
          ))}
        </View>
      </FadeInView>

      {/* Vehicle type filter */}
      <FadeInView index={2}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeRow}
        >
          {VEHICLE_TYPES.map((t) => {
            const on = activeType === t.key;
            return (
              <PopIn key={t.key} active={on}>
                <PressableScale
                  style={[styles.typeChip, on && styles.typeChipOn]}
                  onPress={() => selectType(t.key)}
                  scaleTo={0.92}
                >
                  <Ionicons
                    name={t.icon}
                    size={14}
                    color={on ? COLORS.white : PURPLE.primary}
                  />
                  <Text
                    style={[styles.typeChipText, on && styles.typeChipTextOn]}
                  >
                    {t.label}
                  </Text>
                </PressableScale>
              </PopIn>
            );
          })}
        </ScrollView>
      </FadeInView>

      {/* Section header + status filter */}
      <FadeInView index={3}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Available Rides</Text>
          <Bump trigger={filtered.length} style={styles.sectionCountWrap}>
            <Text style={styles.sectionCountText}>{filtered.length} found</Text>
          </Bump>
        </View>
        <View style={styles.statusRow}>
          {STATUS_FILTERS.map((f) => {
            const on = activeFilter === f;
            return (
              <PopIn key={f} active={on}>
                <PressableScale
                  style={[styles.statusChip, on && styles.statusChipOn]}
                  onPress={() => selectStatus(f)}
                  scaleTo={0.92}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      on && styles.statusChipTextOn,
                    ]}
                  >
                    {f}
                  </Text>
                </PressableScale>
              </PopIn>
            );
          })}
        </View>
      </FadeInView>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* ── Fixed purple hero ── */}
      <View style={styles.hero}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill id="homeHero" colors={PURPLE.gradient} vertical />
          <Animated.View
            style={[
              styles.heroDecor1,
              { transform: [{ translateY: decorShift1 }] },
            ]}
          />
          <Animated.View
            style={[
              styles.heroDecor2,
              { transform: [{ translateY: decorShift2 }] },
            ]}
          />
        </View>

        <View style={{ paddingTop: insets.top + 10 }}>
          {/* Top bar */}
          <Animated.View style={[styles.heroTop, heroEntrance(0)]}>
            <View style={[styles.locationRow, { flex: 1 }]}>
              <Ionicons name="bus" size={15} color="rgba(255,255,255,0.9)" />
              <Text style={styles.brandText}>Yalla Transit</Text>
            </View>
            <PressableScale
              style={styles.iconBtn}
              onPress={() =>
                navigation.navigate("ProfileStack", { screen: "Notifications" })
              }
            >
              <BellWiggle>
                <Ionicons
                  name="notifications-outline"
                  size={21}
                  color={COLORS.white}
                />
              </BellWiggle>
              <View style={styles.notifDot} />
            </PressableScale>
            <PressableScale
              style={styles.avatar}
              onPress={() =>
                navigation.navigate("ProfileStack", { screen: "Profile" })
              }
            >
              <Text style={styles.avatarText}>{initials}</Text>
            </PressableScale>
          </Animated.View>

          {/* Wallet balance card */}
          <Animated.View style={heroEntrance(1)}>
            <PressableScale
              style={styles.walletCard}
              onPress={() => navigation.navigate("Wallet")}
              scaleTo={0.98}
            >
              <Shimmer />
              <View style={styles.walletIcon}>
                <Ionicons name="wallet" size={20} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletLabel}>Available balance</Text>
                <View style={styles.walletAmountRow}>
                  <Text style={styles.walletCurrency}>{currency}</Text>
                  <CountUp
                    value={(walletBalance ?? 0) * exchangeRate}
                    decimals={exchangeRate >= 100 ? 0 : 2}
                    style={styles.walletAmount}
                  />
                </View>
              </View>
              <View style={styles.topUpBtn}>
                <Text style={styles.topUpText}>Top Up</Text>
                <Ionicons
                  name="chevron-forward"
                  size={13}
                  color={PURPLE.dark}
                />
              </View>
            </PressableScale>
          </Animated.View>

          {/* Search */}
          <Animated.View
            style={[
              heroEntrance(2),
              {
                transform: [
                  ...heroEntrance(2).transform,
                  {
                    scale: searchAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.02],
                    }),
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.searchWrap,
                searchFocused && styles.searchWrapFocused,
              ]}
            >
              <Ionicons
                name="search-outline"
                size={18}
                color={searchFocused ? PURPLE.primary : COLORS.textMuted}
              />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search route, destination, vehicle…"
                placeholderTextColor={COLORS.textMuted}
                returnKeyType="search"
              />
              {search ? (
                <PressableScale
                  onPress={() => setSearch("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={COLORS.textMuted}
                  />
                </PressableScale>
              ) : null}
            </View>
          </Animated.View>
        </View>
      </View>

      {/* ── Ride list ── */}
      {loading ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {renderHeader()}
          <SkeletonCardList count={4} />
        </ScrollView>
      ) : (
        <Animated.FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item, index }) => (
            // key={wave} remounts the card on filter change so the cascade
            // replays; the index cap keeps deep items from waiting forever.
            <FadeInView key={wave} index={Math.min(index, 9)}>
              <BusCard
                bus={item}
                onPress={() => navigation.navigate("Booking", { bus: item })}
              />
            </FadeInView>
          )}
          ListHeaderComponent={renderHeader()}
          ListEmptyComponent={
            <FadeInView index={4}>
              <EmptyState
                icon="bus-outline"
                title="No rides found"
                message="Try a different search or filter."
                tint={PURPLE.primary}
                tintBg={PURPLE.light}
                tintGlow={PURPLE.glow}
              />
            </FadeInView>
          }
          contentContainerStyle={styles.listContent}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PURPLE.primary}
              colors={[PURPLE.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Scroll-to-top ── */}
      <Animated.View
        pointerEvents={showTop ? "auto" : "none"}
        style={[
          styles.fab,
          { bottom: insets.bottom + 22 },
          {
            opacity: fabAnim,
            transform: [
              { scale: fabAnim },
              {
                translateY: fabAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [40, 0],
                }),
              },
            ],
          },
        ]}
      >
        <PressableScale
          style={styles.fabBtn}
          onPress={scrollToTop}
          scaleTo={0.88}
        >
          <Ionicons name="arrow-up" size={22} color={COLORS.white} />
        </PressableScale>
      </Animated.View>
    </View>
  );
};

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
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -90,
    right: -60,
  },
  heroDecor2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.05)",
    bottom: -30,
    left: -40,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  brandText: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  userName: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.white,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  wave: { fontSize: 20 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F87171",
    borderWidth: 1.5,
    borderColor: PURPLE.deep,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
  },
  avatarText: { fontSize: 14, fontWeight: "900", color: COLORS.white },

  /* Wallet card */
  walletCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 18,
    padding: 12,
    marginBottom: 14,
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: -30,
    bottom: -30,
    width: 64,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  walletIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  walletLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "500",
  },
  walletAmountRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 1,
  },
  walletCurrency: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.white,
    marginTop: 2,
    marginRight: 1,
  },
  walletAmount: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  topUpBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
  },
  topUpText: { fontSize: 13, fontWeight: "800", color: PURPLE.dark },

  /* Search */
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  searchWrapFocused: { borderColor: PURPLE.primary },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: "500",
  },

  /* List */
  listContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 32 },

  /* Active ride */
  activeRide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    overflow: "hidden",
    shadowColor: PURPLE.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  activeRidePulseWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  activeRidePulse: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  activeRideDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.secondary,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  activeRideLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  activeRideName: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.white,
    marginTop: 2,
  },
  activeRideRoute: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 1,
  },
  activeRideTrackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  activeRideTrackText: { fontSize: 13, fontWeight: "700", color: COLORS.white },

  /* Quick actions */
  quickRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  quickTile: { flex: 1, alignItems: "center", gap: 8 },
  quickIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#94A3B8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  quickBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  quickBadgeText: { fontSize: 10, fontWeight: "800", color: COLORS.white },
  quickLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textAlign: "center",
  },

  /* Vehicle type pills */
  typeRow: { gap: 8, paddingBottom: 18, paddingRight: 4 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: PURPLE.midStrong,
  },
  typeChipOn: { backgroundColor: PURPLE.primary, borderColor: PURPLE.primary },
  typeChipText: { fontSize: 13, fontWeight: "700", color: PURPLE.primary },
  typeChipTextOn: { color: COLORS.white },

  /* Section header */
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  sectionCountWrap: {
    backgroundColor: PURPLE.light,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  sectionCountText: { fontSize: 12, color: PURPLE.primary, fontWeight: "700" },

  /* Status filter */
  statusRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusChipOn: { backgroundColor: PURPLE.dark, borderColor: PURPLE.dark },
  statusChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  statusChipTextOn: { color: COLORS.white },

  /* Scroll-to-top FAB */
  fab: { position: "absolute", right: 18 },
  fabBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PURPLE.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PURPLE.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});

export default HomeScreen;
