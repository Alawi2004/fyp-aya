import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, StatusBar, Animated, ActivityIndicator, ScrollView,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PURPLE } from '../../constants/colors';
import { scanQrApi } from '../../api/driverApi';

const PassengerVerifyScreen = ({ navigation, route }) => {
  const headerInsets = useHeaderInsets();
  const tripId = route?.params?.tripId ?? null;

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null); // 'valid' | 'wrong_trip' | 'invalid'
  const [scanData, setScanData] = useState(null);
  const [scanCount, setScanCount] = useState(0);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const scanAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const showResult = (type, data = null) => {
    setResult(type);
    setScanData(data);
    setScanned(true);
    Animated.spring(scaleAnim, { toValue: 1, tension: 55, useNativeDriver: true }).start();
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || loading) return;
    setLoading(true);
    try {
      const response = await scanQrApi(data, tripId);
      const body = response.data;

      if (body.valid) {
        showResult('valid', body);
        setScanCount(c => c + 1);
      } else if (body.wrong_trip) {
        showResult('wrong_trip', body);
      } else {
        showResult('invalid', body);
      }
    } catch (err) {
      const body = err?.response?.data ?? {};
      if (body.wrong_trip) {
        showResult('wrong_trip', body);
      } else {
        showResult('invalid', { message: body.message ?? 'Invalid or expired QR code', passenger: body.passenger });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setScanned(false);
    setResult(null);
    setScanData(null);
    scaleAnim.setValue(0);
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />
        <View style={[styles.permHeader, headerInsets]}>
          <TouchableOpacity style={styles.topBackBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.permHeaderTitle}>Scan QR Ticket</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.permBody}>
          <View style={styles.permIconWrap}>
            <Ionicons name="camera-outline" size={42} color={PURPLE.primary} />
          </View>
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permSub}>Enable camera permission to scan passenger boarding QR tickets.</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Ionicons name="camera" size={16} color={COLORS.white} />
            <Text style={styles.permBtnText}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const scanLineY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [-105, 105] });

  const overlayColor =
    result === 'valid'      ? 'rgba(16,185,129,0.92)' :
    result === 'wrong_trip' ? 'rgba(234,179,8,0.92)'  :
                              'rgba(239,68,68,0.92)';

  const overlayIcon =
    result === 'valid'      ? 'checkmark-circle' :
    result === 'wrong_trip' ? 'warning'           :
                              'close-circle';

  const overlayTitle =
    result === 'valid'      ? 'Valid Ticket'   :
    result === 'wrong_trip' ? 'Wrong Trip'     :
                              'Invalid Ticket';

  const overlaySub =
    result === 'valid'      ? 'Allow boarding'      :
    result === 'wrong_trip' ? 'Deny — wrong trip'   :
                              'Deny boarding';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Dark vignette */}
      <View style={styles.vignette} />

      {/* Header */}
      <View style={[styles.topHeader, { top: headerInsets.paddingTop }]}>
        <TouchableOpacity style={styles.topBackBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.topTitleWrap}>
          <Text style={styles.topTitle}>Passenger Verification</Text>
          <Text style={styles.topSub}>
            {tripId ? `Trip #${tripId} · ${scanCount} boarded` : `${scanCount} scanned`}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Scanner viewfinder */}
      <View style={styles.viewfinderWrap}>
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.cTL]} />
          <View style={[styles.corner, styles.cTR]} />
          <View style={[styles.corner, styles.cBL]} />
          <View style={[styles.corner, styles.cBR]} />

          {!scanned && (
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]} />
          )}

          {scanned && result && (
            <Animated.View style={[
              styles.resultOverlay,
              { backgroundColor: overlayColor },
              { transform: [{ scale: scaleAnim }] },
            ]}>
              <Ionicons name={overlayIcon} size={52} color={COLORS.white} />
              <Text style={styles.resultTitle}>{overlayTitle}</Text>
              <Text style={styles.resultSub}>{overlaySub}</Text>
            </Animated.View>
          )}
        </View>

        <Text style={styles.scanHint}>
          {scanned ? '' : 'Align the passenger QR code inside the frame'}
        </Text>
      </View>

      {/* Bottom panel — scrollable for rich result info */}
      <View style={styles.bottomPanel}>
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={COLORS.white} size="small" />
            <Text style={styles.hintText}>Verifying ticket…</Text>
          </View>
        )}

        {/* ── Valid ticket ── */}
        {scanned && result === 'valid' && scanData && (
          <ScrollView style={styles.resultScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.infoSection}>
              <Row icon="person-outline" color={PURPLE.primary} label="Passenger" value={scanData.passenger?.name ?? '—'} />
              <Divider />
              <Row icon="ticket-outline"   color={COLORS.secondary} label="Seat"      value={scanData.passenger?.seat_number ?? '—'} />
              <Divider />
              <Row icon="map-outline"      color={COLORS.secondary} label="Route"     value={scanData.trip?.route_name ?? '—'} />
              <Divider />
              <Row
                icon="cash-outline"
                color={COLORS.secondary}
                label="Fare"
                value={
                  scanData.fare_deducted
                    ? `$${scanData.amount_deducted?.toFixed(2)} deducted`
                    : scanData.fare_insufficient
                    ? 'Insufficient balance'
                    : '—'
                }
                valueStyle={scanData.fare_insufficient ? styles.warnVal : undefined}
              />
            </View>
          </ScrollView>
        )}

        {/* ── Wrong trip ── */}
        {scanned && result === 'wrong_trip' && scanData && (
          <ScrollView style={styles.resultScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.wrongTripBanner}>
              <Ionicons name="warning-outline" size={16} color="#FDE047" />
              <Text style={styles.wrongTripText}>
                This ticket is for Trip #{scanData.ticket?.trip_id ?? '?'}, not your current trip.
              </Text>
            </View>
            <View style={styles.infoSection}>
              <Row icon="person-outline"  color={PURPLE.primary}   label="Passenger" value={scanData.passenger?.name ?? '—'} />
              <Divider />
              <Row icon="ticket-outline"  color={COLORS.secondary} label="Seat"      value={scanData.passenger?.seat_number ?? scanData.ticket?.seat_number ?? '—'} />
              <Divider />
              <Row icon="map-outline"     color="#FBBF24"          label="Ticket Route" value={`${scanData.ticket?.start_location ?? ''} → ${scanData.ticket?.end_location ?? ''}`} />
            </View>
          </ScrollView>
        )}

        {/* ── Invalid ticket ── */}
        {scanned && result === 'invalid' && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={16} color="#FCA5A5" />
            <Text style={styles.errorText}>{scanData?.message ?? 'Invalid or expired QR code'}</Text>
          </View>
        )}

        {scanned ? (
          <TouchableOpacity style={styles.nextBtn} onPress={handleReset}>
            <Ionicons name="refresh" size={16} color={COLORS.white} />
            <Text style={styles.nextBtnText}>Scan Next Passenger</Text>
          </TouchableOpacity>
        ) : !loading ? (
          <View style={styles.hintRow}>
            <Ionicons name="qr-code-outline" size={14} color="rgba(255,255,255,0.6)" />
            <Text style={styles.hintText}>Camera auto-detects QR codes</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function Row({ icon, color, label, value, valueStyle }) {
  return (
    <View style={styles.ticketInfoRow}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={styles.ticketInfoLabel}>{label}</Text>
      <Text style={[styles.ticketInfoVal, valueStyle]}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.ticketInfoDivider} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },

  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },

  /* Header */
  topHeader: {
    position: 'absolute', top: 0, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    zIndex: 10,
  },
  topBackBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  topTitleWrap: { alignItems: 'center' },
  topTitle: { fontSize: 15, fontWeight: '800', color: COLORS.white },
  topSub:   { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '500' },

  /* Viewfinder */
  viewfinderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  viewfinder: {
    width: 230, height: 230, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: PURPLE.primary, borderWidth: 3 },
  cTL: { top: 0, left: 0,  borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 5 },
  cTR: { top: 0, right: 0, borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 5 },
  cBL: { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 5 },
  cBR: { bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0, borderBottomRightRadius: 5 },
  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 2,
    backgroundColor: PURPLE.primary, opacity: 0.85,
    shadowColor: PURPLE.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 4,
  },
  scanHint: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 18, fontWeight: '500' },

  /* Result overlay (inside viewfinder) */
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 4, gap: 6,
  },
  resultTitle: { fontSize: 17, fontWeight: '900', color: COLORS.white },
  resultSub:   { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },

  /* Bottom panel */
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 38 : 22,
    alignItems: 'center', gap: 10,
  },
  resultScroll: { width: '100%', maxHeight: 140 },

  /* Info rows */
  infoSection: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6,
  },
  ticketInfoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 8,
  },
  ticketInfoLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600', width: 64 },
  ticketInfoVal:   { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.white },
  ticketInfoDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 4 },
  warnVal: { color: '#FDE047' },

  /* Wrong-trip banner */
  wrongTripBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(234,179,8,0.18)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 10,
  },
  wrongTripText: { flex: 1, color: '#FDE047', fontSize: 12, fontWeight: '700' },

  /* Error */
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, width: '100%',
  },
  errorText: { flex: 1, color: '#FCA5A5', fontSize: 12, fontWeight: '600' },

  /* Buttons */
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PURPLE.primary, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14, width: '100%', justifyContent: 'center',
  },
  nextBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.white },
  hintRow:    { flexDirection: 'row', alignItems: 'center', gap: 7 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hintText:   { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500' },

  /* Permission screen */
  permHeader: {
    backgroundColor: PURPLE.deep,
    paddingBottom: 18, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  permHeaderTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  permBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: PURPLE.light,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  permTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  permSub:   { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  permBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PURPLE.primary, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  permBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.white },
});

export default PassengerVerifyScreen;
