import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Platform, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import EmptyState from '../../components/common/EmptyState';
import { COLORS } from '../../constants/colors';
import { getFavoriteRoutes, removeFavoriteRoute } from '../../api/apiClient';

const FavoriteRoutesScreen = ({ navigation }) => {
  const headerInsets = useHeaderInsets();
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
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <View style={[styles.pageHeader, headerInsets]}>
        <Text style={styles.pageTitle}>Favorite Routes</Text>
        <Text style={styles.pageSubtitle}>{favorites.length} saved route{favorites.length !== 1 ? 's' : ''}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
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
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState icon="heart-outline" title="No favorites yet" message="Save routes for quick access and booking." />
          }
          renderItem={({ item }) => (
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
              <TouchableOpacity
                style={styles.bookBtn}
                onPress={() => navigation.navigate('HomeStack')}
                activeOpacity={0.8}
              >
                <Text style={styles.bookBtnText}>Book</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => remove(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  pageHeader: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pageTitle:    { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  pageSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
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
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10,
  },
  bookBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});

export default FavoriteRoutesScreen;
