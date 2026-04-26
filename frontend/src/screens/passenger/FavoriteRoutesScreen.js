import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Platform, StatusBar } from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import EmptyState from '../../components/common/EmptyState';
import { COLORS } from '../../constants/colors';

const MOCK_FAVORITES = [
  { _id: '1', name: 'Express 101', origin: 'Home', destination: 'Work', time: '08:00 AM' },
  { _id: '2', name: 'City Line 5', origin: 'Mall', destination: 'University', time: '09:15 AM' },
];

const FavoriteRoutesScreen = ({ navigation }) => {
  const headerInsets = useHeaderInsets();
  const [favorites, setFavorites] = useState(MOCK_FAVORITES);

  const remove = (id) => {
    Alert.alert('Remove Favorite', 'Remove this route from favorites?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setFavorites(prev => prev.filter(f => f._id !== id)) },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <View style={[styles.pageHeader, headerInsets]}>
        <Text style={styles.pageTitle}>Favorite Routes</Text>
        <Text style={styles.pageSubtitle}>{favorites.length} saved route{favorites.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={favorites}
        keyExtractor={i => i._id}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState icon="heart-outline" title="No favorites yet" message="Save routes for quick access and booking." />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="heart" size={18} color={COLORS.danger} />
            </View>
            <View style={styles.info}>
              <Text style={styles.routeName}>{item.name}</Text>
              <View style={styles.routeRow}>
                <Text style={styles.routeStop}>{item.origin}</Text>
                <Ionicons name="arrow-forward" size={12} color={COLORS.textMuted} />
                <Text style={styles.routeStop}>{item.destination}</Text>
                <Text style={styles.routeTime}>· {item.time}</Text>
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
              onPress={() => remove(item._id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  pageHeader: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pageTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
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
  info: { flex: 1 },
  routeName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  routeStop: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  routeTime: { fontSize: 12, color: COLORS.textMuted },

  bookBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10,
  },
  bookBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});

export default FavoriteRoutesScreen;
