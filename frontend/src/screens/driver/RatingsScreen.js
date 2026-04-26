import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Platform,
  StatusBar, TouchableOpacity,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

const OVERALL = 4.8;
const TOTAL_REVIEWS = 6;
const DISTRIBUTION = [
  { stars: 5, count: 4 },
  { stars: 4, count: 1 },
  { stars: 3, count: 1 },
  { stars: 2, count: 0 },
  { stars: 1, count: 0 },
];

const MOCK_RATINGS = [
  { id: '1', passenger: 'Ahmad A.',    rating: 5, comment: 'Very punctual and smooth ride!',              date: 'Today, 09:20',      route: 'Route A' },
  { id: '2', passenger: 'Siti N.',     rating: 5, comment: 'Professional driver, great trip.',            date: 'Today, 07:10',      route: 'Route C' },
  { id: '3', passenger: 'Muhammad H.', rating: 4, comment: 'Good drive, slightly late departure.',        date: 'Yesterday, 13:50',  route: 'Route B' },
  { id: '4', passenger: 'Priya R.',    rating: 5, comment: 'Excellent! Will ride again.',                 date: 'Yesterday, 09:20',  route: 'Route A' },
  { id: '5', passenger: 'Lim W.',      rating: 3, comment: 'Bus was a bit crowded.',                      date: '2 days ago',        route: 'Route B' },
  { id: '6', passenger: 'Kavitha P.',  rating: 5, comment: 'Perfect ride. Very comfortable bus.',         date: '2 days ago',        route: 'Route C' },
];

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
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? MOCK_RATINGS : MOCK_RATINGS.filter(r => String(r.rating) === filter);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.passenger[0]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.passengerName}>{item.passenger}</Text>
          <View style={styles.ratingMeta}>
            <Stars rating={item.rating} size={12} />
            <View style={styles.metaDot} />
            <View style={styles.routeChip}>
              <Text style={styles.routeChipText}>{item.route}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.dateText}>{item.date}</Text>
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

        {/* Rating summary */}
        <View style={styles.ratingSummary}>
          <View style={styles.ratingLeft}>
            <Text style={styles.ratingNumber}>{OVERALL}</Text>
            <Stars rating={Math.round(OVERALL)} size={20} />
            <Text style={styles.ratingCount}>{TOTAL_REVIEWS} reviews</Text>
          </View>
          <View style={styles.ratingRight}>
            {DISTRIBUTION.map(d => (
              <View key={d.stars} style={styles.distRow}>
                <Text style={styles.distStar}>{d.stars}</Text>
                <Ionicons name="star" size={9} color={COLORS.warning} />
                <View style={styles.distBarBg}>
                  <View style={[styles.distBarFill, { width: `${(d.count / TOTAL_REVIEWS) * 100}%` }]} />
                </View>
                <Text style={styles.distCount}>{d.count}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Performance badges */}
        <View style={styles.badgesRow}>
          {[
            { icon: 'star',           label: '4.8 Rating',    color: COLORS.warning    },
            { icon: 'time-outline',   label: '94% On Time',   color: COLORS.secondary  },
            { icon: 'trophy-outline', label: 'Top Driver',    color: COLORS.primary    },
          ].map(b => (
            <View key={b.label} style={styles.badge}>
              <Ionicons name={b.icon} size={13} color={b.color} />
              <Text style={styles.badgeText}>{b.label}</Text>
            </View>
          ))}
        </View>
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
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="star-outline" size={38} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No reviews for this rating</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Header */
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

  /* Rating summary */
  ratingSummary: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 14, gap: 20,
  },
  ratingLeft: { alignItems: 'center', gap: 5 },
  ratingNumber: { fontSize: 46, fontWeight: '900', color: COLORS.white, letterSpacing: -1.5 },
  ratingCount: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600', marginTop: 2 },
  ratingRight: { flex: 1, gap: 4 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  distStar: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '700', width: 10, textAlign: 'right' },
  distBarBg: {
    flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 99, overflow: 'hidden',
  },
  distBarFill: { height: '100%', backgroundColor: COLORS.warning, borderRadius: 99 },
  distCount: { fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '600', width: 12 },

  /* Badges */
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

  /* Filters */
  filterWrap: { flexDirection: 'row', padding: 14, gap: 8 },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999, backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1, borderColor: 'transparent',
  },
  filterBtnActive: { backgroundColor: COLORS.warningLight, borderColor: COLORS.warningMid },
  filterText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  filterTextActive: { color: COLORS.warning },

  list: { padding: 14 },

  /* Card */
  card: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 10,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  passengerName: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  ratingMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.border },
  routeChip: {
    backgroundColor: COLORS.primaryLight, borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  routeChipText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  dateText: { fontSize: 10, color: COLORS.textMuted, fontWeight: '500' },
  commentBubble: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: COLORS.surfaceAlt, borderRadius: 10, padding: 10, marginTop: 10,
    borderLeftWidth: 3, borderLeftColor: COLORS.primary,
  },
  commentText: { flex: 1, fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, fontStyle: 'italic', fontWeight: '500' },

  emptyWrap: { alignItems: 'center', paddingTop: 56, gap: 10 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
});

export default RatingsScreen;
