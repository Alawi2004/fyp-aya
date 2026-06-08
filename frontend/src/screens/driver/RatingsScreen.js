import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Platform,
  StatusBar, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { getDriverRatingsApi } from '../../api/driverApi';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const min = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (min < 1)  return 'Just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)    return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const Stars = ({ rating, size = 14 }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map(i => (
      <Ionicons
        key={i}
        name={i <= rating ? 'star' : i - 0.5 <= rating ? 'star-half' : 'star-outline'}
        size={size}
        color={i <= rating ? COLORS.warning : COLORS.border}
      />
    ))}
  </View>
);

const RatingsScreen = ({ navigation }) => {
  const headerInsets = useHeaderInsets();
  const { user } = useAuth();
  const [data,       setData]       = useState(null);  // { average, total, distribution, reviews }
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // driver_id is separate from user_id; look it up from user context or use user_id as fallback
      const driverId = user?.driver_id ?? user?.user_id ?? user?._id;
      const result = await getDriverRatingsApi(driverId);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const reviews  = data?.reviews ?? [];
  const average  = data?.average ?? 0;
  const total    = data?.total   ?? 0;
  const dist     = data?.distribution ?? [5,4,3,2,1].map(s => ({ stars: s, count: 0 }));

  const filtered = filter === 'all'
    ? reviews
    : reviews.filter(r => String(r.rating) === filter);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.passenger_name ?? '?')[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.passengerName}>{item.passenger_name ?? 'Passenger'}</Text>
          <View style={styles.ratingMeta}>
            <Stars rating={item.rating} size={12} />
            <View style={styles.metaDot} />
            <View style={styles.routeChip}>
              <Text style={styles.routeChipText}>{item.route_name ?? `Trip #${item.trip_id}`}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.dateText}>{timeAgo(item.created_at)}</Text>
      </View>
      {item.comment ? (
        <View style={styles.commentBubble}>
          <Ionicons name="chatbubble-outline" size={11} color={COLORS.textMuted} />
          <Text style={styles.commentText}>"{item.comment}"</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      {/* Header */}
      <View style={[styles.header, headerInsets]}>
        <View style={styles.headerDecor} />
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Driver Ratings</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
            <ActivityIndicator color={COLORS.white} />
          </View>
        ) : (
          <>
            <View style={styles.ratingSummary}>
              <View style={styles.ratingLeft}>
                <Text style={styles.ratingNumber}>{average.toFixed(1)}</Text>
                <Stars rating={Math.round(average)} size={20} />
                <Text style={styles.ratingCount}>{total} review{total !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.ratingRight}>
                {dist.map(d => (
                  <View key={d.stars} style={styles.distRow}>
                    <Text style={styles.distStar}>{d.stars}</Text>
                    <Ionicons name="star" size={9} color={COLORS.warning} />
                    <View style={styles.distBarBg}>
                      <View style={[
                        styles.distBarFill,
                        { width: total > 0 ? `${(d.count / total) * 100}%` : '0%' },
                      ]} />
                    </View>
                    <Text style={styles.distCount}>{d.count}</Text>
                  </View>
                ))}
              </View>
            </View>

            {total > 0 && (
              <View style={styles.badgesRow}>
                <View style={styles.badge}>
                  <Ionicons name="star" size={13} color={COLORS.warning} />
                  <Text style={styles.badgeText}>{average.toFixed(1)} Rating</Text>
                </View>
                {average >= 4.5 && (
                  <View style={styles.badge}>
                    <Ionicons name="trophy-outline" size={13} color={COLORS.primary} />
                    <Text style={styles.badgeText}>Top Driver</Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filterWrap}>
        {[
          { key: 'all', label: 'All' },
          { key: '5',   label: '5★'  },
          { key: '4',   label: '4★'  },
          { key: '3',   label: '3★'  },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.rating_id)}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, filtered.length === 0 && styles.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={COLORS.driverPrimary ?? COLORS.primary}
            colors={[COLORS.driverPrimary ?? COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="star-outline" size={38} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>
              {loading ? 'Loading…' : total === 0 ? 'No ratings yet' : 'No reviews for this rating'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: COLORS.headerBg,
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute', top: -50, right: -50,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },

  ratingSummary: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 14, gap: 20,
  },
  ratingLeft:  { alignItems: 'center', gap: 5 },
  ratingNumber: { fontSize: 46, fontWeight: '900', color: COLORS.white, letterSpacing: -1.5 },
  ratingCount:  { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600', marginTop: 2 },
  ratingRight:  { flex: 1, gap: 4 },
  distRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  distStar:     { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '700', width: 10, textAlign: 'right' },
  distBarBg: {
    flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 99, overflow: 'hidden',
  },
  distBarFill:  { height: '100%', backgroundColor: COLORS.warning, borderRadius: 99 },
  distCount:    { fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '600', width: 12 },

  badgesRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.18)', paddingHorizontal: 20, paddingVertical: 10,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: COLORS.white },

  filterWrap:      { flexDirection: 'row', padding: 14, gap: 8 },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999, backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1, borderColor: 'transparent',
  },
  filterBtnActive:  { backgroundColor: COLORS.warningLight, borderColor: COLORS.warningMid },
  filterText:       { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  filterTextActive: { color: COLORS.warning },

  list:      { padding: 14 },
  listEmpty: { flex: 1 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 10,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarText:   { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  passengerName:{ fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  ratingMeta:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaDot:      { width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.border },
  routeChip: {
    backgroundColor: COLORS.primaryLight, borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  routeChipText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  dateText:      { fontSize: 10, color: COLORS.textMuted, fontWeight: '500' },
  commentBubble: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: COLORS.surfaceAlt, borderRadius: 10, padding: 10, marginTop: 10,
    borderLeftWidth: 3, borderLeftColor: COLORS.primary,
  },
  commentText:  { flex: 1, fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, fontStyle: 'italic', fontWeight: '500' },

  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 56, gap: 10 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
});

export default RatingsScreen;
