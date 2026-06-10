import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, Platform, StatusBar, Animated, ActivityIndicator,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { scanQrApi } from '../../api/driverApi';

const PassengerVerifyScreen = ({ navigation }) => {
  const headerInsets = useHeaderInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null); // 'valid' | 'invalid'
  const [scanData, setScanData]     = useState(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const scanAnim  = useRef(new Animated.Value(0)).current;
  const [scanCount, setScanCount]   = useState(0);

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

  const showResult = (valid, data = null) => {
    setResult(valid ? 'valid' : 'invalid');
    setScanData(data);
    setScanned(true);
    Animated.spring(scaleAnim, { toValue: 1, tension: 55, useNativeDriver: true }).start();
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || loading) return;
    setLoading(true);
    try {
      const response = await scanQrApi(data);
      showResult(true, response.data);
    } catch (err) {
      const msg = err?.response?.data?.message ?? 'Invalid or expired QR code';
      showResult(false, { errorMessage: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setScanned(false);
    setResult(null);
    setScanData(null);
    scaleAnim.setValue(0);
    setScanCount(c => c + 1);
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />
        <View style={[styles.permHeader, headerInsets]}>
          <TouchableOpacity style={styles.topBackBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.permHeaderTitle}>Scan QR Ticket</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.permBody}>
          <View style={styles.permIconWrap}>
            <Ionicons name="camera-outline" size={42} color={COLORS.primary} />
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
          <Text style={styles.topSub}>{scanCount} scanned this trip</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Scanner viewfinder */}
      <View style={styles.viewfinderWrap}>
        <View style={styles.viewfinder}>
          {/* Corners */}
          <View style={[styles.corner, styles.cTL]} />
          <View style={[styles.corner, styles.cTR]} />
          <View style={[styles.corner, styles.cBL]} />
          <View style={[styles.corner, styles.cBR]} />

          {/* Scan line */}
          {!scanned && (
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]} />
          )}

          {/* Result overlay */}
          {scanned && result && (
            <Animated.View style={[
              styles.resultOverlay,
              { backgroundColor: result === 'valid' ? 'rgba(16,185,129,0.92)' : 'rgba(239,68,68,0.92)' },
              { transform: [{ scale: scaleAnim }] },
            ]}>
              <Ionicons
                name={result === 'valid' ? 'checkmark-circle' : 'close-circle'}
                size={52}
                color={COLORS.white}
              />
              <Text style={styles.resultTitle}>
                {result === 'valid' ? 'Valid Ticket' : 'Invalid Ticket'}
              </Text>
              <Text style={styles.resultSub}>
                {result === 'valid' ? 'Allow boarding' : 'Deny boarding'}
              </Text>
            </Animated.View>
          )}
        </View>

        {/* Hint */}
        <Text style={styles.scanHint}>
          {scanned ? '' : 'Align the QR code inside the frame'}
        </Text>
      </View>

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={COLORS.white} size="small" />
            <Text style={styles.hintText}>Verifying…</Text>
          </View>
        )}

        {scanned && result === 'valid' && scanData && (
          <View style={styles.ticketInfoCard}>
            <View style={styles.ticketInfoRow}>
              <Ionicons name="person-outline" size={14} color={COLORS.primary} />
              <Text style={styles.ticketInfoLabel}>Passenger</Text>
              <Text style={styles.ticketInfoVal}>{scanData.passenger?.name ?? '—'}</Text>
            </View>
            <View style={styles.ticketInfoDivider} />
            <View style={styles.ticketInfoRow}>
              <Ionicons name="ticket-outline" size={14} color={COLORS.secondary} />
              <Text style={styles.ticketInfoLabel}>Seat</Text>
              <Text style={styles.ticketInfoVal}>{scanData.passenger?.seat_number ?? '—'}</Text>
            </View>
            <View style={styles.ticketInfoDivider} />
            <View style={styles.ticketInfoRow}>
              <Ionicons name="cash-outline" size={14} color={COLORS.secondary} />
              <Text style={styles.ticketInfoLabel}>Fare</Text>
              <Text style={styles.ticketInfoVal}>
                {scanData.fare_deducted ? `$${scanData.amount_deducted?.toFixed(2)} deducted` : '—'}
              </Text>
            </View>
          </View>
        )}

        {scanned && result === 'invalid' && scanData?.errorMessage && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={14} color="#FCA5A5" />
            <Text style={styles.errorText}>{scanData.errorMessage}</Text>
          </View>
        )}

        {scanned ? (
          <TouchableOpacity style={styles.nextBtn} onPress={handleReset}>
            <Ionicons name="refresh" size={16} color={COLORS.white} />
            <Text style={styles.nextBtnText}>Scan Next Passenger</Text>
          </TouchableOpacity>
        ) : !loading ? (
          <View style={styles.hintRow}>
            <Ionicons name="qr-code-outline" size={14} color='rgba(255,255,255,0.6)' />
            <Text style={styles.hintText}>Camera auto-detects QR codes</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },

  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },

  /* Header */
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 16, right: 16,
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
  topSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '500' },

  /* Viewfinder */
  viewfinderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  viewfinder: {
    width: 230, height: 230, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: COLORS.primary, borderWidth: 3 },
  cTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 5 },
  cTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 5 },
  cBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 5 },
  cBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 5 },
  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 2,
    backgroundColor: COLORS.primary, opacity: 0.85,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 4,
  },
  scanHint: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 18, fontWeight: '500' },

  /* Result */
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 4, gap: 6,
  },
  resultTitle: { fontSize: 17, fontWeight: '900', color: COLORS.white },
  resultSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },

  /* Bottom */
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    padding: 18,
    paddingBottom: Platform.OS === 'ios' ? 38 : 22,
    alignItems: 'center', gap: 10,
  },
  ticketInfoCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    width: '100%',
  },
  ticketInfoRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  ticketInfoLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600', flex: 1 },
  ticketInfoVal: { fontSize: 14, fontWeight: '800', color: COLORS.white },
  ticketInfoDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 12 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14, width: '100%', justifyContent: 'center',
  },
  nextBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.white },
  hintRow:    { flexDirection: 'row', alignItems: 'center', gap: 7 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hintText:   { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500' },
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, width: '100%',
  },
  errorText: { flex: 1, color: '#FCA5A5', fontSize: 12, fontWeight: '600' },

  /* Permission */
  permHeader: {
    backgroundColor: COLORS.headerBg,
    paddingBottom: 18, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  permHeaderTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  permBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  permTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  permSub: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  permBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  permBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.white },
});

export default PassengerVerifyScreen;
