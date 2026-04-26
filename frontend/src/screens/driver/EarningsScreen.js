import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, Animated,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

const PERIODS = ['Today', 'Week', 'Month', 'All Time'];

const DATA = {
  Today:      { total: 124.50, trips: 3,   growth: '+8%',  rating: 4.9, onTime: '100%', perTrip: 41.50 },
  Week:       { total: 683.00, trips: 18,  growth: '+12%', rating: 4.8, onTime: '94%',  perTrip: 37.94 },
  Month:      { total: 2810.0, trips: 74,  growth: '+5%',  rating: 4.8, onTime: '92%',  perTrip: 37.97 },
  'All Time': { total: 18420,  trips: 612, growth: '+22%', rating: 4.8, onTime: '91%',  perTrip: 30.10 },
};

const TRANSACTIONS = [
  { id: '1', route: 'Route A — City Center',   time: 'Today, 09:15',    amount: 54.00, pax: 18, duration: '1h 15m' },
  { id: '2', route: 'Route C — Airport Express', time: 'Today, 07:00', amount: 84.00, pax: 28, duration: '1h 00m' },
  { id: '3', route: 'Route B — University',    time: 'Yesterday, 13:50', amount: 66.00, pax: 22, duration: '50m'   },
  { id: '4', route: 'Route A — City Center',   time: 'Yesterday, 09:15', amount: 54.00, pax: 18, duration: '1h 15m'},
];

const EarningsScreen = ({ navigation }) => {
  const headerInsets = useHeaderInsets();
  const [period, setPeriod] = useState('Week');
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const data = DATA[period];

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const changePeriod = (p) => {
    setPeriod(p);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.00, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      {/* ─── Hero ─── */}
      <View style={[styles.hero, headerInsets]}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />

        <View style={styles.heroTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Earnings</Text>
          <TouchableOpacity style={styles.exportBtn}>
            <Ionicons name="download-outline" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Balance */}
        <Animated.View style={[styles.balanceBlock, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.balanceLbl}>Total Earned</Text>
          <Text style={styles.balanceAmt}>
            ${data.total.toLocaleString('en', { minimumFractionDigits: 2 })}
          </Text>
          <View style={styles.growthRow}>
            <View style={styles.growthChip}>
              <Ionicons name="trending-up" size={11} color={COLORS.secondary} />
              <Text style={styles.growthText}>{data.growth} vs last period</Text>
            </View>
            <View style={styles.perTripChip}>
              <Text style={styles.perTripText}>${data.perTrip.toFixed(2)} / trip avg</Text>
            </View>
          </View>
        </Animated.View>

        {/* Period selector */}
        <View style={styles.periodWrap}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => changePeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        style={{ opacity: fadeAnim }}
      >
        {/* Summary cards */}
        <View style={styles.summaryRow}>
          {[
            { icon: 'receipt-outline',   label: 'Trips',    value: String(data.trips), bg: COLORS.primaryLight,  iconColor: COLORS.primary   },
            { icon: 'star',              label: 'Rating',   value: String(data.rating), bg: COLORS.warningLight, iconColor: COLORS.warning    },
            { icon: 'checkmark-circle',  label: 'On Time',  value: data.onTime,         bg: COLORS.secondaryLight, iconColor: COLORS.secondary },
          ].map(c => (
            <View key={c.label} style={[styles.summaryCard, { backgroundColor: c.bg }]}>
              <View style={[styles.summaryIcon, { backgroundColor: c.iconColor }]}>
                <Ionicons name={c.icon} size={15} color={COLORS.white} />
              </View>
              <Text style={styles.summaryVal}>{c.value}</Text>
              <Text style={styles.summaryLbl}>{c.label}</Text>
            </View>
          ))}
        </View>

        {/* Earnings breakdown bar */}
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>Earnings Breakdown</Text>
          <View style={styles.breakdownBar}>
            <View style={[styles.breakdownFill, { width: '68%', backgroundColor: COLORS.primary }]} />
            <View style={[styles.breakdownFill, { width: '22%', backgroundColor: COLORS.secondary }]} />
            <View style={[styles.breakdownFill, { width: '10%', backgroundColor: COLORS.warning }]} />
          </View>
          <View style={styles.breakdownLegend}>
            {[
              { color: COLORS.primary,   label: 'Base Fare',  pct: '68%' },
              { color: COLORS.secondary, label: 'Bonuses',    pct: '22%' },
              { color: COLORS.warning,   label: 'Incentives', pct: '10%' },
            ].map(l => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                <Text style={styles.legendText}>{l.label}</Text>
                <Text style={styles.legendPct}>{l.pct}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Trip Earnings */}
        <Text style={styles.sectionTitle}>Trip Earnings</Text>
        {TRANSACTIONS.map(tx => (
          <View key={tx.id} style={styles.txCard}>
            <View style={styles.txIconWrap}>
              <Ionicons name="bus-outline" size={16} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.txRoute}>{tx.route}</Text>
              <View style={styles.txMeta}>
                <Ionicons name="time-outline" size={10} color={COLORS.textMuted} />
                <Text style={styles.txMetaText}>{tx.time}</Text>
                <View style={styles.txMetaDot} />
                <Ionicons name="people-outline" size={10} color={COLORS.textMuted} />
                <Text style={styles.txMetaText}>{tx.pax} pax</Text>
                <View style={styles.txMetaDot} />
                <Ionicons name="hourglass-outline" size={10} color={COLORS.textMuted} />
                <Text style={styles.txMetaText}>{tx.duration}</Text>
              </View>
            </View>
            <View style={styles.txAmountWrap}>
              <Text style={styles.txAmount}>+${tx.amount.toFixed(2)}</Text>
            </View>
          </View>
        ))}

        <View style={{ height: 32 }} />
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },

  /* Hero */
  hero: {
    backgroundColor: COLORS.headerBg,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  heroDecor1: {
    position: 'absolute', top: -60, right: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroDecor2: {
    position: 'absolute', bottom: -30, left: 40,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 20,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  exportBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Balance */
  balanceBlock: { alignItems: 'center', marginBottom: 20, paddingHorizontal: 20 },
  balanceLbl: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  balanceAmt: { fontSize: 42, fontWeight: '900', color: COLORS.white, marginTop: 4, letterSpacing: -1.5 },
  growthRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  growthChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(16,185,129,0.2)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  growthText: { fontSize: 11, fontWeight: '700', color: COLORS.secondary },
  perTripChip: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  perTripText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },

  /* Period */
  periodWrap: {
    flexDirection: 'row', marginHorizontal: 20, gap: 6,
    backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 14, padding: 4,
  },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 11, alignItems: 'center' },
  periodBtnActive: { backgroundColor: COLORS.primary },
  periodText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  periodTextActive: { color: COLORS.white },

  /* Summary cards */
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6 },
  summaryIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  summaryVal: { fontSize: 18, fontWeight: '900', color: COLORS.textPrimary },
  summaryLbl: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase' },

  /* Breakdown card */
  breakdownCard: {
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 16, marginBottom: 20,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  breakdownTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12 },
  breakdownBar: {
    flexDirection: 'row', height: 8, borderRadius: 99, overflow: 'hidden',
    backgroundColor: COLORS.border, gap: 1, marginBottom: 12,
  },
  breakdownFill: { height: '100%' },
  breakdownLegend: { flexDirection: 'row', gap: 0 },
  legendItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', flex: 1 },
  legendPct: { fontSize: 11, fontWeight: '800', color: COLORS.textPrimary },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 10, letterSpacing: -0.2 },

  /* Transaction card */
  txCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 8,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  txIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  txRoute: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 5 },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  txMetaText: { fontSize: 10, color: COLORS.textMuted, fontWeight: '500' },
  txMetaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.border },
  txAmountWrap: {
    backgroundColor: COLORS.secondaryLight, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  txAmount: { fontSize: 14, fontWeight: '800', color: COLORS.secondary },
});

export default EarningsScreen;
