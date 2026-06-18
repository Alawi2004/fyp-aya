import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
  Animated,
  Easing,
  LayoutAnimation,
  UIManager,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import SeatPicker from "../../components/passenger/SeatPicker";
import Card from "../../components/common/Card";
import GradientFill from "../../components/common/GradientFill";
import FadeInView from "../../components/common/FadeInView";
import PressableScale from "../../components/common/PressableScale";
import CountUp from "../../components/common/CountUp";
import { useApp } from "../../context/AppContext";
import { createBookingApi } from "../../api/bookingApi";
import { getBusDetailsApi } from "../../api/busApi";
import { COLORS, PURPLE } from "../../constants/colors";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const csvToSeats = (csv) =>
  String(csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const animateLayout = () =>
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

/* ────────────────────────── animation helpers ──────────────────────────
   All native-driver, module-level so they never remount with re-renders. */

/** Spring-pop on mount — used for the selected-seat chips. */
const PopIn = ({ style, children }) => {
  const scale = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [scale]);
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
    scale.setValue(0.65);
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

/** Horizontal shake on mount — key it to replay. */
const Shake = ({ style, children }) => {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(x, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(x, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(x, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(x, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [x]);
  const translateX = x.interpolate({
    inputRange: [-1, 1],
    outputRange: [-7, 7],
  });
  return (
    <Animated.View style={[style, { transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
};

/** Slow scale pulse — the Book Now CTA when it's actionable. */
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

/** Pulsing opacity — the origin dot on the journey row. */
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

/** Glides side to side — the little bus travelling the journey line. */
const Shuttle = ({ style, children }) => {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(x, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [-5, 5],
  });
  return (
    <Animated.View style={[style, { transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
};

const BookingScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { bus } = route.params;
  const { walletBalance, updateBalance, addBooking, refreshBookings, currency, exchangeRate, fmtMoney, t } =
    useApp();
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(false);

  const heroAnim = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(heroAnim, {
      toValue: 1,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();
    Animated.sequence([
      Animated.delay(150),
      Animated.spring(barAnim, {
        toValue: 1,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroAnim, barAnim]);

  // The `bus` passed in via navigation comes from the buses list, which can
  // go stale the moment another passenger books a seat. Re-fetch the trip's
  // live seat map every time this screen gains focus so booked seats stay
  // in sync with the DB instead of showing whatever was true when the list
  // was last loaded.
  const [bookedSeats, setBookedSeats] = useState(() =>
    csvToSeats(bus.bookedSeatsCsv)
  );
  const [totalSeats, setTotalSeats] = useState(bus.totalSeats);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getBusDetailsApi(bus._id)
        .then((res) => {
          if (cancelled || !res.data) return;
          setBookedSeats(csvToSeats(res.data.bookedSeatsCsv));
          setTotalSeats(res.data.totalSeats ?? bus.totalSeats);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [bus._id])
  );

  const unitPrice = parseFloat(bus.price);
  const totalPrice = selectedSeats.length * unitPrice;
  const insufficientBalance =
    selectedSeats.length > 0 && walletBalance < totalPrice;
  const shortfall = Math.max(0, totalPrice - walletBalance);
  const availableSeats = totalSeats - bookedSeats.length;
  const canBook = selectedSeats.length > 0 && !insufficientBalance;

  const handleSeatsChange = (seats) => {
    animateLayout();
    setSelectedSeats(seats);
  };

  const handleConfirm = async () => {
    if (selectedSeats.length === 0) {
      Alert.alert(
        "No Seat Selected",
        "Please choose at least one seat to continue."
      );
      return;
    }
    if (insufficientBalance) {
      Alert.alert(
        "Insufficient Balance",
        `You need ${fmtMoney(totalPrice)} for ${
          selectedSeats.length
        } seat(s) but only have ${fmtMoney(walletBalance)} in your wallet.`,
        [
          {
            text: "Top Up Wallet",
            onPress: () => navigation.navigate("Wallet"),
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }
    const seatLabel =
      selectedSeats.length === 1
        ? `seat ${selectedSeats[0]}`
        : `${selectedSeats.length} seats (${selectedSeats.join(", ")})`;
    Alert.alert(
      "Confirm Booking",
      `Book ${seatLabel} on ${bus.name} for ${fmtMoney(totalPrice)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setLoading(true);
            try {
              const res = await createBookingApi({
                trip_id: bus._id,
                seats: selectedSeats,
              });
              const { tickets, total, newBalance } = res.data;
              const newBooking = {
                _id: tickets[0]?.ticket_id?.toString() ?? Date.now().toString(),
                bus,
                tickets,
                seatId: tickets[0]?.seat_number,
                seats: tickets.map((t) => t.seat_number),
                price: total,
                date: tickets[0]?.created_at ?? new Date().toISOString(),
                status: "upcoming",
              };
              addBooking(newBooking);
              updateBalance(newBalance);
              refreshBookings(); // sync "Upcoming Trips" with the DB-confirmed booking
              navigation.replace("Ticket", { booking: newBooking });
            } catch (err) {
              const msg =
                err?.response?.data?.error ||
                "Something went wrong. Please try again.";
              Alert.alert("Booking Failed", msg);
              // Someone may have grabbed the seat first (409 conflict) — refresh
              // the live seat map so the picker reflects what's actually free now.
              animateLayout();
              setSelectedSeats([]);
              getBusDetailsApi(bus._id)
                .then((res) => {
                  if (!res.data) return;
                  setBookedSeats(csvToSeats(res.data.bookedSeatsCsv));
                  setTotalSeats(res.data.totalSeats ?? bus.totalSeats);
                })
                .catch(() => {});
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
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

  const bookButton = (
    <PressableScale
      style={[styles.bookBtn, !canBook && styles.bookBtnDisabled]}
      onPress={() => {
        if (!loading) handleConfirm();
      }}
      scaleTo={0.96}
    >
      {canBook && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill
            id="bookBtn"
            colors={["#6D28D9", "#8B5CF6"]}
            vertical={false}
          />
        </View>
      )}
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.white} />
      ) : (
        <>
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color={COLORS.white}
          />
          <Text style={styles.bookBtnText}>{t('Book Now')}</Text>
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
          <GradientFill id="bookingHero" colors={PURPLE.gradient} vertical />
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
            <Text style={styles.heroTitle}>{t('Book a Seat')}</Text>
            <Text style={styles.heroSub} numberOfLines={1}>
              {bus.name}
            </Text>
          </View>
          <View style={styles.heroFareChip}>
            <Ionicons name="pricetag" size={12} color={COLORS.white} />
            <Text style={styles.heroFareText}>
              {fmtMoney(unitPrice)} / seat
            </Text>
          </View>
        </Animated.View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Route Card */}
        <FadeInView index={0}>
          <View style={styles.routeCard}>
            {/* Bus header */}
            <View style={styles.busHeaderRow}>
              <View style={styles.busIcon}>
                <Ionicons name="bus" size={22} color={PURPLE.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.busName}>{bus.name}</Text>
                <Text style={styles.busRoute}>{bus.route}</Text>
              </View>
              <View style={styles.durationBadge}>
                <Ionicons
                  name="time-outline"
                  size={12}
                  color={PURPLE.primary}
                />
                <Text style={styles.durationText}>{bus.duration}</Text>
              </View>
            </View>

            {/* Journey */}
            <View style={styles.journeyWrap}>
              <View style={styles.journeyStop}>
                <Blink style={styles.journeyDotGreen} />
                <View>
                  <Text style={styles.journeyLabel}>FROM</Text>
                  <Text style={styles.journeyPlace}>{bus.origin}</Text>
                  <Text style={styles.journeyTime}>{bus.departureTime}</Text>
                </View>
              </View>

              <View style={styles.journeyCenter}>
                <View style={styles.journeyLine} />
                <Shuttle>
                  <View style={styles.journeyBusChip}>
                    <Ionicons
                      name="bus-outline"
                      size={13}
                      color={PURPLE.primary}
                    />
                  </View>
                </Shuttle>
                <View style={styles.journeyLine} />
              </View>

              <View style={[styles.journeyStop, { alignItems: "flex-end" }]}>
                <View
                  style={[
                    styles.journeyDotGreen,
                    { backgroundColor: COLORS.danger },
                  ]}
                />
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.journeyLabel}>TO</Text>
                  <Text style={styles.journeyPlace}>{bus.destination}</Text>
                  <Text style={styles.journeyTime}>{bus.arrivalTime}</Text>
                </View>
              </View>
            </View>

            {/* Price + Balance row */}
            <View style={styles.priceRow}>
              <View style={styles.priceItem}>
                <Text style={styles.priceLabel}>{t('Price / Seat')}</Text>
                <Text style={styles.priceValue}>{fmtMoney(unitPrice)}</Text>
              </View>
              <View style={styles.priceDivider} />
              <View style={styles.priceItem}>
                <Text style={styles.priceLabel}>{t('Your Balance')}</Text>
                <Text
                  style={[
                    styles.priceValue,
                    insufficientBalance && { color: COLORS.danger },
                  ]}
                >
                  {fmtMoney(walletBalance ?? 0)}
                </Text>
              </View>
            </View>

            {/* Insufficient balance warning */}
            {insufficientBalance && (
              <Shake key={shortfall}>
                <View style={styles.warningCard}>
                  <View style={styles.warningTop}>
                    <Ionicons
                      name="wallet-outline"
                      size={18}
                      color={COLORS.danger}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.warningTitle}>
                        {t('Insufficient Balance')}
                      </Text>
                      <Text style={styles.warningText}>
                        You need{" "}
                        <Text style={{ fontWeight: "800" }}>
                          {fmtMoney(shortfall)} more
                        </Text>{" "}
                        to book {selectedSeats.length} seat(s).
                      </Text>
                    </View>
                  </View>
                  <View style={styles.warningRow}>
                    <View style={styles.warningAmt}>
                      <Text style={styles.warningAmtLabel}>
                        Total ({selectedSeats.length}×)
                      </Text>
                      <Text style={styles.warningAmtVal}>
                        {fmtMoney(totalPrice)}
                      </Text>
                    </View>
                    <Ionicons
                      name="remove-outline"
                      size={14}
                      color={COLORS.textMuted}
                    />
                    <View style={styles.warningAmt}>
                      <Text style={styles.warningAmtLabel}>{t('Your Balance')}</Text>
                      <Text
                        style={[styles.warningAmtVal, { color: COLORS.danger }]}
                      >
                        {fmtMoney(walletBalance)}
                      </Text>
                    </View>
                    <Ionicons
                      name="remove-outline"
                      size={14}
                      color={COLORS.textMuted}
                    />
                    <View style={styles.warningAmt}>
                      <Text style={styles.warningAmtLabel}>Shortfall</Text>
                      <Text
                        style={[
                          styles.warningAmtVal,
                          { color: COLORS.danger, fontWeight: "900" },
                        ]}
                      >
                        {fmtMoney(shortfall)}
                      </Text>
                    </View>
                  </View>
                  <PressableScale
                    style={styles.topUpInlineBtn}
                    onPress={() => navigation.navigate("Wallet")}
                    scaleTo={0.96}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={16}
                      color={COLORS.white}
                    />
                    <Text style={styles.topUpInlineBtnText}>
                      {t('Top Up Wallet')}
                    </Text>
                  </PressableScale>
                </View>
              </Shake>
            )}
          </View>
        </FadeInView>

        {/* Seat Picker Card */}
        <FadeInView index={1}>
          <Card style={styles.seatCard}>
            <View style={styles.seatCardHeader}>
              <View>
                <Text style={styles.seatCardTitle}>{t('Choose Your Seat')}</Text>
                <Text style={styles.seatCardSub}>
                  {availableSeats} of {totalSeats} seats free
                </Text>
              </View>
              <Bump trigger={availableSeats} style={styles.seatCountBadge}>
                <Text style={styles.seatCountText}>{availableSeats} left</Text>
              </Bump>
            </View>

            {/* Legend */}
            <View style={styles.legend}>
              {[
                {
                  color: COLORS.seatAvailable,
                  label: "Available",
                  border: COLORS.secondaryMid,
                },
                {
                  color: COLORS.seatSelected,
                  label: "Selected",
                  border: PURPLE.primary,
                },
                {
                  color: COLORS.seatBooked,
                  label: "Booked",
                  border: COLORS.dangerMid,
                },
              ].map((l) => (
                <View key={l.label} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: l.color, borderColor: l.border },
                    ]}
                  />
                  <Text style={styles.legendText}>{t(l.label)}</Text>
                </View>
              ))}
            </View>

            {/* Selected seat chips */}
            {selectedSeats.length > 0 && (
              <View style={styles.selChipsRow}>
                {selectedSeats.map((s) => (
                  <PopIn key={s} style={styles.selChip}>
                    <Ionicons name="checkmark" size={11} color={COLORS.white} />
                    <Text style={styles.selChipText}>{s}</Text>
                  </PopIn>
                ))}
              </View>
            )}

            <SeatPicker
              totalSeats={totalSeats}
              bookedSeats={bookedSeats}
              onSelect={handleSeatsChange}
              multiSelect
            />
          </Card>
        </FadeInView>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Bottom Bar */}
      <Animated.View
        style={[
          styles.bottomBar,
          {
            opacity: barAnim,
            transform: [
              {
                translateY: barAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [100, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.bottomInfo}>
          <Text style={styles.bottomLabel}>{t('Seats')}</Text>
          <Bump trigger={selectedSeats.join(",")}>
            <Text style={styles.bottomValue}>
              {selectedSeats.length === 0
                ? "—"
                : selectedSeats.length === 1
                ? selectedSeats[0]
                : `${selectedSeats.length}×`}
            </Text>
          </Bump>
        </View>
        <View style={styles.bottomDivider} />
        <View style={styles.bottomInfo}>
          <Text style={styles.bottomLabel}>{t('Total')}</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <Text style={[styles.bottomValue, { color: PURPLE.primary }]}>
              {currency}{" "}
            </Text>
            <CountUp
              value={(selectedSeats.length > 0 ? totalPrice : unitPrice) * exchangeRate}
              decimals={exchangeRate >= 100 ? 0 : 2}
              style={[styles.bottomValue, { color: PURPLE.primary }]}
            />
          </View>
        </View>
        {canBook && !loading ? (
          <Breathe style={styles.bookBtnWrap}>{bookButton}</Breathe>
        ) : (
          <View style={styles.bookBtnWrap}>{bookButton}</View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },

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
  heroFareChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroFareText: { fontSize: 12, fontWeight: "800", color: COLORS.white },

  /* Route Card */
  routeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    shadowColor: PURPLE.deep,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  busHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  busIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: PURPLE.light,
    alignItems: "center",
    justifyContent: "center",
  },
  busName: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  busRoute: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: "500",
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: PURPLE.light,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  durationText: { fontSize: 12, fontWeight: "700", color: PURPLE.primary },

  /* Journey */
  journeyWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 18,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  journeyStop: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  journeyDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.secondary,
    marginTop: 16,
  },
  journeyLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  journeyPlace: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  journeyTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
    fontWeight: "500",
  },
  journeyCenter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  journeyLine: { width: 14, height: 1.5, backgroundColor: PURPLE.midStrong },
  journeyBusChip: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: PURPLE.light,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Price row */
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 14,
  },
  priceItem: { flex: 1, alignItems: "center" },
  priceLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 3,
  },
  priceDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },

  warningCard: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: COLORS.dangerMid,
    gap: 12,
  },
  warningTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  warningTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.danger,
    marginBottom: 2,
  },
  warningText: { fontSize: 12, color: COLORS.danger, lineHeight: 18 },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 10,
  },
  warningAmt: { alignItems: "center", flex: 1 },
  warningAmtLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  warningAmtVal: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  topUpInlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.danger,
    borderRadius: 11,
    paddingVertical: 12,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  topUpInlineBtnText: { fontSize: 14, fontWeight: "700", color: COLORS.white },

  /* Seat card */
  seatCard: { marginBottom: 12 },
  seatCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  seatCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  seatCardSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: "500",
  },
  seatCountBadge: {
    backgroundColor: PURPLE.light,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  seatCountText: { fontSize: 12, fontWeight: "700", color: PURPLE.primary },
  legend: { flexDirection: "row", gap: 16, marginBottom: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 14, height: 14, borderRadius: 4, borderWidth: 1.5 },
  legendText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "600" },

  /* Selected seat chips */
  selChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  selChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: PURPLE.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  selChipText: { fontSize: 12, fontWeight: "800", color: COLORS.white },

  /* Bottom bar */
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
    shadowColor: PURPLE.deep,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  bottomInfo: { alignItems: "center", minWidth: 52 },
  bottomLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
  bottomValue: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 1,
  },
  bottomDivider: { width: 1, height: 36, backgroundColor: COLORS.border },

  /* Book button */
  bookBtnWrap: { flex: 1 },
  bookBtn: {
    width: "100%",
    height: 52,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: PURPLE.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: PURPLE.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  bookBtnDisabled: {
    backgroundColor: COLORS.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  bookBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.white,
    letterSpacing: 0.2,
  },
});

export default BookingScreen;
