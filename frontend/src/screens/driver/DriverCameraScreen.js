import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, StatusBar, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PURPLE } from '../../constants/colors';
import { CAMERA_WS_URL } from '../../config/camera';
import { completeTripApi } from '../../api/driverApi';

// How often to grab + send a frame. Each takePictureAsync briefly freezes the
// preview, so we keep the rate modest — ~2.5 fps is smooth for the driver and
// plenty for the time-based drowsiness / distraction thresholds.
const FRAME_INTERVAL_MS = 400;
const REST_URL          = CAMERA_WS_URL.replace(/^ws/i, 'http');

// AI state → how the driver should see it
const STATE_UI = {
  focused:        { label: 'Focused',        color: COLORS.secondary, icon: 'checkmark-circle' },
  drowsy:         { label: 'Drowsiness',     color: COLORS.danger,    icon: 'alert-circle' },
  phone_detected: { label: 'Phone Use',      color: COLORS.danger,    icon: 'phone-portrait' },
  distracted:     { label: 'Distracted',     color: COLORS.warning,   icon: 'eye-off' },
  seatbelt_off:   { label: 'Seatbelt Off',   color: COLORS.warning,   icon: 'shield-outline' },
  no_face:        { label: 'No Face',        color: COLORS.textMuted, icon: 'help-circle' },
  unknown:        { label: 'Starting…',      color: COLORS.textMuted, icon: 'time-outline' },
};

const DriverCameraScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { tripId, busId, routeName } = route.params || {};

  const [permission, requestPermission] = useCameraPermissions();
  const [wsState,  setWsState]  = useState('connecting'); // connecting | live | offline
  const [frames,   setFrames]   = useState(0);
  const [aiState,  setAiState]  = useState('unknown');
  const [ending,   setEnding]   = useState(false);

  const cameraRef    = useRef(null);
  const wsRef        = useRef(null);
  const capturingRef = useRef(false);
  const loopRef      = useRef(null);
  const endedRef     = useRef(false);   // intentional teardown (End Trip / unmount)

  // ── Frame capture + send loop ───────────────────────────────────────────────
  const captureAndSend = useCallback(async () => {
    if (endedRef.current) return;
    const ws = wsRef.current;
    if (!cameraRef.current || !ws || ws.readyState !== WebSocket.OPEN || capturingRef.current) {
      return;
    }
    capturingRef.current = true;
    try {
      const pic = await cameraRef.current.takePictureAsync({
        base64: true,
        // The server downscales to ~720px anyway, so a lighter JPEG here cuts
        // upload latency without losing detail the AI would have used.
        quality: 0.4,
        // Keep processing ON for both iOS and Android: it bakes the correct
        // orientation into the pixels. The server decodes with cv2.imdecode,
        // which ignores EXIF orientation — so skipping processing would feed the
        // AI a rotated frame on either platform and break face detection.
        skipProcessing: false,
        shutterSound: false,
      });
      if (pic?.base64 && ws.readyState === WebSocket.OPEN && !endedRef.current) {
        ws.send(pic.base64);
        setFrames(f => f + 1);
      }
    } catch {
      // transient capture error — next tick retries
    } finally {
      capturingRef.current = false;
    }
  }, []);

  // ── WebSocket lifecycle ─────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (endedRef.current || !busId) return;
    setWsState('connecting');
    const url = `${CAMERA_WS_URL}/ws/bus/${encodeURIComponent(busId)}/driver/ingest`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen    = () => { if (!endedRef.current) setWsState('live'); };
    ws.onerror   = () => { if (!endedRef.current) setWsState('offline'); };
    ws.onclose   = () => {
      if (endedRef.current) return;
      setWsState('offline');
      setTimeout(connect, 1500); // auto-reconnect while the trip is active
    };
  }, [busId]);

  useEffect(() => {
    endedRef.current = false;
    connect();
    loopRef.current = setInterval(captureAndSend, FRAME_INTERVAL_MS);
    return () => {
      endedRef.current = true;
      clearInterval(loopRef.current);
      wsRef.current?.close();
    };
  }, [connect, captureAndSend]);

  // ── Poll the AI's read on this driver (their own feedback) ───────────────────
  useEffect(() => {
    if (!busId) return;
    let active = true;
    const id = setInterval(async () => {
      try {
        const res = await fetch(
          `${REST_URL}/api/bus/${encodeURIComponent(busId)}/driver/status`,
          { signal: AbortSignal.timeout(1500) },
        );
        if (res.ok && active) {
          const d = await res.json();
          setAiState(d?.state || 'unknown');
        }
      } catch { /* server warming up */ }
    }, 1500);
    return () => { active = false; clearInterval(id); };
  }, [busId]);

  // ── End trip ────────────────────────────────────────────────────────────────
  const handleEndTrip = () => {
    Alert.alert('End Trip', `Stop the camera and mark ${routeName || 'this trip'} as completed?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Trip', style: 'destructive', onPress: async () => {
          setEnding(true);
          endedRef.current = true;
          clearInterval(loopRef.current);
          wsRef.current?.close();
          try {
            if (tripId) await completeTripApi(tripId);
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.error || 'Could not complete the trip.');
          } finally {
            setEnding(false);
            navigation.goBack();
          }
        },
      },
    ]);
  };

  // ── Permission gate ─────────────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.center}><ActivityIndicator size="large" color={PURPLE.primary} /></View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={[styles.center, { padding: 28 }]}>
        <Ionicons name="camera-outline" size={56} color={PURPLE.primary} />
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permText}>
          Yalla Transit uses your phone camera as the in-cab safety camera while you drive.
          The live feed is shared with the control center for your safety.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 14 }}>
          <Text style={styles.permSkip}>Not now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ui = STATE_UI[aiState] || STATE_UI.unknown;
  const conn = wsState === 'live'
    ? { text: '● LIVE',       color: COLORS.secondary }
    : wsState === 'connecting'
    ? { text: '◉ CONNECTING', color: COLORS.warning }
    : { text: '○ OFFLINE',    color: COLORS.danger };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Live preview — must stay mounted for frames to be captured.
          animateShutter={false} removes the per-capture flash that makes the
          preview glitch while we stream frames. */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        animateShutter={false}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <View style={styles.connPill}>
          <Text style={[styles.connText, { color: conn.color }]}>{conn.text}</Text>
        </View>
        <Text style={styles.topTitle} numberOfLines={1}>{routeName || 'Active Trip'}</Text>
        <View style={styles.connPill}>
          <Ionicons name="videocam" size={13} color={COLORS.white} />
          <Text style={styles.framesText}>{frames}</Text>
        </View>
      </View>

      {/* AI status card */}
      <View style={[styles.aiCard, { borderColor: ui.color }]}>
        <Ionicons name={ui.icon} size={22} color={ui.color} />
        <View style={{ flex: 1 }}>
          <Text style={styles.aiLabel}>AI Safety Monitor</Text>
          <Text style={[styles.aiState, { color: ui.color }]}>{ui.label}</Text>
        </View>
        <View style={styles.streamHint}>
          <Ionicons name="cloud-upload-outline" size={13} color="rgba(255,255,255,0.7)" />
          <Text style={styles.streamHintText}>Streaming to control center</Text>
        </View>
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 18 }]}>
        <TouchableOpacity
          style={[styles.endBtn, ending && { opacity: 0.6 }]}
          onPress={handleEndTrip}
          disabled={ending}
          activeOpacity={0.85}
        >
          {ending
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <Ionicons name="stop-circle" size={22} color={COLORS.white} />}
          <Text style={styles.endBtnText}>{ending ? 'Ending…' : 'End Trip & Stop Camera'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  connPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  connText:   { fontSize: 11, fontWeight: '800' },
  framesText: { fontSize: 11, fontWeight: '700', color: COLORS.white },
  topTitle:   { flex: 1, textAlign: 'center', color: COLORS.white, fontSize: 14, fontWeight: '800' },

  aiCard: {
    position: 'absolute', top: '42%', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(15,23,42,0.82)', borderRadius: 16, borderWidth: 2,
    padding: 14,
  },
  aiLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  aiState: { fontSize: 18, fontWeight: '900', marginTop: 2 },
  streamHint: { alignItems: 'flex-end', maxWidth: 110 },
  streamHintText: { fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textAlign: 'right', marginTop: 2 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  endBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.danger, borderRadius: 16, paddingVertical: 17,
    shadowColor: COLORS.danger, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  endBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },

  permTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginTop: 16 },
  permText:  { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  permBtn:   { backgroundColor: PURPLE.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, marginTop: 22 },
  permBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
  permSkip:  { color: COLORS.textMuted, fontWeight: '700', fontSize: 14 },
});

export default DriverCameraScreen;
