import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import apiClient from '../../api/apiClient';

// ── Star row ──────────────────────────────────────────────────────────────────
const Stars = ({ rating, size = 14 }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map(s => (
      <Ionicons
        key={s}
        name={s <= rating ? 'star' : 'star-outline'}
        size={size}
        color={s <= rating ? '#F59E0B' : COLORS.border}
      />
    ))}
  </View>
);

// ── Rating card ───────────────────────────────────────────────────────────────
const RatingCard = ({ item, onDelete }) => {
  const dateStr = item.created_at
    ? new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <View style={styles.card}>
      {/* Route + date */}
      <View style={styles.cardTop}>
        <View style={styles.routeIcon}>
          <Ionicons name="bus-outline" size={16} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.routeName} numberOfLines={1}>
            {item.route_name || 'Route'}
          </Text>
          {item.driver_name ? (
            <Text style={styles.driverName}>
              Driver: {item.driver_name}
            </Text>
          ) : null}
        </View>
        <Text style={styles.dateText}>{dateStr}</Text>
      </View>

      {/* Stars + comment */}
      <View style={styles.cardBody}>
        <Stars rating={item.rating} size={15} />
        {item.comment ? (
          <Text style={styles.comment}>{item.comment}</Text>
        ) : null}
      </View>

      {/* Delete */}
      <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item)} activeOpacity={0.7}>
        <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
        <Text style={styles.deleteBtnText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────────
const RatingsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [ratings,    setRatings]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiClient.get('/ratings/me');
      setRatings(Array.isArray(res.data) ? res.data : []);
    } catch {
      setRatings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (item) => {
    Alert.alert(
      'Delete Rating',
      'Remove this rating? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setRatings(prev => prev.filter(r => r.rating_id !== item.rating_id));
            try {
              await apiClient.delete(`/ratings/${item.rating_id}`);
            } catch {
              load(true);
            }
          },
        },
      ],
    );
  };

  const avgRating = ratings.length
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
    : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>My Ratings</Text>
          {ratings.length > 0 && (
            <Text style={styles.headerSub}>{ratings.length} review{ratings.length !== 1 ? 's' : ''} · avg {avgRating} ⭐</Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={ratings}
          keyExtractor={r => String(r.rating_id)}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="star-outline" size={40} color={COLORS.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No ratings yet</Text>
              <Text style={styles.emptySub}>Your submitted trip ratings will appear here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <RatingCard item={item} onDelete={handleDelete} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </View>
  );
};

export default RatingsScreen;

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* Header */
  header: {
    backgroundColor: COLORS.headerBg,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 18,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  /* Card */
  card: {
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10,
  },
  routeIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  routeName:  { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  driverName: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  dateText:   { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', marginTop: 2 },

  cardBody: { gap: 8, marginBottom: 12 },
  comment:  { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-end',
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: COLORS.dangerLight, borderRadius: 8,
  },
  deleteBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.danger },

  /* Empty state */
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  emptySub:   { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
});
