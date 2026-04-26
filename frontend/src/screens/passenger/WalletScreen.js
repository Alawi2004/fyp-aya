import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Animated, ActivityIndicator, RefreshControl,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import { getWalletApi, getWalletTransactionsApi, getTopUpLocationsApi } from '../../api/walletApi';
import { useApp } from '../../context/AppContext';
import { COLORS } from '../../constants/colors';

const WalletScreen = () => {
  const headerInsets = useHeaderInsets(20);
  const { walletBalance, updateBalance } = useApp();
  const [transactions, setTransactions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationsExpanded, setLocationsExpanded] = useState(false);
  const balanceAnim = useRef(new Animated.Value(1)).current;

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
      if (locRes.status === 'fulfilled') setLocations(locRes.value.data ?? []);
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

  const visibleLocations = locationsExpanded ? locations : locations.slice(0, 3);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.white} />}
      >
        {/* ── Balance Hero ── */}
        <View style={[styles.hero, headerInsets]}>
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />

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
                For your security, wallet top-ups are handled exclusively at our authorised offices,
                kiosks, and agent counters. Visit any location below to add funds.
              </Text>
            </View>
          </View>

          {/* ── Top-Up Locations ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top-Up Locations</Text>
            {locations.length > 3 && (
              <TouchableOpacity onPress={() => setLocationsExpanded(e => !e)} activeOpacity={0.7}>
                <Text style={styles.seeAll}>{locationsExpanded ? 'Show less' : `See all ${locations.length}`}</Text>
              </TouchableOpacity>
            )}
          </View>

          {locations.length === 0 ? (
            <View style={styles.emptyLocations}>
              <Ionicons name="location-outline" size={28} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No locations listed yet</Text>
            </View>
          ) : (
            visibleLocations.map((loc) => (
              <View key={loc.location_id} style={styles.locationCard}>
                <View style={styles.locationIconWrap}>
                  <Ionicons name="location" size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationName}>{loc.name}</Text>
                  <Text style={styles.locationAddress}>{loc.address}, {loc.city}</Text>
                  {loc.hours ? (
                    <View style={styles.locationHoursRow}>
                      <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
                      <Text style={styles.locationHours}>{loc.hours}</Text>
                    </View>
                  ) : null}
                  {loc.phone ? (
                    <View style={styles.locationPhoneRow}>
                      <Ionicons name="call-outline" size={12} color={COLORS.textMuted} />
                      <Text style={styles.locationPhone}>{loc.phone}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))
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
                      <Text style={styles.txMeta}>
                        <Ionicons name="location-outline" size={11} /> {t.location_name}
                        {t.tx_ref ? `  ·  Ref: ${t.tx_ref}` : ''}
                      </Text>
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

  /* In-person notice */
  noticeBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: COLORS.primaryLight ?? '#EEF2FF',
    borderRadius: 16, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: COLORS.primaryBorder ?? '#C7D2FE',
  },
  noticeIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  noticeTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginBottom: 3 },
  noticeText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },

  /* Sections */
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  seeAll: { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  /* Locations */
  emptyLocations: {
    alignItems: 'center', paddingVertical: 24, gap: 8,
  },
  emptyText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  locationCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  locationIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: COLORS.primaryLight ?? '#EEF2FF',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  locationName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  locationAddress: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  locationHoursRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  locationHours: { fontSize: 12, color: COLORS.textMuted },
  locationPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationPhone: { fontSize: 12, color: COLORS.textMuted },

  /* Transactions */
  txCount: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  emptyTx: {
    alignItems: 'center', paddingVertical: 36, gap: 8,
  },
  emptyTxText: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  emptyTxSub: { fontSize: 13, color: COLORS.textMuted },
  txCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  txIconWrap: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  txDesc: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  txMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  txDate: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },
  txAmount: { fontSize: 15, fontWeight: '800' },
});

export default WalletScreen;
