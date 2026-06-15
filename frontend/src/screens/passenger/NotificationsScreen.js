import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  StatusBar, RefreshControl, AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PURPLE } from '../../constants/colors';
import GradientFill from '../../components/common/GradientFill';
import FadeInView from '../../components/common/FadeInView';
import PressableScale from '../../components/common/PressableScale';
import { SkeletonCardList } from '../../components/common/Skeleton';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/apiClient';

const POLL_MS = 15000;

const TYPE_CFG = {
  arrival:   { icon: 'bus',                color: COLORS.success,  bg: COLORS.success  + '18' },
  delay:     { icon: 'time',               color: COLORS.warning,  bg: COLORS.warning  + '18' },
  reward:    { icon: 'gift',               color: PURPLE.primary,  bg: PURPLE.primary  + '18' },
  emergency: { icon: 'warning',            color: '#EF4444',       bg: '#EF444418'             },
  info:      { icon: 'notifications',      color: PURPLE.primary,  bg: PURPLE.primary  + '18' },
  success:   { icon: 'checkmark-circle',   color: COLORS.success,  bg: COLORS.success  + '18' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const min = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (min < 1)  return 'Just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const NotificationsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [notifs,     setNotifs]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const userId = user?.user_id ?? user?._id;
      if (!userId) return;
      const res = await apiClient.get(`/notifications/user/${userId}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setNotifs(data);
    } catch (err) {
      // keep previous data on error; don't clear the list
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Initial load + polling + foreground refresh
  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(true), POLL_MS);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load(true);
    });

    return () => {
      clearInterval(timerRef.current);
      sub.remove();
    };
  }, [load]);

  const handleRead = useCallback(async (id) => {
    setNotifs(prev => prev.map(n =>
      n.notification_id === id ? { ...n, is_read: true } : n
    ));
    try {
      await apiClient.put(`/notifications/${id}/read`, {});
    } catch { /* best-effort */ }
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = notifs.filter(n => !n.is_read);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    await Promise.all(unread.map(n =>
      apiClient.put(`/notifications/${n.notification_id}/read`, {}).catch(() => {})
    ));
  }, [notifs]);

  const unreadCount = notifs.filter(n => !n.is_read).length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* Gradient header */}
      <View style={styles.hero}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill id="notifHero" colors={PURPLE.gradient} vertical />
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />
        </View>
        <View style={[styles.pageHeader, { paddingTop: insets.top + 8 }]}>
          {navigation?.canGoBack() ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={22} color={COLORS.white} />
            </TouchableOpacity>
          ) : null}
          <Text style={styles.pageTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
            </View>
          )}
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <SkeletonCardList count={6} />
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={i => String(i.notification_id)}
          contentContainerStyle={[styles.list, notifs.length === 0 && styles.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={PURPLE.primary}
              colors={[PURPLE.primary]}
            />
          }
          renderItem={({ item, index }) => {
            const cfg = TYPE_CFG[item.type] ?? TYPE_CFG.info;
            return (
              <FadeInView index={index}>
                <PressableScale
                  style={[styles.item, !item.is_read && styles.itemUnread]}
                  scaleTo={0.98}
                  onPress={() => { if (!item.is_read) handleRead(item.notification_id); }}
                >
                  <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={21} color={cfg.color} />
                  </View>
                  <View style={styles.itemBody}>
                    <View style={styles.itemTop}>
                      <Text style={[styles.itemTitle, !item.is_read && styles.itemTitleUnread]}>
                        {item.title}
                      </Text>
                      <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
                    </View>
                    <Text style={styles.itemText}>{item.body || item.message}</Text>
                    {!item.is_read && (
                      <Text style={[styles.tapHint, { color: cfg.color }]}>Tap to mark as read</Text>
                    )}
                  </View>
                  {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}
                </PressableScale>
              </FadeInView>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={42} color={PURPLE.primary} />
              </View>
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptySubText}>
                Updates from the transit system will appear here
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* Hero */
  hero: {
    backgroundColor: PURPLE.deep,
    overflow: 'hidden',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  heroDecor1: {
    position: 'absolute', width: 190, height: 190, borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -50,
  },
  heroDecor2: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: -20, left: -30,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle:       { fontSize: 24, fontWeight: '900', color: COLORS.white, flex: 1 },
  unreadBadge: {
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  unreadBadgeText: { fontSize: 12, fontWeight: '800', color: PURPLE.dark },
  markAllBtn:      { paddingHorizontal: 4 },
  markAllText:     { fontSize: 12, fontWeight: '700', color: COLORS.white },

  list:      { padding: 16, gap: 8 },
  listEmpty: { flex: 1 },

  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    position: 'relative',
    shadowColor: PURPLE.deep,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  itemUnread:    { backgroundColor: PURPLE.light },
  iconWrap: {
    width: 46, height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemBody:  { flex: 1 },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  itemTitle:       { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, flex: 1, marginRight: 8 },
  itemTitleUnread: { fontWeight: '700', color: COLORS.textPrimary },
  itemTime:        { fontSize: 11, color: COLORS.textMuted, flexShrink: 0 },
  itemText:        { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  tapHint:         { fontSize: 10, fontWeight: '600', marginTop: 4 },
  unreadDot: {
    position: 'absolute',
    top: 12, right: 12,
    width: 8, height: 8,
    borderRadius: 4,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyIcon: {
    width: 84, height: 84, borderRadius: 26,
    backgroundColor: PURPLE.light,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyText:    { fontSize: 15, color: COLORS.textPrimary, fontWeight: '700' },
  emptySubText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 32 },
});

export default NotificationsScreen;
