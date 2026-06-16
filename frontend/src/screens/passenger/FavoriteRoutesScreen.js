import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, StatusBar, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import EmptyState from '../../components/common/EmptyState';
import GradientFill from '../../components/common/GradientFill';
import FadeInView from '../../components/common/FadeInView';
import PressableScale from '../../components/common/PressableScale';
import { SkeletonCardList } from '../../components/common/Skeleton';
import { COLORS, PURPLE } from '../../constants/colors';
import { getFavoriteRoutes, removeFavoriteRoute } from '../../api/apiClient';

const FavoriteRoutesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [favorites,  setFavorites]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getFavoriteRoutes();
      setFavorites(Array.isArray(data) ? data : []);
    } catch {
      setFavorites([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = (item) => {
    Alert.alert('Remove Favorite', `Remove "${item.name}" from favorites?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          // Optimistic update
          setFavorites(prev => prev.filter(f => f.favorite_id !== item.favorite_id && f.route_id !== item.route_id));
          try {
            await removeFavoriteRoute(item.route_id);
          } catch {
            // Revert on failure
            load(true);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* Gradient header */}
      <View style={styles.hero}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill id="favHero" colors={PURPLE.gradient} vertical />
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />
        </View>
        <View style={[styles.pageHeader, { paddingTop: insets.top + 8 }]}>
          {navigation?.canGoBack() ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={22} color={COLORS.white} />
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Favorite Routes</Text>
            <Text style={styles.pageSubtitle}>{favorites.length} saved route{favorites.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <SkeletonCardList count={5} />
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={i => String(i.favorite_id ?? i.route_id)}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={PURPLE.primary}
              colors={[PURPLE.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState icon="heart-outline" title="No favorites yet" message="Save routes for quick access and booking." tint={PURPLE.primary} tintBg={PURPLE.light} tintGlow={PURPLE.glow} />
          }
          renderItem={({ item, index }) => (
            <FadeInView index={index}>
              <View style={styles.card}>
                <View style={styles.iconWrap}>
                  <Ionicons name="heart" size={18} color={COLORS.danger} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.routeName}>
                    {item.nickname ? `${item.name} · ${item.nickname}` : item.name}
                  </Text>
                  <View style={styles.routeRow}>
                    <Text style={styles.routeStop}>{item.origin}</Text>
                    <Ionicons name="arrow-forward" size={12} color={COLORS.textMuted} />
                    <Text style={styles.routeStop}>{item.destination}</Text>
                  </View>
                </View>
                <PressableScale
                  style={styles.bookBtn}
                  onPress={() => navigation.navigate('HomeStack')}
                  scaleTo={0.9}
                >
                  <Text style={styles.bookBtnText}>Book</Text>
                </PressableScale>
                <TouchableOpacity
                  onPress={() => remove(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            </FadeInView>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  pageTitle:    { fontSize: 24, fontWeight: '900', color: COLORS.white },
  pageSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: PURPLE.deep,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: '#FFEBEE',
    alignItems: 'center', justifyContent: 'center',
  },
  info:      { flex: 1 },
  routeName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  routeRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  routeStop: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },

  bookBtn: {
    backgroundColor: PURPLE.light,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10,
  },
  bookBtnText: { fontSize: 13, fontWeight: '700', color: PURPLE.primary },
});

export default FavoriteRoutesScreen;
