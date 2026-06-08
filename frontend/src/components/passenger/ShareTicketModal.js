import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, Alert, useColorScheme, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { File, Paths } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import ShareTicketCard from './ShareTicketCard';
import { COLORS } from '../../constants/colors';

// ── Main modal ────────────────────────────────────────────────────────────────
const ShareTicketModal = ({ visible, onClose, booking, ticket, passengerName, user, boardingQr }) => {
  const insets    = useSafeAreaInsets();
  const scheme    = useColorScheme();
  const isDark    = scheme === 'dark';
  const cardRef   = useRef(null);
  const slideAnim = useRef(new Animated.Value(600)).current;

  const [generating, setGenerating] = useState(false);

  // Animate sheet in/out
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 600,
      useNativeDriver: true,
      tension: 65, friction: 11,
    }).start();
  }, [visible]);

  // ── Capture card as PNG → embed in A4 PDF → share ────────────────────────
  const handleSharePdf = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) throw new Error('Sharing not available on this device');

      const imgUri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });

      const bus     = booking?.bus ?? {};
      const seat    = ticket?.seat_number ?? booking?.seatId ?? '—';
      const dateStr = booking?.date
        ? new Date(booking.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';

      const html = `<!DOCTYPE html><html><head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: ${isDark ? '#0F172A' : '#F1F5F9'}; display: flex;
                 justify-content: center; padding: 24pt; font-family: -apple-system, sans-serif; }
          .card { max-width: 380pt; width: 100%; }
          img { width: 100%; height: auto; display: block; border-radius: 16pt; }
          footer { text-align: center; margin-top: 18pt;
                   font-size: 9pt; color: #94A3B8; }
        </style>
      </head><body>
        <div class="card">
          <img src="${imgUri}" />
          <footer>Yalla Transit — Official Digital Ticket · ${bus.name || ''} · Seat ${seat} · ${dateStr}</footer>
        </div>
      </body></html>`;

      const { uri: tempUri } = await Print.printToFileAsync({ html, base64: false, width: 595, height: 842 });

      // Move the auto-named temp file to a readable filename before sharing
      const busName  = (bus.name || 'Ticket').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
      const dateSlug = booking?.date ? new Date(booking.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      const filename = `${busName}_Seat${seat}_${dateSlug}.pdf`;
      const namedFile = new File(Paths.cache, filename);
      new File(tempUri).move(namedFile);

      await Sharing.shareAsync(namedFile.uri, {
        mimeType:    'application/pdf',
        dialogTitle: `Save Ticket PDF — Seat ${seat}`,
        UTI:         'com.adobe.pdf',
      });
    } catch (err) {
      Alert.alert('Could not share PDF', err?.message || 'Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [isDark, booking, ticket, generating]);

  // ── Auto-share as PDF the moment the sheet is visible ────────────────────
  const autoSharedRef = useRef(false);
  useEffect(() => {
    if (!visible) { autoSharedRef.current = false; return; }
    if (autoSharedRef.current) return;
    autoSharedRef.current = true;
    const t = setTimeout(() => { handleSharePdf(); }, 350);
    return () => clearTimeout(t);
  }, [visible, handleSharePdf]);

  const bgModal = isDark ? '#0F172A' : COLORS.white;
  const bgCard  = isDark ? '#1E293B' : COLORS.background;
  const txPri   = isDark ? COLORS.white : COLORS.textPrimary;
  const txSec   = isDark ? 'rgba(255,255,255,0.6)' : COLORS.textSecondary;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: bgModal, paddingBottom: insets.bottom + 16 },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : COLORS.border }]} />

        {/* Header */}
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: txPri }]}>Share Ticket</Text>
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: bgCard }]} onPress={onClose}>
            <Ionicons name="close" size={20} color={txSec} />
          </TouchableOpacity>
        </View>

        {/* Ticket card preview */}
        <View style={styles.cardWrap}>
          <ShareTicketCard
            ref={cardRef}
            booking={booking}
            ticket={ticket}
            passengerName={passengerName}
            boardingQr={boardingQr}
            isDark={isDark}
          />
        </View>

        {/* Share PDF button — manual trigger / retry */}
        <View style={styles.actionWrap}>
          <TouchableOpacity
            style={[styles.pdfBtn, generating && { opacity: 0.6 }]}
            onPress={handleSharePdf}
            disabled={generating}
            activeOpacity={0.8}
          >
            {generating
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Ionicons name="document-outline" size={20} color={COLORS.white} />
            }
            <Text style={styles.pdfBtnText}>{generating ? 'Generating PDF…' : 'Share as PDF'}</Text>
          </TouchableOpacity>

          <View style={styles.boardingNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.secondary} />
            <Text style={[styles.boardingNoteText, { color: txSec }]}>
              The QR code in this PDF can be used for boarding — anyone holding it can scan in.
            </Text>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
};

export default ShareTicketModal;

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '93%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  modalTitle: { fontSize: 19, fontWeight: '800' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  cardWrap: { paddingHorizontal: 16, marginBottom: 16 },
  actionWrap: { paddingHorizontal: 16 },
  pdfBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.danger,
    borderRadius: 16, paddingVertical: 16,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  pdfBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  boardingNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 14, paddingHorizontal: 4,
  },
  boardingNoteText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
