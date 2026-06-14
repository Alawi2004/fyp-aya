import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput,
  TouchableOpacity, Platform, StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PURPLE } from '../../constants/colors';
import { getPassengerListApi } from '../../api/driverApi';

const STATUS_CFG = {
  boarded:  { label: 'Boarded',  bg: COLORS.secondaryLight, text: COLORS.secondary, icon: 'checkmark-circle' },
  pending:  { label: 'Pending',  bg: COLORS.warningLight,   text: COLORS.warning,   icon: 'time-outline'     },
  'no-show':{ label: 'No Show',  bg: COLORS.dangerLight,    text: COLORS.danger,    icon: 'close-circle'     },
};

function normalizePassenger(p) {
  let status = 'pending';
  if (p.status === 'used')                          status = 'boarded';
  else if (p.status === 'cancelled')                status = 'no-show';
  else if (p.status === 'confirmed' || p.status === 'pending') status = 'pending';
  return {
    id:   String(p.ticket_id ?? p.id ?? Math.random()),
    name: p.full_name ?? p.name ?? 'Passenger',
    seat: p.seat_number ?? p.seat ?? '—',
    status,
    time: p.boarding_time ?? '—',
    route: p.route ?? '',
  };
}

const PassengerListScreen = ({ navigation, route: navRoute }) => {
  const headerInsets = useHeaderInsets();
  const tripId = navRoute?.params?.tripId;
  const routeLabel = navRoute?.params?.routeName ?? 'Trip';

  const [passengers, setPassengers] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await getPassengerListApi(tripId);
      const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setPassengers(data.map(normalizePassenger));
    } catch {
      setPassengers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  const counts = {
    boarded:   passengers.filter(p => p.status === 'boarded').length,
    pending:   passengers.filter(p => p.status === 'pending').length,
    'no-show': passengers.filter(p => p.status === 'no-show').length,
  };

  const filtered = passengers.filter(p => {
    const matchFilter = filter === 'all' || p.status === filter;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
      || p.seat.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const renderItem = ({ item }) => {
    const cfg = STATUS_CFG[item.status] || STATUS_CFG.pending;
    const initials = item.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    return (
      <View style={styles.card}>
        <View style={styles.cardAvatar}>
          <Text style={styles.cardAvatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{item.name}</Text>
          <View style={styles.cardMeta}>
            <View style={styles.seatPill}>
              <Ionicons name="ticket-outline" size={10} color={PURPLE.primary} />
              <Text style={styles.seatPillText}>Seat {item.seat}</Text>
            </View>
            {item.time !== '—' && (
              <>
                <View style={styles.metaDot} />
                <Text style={styles.metaTime}>{item.time}</Text>
              </>
            )}
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={11} color={cfg.text} />
          <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      <View style={[styles.header, headerInsets]}>
        <View style={styles.headerDecor} />
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Passenger List</Text>
            <Text style={styles.headerSub}>{routeLabel} · {passengers.length} registered</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.statsStrip}>
          {[
            { label: 'Boarded',  value: counts.boarded,       color: COLORS.secondary    },
            { label: 'Pending',  value: counts.pending,       color: COLORS.warning       },
            { label: 'No Show',  value: counts['no-show'],    color: COLORS.danger        },
            { label: 'Total',    value: passengers.length,    color: 'rgba(255,255,255,0.9)' },
          ].map((s, i) => (
            <View key={s.label} style={[styles.statCell, i < 3 && styles.statCellBorder]}>
              <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLbl}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search passenger or seat..."
          placeholderTextColor={COLORS.textPlaceholder}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterWrap}>
        {[
          { key: 'all',      label: `All (${passengers.length})` },
          { key: 'boarded',  label: `Boarded (${counts.boarded})`    },
          { key: 'pending',  label: `Pending (${counts.pending})`    },
          { key: 'no-show',  label: `No Show (${counts['no-show']})` },
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

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={PURPLE.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={38} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No passengers found</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: PURPLE.deep,
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute', top: -50, right: -50,
    width: 190, height: 190, borderRadius: 95,
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
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: '500' },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 12,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statCellBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.1)' },
  statVal: { fontSize: 18, fontWeight: '900' },
  statLbl: { fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: '600', textTransform: 'uppercase' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: 14,
    margin: 14, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },

  filterWrap: { flexDirection: 'row', paddingHorizontal: 14, gap: 6, marginBottom: 10 },
  filterBtn: {
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: 999, backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1, borderColor: 'transparent',
  },
  filterBtnActive: { backgroundColor: PURPLE.light, borderColor: PURPLE.midStrong },
  filterText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  filterTextActive: { color: PURPLE.primary },

  list: { paddingHorizontal: 14, paddingBottom: 24 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: COLORS.white, borderRadius: 14, padding: 13, marginBottom: 8,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardAvatar: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: PURPLE.light,
    alignItems: 'center', justifyContent: 'center',
  },
  cardAvatarText: { fontSize: 14, fontWeight: '800', color: PURPLE.primary },
  cardName: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 5 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seatPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: PURPLE.light, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  seatPillText: { fontSize: 10, fontWeight: '700', color: PURPLE.primary },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.border },
  metaTime: { fontSize: 10, color: COLORS.textMuted, fontWeight: '500' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
  },
  statusText: { fontSize: 10, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingTop: 56, gap: 10 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
});

export default PassengerListScreen;
