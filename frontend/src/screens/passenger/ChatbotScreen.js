import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, FlatList,
  Platform, Pressable, ScrollView, Animated, KeyboardAvoidingView,
  Dimensions, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import apiClient from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { COLORS, PURPLE } from '../../constants/colors';
import PressableScale from '../../components/common/PressableScale';
import GradientFill from '../../components/common/GradientFill';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SHEET_MAX_H = SCREEN_H * 0.88;

// ── Quick reply chip definitions ──────────────────────────────────────────────
const QUICK_REPLIES = [
  { id: 'balance',    label: 'My Balance',    icon: 'wallet-outline'         },
  { id: 'find_bus',   label: 'Find a Bus',    icon: 'bus-outline'            },
  { id: 'book_taxi',  label: 'Book Taxi',     icon: 'car-outline'            },
  { id: 'cancel',     label: 'Cancel Booking',icon: 'close-circle-outline'   },
  { id: 'seats',      label: 'Seat Availability', icon: 'people-outline'    },
  { id: 'rate',       label: 'Rate My Trip',  icon: 'star-outline'           },
  { id: 'topup',      label: 'Top-Up Locations', icon: 'location-outline'   },
  { id: 'lost',       label: 'Lost Item',     icon: 'search-outline'         },
  { id: 'report',     label: 'Report Issue',  icon: 'flag-outline'           },
  { id: 'ticket',     label: 'My Ticket',     icon: 'qr-code-outline'        },
  { id: 'help',       label: 'Help',          icon: 'help-circle-outline'    },
];

// Quick-reply IDs map to natural-language prompts the backend understands
const CHIP_PROMPTS = {
  balance:    'What is my current wallet balance?',
  find_bus:   'Help me find a bus route',
  book_taxi:  'I want to book a private taxi',
  cancel:     'I want to cancel a booking',
  seats:      'Check seat availability on a route',
  rate:       'I want to rate my last trip',
  topup:      'Where can I top up my wallet?',
  lost:       'I lost something on the bus',
  report:     'I want to report an issue or complaint',
  ticket:     'Is my ticket valid?',
  help:       'What can you help me with?',
};

// ── Typing indicator (3-dot staggered bounce) ─────────────────────────────────
const TypingIndicator = () => {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(dot, { toValue: -7, duration: 280, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0,  duration: 280, useNativeDriver: true }),
          Animated.delay(560 - i * 140),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={styles.row}>
      <View style={styles.botAvatar}>
        <Ionicons name="sparkles" size={12} color={COLORS.white} />
      </View>
      <View style={styles.typingBubble}>
        {dots.map((dot, i) => (
          <Animated.View key={i} style={[styles.typingDot, { transform: [{ translateY: dot }] }]} />
        ))}
      </View>
    </View>
  );
};

// ── Inline markdown renderer ───────────────────────────────────────────────────
function renderInline(text, baseStyle) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <Text key={i} style={[baseStyle, { fontWeight: '700' }]}>{part.slice(2, -2)}</Text>;
    }
    return <Text key={i} style={baseStyle}>{part}</Text>;
  });
}

function MarkdownText({ text, style }) {
  const lines = String(text).split('\n');
  return (
    <View>
      {lines.map((line, idx) => {
        if (line.startsWith('• ') || line.startsWith('- ')) {
          return (
            <View key={idx} style={styles.mdBulletRow}>
              <Text style={[style, styles.mdBulletDot]}>•  </Text>
              <Text style={[style, { flex: 1 }]}>{renderInline(line.slice(2), style)}</Text>
            </View>
          );
        }
        const numMatch = line.match(/^(\d+)\. (.+)/);
        if (numMatch) {
          return (
            <View key={idx} style={styles.mdBulletRow}>
              <Text style={[style, styles.mdBulletDot]}>{numMatch[1]}.  </Text>
              <Text style={[style, { flex: 1 }]}>{renderInline(numMatch[2], style)}</Text>
            </View>
          );
        }
        if (line.trim() === '') return <View key={idx} style={{ height: 5 }} />;
        return <Text key={idx} style={style}>{renderInline(line, style)}</Text>;
      })}
    </View>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
const MessageBubble = ({ item }) => {
  const isUser = item.role === 'user';
  if (isUser) {
    return (
      <View style={[styles.row, styles.rowUser]}>
        <View style={styles.userBubble}>
          <GradientFill id={`ub-${item.id}`} colors={PURPLE.gradient} />
          <Text style={styles.userText}>{item.text}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <View style={styles.botAvatar}>
        <Ionicons name="sparkles" size={12} color={COLORS.white} />
      </View>
      <View style={styles.botBubble}>
        <MarkdownText text={item.text} style={styles.botText} />
      </View>
    </View>
  );
};

// ── Quick reply chip strip ────────────────────────────────────────────────────
const QuickReplies = ({ onSelect }) => (
  <View style={styles.chipsWrapper}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsRow}
      keyboardShouldPersistTaps="handled"
    >
      {QUICK_REPLIES.map((q, idx) => (
        <PressableScale
          key={q.id}
          style={[styles.chip, idx < QUICK_REPLIES.length - 1 && { marginRight: 8 }]}
          scaleTo={0.92}
          onPress={() => onSelect(q.id, q.label)}
        >
          <Ionicons name={q.icon} size={13} color={PURPLE.onLight} style={{ marginRight: 5 }} />
          <Text style={styles.chipText}>{q.label}</Text>
        </PressableScale>
      ))}
    </ScrollView>
  </View>
);

// ── Module-level location cache — survives modal re-opens ────────────────────
// Continuously updated by watchPositionAsync so every message gets the
// most accurate GPS fix available at that moment.
let _cachedLocation = null;
let _locationSub = null;

async function startLocationWatch() {
  try {
    const { status: existing } = await Location.getForegroundPermissionsAsync();
    const granted = existing === 'granted'
      ? true
      : (await Location.requestForegroundPermissionsAsync()).status === 'granted';
    if (!granted) return;

    // Seed with last-known position immediately (zero latency)
    const last = await Location.getLastKnownPositionAsync({});
    if (last) {
      _cachedLocation = { latitude: last.coords.latitude, longitude: last.coords.longitude };
    }

    // Watch with Highest accuracy — OS starts with network fix and automatically
    // upgrades to GPS-chip fix as satellites are acquired, keeping cache fresh.
    if (_locationSub) _locationSub.remove();
    _locationSub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Highest, distanceInterval: 5 },
      (pos) => {
        _cachedLocation = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      }
    );
  } catch { /* optional — silently ignore */ }
}

// Start watching immediately at module load so coords are ready before the first message
startLocationWatch();

// ── Main chatbot modal ────────────────────────────────────────────────────────
// Timestamp + per-call counter — stays unique even across a Fast Refresh
// reload, which would otherwise reset a plain incrementing counter back to 1
// while restored chat history (with old high ids) is still sitting in state,
// causing duplicate-key collisions in the FlatList.
let _msgSeq = 0;
const mkId = () => `${Date.now()}-${_msgSeq++}`;

const WELCOME = (userName) => ({
  id: mkId(),
  role: 'bot',
  text:
    `Hi **${userName || 'there'}**! I'm your **Yalla Transit** assistant.\n\n` +
    `I can help with your wallet, bus routes, tickets, and complaints.\n` +
    `What can I do for you today?`,
});

const ChatbotScreen = ({ visible, onClose, onAction }) => {
  const insets       = useSafeAreaInsets();
  const { user }     = useAuth();

  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const [typing,    setTyping]    = useState(false);
  const [showChips, setShowChips] = useState(true);
  const [kbHeight,  setKbHeight]  = useState(0);

  const listRef    = useRef(null);
  const inputRef   = useRef(null);
  const historyRef = useRef([]);

  // ── Keyboard height tracking ──────────────────────────────────────────────
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, ()  => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Ensure location watch is running each time the chat opens ───────────
  useEffect(() => {
    if (visible) startLocationWatch();
  }, [visible]);

  // ── Open / close ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      historyRef.current = [];
      setMessages([WELCOME(user?.full_name ?? user?.name)]);
      setShowChips(true);
      setKbHeight(0);
    } else {
      setInput('');
      setTyping(false);
    }
  }, [visible]);

  // ── Send message — calls real backend ─────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const trimmed = String(text ?? input).trim();
    if (!trimmed || typing) return;
    setInput('');
    setShowChips(false);

    const userMsg = { id: mkId(), role: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setTyping(true);

    // Snapshot history before the new message (backend handles the new message separately)
    const historySnapshot = [...historyRef.current];

    try {
      const res = await apiClient.post('/chatbot/message', {
        message:  trimmed,
        history:  historySnapshot,
        location: _cachedLocation ?? undefined,
      });

      const botText = res.data?.reply ?? "I'm having a moment — please try again.";

      // Append to history for next turn
      historyRef.current = [
        ...historySnapshot,
        { role: 'user',      content: trimmed  },
        { role: 'assistant', content: botText  },
      ].slice(-20); // keep last 10 turns

      setMessages(prev => [...prev, { id: mkId(), role: 'bot', text: botText }]);

      // If the backend returned a navigation action, forward it to the parent
      if (res.data?.action && onAction) {
        onAction(res.data.action);
      }
    } catch (err) {
      const status   = err?.response?.status;
      const serverReply = err?.response?.data?.reply; // backend may still send a friendly reply in error body
      let errText;
      if (serverReply) {
        errText = serverReply;
      } else if (status === 401 || status === 403) {
        errText = "Your session has expired. Please log out and log back in.";
      } else if (!status) {
        // No response at all — network / URL issue
        errText = "Can't reach the server. Make sure you're on the same Wi-Fi as the backend, then try again.";
      } else {
        errText = "Something went wrong on our end. Please try again in a moment.";
      }
      setMessages(prev => [...prev, { id: mkId(), role: 'bot', text: errText }]);
    } finally {
      setTyping(false);
      setShowChips(true);
    }
  }, [input, typing]);

  const handleChip = useCallback((id) => {
    Keyboard.dismiss();
    sendMessage(CHIP_PROMPTS[id] ?? id);
  }, [sendMessage]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* KeyboardAvoidingView (not manual keyboard-height math) shrinks the
          available space itself, so the sheet — sized off that space via
          flexGrow + maxHeight below — shrinks correctly on both platforms
          instead of getting shoved off-screen by the keyboard. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); onClose(); }} />

          <View style={styles.sheet}>
            {/* ── Header ─────────────────────────────────────────────── */}
            <View style={styles.header}>
              <GradientFill id="chat-hdr" colors={PURPLE.gradient} />
              <View style={styles.headerContent}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerAvatar}>
                    <Ionicons name="sparkles" size={18} color={COLORS.white} />
                  </View>
                  <View>
                    <Text style={styles.headerTitle}>Yalla Transit AI</Text>
                    <View style={styles.headerStatusRow}>
                      <View style={styles.onlineDot} />
                      <Text style={styles.headerSub}>Online · Ready to help</Text>
                    </View>
                  </View>
                </View>
                <PressableScale onPress={onClose} scaleTo={0.88} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={COLORS.white} />
                </PressableScale>
              </View>
            </View>

            {/* ── Message list ────────────────────────────────────────── */}
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={m => m.id}
              renderItem={({ item }) => <MessageBubble item={item} />}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
              ListFooterComponent={typing ? <TypingIndicator /> : null}
              keyboardShouldPersistTaps="handled"
            />

            {/* ── Quick reply chips ─────────────────────────────────── */}
            {showChips && !typing && <QuickReplies onSelect={handleChip} />}

            {/* ── Input bar ────────────────────────────────────────── */}
            <View style={[styles.inputBar, { paddingBottom: kbHeight > 0 ? 10 : Math.max(insets.bottom, 10) }]}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Ask me anything…"
                placeholderTextColor={COLORS.textMuted}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={400}
                returnKeyType="send"
                blurOnSubmit
                onSubmitEditing={() => sendMessage()}
              />
              <PressableScale
                onPress={() => sendMessage()}
                scaleTo={0.88}
                style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                disabled={!input.trim()}
              >
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  {input.trim() && <GradientFill id="send-btn" colors={PURPLE.gradient} />}
                </View>
                <Ionicons name="send" size={17} color={input.trim() ? COLORS.white : COLORS.textMuted} />
              </PressableScale>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  kav: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,15,35,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    // flexGrow fills whatever room KeyboardAvoidingView leaves above the
    // keyboard; maxHeight caps it at 88% of the screen when the keyboard
    // is closed (or absent) so the sheet doesn't fill the whole screen.
    flexGrow: 1,
    flexShrink: 1,
    maxHeight: SHEET_MAX_H,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: { height: 70, overflow: 'hidden' },
  headerContent: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  onlineDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#34D399', marginRight: 5,
  },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Message list ──────────────────────────────────────────────────────────
  // flex: 1 + minHeight: 0 lets the list actually shrink to the space left
  // between the header and the input bar when the keyboard opens — without
  // it the list keeps its full content height and pushes the chips/input
  // bar (and bottom messages) past the sheet's clipped bounds.
  list: { flex: 1, minHeight: 0 },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    rowGap: 10,
  },

  // ── Bubbles ───────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: SCREEN_W * 0.85,
  },
  rowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  botAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: PURPLE.primary,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginBottom: 2,
  },
  botBubble: {
    backgroundColor: PURPLE.light,
    borderRadius: 18, borderBottomLeftRadius: 5,
    paddingHorizontal: 14, paddingVertical: 10,
    flexShrink: 1,
  },
  botText: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 20 },
  userBubble: {
    borderRadius: 18, borderBottomRightRadius: 5,
    paddingHorizontal: 14, paddingVertical: 10,
    overflow: 'hidden', flexShrink: 1,
  },
  userText: {
    color: COLORS.white, fontSize: 14,
    lineHeight: 20, fontWeight: '500',
  },

  // ── Typing indicator ──────────────────────────────────────────────────────
  typingBubble: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: PURPLE.light,
    borderRadius: 18, borderBottomLeftRadius: 5,
    paddingHorizontal: 16, paddingVertical: 14,
    gap: 5,
  },
  typingDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: PURPLE.primary,
  },

  // ── Markdown ──────────────────────────────────────────────────────────────
  mdBulletRow: { flexDirection: 'row', marginVertical: 1 },
  mdBulletDot: { fontWeight: '700', color: PURPLE.primary },

  // ── Quick reply chips ─────────────────────────────────────────────────────
  // Explicit height wrapper prevents the flex child (FlatList) from
  // squishing the chip strip when the list is tall.
  chipsWrapper: {
    height: 54,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    justifyContent: 'center',
  },
  chipsRow: {
    paddingHorizontal: 14,
    alignItems: 'center',
    // marginRight on each chip instead of gap (more reliable on Android)
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PURPLE.mid,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: PURPLE.midStrong,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: PURPLE.onLight },

  // ── Input bar ─────────────────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 10,
    // paddingBottom set dynamically based on kbHeight / safeArea
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 11 : 11,
    paddingBottom: Platform.OS === 'ios' ? 11 : 9,
    fontSize: 14,
    lineHeight: 18,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceAlt,
  },
  sendBtnDisabled: { backgroundColor: COLORS.surfaceAlt },
});

export default ChatbotScreen;
