import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Alert, StatusBar, ScrollView, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';

// react-native-nfc-manager requires a dev build; mock gracefully in Expo Go
let NfcManager = null;
let NfcTech    = null;
try {
  const nfc  = require('react-native-nfc-manager');
  NfcManager = nfc.default;
  NfcTech    = nfc.NfcTech;
} catch (_) {}

const NFC_CARD_KEY = 'linkedNfcCard';

const mockScanNfc = () =>
  new Promise((resolve) => {
    setTimeout(() => {
      const bytes = Array.from({ length: 4 }, () => Math.floor(Math.random() * 256));
      resolve(bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':'));
    }, 2200);
  });

const scanNfcTag = async () => {
  if (NfcManager) {
    await NfcManager.start();
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    await NfcManager.cancelTechnologyRequest();
    const uid = (tag?.id ?? [])
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(':');
    return uid || null;
  }
  return mockScanNfc();
};

// ── Pulse ring animation ─────────────────────────────────────────────────────
const PulseRing = ({ color }) => {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (val, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 0,    useNativeDriver: true }),
        ])
      ).start();
    pulse(ring1, 0);
    pulse(ring2, 600);
  }, []);

  const ringStyle = (val) => ({
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 2, borderColor: color,
    opacity: val.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.2, 0] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
  });

  return (
    <>
      <Animated.View style={ringStyle(ring1)} />
      <Animated.View style={ringStyle(ring2)} />
    </>
  );
};

// ── Main screen ──────────────────────────────────────────────────────────────
const NfcCardScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [linkedCard, setLinkedCard]     = useState(null);
  const [scanning, setScanning]         = useState(false);
  const [scanState, setScanState]       = useState('idle'); // idle | scanning | found | error
  const [scannedUid, setScannedUid]     = useState('');

  useEffect(() => { loadCard(); }, []);

  const loadCard = async () => {
    try {
      const raw = await AsyncStorage.getItem(NFC_CARD_KEY);
      if (raw) setLinkedCard(JSON.parse(raw));
    } catch (_) {}
  };

  const saveCard = async (card) => {
    await AsyncStorage.setItem(NFC_CARD_KEY, JSON.stringify(card));
    setLinkedCard(card);
  };

  const removeCard = () => {
    Alert.alert(
      'Remove NFC Card',
      'Are you sure you want to unlink this card? You can always link it again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(NFC_CARD_KEY);
            setLinkedCard(null);
          },
        },
      ]
    );
  };

  const startScan = async () => {
    setScanning(true);
    setScanState('scanning');
    setScannedUid('');
    try {
      const uid = await scanNfcTag();
      if (!uid) throw new Error('No tag detected');
      setScannedUid(uid);
      setScanState('found');
    } catch (err) {
      setScanState('error');
    }
  };

  const confirmLink = async () => {
    const card = {
      uid: scannedUid,
      cardNumber: `****-****-****-${Math.floor(1000 + Math.random() * 9000)}`,
      linkedAt: new Date().toISOString().split('T')[0],
      linkedTo: user?._id ?? 'guest',
      status: 'active',
    };
    await saveCard(card);
    setScanning(false);
    setScanState('idle');
    Alert.alert('Card Linked!', `NFC card ${scannedUid} is now linked to your account.`);
  };

  const cancelScan = async () => {
    try {
      if (NfcManager) await NfcManager.cancelTechnologyRequest().catch(() => {});
    } catch (_) {}
    setScanning(false);
    setScanState('idle');
  };

  const formatUid = (uid) => uid || '—';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NFC Card</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: linkedCard ? COLORS.secondaryLight : COLORS.primaryLight }]}>
          <View style={[styles.heroIcon, { backgroundColor: linkedCard ? COLORS.secondary : COLORS.primary }]}>
            <Ionicons name="card-outline" size={36} color={COLORS.white} />
          </View>
          <Text style={styles.heroTitle}>
            {linkedCard ? 'NFC Card Linked' : 'Link Your NFC Card'}
          </Text>
          <Text style={styles.heroSub}>
            {linkedCard
              ? 'Tap your card at the bus reader to board instantly.'
              : 'Link a physical NFC card to your account for contactless boarding.'}
          </Text>
        </View>

        {/* How it works */}
        {!linkedCard && (
          <View style={styles.howCard}>
            <Text style={styles.howTitle}>How it works</Text>
            {[
              { icon: 'card-outline',      text: 'Get a Yalla Transit NFC card from any top-up station.' },
              { icon: 'phone-portrait-outline', text: 'Tap "Link Card" and hold the card to your phone.' },
              { icon: 'bus-outline',       text: 'At the bus door, tap your card on the reader to board.' },
            ].map((s, i) => (
              <View key={i} style={styles.howStep}>
                <View style={styles.howNum}>
                  <Text style={styles.howNumText}>{i + 1}</Text>
                </View>
                <View style={[styles.howIconWrap, { backgroundColor: COLORS.primaryLight }]}>
                  <Ionicons name={s.icon} size={18} color={COLORS.primary} />
                </View>
                <Text style={styles.howText}>{s.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Linked card display */}
        {linkedCard && (
          <View style={styles.cardDisplay}>
            {/* Physical card visualisation */}
            <View style={styles.cardVisual}>
              <View style={styles.cardChip}>
                <Ionicons name="radio-outline" size={20} color={COLORS.white} />
              </View>
              <Text style={styles.cardNumber}>{linkedCard.cardNumber}</Text>
              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.cardFooterLabel}>CARD UID</Text>
                  <Text style={styles.cardFooterValue}>{formatUid(linkedCard.uid)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.cardFooterLabel}>LINKED</Text>
                  <Text style={styles.cardFooterValue}>{linkedCard.linkedAt}</Text>
                </View>
              </View>
            </View>

            {/* Status row */}
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Active · Ready to board</Text>
            </View>

            {/* Info rows */}
            <View style={styles.infoBlock}>
              {[
                { label: 'Card UID',   value: formatUid(linkedCard.uid) },
                { label: 'Card No.',   value: linkedCard.cardNumber },
                { label: 'Linked on', value: linkedCard.linkedAt },
                { label: 'Status',    value: 'Active' },
              ].map(({ label, value }) => (
                <View key={label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{label}</Text>
                  <Text style={styles.infoValue}>{value}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.removeBtn} onPress={removeCard} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
              <Text style={styles.removeBtnText}>Remove Card</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Link button */}
        {!linkedCard && (
          <TouchableOpacity style={styles.linkBtn} onPress={startScan} activeOpacity={0.85}>
            <Ionicons name="scan-outline" size={20} color={COLORS.white} />
            <Text style={styles.linkBtnText}>Link NFC Card</Text>
          </TouchableOpacity>
        )}

        {linkedCard && (
          <TouchableOpacity style={styles.relinkBtn} onPress={startScan} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
            <Text style={styles.relinkBtnText}>Replace Card</Text>
          </TouchableOpacity>
        )}

        <View style={styles.noteBanner}>
          <Ionicons name="shield-checkmark-outline" size={15} color={COLORS.secondary} />
          <Text style={styles.noteText}>
            Your NFC card is encrypted and linked only to your account. It cannot be used on another account.
          </Text>
        </View>
      </ScrollView>

      {/* Scan modal */}
      <Modal visible={scanning} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {scanState === 'scanning' && (
              <>
                <View style={styles.scanCircleWrap}>
                  <PulseRing color={COLORS.primary} />
                  <View style={styles.scanCircle}>
                    <Ionicons name="card-outline" size={44} color={COLORS.primary} />
                  </View>
                </View>
                <Text style={styles.modalTitle}>Ready to Scan</Text>
                <Text style={styles.modalSub}>Hold your NFC card flat against the back of your phone.</Text>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={cancelScan}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {scanState === 'found' && (
              <>
                <View style={[styles.scanCircle, { backgroundColor: COLORS.secondaryLight }]}>
                  <Ionicons name="checkmark-circle" size={52} color={COLORS.secondary} />
                </View>
                <Text style={styles.modalTitle}>Card Detected!</Text>
                <View style={styles.uidBox}>
                  <Text style={styles.uidLabel}>Card UID</Text>
                  <Text style={styles.uidValue}>{scannedUid}</Text>
                </View>
                <TouchableOpacity style={styles.confirmBtn} onPress={confirmLink} activeOpacity={0.85}>
                  <Text style={styles.confirmBtnText}>Link This Card</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={cancelScan}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {scanState === 'error' && (
              <>
                <View style={[styles.scanCircle, { backgroundColor: COLORS.dangerLight }]}>
                  <Ionicons name="alert-circle" size={52} color={COLORS.danger} />
                </View>
                <Text style={styles.modalTitle}>Scan Failed</Text>
                <Text style={styles.modalSub}>Could not detect a card. Make sure NFC is enabled and the card is compatible.</Text>
                <TouchableOpacity style={styles.confirmBtn} onPress={startScan} activeOpacity={0.85}>
                  <Text style={styles.confirmBtnText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={cancelScan}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },

  body: { padding: 20, paddingBottom: 48 },

  /* Hero */
  hero: {
    borderRadius: 20, padding: 24, alignItems: 'center',
    marginBottom: 20,
  },
  heroIcon: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  heroTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  heroSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21 },

  /* How it works */
  howCard: {
    backgroundColor: COLORS.background, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 16, marginBottom: 20,
  },
  howTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 14 },
  howStep: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  howNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  howNumText: { fontSize: 11, fontWeight: '800', color: COLORS.white },
  howIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  howText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },

  /* Card display */
  cardDisplay: { marginBottom: 16 },
  cardVisual: {
    backgroundColor: COLORS.primary,
    borderRadius: 20, padding: 22,
    marginBottom: 14, height: 160,
    justifyContent: 'space-between',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  cardChip: {
    width: 36, height: 28, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardNumber: {
    fontSize: 17, fontWeight: '700', color: COLORS.white,
    letterSpacing: 2, textAlign: 'center',
  },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  cardFooterLabel: { fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '700', letterSpacing: 1 },
  cardFooterValue: { fontSize: 12, color: COLORS.white, fontWeight: '700', marginTop: 2 },

  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 16,
  },
  statusDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.secondary,
  },
  statusText: { fontSize: 13, fontWeight: '600', color: COLORS.secondary },

  infoBlock: {
    backgroundColor: COLORS.background, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  infoLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  infoValue: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600' },

  removeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.dangerMid,
    borderRadius: 12, paddingVertical: 12,
    backgroundColor: COLORS.dangerLight, marginBottom: 16,
  },
  removeBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.danger },

  /* Buttons */
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 16, marginBottom: 16,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  linkBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

  relinkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.primaryMid,
    borderRadius: 12, paddingVertical: 11, marginBottom: 16,
  },
  relinkBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },

  noteBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.secondaryLight, borderRadius: 12, padding: 12,
  },
  noteText: { flex: 1, fontSize: 12, color: COLORS.secondaryDark, lineHeight: 18 },

  /* Modal */
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.white, borderRadius: 24,
    padding: 28, alignItems: 'center', width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25, shadowRadius: 24, elevation: 16,
  },
  scanCircleWrap: {
    width: 140, height: 140,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  scanCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  modalSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  uidBox: {
    backgroundColor: COLORS.background, borderRadius: 12,
    padding: 14, width: '100%', alignItems: 'center', marginBottom: 20,
  },
  uidLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  uidValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary, letterSpacing: 2 },
  confirmBtn: {
    width: '100%', backgroundColor: COLORS.primary,
    borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginBottom: 10,
  },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  modalCancelBtn: { paddingVertical: 8 },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
});

export default NfcCardScreen;
