import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, FlatList,
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  Animated, Dimensions, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { COLORS, PURPLE } from '../../constants/colors';
import PressableScale from '../../components/common/PressableScale';
import GradientFill from '../../components/common/GradientFill';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Quick reply chip definitions ──────────────────────────────────────────────
const QUICK_REPLIES = [
  { id: 'balance',  label: 'My Balance',   icon: 'wallet-outline'       },
  { id: 'find_bus', label: 'Find a Bus',   icon: 'bus-outline'           },
  { id: 'report',   label: 'Report Issue', icon: 'flag-outline'          },
  { id: 'ticket',   label: 'My Ticket',    icon: 'qr-code-outline'       },
  { id: 'help',     label: 'Help',         icon: 'help-circle-outline'   },
];

// ── Bot response engine (mock — replace with API call when backend is ready) ──
function buildBotResponse(input, ctx) {
  const msg = (typeof input === 'string' ? input : '').toLowerCase().trim();

  if (msg === 'balance' || msg.includes('balance') || msg.includes('wallet') || msg.includes('money')) {
    return (
      `Your current wallet balance is **${ctx.currency} ${Number(ctx.walletBalance).toFixed(2)}**.\n\n` +
      `• Minimum top-up: **${ctx.currency} ${ctx.walletLimits.minTopup}**\n` +
      `• Max per transaction: **${ctx.currency} ${ctx.walletLimits.maxTopup}**\n` +
      `• Max wallet balance: **${ctx.currency} ${ctx.walletLimits.maxBalance}**\n\n` +
      `Go to the **Wallet** tab to top up or view your transaction history.`
    );
  }

  if (msg === 'find_bus' || msg.includes('bus') || msg.includes('route') || msg.includes('find')) {
    return (
      `I can help you find the right bus!\n\n` +
      `• **Trip Planner** — enter origin & destination\n` +
      `• **Nearby Stops** — see stops closest to you\n` +
      `• **Home screen** — browse all available buses\n\n` +
      `What's your destination?`
    );
  }

  if (msg === 'report' || msg.includes('complaint') || msg.includes('report') || msg.includes('issue')) {
    return (
      `To file a complaint or report an issue:\n\n` +
      `1. Go to **Profile** tab\n` +
      `2. Tap **My Complaints**\n` +
      `3. Press **+** to file a new one\n\n` +
      `You can report driver behaviour, bus conditions, delays, or other issues. Staff review within **24 hours**.`
    );
  }

  if (msg === 'ticket' || msg.includes('ticket') || msg.includes('qr')) {
    return (
      `Your tickets are in the **Wallet** tab. Each ticket has a **QR code** that the driver scans when you board.\n\n` +
      `• Tickets are valid for one trip\n` +
      `• Show the QR to the driver before boarding\n` +
      `• Check Wallet → Transactions for your history`
    );
  }

  if (msg.includes('trip') || msg.includes('booking') || msg === 'next_trip') {
    return (
      `Your trips and bookings are in the **Trips** tab.\n\n` +
      `• View past trips & details\n` +
      `• Check ticket & booking status\n` +
      `• Rate your driver after each trip\n` +
      `• Cancel upcoming bookings\n\n` +
      `Need help with a specific trip?`
    );
  }

  if (msg.includes('top up') || msg.includes('topup') || msg.includes('recharge')) {
    return (
      `To top up your wallet:\n\n` +
      `1. Open the **Wallet** tab\n` +
      `2. Tap **Top Up**\n` +
      `3. Enter an amount between **${ctx.currency} ${ctx.walletLimits.minTopup}** and **${ctx.currency} ${ctx.walletLimits.maxTopup}**\n\n` +
      `You can also top up at any authorised Yalla Transit agent.`
    );
  }

  if (msg.includes('cancel')) {
    return (
      `To cancel a booking:\n\n` +
      `1. Go to **Trips** tab\n` +
      `2. Find the booking\n` +
      `3. Tap **Cancel Booking**\n\n` +
      `Taxi reservations can be cancelled up to **30 minutes** before pickup.`
    );
  }

  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    const h = new Date().getHours();
    const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return (
      `${greet}, **${ctx.userName}**!\n\n` +
      `I'm your Yalla Transit assistant. Ask me anything about:\n\n` +
      `• **Wallet & balance**\n• **Bus routes & schedules**\n• **Tickets & bookings**\n• **Complaints & support**`
    );
  }

  if (msg === 'help' || msg.includes('help') || msg.includes('support')) {
    return (
      `Here's what I can help with:\n\n` +
      `• **My Balance** — wallet balance & top-up info\n` +
      `• **Find a Bus** — routes, schedules, nearby stops\n` +
      `• **Report Issue** — complaints & feedback\n` +
      `• **My Ticket** — how to use your QR ticket\n` +
      `• **Trips** — bookings, history, ratings\n\n` +
      `Or reach support directly:\n` +
      `📞 **${ctx.supportPhone}**\n✉️ **${ctx.supportEmail}**`
    );
  }

  return (
    `I'm still learning, but I'm here to help!\n\n` +
    `Try asking me about:\n` +
    `• Your wallet balance\n• Finding a bus route\n• Filing a complaint\n• Your tickets\n\n` +
    `For urgent help: **${ctx.supportPhone}**`
  );
}

// ── Typing indicator (3-dot bounce) ──────────────────────────────────────────
const TypingIndicator = () => {
  const dots = [useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current];

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

// ── Inline markdown renderer (bold + line breaks) ─────────────────────────────
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
  <ScrollView horizontal showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.chipsRow}
    keyboardShouldPersistTaps="handled"
  >
    {QUICK_REPLIES.map(q => (
      <PressableScale key={q.id} style={styles.chip} scaleTo={0.92} onPress={() => onSelect(q.id, q.label)}>
        <Ionicons name={q.icon} size={13} color={PURPLE.onLight} style={{ marginRight: 5 }} />
        <Text style={styles.chipText}>{q.label}</Text>
      </PressableScale>
    ))}
  </ScrollView>
);

// ── Main chatbot modal ────────────────────────────────────────────────────────
let _msgId = 1;
const mkId = () => String(_msgId++);

const WELCOME = (userName) => ({
  id: mkId(),
  role: 'bot',
  text:
    `Hi **${userName || 'there'}**! I'm your **Yalla Transit** assistant.\n\n` +
    `I can help with your wallet, bus routes, tickets, and complaints.\n` +
    `What can I do for you today?`,
});

const ChatbotScreen = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { walletBalance, walletLimits, currency, supportPhone, supportEmail } = useApp();
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [typing, setTyping]     = useState(false);
  const [showChips, setShowChips] = useState(true);
  const listRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Slide in when opened
  useEffect(() => {
    if (visible) {
      setMessages([WELCOME(user?.full_name ?? user?.name)]);
      setShowChips(true);
      Animated.spring(slideAnim, {
        toValue: 1, useNativeDriver: true,
        tension: 60, friction: 11,
      }).start();
    } else {
      slideAnim.setValue(0);
      setInput('');
      setTyping(false);
    }
  }, [visible]);

  const ctx = {
    walletBalance, walletLimits, currency,
    supportPhone, supportEmail,
    userName: user?.full_name ?? user?.name ?? 'there',
  };

  const sendMessage = useCallback((text) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed) return;
    setInput('');
    setShowChips(false);

    const userMsg = { id: mkId(), role: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setTyping(true);

    // Simulate AI thinking delay (1.2 – 2.0 s)
    const delay = 1200 + Math.random() * 800;
    setTimeout(() => {
      const botText = buildBotResponse(trimmed, ctx);
      setMessages(prev => [...prev, { id: mkId(), role: 'bot', text: botText }]);
      setTyping(false);
      setShowChips(true);
    }, delay);
  }, [input, ctx]);

  const handleChip = useCallback((id, label) => {
    sendMessage(id);
  }, [sendMessage]);

  const slideStyle = {
    transform: [{
      translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [700, 0] }),
    }],
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom }, slideStyle]}>
          {/* ── Header ───────────────────────────────────────────── */}
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

          {/* ── Message list ─────────────────────────────────────── */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={m => m.id}
              renderItem={({ item }) => <MessageBubble item={item} />}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
              ListFooterComponent={typing ? <TypingIndicator /> : null}
              keyboardShouldPersistTaps="handled"
            />

            {/* ── Quick reply chips ─────────────────────────────── */}
            {showChips && !typing && (
              <QuickReplies onSelect={handleChip} />
            )}

            {/* ── Input bar ─────────────────────────────────────── */}
            <View style={styles.inputBar}>
              <TextInput
                style={styles.input}
                placeholder="Ask me anything…"
                placeholderTextColor={COLORS.textMuted}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={400}
                onSubmitEditing={() => sendMessage()}
                returnKeyType="send"
                blurOnSubmit
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
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,15,35,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '88%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },

  // Header
  header: {
    height: 70,
    overflow: 'hidden',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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

  // Message list
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 10,
  },

  // Bubbles
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: SCREEN_W * 0.85,
  },
  rowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  botAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: PURPLE.primary,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
  },
  botBubble: {
    backgroundColor: PURPLE.light,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexShrink: 1,
  },
  botText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  userBubble: {
    borderRadius: 18,
    borderBottomRightRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: 'hidden',
    flexShrink: 1,
  },
  userText: {
    color: COLORS.white,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },

  // Typing indicator
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PURPLE.light,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 5,
  },
  typingDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: PURPLE.primary,
  },

  // Markdown helpers
  mdBulletRow: { flexDirection: 'row', marginVertical: 1 },
  mdBulletDot: { fontWeight: '700', color: PURPLE.primary },

  // Quick reply chips
  chipsRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PURPLE.mid,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: PURPLE.midStrong,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: PURPLE.onLight,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
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
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceAlt,
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.surfaceAlt,
  },
});

export default ChatbotScreen;
