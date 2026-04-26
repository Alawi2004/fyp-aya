import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput,
  TouchableOpacity, Platform, StatusBar,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

const MOCK_PASSENGERS = [
  { id: '1', name: 'Ahmad Al-Rashid',    seat: 'A3',  status: 'boarded',   time: '08:02', route: 'City Center' },
  { id: '2', name: 'Siti Nur Aisyah',    seat: 'A7',  status: 'boarded',   time: '08:04', route: 'City Center' },
  { id: '3', name: 'Muhammad Haziq',     seat: 'B1',  status: 'boarded',   time: '08:05', route: 'City Center' },
  { id: '4', name: 'Priya Ramasamy',     seat: 'B4',  status: 'boarded',   time: '08:06', route: 'City Center' },
  { id: '5', name: 'Lim Wei Chen',       seat: 'B8',  status: 'boarded',   time: '08:07', route: 'City Center' },
  { id: '6', name: 'Kavitha Pillai',     seat: 'C2',  status: 'pending',   time: '—',     route: 'City Center' },
  { id: '7', name: 'Amirul Faiz',        seat: 'C5',  status: 'pending',   time: '—',     route: 'City Center' },
  { id: '8', name: 'Wong Mei Ling',      seat: 'C9',  status: 'no-show',   time: '—',     route: 'City Center' },
  { id: '9', name: 'Rajan Krishnan',     seat: 'D2',  status: 'boarded',   time: '08:09', route: 'City Center' },
  { id: '10', name: 'Nurul Hidayah',     seat: 'D6',  status: 'boarded',   time: '08:10', route: 'City Center' },
];

const STATUS_CFG = {
  boarded:  { label: 'Boarded',  bg: COLORS.secondaryLight, text: COLORS.secondary, icon: 'checkmark-circle' },
  pending:  { label: 'Pending',  bg: COLORS.warningLight,   text: COLORS.warning,   icon: 'time-outline'     },
  'no-show':{ label: 'No Show',  bg: COLORS.dangerLight,    text: COLORS.danger,    icon: 'close-circle'     },
};

const PassengerListScreen = ({ navigation }) => {
  const headerInsets = useHeaderInsets();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const counts = {
    boarded:   MOCK_PASSENGERS.filter(p => p.status === 'boarded').length,
    pending:   MOCK_PASSENGERS.filter(p => p.status === 'pending').length,
    'no-show': MOCK_PASSENGERS.filter(p => p.status === 'no-show').length,
  };

  const filtered = MOCK_PASSENGERS.filter(p => {
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
              <Ionicons name="ticket-outline" size={10} color={COLORS.primary} />
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      {/* Header */}
      <View style={[styles.header, headerInsets]}>
        <View style={styles.headerDecor} />
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Passenger List</Text>
            <Text style={styles.headerSub}>Route A · {MOCK_PASSENGERS.length} registered</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          {[
            { label: 'Boarded',  value: counts.boarded,          color: COLORS.secondary    },
            { label: 'Pending',  value: counts.pending,          color: COLORS.warning       },
            { label: 'No Show',  value: counts['no-show'],       color: COLORS.danger        },
            { label: 'Total',    value: MOCK_PASSENGERS.length,  color: 'rgba(255,255,255,0.9)' },
          ].map((s, i) => (
            <View key={s.label} style={[styles.statCell, i < 3 && styles.statCellBorder]}>
              <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLbl}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Search */}
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

      {/* Filters */}
      <View style={styles.filterWrap}>
        {[
          { key: 'all',      label: `All (${MOCK_PASSENGERS.length})` },
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

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={38} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No passengers found</Text>
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

  /* Search */
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: 14,
    margin: 14, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },

  /* Filters */
  filterWrap: { flexDirection: 'row', paddingHorizontal: 14, gap: 6, marginBottom: 10 },
  filterBtn: {
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: 999, backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1, borderColor: 'transparent',
  },
  filterBtnActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primaryMid },
  filterText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  filterTextActive: { color: COLORS.primary },

  list: { paddingHorizontal: 14, paddingBottom: 24 },

  /* Card */
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: COLORS.white, borderRadius: 14, padding: 13, marginBottom: 8,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardAvatar: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  cardAvatarText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  cardName: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 5 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seatPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primaryLight, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  seatPillText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
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
