import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, RefreshControl, Platform, StatusBar,
  Animated, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import BusCard from '../../components/passenger/BusCard';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import { getBusesApi } from '../../api/busApi';
import { COLORS } from '../../constants/colors';

const VEHICLE_TYPES = [
  { key: 'all',    label: 'All',    icon: 'apps-outline'      },
  { key: 'bus',    label: 'Bus',    icon: 'bus-outline'       },
  { key: 'van',    label: 'Van',    icon: 'car-outline'       },
  { key: 'taxi',   label: 'Taxi',   icon: 'car-sport-outline' },
  { key: 'tuktuk', label: 'Tuktuk', icon: 'bicycle-outline'   },
];

const STATUS_FILTERS = ['All', 'Active', 'Boarding', 'Delayed'];

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { walletBalance, bookings } = useApp();
  const [buses, setBuses] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [activeType, setActiveType] = useState('all');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'P';

  const activeBooking = bookings?.find(b => b.status === 'upcoming');
  const upcomingCount = bookings?.filter(b => b.status === 'upcoming').length || 0;

  useEffect(() => {
    loadBuses();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    let data = buses;
    if (activeType !== 'all') {
      data = data.filter(b => b.type === activeType);
    }
    if (search) {
      data = data.filter(b =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.origin.toLowerCase().includes(search.toLowerCase()) ||
        b.destination.toLowerCase().includes(search.toLowerCase()) ||
        b.route.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (activeFilter !== 'All') {
      data = data.filter(b => b.status === activeFilter.toLowerCase());
    }
    setFiltered(data);
  }, [search, activeFilter, activeType, buses]);

  const loadBuses = async () => {
    try {
      const res = await getBusesApi();
      setBuses(res.data.buses ?? []);
    } catch {
      setBuses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) return <Loader />;

  const ListHeader = () => (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      {/* Active Ride Card */}
      {activeBooking && (
        <TouchableOpacity
          style={styles.activeRideCard}
          onPress={() => navigation.navigate('BusTracking', {
            tripId: activeBooking.bus?._id,
            busName: activeBooking.bus?.name,
          })}
          activeOpacity={0.9}
        >
          <View style={styles.activeRideLeft}>
            <View style={styles.activeRidePulseWrap}>
              <Animated.View style={[styles.activeRidePulse, { transform: [{ scale: pulseAnim }] }]} />
              <View style={styles.activeRideDot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeRideLabel}>Active Ride</Text>
              <Text style={styles.activeRideName} numberOfLines={1}>
                {activeBooking.bus?.name}
              </Text>
              <Text style={styles.activeRideRoute} numberOfLines={1}>
                {activeBooking.bus?.origin} → {activeBooking.bus?.destination}
              </Text>
            </View>
          </View>
          <View style={styles.activeRideTrackBtn}>
            <Ionicons name="navigate" size={15} color={COLORS.white} />
            <Text style={styles.activeRideTrackText}>Track</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Quick Stats */}
      <View style={styles.quickStats}>
        <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Wallet')} activeOpacity={0.85}>
          <View style={[styles.statIcon, { backgroundColor: COLORS.primaryLight }]}>
            <Ionicons name="wallet" size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.statValue}>${walletBalance?.toFixed(2) ?? '0.00'}</Text>
          <Text style={styles.statLabel}>Wallet</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('TripHistory')} activeOpacity={0.85}>
          <View style={[styles.statIcon, { backgroundColor: COLORS.secondaryLight }]}>
            <Ionicons name="bus" size={18} color={COLORS.secondary} />
          </View>
          <Text style={styles.statValue}>{upcomingCount}</Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('ProfileStack', { screen: 'FavoriteRoutes' })} activeOpacity={0.85}>
          <View style={[styles.statIcon, { backgroundColor: COLORS.warningLight }]}>
            <Ionicons name="heart" size={18} color={COLORS.warning} />
          </View>
          <Text style={styles.statValue}>3</Text>
          <Text style={styles.statLabel}>Favorites</Text>
        </TouchableOpacity>
      </View>

      {/* Section heading */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>
          {activeType === 'all' ? 'All Vehicles' : VEHICLE_TYPES.find(t => t.key === activeType)?.label + 's'}
        </Text>
        <Text style={styles.sectionCount}>{filtered.length} found</Text>
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      {/* Premium Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerDecorCircle1} />
        <View style={styles.headerDecorCircle2} />

        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{getGreeting()} 👋</Text>
            <Text style={styles.userName}>{user?.name || 'Passenger'}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate('ProfileStack', { screen: 'Notifications' })}
              style={styles.notifBtn}
            >
              <Ionicons name="notifications-outline" size={21} color={COLORS.white} />
              <View style={styles.notifDot} />
            </TouchableOpacity>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search bus, route, destination..."
            placeholderTextColor={COLORS.textMuted}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Quick actions row */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickActionCard, { flex: 1.6 }]}
            onPress={() => navigation.navigate('TripPlanner')}
            activeOpacity={0.85}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: COLORS.primaryLight }]}>
              <Ionicons name="git-branch-outline" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickActionTitle}>Plan a Trip</Text>
              <Text style={styles.quickActionSub}>Multi-line routes</Text>
            </View>
            <Ionicons name="arrow-forward" size={15} color={COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionCard, { flex: 1 }]}
            onPress={() => navigation.navigate('NearbyStops')}
            activeOpacity={0.85}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: COLORS.secondaryLight }]}>
              <Ionicons name="walk-outline" size={20} color={COLORS.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.quickActionTitle, { color: COLORS.secondary }]}>Nearby</Text>
              <Text style={styles.quickActionSub}>Stops near me</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Reserve Taxi banner */}
        <TouchableOpacity
          style={styles.taxiCard}
          onPress={() => navigation.navigate('TaxiReservation')}
          activeOpacity={0.85}
        >
          <View style={styles.taxiIconWrap}>
            <Ionicons name="car-sport" size={22} color={COLORS.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.taxiTitle}>Reserve a Taxi</Text>
            <Text style={styles.taxiSub}>Book now or schedule for later · set recurring rides</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={COLORS.warning} />
        </TouchableOpacity>

        {/* Vehicle type pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeContent}
        >
          {VEHICLE_TYPES.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeChip, activeType === t.key && styles.typeChipActive]}
              onPress={() => setActiveType(t.key)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={t.icon}
                size={14}
                color={activeType === t.key ? COLORS.primary : 'rgba(255,255,255,0.75)'}
              />
              <Text style={[styles.typeChipText, activeType === t.key && styles.typeChipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Status filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {STATUS_FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
              onPress={() => setActiveFilter(f)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Bus List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item._id}
        renderItem={({ item }) => (
          <BusCard bus={item} onPress={() => navigation.navigate('Booking', { bus: item })} />
        )}
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={
          <EmptyState icon="bus-outline" title="No buses found" message="Try a different search or filter." />
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadBuses(); }}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  /* Header */
  header: {
    backgroundColor: COLORS.headerBg,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  headerDecorCircle1: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -60, right: -50,
  },
  headerDecorCircle2: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: 10, left: -40,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  greeting: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginBottom: 2,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.danger,
    borderWidth: 1.5, borderColor: COLORS.headerBg,
  },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 14, fontWeight: '800', color: COLORS.white,
  },

  /* Search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 50,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },

  /* Plan a Trip banner */
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  quickActionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 1,
  },
  quickActionSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  /* Reserve Taxi banner */
  taxiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.warningMid ?? '#FCD34D',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 2,
  },
  taxiIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.warningLight ?? '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  taxiTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.warning ?? '#D97706',
    marginBottom: 1,
  },
  taxiSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  /* Vehicle type pills */
  typeContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    marginRight: 6,
  },
  typeChipActive: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.white,
  },
  typeChipText: {
    fontSize: 13, fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
  },
  typeChipTextActive: {
    color: COLORS.primary,
  },

  /* Status filters */
  filterContent: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  filterChipText: {
    fontSize: 12, fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  filterChipTextActive: {
    color: COLORS.white, fontWeight: '700',
  },

  /* List */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },

  /* Active Ride */
  activeRideCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  activeRideLeft: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, flex: 1,
  },
  activeRidePulseWrap: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  activeRidePulse: {
    position: 'absolute',
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  activeRideDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: COLORS.secondary,
    borderWidth: 2, borderColor: COLORS.white,
  },
  activeRideLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  activeRideName: {
    fontSize: 15, fontWeight: '800', color: COLORS.white,
  },
  activeRideRoute: {
    fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1,
  },
  activeRideTrackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 12,
  },
  activeRideTrackText: {
    fontSize: 13, fontWeight: '700', color: COLORS.white,
  },

  /* Quick Stats */
  quickStats: {
    flexDirection: 'row', gap: 10, marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  statIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 2,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11, color: COLORS.textMuted, fontWeight: '600',
  },

  /* Section heading */
  sectionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17, fontWeight: '800',
    color: COLORS.textPrimary, letterSpacing: -0.3,
  },
  sectionCount: {
    fontSize: 12, color: COLORS.textMuted, fontWeight: '600',
    backgroundColor: COLORS.background,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
  },
});

export default HomeScreen;
