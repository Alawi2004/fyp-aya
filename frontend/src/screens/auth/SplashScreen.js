import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect, Circle } from 'react-native-svg';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { COLORS, PURPLE } from '../../constants/colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BRAND = PURPLE.gradient;

// ── SVG gradient fill that measures its own box (matches Login/Register) ──────
const GradientFill = ({ id, colors, vertical = false }) => {
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((p) => (p.w === width && p.h === height ? p : { w: width, h: height }));
      }}
    >
      {box.w > 0 && box.h > 0 && (
        <Svg width={box.w} height={box.h}>
          <Defs>
            <SvgGradient id={id} x1="0" y1="0" x2={vertical ? '0' : box.w} y2={box.h} gradientUnits="userSpaceOnUse">
              {colors.map((c, i) => (
                <Stop key={i} offset={`${i / (colors.length - 1)}`} stopColor={c} />
              ))}
            </SvgGradient>
          </Defs>
          <Rect x="0" y="0" width={box.w} height={box.h} fill={`url(#${id})`} />
        </Svg>
      )}
    </View>
  );
};

// ── Realistic side-view bus (vector) ─────────────────────────────────────────
const BUS_W = 230;
const BUS_H = 110;

const BusBody = () => (
  <Svg width={BUS_W} height={BUS_H} viewBox="0 0 230 110">
    <Defs>
      <SvgGradient id="busStripe" x1="0" y1="0" x2="230" y2="0" gradientUnits="userSpaceOnUse">
        {BRAND.map((c, i) => <Stop key={i} offset={`${i / (BRAND.length - 1)}`} stopColor={c} />)}
      </SvgGradient>
      <SvgGradient id="glass" x1="0" y1="0" x2="0" y2="30" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor="#DCEBFF" />
        <Stop offset="1" stopColor="#9EC5FE" />
      </SvgGradient>
    </Defs>

    {/* drop shadow */}
    <Rect x="20" y="88" width="190" height="10" rx="5" fill="rgba(0,0,0,0.18)" />

    {/* roof cap */}
    <Rect x="22" y="8" width="186" height="12" rx="6" fill="#EEF3FF" />
    {/* main body */}
    <Rect x="12" y="14" width="206" height="66" rx="18" fill="#FFFFFF" />

    {/* passenger windows */}
    <Rect x="26" y="24" width="118" height="26" rx="6" fill="url(#glass)" />
    <Rect x="59" y="24" width="5" height="26" fill="#FFFFFF" />
    <Rect x="90" y="24" width="5" height="26" fill="#FFFFFF" />
    <Rect x="121" y="24" width="5" height="26" fill="#FFFFFF" />

    {/* door */}
    <Rect x="150" y="34" width="18" height="44" rx="3" fill="#CFE0FB" />
    <Rect x="158.5" y="34" width="1.6" height="44" fill="#94A8C9" />

    {/* driver windshield */}
    <Rect x="174" y="24" width="32" height="26" rx="7" fill="url(#glass)" />

    {/* brand accent stripe */}
    <Rect x="12" y="62" width="206" height="11" fill="url(#busStripe)" />

    {/* lights */}
    <Rect x="205" y="52" width="11" height="9" rx="2.5" fill="#FDE68A" />
    <Rect x="14" y="52" width="8" height="9" rx="2.5" fill="#F87171" />

    {/* front bumper */}
    <Rect x="212" y="64" width="8" height="16" rx="3" fill="#CBD5E1" />

    {/* wheel wells (tyres are rendered as views on top) */}
    <Circle cx="62" cy="84" r="22" fill="#0F172A" />
    <Circle cx="170" cy="84" r="22" fill="#0F172A" />
  </Svg>
);

// Spinning rim that sits inside each wheel well
const Wheel = ({ left, spin }) => {
  const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={[styles.tire, { left }]}>
      <Animated.View style={[styles.rim, { transform: [{ rotate: rot }] }]}>
        <View style={styles.spoke} />
        <View style={[styles.spoke, { transform: [{ rotate: '45deg' }] }]} />
        <View style={[styles.spoke, { transform: [{ rotate: '90deg' }] }]} />
        <View style={[styles.spoke, { transform: [{ rotate: '135deg' }] }]} />
        <View style={styles.hub} />
      </Animated.View>
    </View>
  );
};

// ── Drift dust / smoke kicked up under the wheels ────────────────────────────
// Pre-baked random puffs (stable across renders). Bus faces right, so dust
// mostly flies up-and-back (to the left).
const DUST = [...Array(11)].map((_, i) => ({
  dx: -80 + Math.random() * 110,        // favour the left (trailing) side
  dy: -(18 + Math.random() * 60),       // upward
  size: 9 + Math.random() * 18,
  drift: Math.random() * 0.18,          // stagger so they don't move as one
}));

const Dust = ({ burst, offset }) => (
  <View style={[styles.dust, { transform: [{ translateX: offset }] }]} pointerEvents="none">
    {DUST.map((p, i) => {
      const inMax = Math.min(1, 0.55 + p.drift);
      return (
        <Animated.View
          key={i}
          style={[styles.puff, {
            width: p.size, height: p.size, borderRadius: p.size / 2,
            opacity: burst.interpolate({ inputRange: [0, 0.12, inMax, 1], outputRange: [0, 0.55, 0.3, 0] }),
            transform: [
              { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
              { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }) },
              { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1.6] }) },
            ],
          }]}
        />
      );
    })}
  </View>
);

const SplashScreen = ({ navigation }) => {
  const driveX = useRef(new Animated.Value(-SCREEN_W * 0.85)).current; // off-screen left
  const spin = useRef(new Animated.Value(0)).current;                  // the 360
  const hop = useRef(new Animated.Value(0)).current;                   // jump during spin
  const squash = useRef(new Animated.Value(1)).current;                // skid / landing squash
  const bob = useRef(new Animated.Value(0)).current;                   // suspension bob
  const wheelSpin = useRef(new Animated.Value(0)).current;             // wheels rolling
  const road = useRef(new Animated.Value(0)).current;                  // scrolling ground
  const dust = useRef(new Animated.Value(0)).current;                  // drift smoke burst
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(20)).current;

  const player = useAudioPlayer(require('../../../assets/sounds/pip.wav'));

  const playHorn = () => {
    try { player.seekTo(0); player.play(); } catch (e) { /* noop */ }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), 400);
  };

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});

    let navigated = false;
    const go = async () => {
      if (navigated) return;
      navigated = true;
      const seen = await AsyncStorage.getItem('hasSeenOnboarding');
      navigation.replace(seen ? 'Login' : 'Onboarding');
    };

    // Wheels + ground keep rolling the whole time the bus is on screen
    const wheelLoop = Animated.loop(
      Animated.timing(wheelSpin, { toValue: 1, duration: 650, easing: Easing.linear, useNativeDriver: true })
    );
    const roadLoop = Animated.loop(
      Animated.timing(road, { toValue: 1, duration: 480, easing: Easing.linear, useNativeDriver: true })
    );
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 360, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 360, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    wheelLoop.start();
    roadLoop.start();
    bobLoop.start();

    Animated.timing(textOpacity, { toValue: 1, duration: 600, delay: 250, useNativeDriver: true }).start();
    Animated.timing(textSlide, { toValue: 0, duration: 600, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

    const fireDust = () => {
      dust.setValue(0);
      Animated.timing(dust, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    };

    // 1) Drive in and decelerate to a stop in the middle
    Animated.timing(driveX, { toValue: 0, duration: 1250, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      .start(({ finished }) => {
        if (!finished) return;

        // 2) Skid stop: throw up dust + honk + a squash recoil
        fireDust();
        playHorn();

        Animated.sequence([
          // skid squash on the brakes
          Animated.timing(squash, { toValue: 0.86, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(squash, { toValue: 1, duration: 110, useNativeDriver: true }),
          Animated.delay(80),
          // 3) Jump + drift 360 (more dust at lift-off)
          Animated.parallel([
            Animated.timing(spin, { toValue: 1, duration: 760, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(hop, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.timing(hop, { toValue: 0, duration: 360, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            ]),
          ]),
          // 4) Land, then continue off to the right
          Animated.timing(squash, { toValue: 0.9, duration: 90, useNativeDriver: true }),
          Animated.timing(squash, { toValue: 1, duration: 110, useNativeDriver: true }),
          Animated.timing(driveX, { toValue: SCREEN_W * 0.95, duration: 760, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]).start(({ finished: done }) => { if (done) go(); });

        // a second puff right as it jumps into the drift
        setTimeout(fireDust, 300);
      });

    // Safety net in case the animation is interrupted
    const fallback = setTimeout(go, 4200);

    return () => {
      clearTimeout(fallback);
      wheelLoop.stop();
      roadLoop.stop();
      bobLoop.stop();
    };
  }, []);

  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -46] });
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const roadX = road.interpolate({ inputRange: [0, 1], outputRange: [0, -44] });

  // enough dashes to cover the screen plus one period
  const dashes = Array.from({ length: Math.ceil(SCREEN_W / 44) + 2 });

  return (
    <View style={styles.container}>
      {/* Animated gradient background (matches Login / Register) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <GradientFill id="splashBg" colors={BRAND} vertical />
        <View style={[styles.blob, styles.blobA]} />
        <View style={[styles.blob, styles.blobB]} />
        <View style={styles.blobC} />
      </View>

      {/* Stage: road + bus */}
      <View style={styles.stage}>
        {/* scrolling road */}
        <Animated.View style={[styles.road, { transform: [{ translateX: roadX }] }]}>
          {dashes.map((_, i) => <View key={i} style={styles.roadDash} />)}
        </Animated.View>

        {/* drift dust (world-space, near each wheel at the centre stop) */}
        <View style={styles.dustWrap} pointerEvents="none">
          <Dust burst={dust} offset={-53} />
          <Dust burst={dust} offset={55} />
        </View>

        {/* the bus */}
        <Animated.View
          style={[styles.bus, {
            transform: [
              { translateX: driveX },
              { translateY: bobY },
              { translateY: hopY },
              { scaleY: squash },
              { rotate: spinDeg },
            ],
          }]}
        >
          <BusBody />
          <Wheel left={42} spin={wheelSpin} />
          <Wheel left={150} spin={wheelSpin} />
        </Animated.View>
      </View>

      {/* Wordmark */}
      <Animated.View style={[styles.textWrap, { opacity: textOpacity, transform: [{ translateY: textSlide }] }]}>
        <Text style={styles.title}>Yalla Transit</Text>
        <Text style={styles.subtitle}>Smart Bus Booking & Tracking</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND[0], alignItems: 'center', justifyContent: 'center' },

  /* background blobs (same language as Login/Register) */
  blob: { position: 'absolute', borderRadius: 9999 },
  blobA: { width: 280, height: 280, top: -60, right: -80, backgroundColor: 'rgba(124,58,237,0.45)' },
  blobB: { width: 240, height: 240, top: SCREEN_H * 0.22, left: -90, backgroundColor: 'rgba(139,92,246,0.35)' },
  blobC: { width: 180, height: 180, borderRadius: 90, position: 'absolute', top: -30, left: SCREEN_W * 0.3, backgroundColor: 'rgba(255,255,255,0.06)' },

  /* stage holds the road + bus, centered vertically */
  stage: {
    width: '100%',
    height: BUS_H + 80,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
    marginBottom: 40,
  },
  road: {
    position: 'absolute',
    top: '50%',
    marginTop: 46,
    left: 0,
    flexDirection: 'row',
    gap: 22,
    paddingHorizontal: 6,
  },
  roadDash: { width: 22, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.45)' },

  bus: {
    width: BUS_W,
    height: BUS_H,
    alignSelf: 'center',
  },

  /* drift dust */
  dustWrap: {
    position: 'absolute',
    top: '50%',
    marginTop: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dust: { width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  puff: {
    position: 'absolute',
    backgroundColor: 'rgba(226,232,240,0.85)',
  },

  /* wheels */
  tire: {
    position: 'absolute',
    top: 64,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#0B1220',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rim: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spoke: {
    position: 'absolute',
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  hub: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
  },

  /* wordmark */
  textWrap: { alignItems: 'center', position: 'absolute', bottom: SCREEN_H * 0.16 },
  title: { fontSize: 36, fontWeight: '900', color: COLORS.white, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.78)', textAlign: 'center', marginTop: 8, fontWeight: '500', letterSpacing: 0.2 },
});

export default SplashScreen;
