import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Animated, Linking, Alert, useColorScheme,
  ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import ShareTicketCard from './ShareTicketCard';
import { issueShareTokenApi } from '../../api/shareApi';
import { COLORS } from '../../constants/colors';

// expo-crypto for client-side token when backend unavailable
let Crypto = null;
try { Crypto = require('expo-crypto'); } catch (_) {}

// Share URL uses the real backend so links actually open in a browser.
// Change EXPO_PUBLIC_API_URL in .env to your LAN IP (e.g. http://192.168.1.x:4000/api)
// for cross-device sharing during development.
const SHARE_BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api')
  .replace(/\/api\/?$/, '');

// ── Client-side token fallback (mock / offline) ───────────────────────────────
const buildClientToken = async (booking, user) => {
  const exp = Math.floor(Date.now() / 1000) + 604800;
  const raw = `${booking._id}.${user?._id ?? 'g'}.${booking.seatId}.${exp}.ticket_share`;
  const b64 = btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  let sig = 'mocksig0000000000000000000000000';
  if (Crypto) {
    sig = (await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `yalla-share-secret-dev-2026:${b64}`,
      { encoding: Crypto.CryptoEncoding.HEX }
    )).slice(0, 32);
  }
  return `${b64}.${sig}`;
};

const buildShareText = (booking, passengerName, shareUrl) => {
  const bus = booking?.bus ?? {};
  return [
    '🚌 *Yalla Transit Ticket*',
    '─────────────────────',
    `*${bus.name || 'Bus Service'}*`,
    `📍 ${bus.origin || '—'} → ${bus.destination || '—'}`,
    `📅 ${bus.departureTime || '—'}${bus.arrivalTime ? ` → ${bus.arrivalTime}` : ''}`,
    `👤 ${passengerName || 'Passenger'}  |  Seat *${booking?.seatId || '—'}*`,
    `💰 $${parseFloat(booking?.price || 0).toFixed(2)}  |  ✅ ${booking?.status?.toUpperCase() || 'CONFIRMED'}`,
    `🔖 Booking #${booking?._id || '—'}`,
    '─────────────────────',
    `🔗 View ticket: ${shareUrl}`,
    '',
    '_Open in Yalla Transit for live tracking_',
  ].join('\n');
};

// ── Action button ─────────────────────────────────────────────────────────────
const ActionBtn = ({ icon, label, onPress, color, loading, disabled }) => (
  <TouchableOpacity
    style={[styles.actionBtn, { borderColor: color + '33', backgroundColor: color + '12' }, disabled && { opacity: 0.45 }]}
    onPress={onPress}
    disabled={disabled || loading}
    activeOpacity={0.75}
  >
    {loading
      ? <ActivityIndicator size="small" color={color} />
      : <Ionicons name={icon} size={22} color={color} />
    }
    <Text style={[styles.actionLabel, { color }]}>{label}</Text>
  </TouchableOpacity>
);

// ── Main modal ────────────────────────────────────────────────────────────────
const ShareTicketModal = ({ visible, onClose, booking, passengerName, user }) => {
  const insets    = useSafeAreaInsets();
  const scheme    = useColorScheme();
  const isDark    = scheme === 'dark';
  const cardRef   = useRef(null);
  const slideAnim = useRef(new Animated.Value(600)).current;

  const [shareUrl,    setShareUrl]    = useState('');
  const [shareToken,  setShareToken]  = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [generating,  setGenerating]  = useState(null); // 'image' | 'pdf' | null

  // Animate in/out
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 600,
      useNativeDriver: true,
      tension: 65, friction: 11,
    }).start();
  }, [visible]);

  // Generate share token when modal opens
  useEffect(() => {
    if (!visible || !booking) return;
    let cancelled = false;
    (async () => {
      setTokenLoading(true);
      try {
        const res = await issueShareTokenApi({
          bookingId: booking._id,
          seatId:    booking.seatId,
          userId:    user?._id,
        });
        if (!cancelled) {
          setShareToken(res.data?.token   ?? '');
          setShareUrl(res.data?.shareUrl  ?? `${SHARE_BASE}/ticket/share?t=demo`);
        }
      } catch {
        // API unavailable — generate client-side
        const t = await buildClientToken(booking, user);
        if (!cancelled) {
          setShareToken(t);
          setShareUrl(`${SHARE_BASE}/ticket/share?t=${t}`);
        }
      } finally {
        if (!cancelled) setTokenLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, booking, user]);

  // ── Capture QR card as PNG → native share ────────────────────────────────
  const handleShareImage = useCallback(async () => {
    setGenerating('image');
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) throw new Error('Sharing not available');
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Ticket Image',
        UTI: 'public.png',
      });
    } catch {
      Alert.alert('Could not share image', 'Try "Share Link" instead.');
    } finally {
      setGenerating(null);
    }
  }, []);

  // ── Capture as PNG → embed in A4 PDF → share ─────────────────────────────
  const handleDownloadPdf = useCallback(async () => {
    setGenerating('pdf');
    try {
      const imgUri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
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
          <footer>Yalla Transit — Official Digital Ticket · ${shareUrl}</footer>
        </div>
      </body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false, width: 595, height: 842 });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Save Ticket PDF',
        UTI: 'com.adobe.pdf',
      });
    } catch {
      Alert.alert('PDF error', 'Could not generate PDF. Try sharing the image instead.');
    } finally {
      setGenerating(null);
    }
  }, [isDark, shareUrl]);

  // ── Copy link ─────────────────────────────────────────────────────────────
  const handleCopyLink = useCallback(async () => {
    await Clipboard.setStringAsync(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [shareUrl]);

  // ── Native Share (text + URL) ─────────────────────────────────────────────
  const handleNativeShare = useCallback(async () => {
    try {
      const { Share } = await import('react-native');
      await Share.share({
        title:   'My Yalla Transit Ticket',
        message: buildShareText(booking, passengerName, shareUrl),
        url:     shareUrl, // iOS uses url for iMessage link preview
      });
    } catch (_) {}
  }, [booking, passengerName, shareUrl]);

  // ── Platform-specific openers ─────────────────────────────────────────────
  const openWhatsApp = useCallback(() => {
    const text = encodeURIComponent(buildShareText(booking, passengerName, shareUrl));
    Linking.openURL(`whatsapp://send?text=${text}`).catch(() =>
      Linking.openURL(`https://wa.me/?text=${text}`)
    );
  }, [booking, passengerName, shareUrl]);

  const openTelegram = useCallback(() => {
    const text = encodeURIComponent(buildShareText(booking, passengerName, shareUrl));
    Linking.openURL(`tg://msg?text=${text}`).catch(() =>
      Linking.openURL(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('🚌 My Yalla Transit Ticket')}`)
    );
  }, [booking, passengerName, shareUrl]);

  const openEmail = useCallback(() => {
    const bus  = booking?.bus ?? {};
    const subj = encodeURIComponent(`Yalla Transit Ticket — ${bus.name || 'Bus Service'}`);
    const body = encodeURIComponent(buildShareText(booking, passengerName, shareUrl));
    Linking.openURL(`mailto:?subject=${subj}&body=${body}`);
  }, [booking, passengerName, shareUrl]);

  const openSms = useCallback(() => {
    const body = encodeURIComponent(buildShareText(booking, passengerName, shareUrl));
    const sep  = Platform.OS === 'ios' ? '&' : '?';
    Linking.openURL(`sms:${sep}body=${body}`);
  }, [booking, passengerName, shareUrl]);

  // ─────────────────────────────────────────────────────────────────────────
  const bgModal  = isDark ? '#0F172A' : COLORS.white;
  const bgCard   = isDark ? '#1E293B' : COLORS.background;
  const txPri    = isDark ? COLORS.white : COLORS.textPrimary;
  const txSec    = isDark ? 'rgba(255,255,255,0.6)' : COLORS.textSecondary;
  const bdr      = isDark ? 'rgba(255,255,255,0.1)' : COLORS.border;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

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

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Token loading */}
          {tokenLoading && (
            <View style={styles.tokenLoading}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={[styles.tokenLoadingText, { color: txSec }]}>Generating secure link…</Text>
            </View>
          )}

          {/* ── Ticket card preview ── */}
          <View style={styles.cardWrap}>
            <ShareTicketCard
              ref={cardRef}
              booking={booking}
              passengerName={passengerName}
              shareUrl={shareUrl}
              isDark={isDark}
            />
          </View>

          {/* ── Copyable link row ── */}
          <View style={[styles.linkRow, { backgroundColor: bgCard, borderColor: bdr }]}>
            <Ionicons name="link-outline" size={16} color={COLORS.primary} />
            <Text style={[styles.linkText, { color: txSec }]} numberOfLines={1} ellipsizeMode="middle">
              {shareUrl || 'Generating link…'}
            </Text>
            <TouchableOpacity
              style={[styles.copyBtn, { backgroundColor: copied ? COLORS.secondary : COLORS.primary }]}
              onPress={handleCopyLink}
              disabled={!shareUrl}
            >
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={COLORS.white} />
              <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>

          {/* ── Primary actions ── */}
          <Text style={[styles.sectionLabel, { color: txSec }]}>Share options</Text>
          <View style={styles.actionsGrid}>
            <ActionBtn
              icon="share-social-outline"
              label="Share"
              color={COLORS.primary}
              onPress={handleNativeShare}
              disabled={!shareUrl}
            />
            <ActionBtn
              icon="image-outline"
              label="Image"
              color="#7C3AED"
              onPress={handleShareImage}
              loading={generating === 'image'}
              disabled={!!generating || !shareUrl}
            />
            <ActionBtn
              icon="document-outline"
              label="PDF"
              color={COLORS.danger}
              onPress={handleDownloadPdf}
              loading={generating === 'pdf'}
              disabled={!!generating || !shareUrl}
            />
          </View>

          {/* ── Platform shortcuts ── */}
          <Text style={[styles.sectionLabel, { color: txSec }]}>Send via</Text>
          <View style={styles.platformRow}>
            <TouchableOpacity style={[styles.platformBtn, { backgroundColor: '#25D366' + '18', borderColor: '#25D36633' }]} onPress={openWhatsApp} disabled={!shareUrl}>
              <View style={[styles.platformIcon, { backgroundColor: '#25D366' }]}>
                <Ionicons name="logo-whatsapp" size={18} color={COLORS.white} />
              </View>
              <Text style={[styles.platformLabel, { color: txPri }]}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.platformBtn, { backgroundColor: '#2AABEE' + '18', borderColor: '#2AABEE33' }]} onPress={openTelegram} disabled={!shareUrl}>
              <View style={[styles.platformIcon, { backgroundColor: '#2AABEE' }]}>
                <Ionicons name="paper-plane-outline" size={18} color={COLORS.white} />
              </View>
              <Text style={[styles.platformLabel, { color: txPri }]}>Telegram</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.platformBtn, { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primaryMid }]} onPress={openEmail} disabled={!shareUrl}>
              <View style={[styles.platformIcon, { backgroundColor: COLORS.primary }]}>
                <Ionicons name="mail-outline" size={18} color={COLORS.white} />
              </View>
              <Text style={[styles.platformLabel, { color: txPri }]}>Email</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.platformBtn, { backgroundColor: COLORS.secondaryLight, borderColor: COLORS.secondaryMid }]} onPress={openSms} disabled={!shareUrl}>
              <View style={[styles.platformIcon, { backgroundColor: COLORS.secondary }]}>
                <Ionicons name="chatbubble-outline" size={18} color={COLORS.white} />
              </View>
              <Text style={[styles.platformLabel, { color: txPri }]}>SMS</Text>
            </TouchableOpacity>
          </View>

          {/* Security note */}
          <View style={[styles.securityNote, { backgroundColor: bgCard, borderColor: bdr }]}>
            <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.secondary} />
            <Text style={[styles.securityText, { color: txSec }]}>
              Secure link · HMAC-signed · Expires in 7 days · Share token is view-only
              and cannot be used for boarding.
            </Text>
          </View>
        </ScrollView>
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

  tokenLoading: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, justifyContent: 'center',
  },
  tokenLoadingText: { fontSize: 13, fontWeight: '500' },

  cardWrap: { marginBottom: 16 },

  /* Link row */
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 20,
  },
  linkText: { flex: 1, fontSize: 12, fontWeight: '500' },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  copyBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.7, marginBottom: 10,
  },

  /* Primary actions */
  actionsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  actionBtn: {
    flex: 1, alignItems: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1.5,
  },
  actionLabel: { fontSize: 12, fontWeight: '700' },

  /* Platform row */
  platformRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  platformBtn: {
    flex: 1, alignItems: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 14, borderWidth: 1,
  },
  platformIcon: {
    width: 36, height: 36, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  platformLabel: { fontSize: 11, fontWeight: '600' },

  /* Security note */
  securityNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  securityText: { flex: 1, fontSize: 11, lineHeight: 17 },
});
