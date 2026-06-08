import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Animated, ActivityIndicator, RefreshControl,
  Platform, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import { getWalletApi, getWalletTransactionsApi, getTopUpLocationsApi } from '../../api/walletApi';
import { useApp } from '../../context/AppContext';
import { COLORS } from '../../constants/colors';

const MAP_REGION = {
  latitude: 33.8938,
  longitude: 35.5200,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};

const hasCoords = (loc) => {
  const lat = Number(loc?.latitude);
  const lng = Number(loc?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
};

const WalletScreen = () => {
  const navigation  = useNavigation();
  const headerInsets = useHeaderInsets(20);
  const { walletBalance, updateBalance } = useApp();
  const [transactions, setTransactions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'list'
  const [selectedStation, setSelectedStation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locPermission, setLocPermission] = useState(null);
  const balanceAnim = useRef(new Animated.Value(1)).current;
  const mapRef = useRef(null);
  const listScrollRef = useRef(null);

  useEffect(() => { requestLocation(); }, []);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocPermission(status);
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      }
    } catch (_) {}
  };

  const loadData = useCallback(async () => {
    try {
      const [walletRes, txRes, locRes] = await Promise.allSettled([
        getWalletApi(),
        getWalletTransactionsApi(),
        getTopUpLocationsApi(),
      ]);
      if (walletRes.status === 'fulfilled') {
        updateBalance(walletRes.value.data.balance ?? 0);
        Animated.sequence([
          Animated.timing(balanceAnim, { toValue: 1.04, duration: 160, useNativeDriver: true }),
          Animated.timing(balanceAnim, { toValue: 1,    duration: 200, useNativeDriver: true }),
        ]).start();
      }
      if (txRes.status === 'fulfilled') setTransactions(txRes.value.data ?? []);

      const apiLocations = locRes.status === 'fulfilled' ? (locRes.value.data ?? []) : [];
      setLocations(apiLocations);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const totalSpent = transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + parseFloat(t.amount ?? 0), 0);

  const handleMarkerPress = (loc) => {
    setSelectedStation(loc.location_id);
    if (viewMode === 'map' && hasCoords(loc)) {
      mapRef.current?.animateToRegion({
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }, 400);
    }
  };

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      }, 400);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      <ScrollView
        ref={listScrollRef}
        showsVerticalScrollIndicator={false}
        bounces={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.white} />}
      >
        {/* ── Balance Hero ── */}
        <View style={[styles.hero, headerInsets]}>
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />

          {navigation.canGoBack() ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.heroBackBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={22} color={COLORS.white} />
            </TouchableOpacity>
          ) : null}

          <Text style={styles.heroLabel}>Available Balance</Text>
          <Animated.Text style={[styles.heroAmount, { transform: [{ scale: balanceAnim }] }]}>
            ${(walletBalance ?? 0).toFixed(2)}
          </Animated.Text>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Ionicons name="arrow-up-circle" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.heroStatValue}>${totalSpent.toFixed(2)}</Text>
              <Text style={styles.heroStatLabel}>Total Spent</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Ionicons name="receipt-outline" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.heroStatValue}>{transactions.filter(t => t.type === 'debit').length}</Text>
              <Text style={styles.heroStatLabel}>Trips Paid</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>

          {/* ── In-Person Recharge Notice ── */}
          <View style={styles.noticeBanner}>
            <View style={styles.noticeIcon}>
              <Ionicons name="information-circle" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>In-Person Recharge Only</Text>
              <Text style={styles.noticeText}>
                Wallet top-ups are handled at authorised offices, kiosks, and agent counters.
                Visit any nearby location below to add funds.
              </Text>
            </View>
          </View>

          {/* ── Top-Up Locations header + toggle ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearest Top-Up Stations</Text>
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
                onPress={() => setViewMode('map')}
              >
                <Ionicons name="map-outline" size={14} color={viewMode === 'map' ? COLORS.white : COLORS.textMuted} />
                <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>Map</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
                onPress={() => setViewMode('list')}
              >
                <Ionicons name="list-outline" size={14} color={viewMode === 'list' ? COLORS.white : COLORS.textMuted} />
                <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Map View ── */}
          {viewMode === 'map' && (
            <View style={styles.mapContainer}>
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={Platform.OS === 'android' ? 'google' : PROVIDER_DEFAULT}
                initialRegion={userLocation
                  ? { ...userLocation, latitudeDelta: 0.10, longitudeDelta: 0.10 }
                  : MAP_REGION
                }
                showsUserLocation={locPermission === 'granted'}
                showsMyLocationButton={false}
              >
                {locations.filter(hasCoords).map((loc, i) => (
                  <Marker
                    key={`marker-${loc.location_id ?? i}`}
                    coordinate={{ latitude: Number(loc.latitude), longitude: Number(loc.longitude) }}
                    title={loc.name}
                    description={`${loc.address}, ${loc.city}`}
                    onPress={() => handleMarkerPress(loc)}
                    pinColor={selectedStation === loc.location_id ? COLORS.secondary : COLORS.primary}
                  />
                ))}
              </MapView>

              {/* My Location button */}
              {locPermission === 'granted' && (
                <TouchableOpacity style={styles.myLocBtn} onPress={centerOnUser} activeOpacity={0.85}>
                  <Ionicons name="locate-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              )}

              {/* Station count badge */}
              <View style={styles.stationBadge}>
                <Ionicons name="location" size={13} color={COLORS.white} />
                <Text style={styles.stationBadgeText}>{locations.length} stations nearby</Text>
              </View>
            </View>
          )}

          {/* ── Station list (always visible under map, or as full list) ── */}
          {locations.length === 0 ? (
            <View style={styles.emptyLocations}>
              <Ionicons name="location-outline" size={28} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No locations found</Text>
            </View>
          ) : (
            <View style={viewMode === 'map' ? styles.compactList : undefined}>
              {locations.map((loc, i) => (
                <TouchableOpacity
                  key={`loc-${loc.location_id ?? i}`}
                  style={[
                    styles.locationCard,
                    selectedStation === loc.location_id && styles.locationCardSelected,
                  ]}
                  onPress={() => {
                    handleMarkerPress(loc);
                    setViewMode('map');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.locationIconWrap,
                    selectedStation === loc.location_id && { backgroundColor: COLORS.secondary },
                  ]}>
                    <Ionicons
                      name="location"
                      size={18}
                      color={selectedStation === loc.location_id ? COLORS.white : COLORS.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locationName}>{loc.name}</Text>
                    <Text style={styles.locationAddress}>{loc.address}, {loc.city}</Text>
                    {loc.hours ? (
                      <View style={styles.locationMetaRow}>
                        <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
                        <Text style={styles.locationMeta}>{loc.hours}</Text>
                      </View>
                    ) : null}
                    {loc.phone ? (
                      <TouchableOpacity
                        style={styles.locationMetaRow}
                        onPress={() => Linking.openURL(`tel:${loc.phone}`).catch(() => {})}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="call-outline" size={12} color={COLORS.textMuted} />
                        <Text style={[styles.locationMeta, styles.locationPhoneLink]}>{loc.phone}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Transaction History ── */}
          <View style={[styles.sectionHeader, { marginTop: 8 }]}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            <Text style={styles.txCount}>{transactions.length} records</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
          ) : transactions.length === 0 ? (
            <View style={styles.emptyTx}>
              <Ionicons name="receipt-outline" size={36} color={COLORS.textMuted} />
              <Text style={styles.emptyTxText}>No transactions yet</Text>
              <Text style={styles.emptyTxSub}>Your payment history will appear here</Text>
            </View>
          ) : (
            transactions.map((t, idx) => {
              const isCredit = t.type === 'credit';
              return (
                <View
                  key={t.transaction_id ?? idx}
                  style={[styles.txCard, idx === transactions.length - 1 && { marginBottom: 0 }]}
                >
                  <View style={[styles.txIconWrap, { backgroundColor: isCredit ? COLORS.secondaryLight : COLORS.dangerLight }]}>
                    <Ionicons
                      name={isCredit ? 'arrow-down' : 'arrow-up'}
                      size={16}
                      color={isCredit ? COLORS.secondary : COLORS.danger}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txDesc}>{t.description}</Text>
                    {isCredit && t.location_name ? (
                      <Text style={styles.txMeta}>{t.location_name}{t.tx_ref ? `  ·  Ref: ${t.tx_ref}` : ''}</Text>
                    ) : null}
                    {isCredit && t.processed_by ? (
                      <Text style={styles.txMeta}>Processed by {t.processed_by}</Text>
                    ) : null}
                    <Text style={styles.txDate}>
                      {new Date(t.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: isCredit ? COLORS.secondary : COLORS.danger }]}>
                    {isCredit ? '+' : '-'}${parseFloat(t.amount).toFixed(2)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Hero */
  hero: {
    backgroundColor: COLORS.headerBg,
    paddingBottom: 32, alignItems: 'center', paddingHorizontal: 24,
    overflow: 'hidden',
  },
  heroBackBtn: {
    alignSelf: 'flex-start',
    marginBottom: 14,
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroDecor1: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.05)', top: -70, right: -60,
  },
  heroDecor2: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: -40,
  },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  heroAmount: {
    fontSize: 56, fontWeight: '900', color: COLORS.white,
    marginTop: 4, marginBottom: 16, letterSpacing: -1,
  },
  heroStats: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 20,
    gap: 20,
  },
  heroStat: { alignItems: 'center', gap: 2 },
  heroStatValue: { fontSize: 14, fontWeight: '800', color: COLORS.white, marginTop: 2 },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },

  /* Body */
  body: { padding: 16 },

  /* Notice */
  noticeBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: COLORS.primaryMid,
  },
  noticeIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  noticeTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginBottom: 3 },
  noticeText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },

  /* View toggle */
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8,
  },
  toggleBtnActive: { backgroundColor: COLORS.primary },
  toggleText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  toggleTextActive: { color: COLORS.white },

  /* Map */
  mapContainer: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
    height: 240,
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  map: { flex: 1 },
  myLocBtn: {
    position: 'absolute',
    bottom: 12, right: 12,
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  stationBadge: {
    position: 'absolute',
    top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primary,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  stationBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.white },

  /* Compact list under map */
  compactList: {},

  /* Locations */
  emptyLocations: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  locationCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 14, marginBottom: 8,
    borderWidth: 1.5, borderColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  locationCardSelected: {
    borderColor: COLORS.secondary,
    backgroundColor: COLORS.secondaryLight,
  },
  locationIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  locationName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  locationAddress: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 3 },
  locationMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  locationMeta: { fontSize: 11, color: COLORS.textMuted },
  locationPhoneLink: { color: COLORS.primary, fontWeight: '600', textDecorationLine: 'underline' },

  /* Transactions */
  txCount: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  emptyTx: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTxText: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  emptyTxSub: { fontSize: 13, color: COLORS.textMuted },
  txCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  txIconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  txDesc: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  txMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  txDate: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },
  txAmount: { fontSize: 15, fontWeight: '800' },
});

export default WalletScreen;
