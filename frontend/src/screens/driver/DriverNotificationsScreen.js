import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, StatusBar, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { getDriverNotificationsApi, markNotificationReadApi } from '../../api/driverApi';

// ── Type config ───────────────────────────────────────────────────────────────
const TYPE_CFG = {
  delay:     { icon: 'time-outline',           bg: COLORS.warningLight,  color: COLORS.warningDark,  border: COLORS.warningMid },
  emergency: { icon: 'alert-circle-outline',   bg: COLORS.dangerLight,   color: COLORS.dangerDark,   border: COLORS.dangerMid  },
  warning:   { icon: 'warning-outline',        bg: COLORS.warningLight,  color: COLORS.warning,      border: COLORS.warningMid },
  info:      { icon: 'notifications-outline',  bg: COLORS.primaryLight,  color: COLORS.primary,      border: COLORS.primaryMid },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const min = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (min < 1)  return 'Just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Notification item ─────────────────────────────────────────────────────────
function NotifItem({ item, onRead }) {
  const cfg = TYPE_CFG[item.type] ?? TYPE_CFG.info;
  return (
    <TouchableOpacity
      onPress={() => { if (!item.is_read) onRead(item.notification_id); }}
      activeOpacity={0.75}
      style={[styles.card, { borderLeftColor: cfg.color, opacity: item.is_read ? 0.7 : 1 }]}
    >
      {/* Unread dot */}
      {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}

      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
        <Ionicons name={cfg.icon} size={20} color={cfg.color} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, !item.is_read && styles.titleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        </View>
        <Text style={styles.body} numberOfLines={2}>{item.body || item.message}</Text>
        {!item.is_read && (
          <Text style={[styles.tapHint, { color: cfg.color }]}>Tap to mark as read</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function DriverNotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [notifs,    setNotifs]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const timerRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const userId = user?._id ?? user?.user_id;
      if (!userId) { setLoading(false); return; }
      const data = await getDriverNotificationsApi(userId);
      setNotifs(Array.isArray(data) ? data : []);
    } catch {
      setNotifs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(true), 30000);
    return () => clearInterval(timerRef.current);
  }, [load]);

  const handleRead = useCallback(async (id) => {
    setNotifs(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n));
    try { await markNotificationReadApi(id); } catch { /* best-effort */ }
  }, []);

  const markAllRead = () => {
    const unread = notifs.filter(n => !n.is_read);
    unread.forEach(n => handleRead(n.notification_id));
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.driverPrimary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerText}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.driverPrimary} />
          <Text style={styles.loadingText}>Loading notifications…</Text>
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={item => String(item.notification_id)}
          renderItem={({ item }) => <NotifItem item={item} onRead={handleRead} />}
          contentContainerStyle={[styles.list, notifs.length === 0 && styles.listEmpty]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={COLORS.driverPrimary}
              colors={[COLORS.driverPrimary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="notifications-off-outline" size={64} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyBody}>
                Driver updates and alerts from dispatch will appear here.
              </Text>
            </View>
          }
          ListHeaderComponent={
            notifs.length > 0 ? (
              <Text style={styles.sectionLabel}>
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.driverPrimary,
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn:      { marginRight: 8 },
  headerTitle:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText:   { fontSize: 18, fontWeight: '700', color: COLORS.white },
  badge: {
    backgroundColor: COLORS.dangerDark,
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeText:    { fontSize: 10, fontWeight: '700', color: COLORS.white },
  markAllText:  { fontSize: 12, fontWeight: '600', color: COLORS.white, opacity: 0.85 },

  list:         { padding: 16, gap: 10 },
  listEmpty:    { flex: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderLeftWidth: 3,
    shadowColor: '#1E293B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute', top: 12, right: 12,
    width: 8, height: 8, borderRadius: 4,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, flexShrink: 0,
  },
  content:      { flex: 1 },
  titleRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title:        { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, flex: 1, marginRight: 8 },
  titleUnread:  { fontWeight: '700', color: COLORS.textPrimary },
  time:         { fontSize: 10, color: COLORS.textMuted, flexShrink: 0 },
  body:         { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
  tapHint:      { fontSize: 10, fontWeight: '600', marginTop: 4 },

  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  loadingText:  { fontSize: 13, color: COLORS.textMuted, marginTop: 8 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  emptyBody:    { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
});
