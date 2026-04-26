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

const ALL_VEHICLES = [
  // ── Bus ──────────────────────────────────────────────────────────────────
  { _id: '1',  type: 'bus',     name: 'Express 101',   route: 'Route A', origin: 'Central Station',  destination: 'Airport',          departureTime: '08:00 AM', arrivalTime: '09:30 AM', duration: '1h 30m', price: '4.50', totalSeats: 40, bookedSeats: 32, status: 'active'   },
  { _id: '2',  type: 'bus',     name: 'City Line 5',   route: 'Route B', origin: 'Mall Junction',    destination: 'University',       departureTime: '09:15 AM', arrivalTime: '10:00 AM', duration: '45m',    price: '2.00', totalSeats: 30, bookedSeats: 10, status: 'boarding' },
  { _id: '3',  type: 'bus',     name: 'Night Owl',     route: 'Route C', origin: 'Downtown',         destination: 'Suburbs',          departureTime: '10:30 AM', arrivalTime: '11:45 AM', duration: '1h 15m', price: '3.00', totalSeats: 35, bookedSeats: 35, status: 'delayed'  },
  { _id: '4',  type: 'bus',     name: 'Metro Bus 7',   route: 'Route D', origin: 'Hospital',         destination: 'Market',           departureTime: '11:00 AM', arrivalTime: '11:30 AM', duration: '30m',    price: '1.50', totalSeats: 40, bookedSeats: 20, status: 'active'   },
  // ── Van ───────────────────────────────────────────────────────────────────
  { _id: '5',  type: 'van',     name: 'QuickVan A1',   route: 'Route E', origin: 'Tech Park',        destination: 'City Center',      departureTime: '07:30 AM', arrivalTime: '08:10 AM', duration: '40m',    price: '3.50', totalSeats: 12, bookedSeats: 7,  status: 'active'   },
  { _id: '6',  type: 'van',     name: 'MaxiVan B2',    route: 'Route F', origin: 'Riverside Plaza',  destination: 'Sports Complex',   departureTime: '09:00 AM', arrivalTime: '09:35 AM', duration: '35m',    price: '3.00', totalSeats: 12, bookedSeats: 4,  status: 'boarding' },
  { _id: '7',  type: 'van',     name: 'Hiace VIP',     route: 'Route G', origin: 'Uptown Gate',      destination: 'Business District', departureTime: '08:45 AM', arrivalTime: '09:20 AM', duration: '35m',   price: '4.00', totalSeats: 10, bookedSeats: 9,  status: 'active'   },
  // ── Taxi ──────────────────────────────────────────────────────────────────
  { _id: '8',  type: 'taxi',    name: 'GrabCab 001',   route: 'On Demand', origin: 'Your Location', destination: 'Anywhere',          departureTime: 'On Call',  arrivalTime: 'Variable',  duration: 'Varies', price: '6.00', totalSeats: 4,  bookedSeats: 0,  status: 'active'   },
  { _id: '9',  type: 'taxi',    name: 'BlueTaxi X2',   route: 'On Demand', origin: 'City Depot',    destination: 'Airport Terminal', departureTime: 'On Call',  arrivalTime: 'Variable',  duration: 'Varies', price: '8.50', totalSeats: 4,  bookedSeats: 0,  status: 'active'   },
  { _id: '10', type: 'taxi',    name: 'AirportRide 3', route: 'Route H', origin: 'City Hub',         destination: 'Int\' Airport',    departureTime: '06:00 AM', arrivalTime: '07:15 AM', duration: '1h 15m', price: '12.00', totalSeats: 4, bookedSeats: 2,  status: 'boarding' },
  // ── Shuttle ───────────────────────────────────────────────────────────────
  { _id: '11', type: 'shuttle', name: 'Campus Shuttle', route: 'Route I', origin: 'Main Gate',       destination: 'Cafeteria Block',  departureTime: '07:00 AM', arrivalTime: '07:20 AM', duration: '20m',    price: '1.00', totalSeats: 20, bookedSeats: 15, status: 'active'   },
  { _id: '12', type: 'shuttle', name: 'Airport Shuttle', route: 'Route J', origin: 'Hotel Row',      destination: 'Departure Hall',   departureTime: '05:30 AM', arrivalTime: '06:15 AM', duration: '45m',    price: '5.00', totalSeats: 18, bookedSeats: 10, status: 'active'   },
  { _id: '13', type: 'shuttle', name: 'Mall Hopper',   route: 'Route K', origin: 'North Terminal',   destination: 'Grand Mall',       departureTime: '10:00 AM', arrivalTime: '10:25 AM', duration: '25m',    price: '2.50', totalSeats: 16, bookedSeats: 3,  status: 'boarding' },
];

const VEHICLE_TYPES = [
  { key: 'all',     label: 'All',     icon: 'apps-outline'       },
  { key: 'bus',     label: 'Bus',     icon: 'bus-outline'        },
  { key: 'van',     label: 'Van',     icon: 'car-outline'        },
  { key: 'taxi',    label: 'Taxi',    icon: 'car-sport-outline'  },
  { key: 'shuttle', label: 'Shuttle', icon: 'train-outline'      },
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
      setBuses(res.data.buses || ALL_VEHICLES);
    } catch {
      setBuses(ALL_VEHICLES);
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
            busId: activeBooking.bus?._id || 'bus1',
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

        {/* Plan a Trip banner */}
        <TouchableOpacity
          style={styles.planTripBanner}
          onPress={() => navigation.navigate('TripPlanner')}
          activeOpacity={0.85}
        >
          <View style={styles.planTripLeft}>
            <View style={styles.planTripIconWrap}>
              <Ionicons name="git-branch-outline" size={20} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.planTripTitle}>Plan a Trip</Text>
              <Text style={styles.planTripSub}>Multi-line routes with transfers</Text>
            </View>
          </View>
          <View style={styles.planTripArrow}>
            <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
          </View>
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
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },

  /* Plan a Trip banner */
  planTripBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primaryMid,
  },
  planTripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planTripIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTripTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 1,
  },
  planTripSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  planTripArrow: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: 16, padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 2,
  },
  statLabel: {
    fontSize: 11, color: COLORS.textMuted, fontWeight: '500',
  },

  /* Section heading */
  sectionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17, fontWeight: '800',
    color: COLORS.textPrimary, letterSpacing: -0.2,
  },
  sectionCount: {
    fontSize: 13, color: COLORS.textMuted, fontWeight: '500',
  },
});

export default HomeScreen;
