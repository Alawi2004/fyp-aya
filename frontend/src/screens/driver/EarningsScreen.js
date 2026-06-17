import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  StatusBar, Alert, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { COLORS, PURPLE } from '../../constants/colors';
import GradientFill from '../../components/common/GradientFill';
import FadeInView from '../../components/common/FadeInView';
import PressableScale from '../../components/common/PressableScale';
import { SkeletonCardList } from '../../components/common/Skeleton';
import CountUp from '../../components/common/CountUp';
import { getDriverTripsApi } from '../../api/driverApi';
import { useApp } from '../../context/AppContext';

const PERIODS = ['Today', 'Week', 'Month', 'All Time'];

// Distinct colors for the by-route breakdown segments
const SEG_COLORS = [PURPLE.primary, COLORS.secondary, COLORS.warning, '#EC4899', '#0EA5E9', COLORS.textMuted];


const fmtDate = (d) => {
  if (!d) return '—';
  const now = new Date();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString())   return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtTime = (d) => (d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const fmtDur  = (min) => {
  if (!min || min <= 0) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

function normalise(t) {
  const start = t.start_time ? new Date(t.start_time) : null;
  const end   = t.end_time ? new Date(t.end_time) : null;
  return {
    id:          String(t.trip_id ?? t._id ?? Math.random()),
    route:       t.route_name ?? t.routeName ?? 'Route',
    origin:      t.start_location ?? '—',
    destination: t.end_location ?? '—',
    start,
    amount:      parseFloat(t.earnings ?? 0),
    pax:         Number(t.passengers ?? 0),
    totalSeats:  Number(t.totalSeats ?? t.capacity ?? 0),
    status:      t.status ?? 'completed',
    plate:       t.plate_number ?? null,
    vehicle:     t.vehicle_model ?? null,
    durationMin: start && end ? Math.round((end - start) / 60000) : null,
  };
}

const EarningsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { currency, exchangeRate, fmtMoney } = useApp();
  const [trips,     setTrips]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [period,    setPeriod]    = useState('Week');
  const [exporting, setExporting] = useState(false);
  const [selected,  setSelected]  = useState(null); // trip for the detail sheet

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await getDriverTripsApi();
      const data = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.trips) ? res.data.trips : []);
      setTrips(data.map(normalise));
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not reach the server.');
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Period filtering (real, from trip start_time) ──────────────────────────
  const inPeriod = useCallback((d) => {
    if (period === 'All Time') return true;
    if (!d) return false;
    const now = new Date();
    if (period === 'Today') return d.toDateString() === now.toDateString();
    const days = period === 'Week' ? 7 : 30;
    const cutoff = new Date(now); cutoff.setDate(now.getDate() - days);
    return d >= cutoff;
  }, [period]);

  // Completed trips that actually earned, within the selected period
  const periodTrips = useMemo(
    () => trips.filter(t => t.status === 'completed' && inPeriod(t.start)),
    [trips, inPeriod],
  );

  const total    = periodTrips.reduce((s, t) => s + t.amount, 0);
  const count    = periodTrips.length;
  const perTrip  = count ? total / count : 0;
  const totalPax = periodTrips.reduce((s, t) => s + t.pax, 0);

  // ── Earnings by route (real breakdown) ─────────────────────────────────────
  const breakdown = useMemo(() => {
    const byRoute = {};
    periodTrips.forEach(t => { byRoute[t.route] = (byRoute[t.route] || 0) + t.amount; });
    let arr = Object.entries(byRoute)
      .map(([route, amt]) => ({ route, amt }))
      .sort((a, b) => b.amt - a.amt);
    if (arr.length > 5) {
      const top = arr.slice(0, 5);
      const other = arr.slice(5).reduce((s, r) => s + r.amt, 0);
      arr = [...top, { route: 'Other routes', amt: other }];
    }
    return arr.map((r, i) => ({
      ...r,
      color: SEG_COLORS[Math.min(i, SEG_COLORS.length - 1)],
      pct: total > 0 ? (r.amt / total) * 100 : 0,
    }));
  }, [periodTrips, total]);

  // ── PDF export (real data) ─────────────────────────────────────────────────
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const rows = periodTrips.map(t => `
        <tr>
          <td>${t.route}</td>
          <td>${t.origin} → ${t.destination}</td>
          <td>${fmtDate(t.start)} ${fmtTime(t.start)}</td>
          <td>${t.pax}</td>
          <td>${fmtDur(t.durationMin)}</td>
          <td style="color:#7C3AED;font-weight:700">${fmtMoney(t.amount)}</td>
        </tr>`).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <style>
          body{font-family:-apple-system,Arial,sans-serif;margin:0;padding:32px;color:#1E293B;}
          .header{background:linear-gradient(135deg,#4C1D95,#7C3AED);color:#fff;padding:24px 32px;margin:-32px -32px 28px;}
          .header h1{margin:0 0 4px;font-size:22px;} .header p{margin:0;font-size:12px;opacity:.75;}
          .badge{display:inline-block;background:rgba(255,255,255,.2);border-radius:999px;padding:4px 12px;font-size:12px;margin-top:10px;}
          .total{text-align:center;margin:22px 0;} .total .amt{font-size:44px;font-weight:900;color:#7C3AED;}
          .total .lbl{font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;}
          .stats{display:flex;gap:16px;margin-bottom:26px;} .card{flex:1;background:#F5F3FF;border-radius:12px;padding:16px;text-align:center;}
          .card .v{font-size:22px;font-weight:800;color:#7C3AED;} .card .l{font-size:11px;color:#94A3B8;margin-top:4px;text-transform:uppercase;}
          h2{font-size:15px;color:#6D28D9;border-bottom:2px solid #E2E8F0;padding-bottom:8px;margin-bottom:12px;}
          table{width:100%;border-collapse:collapse;font-size:13px;} thead tr{background:#F1F5F9;}
          th{padding:10px 12px;text-align:left;font-size:11px;color:#64748B;text-transform:uppercase;}
          td{padding:10px 12px;border-bottom:1px solid #F1F5F9;}
          .footer{margin-top:28px;text-align:center;font-size:11px;color:#94A3B8;}
        </style></head><body>
        <div class="header"><h1>Earnings Report</h1>
          <p>Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <div class="badge">${period}</div></div>
        <div class="total"><div class="lbl">Total Earned</div><div class="amt">${fmtMoney(total)}</div></div>
        <div class="stats">
          <div class="card"><div class="v">${count}</div><div class="l">Trips</div></div>
          <div class="card"><div class="v">${totalPax}</div><div class="l">Passengers</div></div>
          <div class="card"><div class="v">${fmtMoney(perTrip)}</div><div class="l">Per Trip</div></div>
        </div>
        <h2>Trip Earnings</h2>
        <table><thead><tr><th>Route</th><th>Journey</th><th>Date</th><th>Pax</th><th>Duration</th><th>Amount</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#94A3B8;padding:20px">No trips in this period</td></tr>'}</tbody></table>
        <div class="footer">Yalla Transit — Driver Earnings · Confidential · ${new Date().getFullYear()}</div>
        </body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Earnings — ${period}` });
      } else {
        Alert.alert('Saved', `PDF saved to:\n${uri}`);
      }
    } catch (err) {
      Alert.alert('Export Failed', err?.message || 'Could not generate PDF.');
    } finally {
      setExporting(false);
    }
  };

  const SUMMARY = [
    { icon: 'receipt-outline',  label: 'Trips',      value: String(count),       bg: PURPLE.light,         color: PURPLE.primary   },
    { icon: 'people-outline',   label: 'Passengers', value: String(totalPax),    bg: COLORS.secondaryLight, color: COLORS.secondary },
    { icon: 'trending-up',      label: 'Per Trip',   value: fmtMoney(perTrip),   bg: COLORS.warningLight,   color: COLORS.warning   },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* ── Gradient hero ── */}
      <View style={styles.hero}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill id="earnHero" colors={PURPLE.gradient} vertical />
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />
        </View>

        <View style={[styles.heroTop, { paddingTop: insets.top + 8 }]}>
          <PressableScale style={styles.iconBtn} onPress={() => navigation.goBack()} scaleTo={0.88}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </PressableScale>
          <Text style={styles.heroTitle}>Earnings</Text>
          <PressableScale
            style={[styles.iconBtn, (exporting || count === 0) && { opacity: 0.5 }]}
            onPress={handleExport}
            disabled={exporting || count === 0}
            scaleTo={0.88}
          >
            <Ionicons name={exporting ? 'hourglass-outline' : 'download-outline'} size={18} color={COLORS.white} />
          </PressableScale>
        </View>

        {/* Balance */}
        <View style={styles.balanceBlock}>
          <Text style={styles.balanceLbl}>Total Earned · {period}</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceCurrency}>{currency}</Text>
            <CountUp value={total * exchangeRate} decimals={exchangeRate >= 100 ? 0 : 2} style={styles.balanceAmt} />
          </View>
          {count > 0 && (
            <View style={styles.perTripChip}>
              <Ionicons name="trending-up" size={11} color={COLORS.white} />
              <Text style={styles.perTripText}>{fmtMoney(perTrip)} / trip avg · {count} trip{count !== 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>

        {/* Period selector */}
        <View style={styles.periodWrap}>
          {PERIODS.map(p => (
            <PressableScale
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
              scaleTo={0.94}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]} numberOfLines={1}>{p}</Text>
            </PressableScale>
          ))}
        </View>
      </View>

      {loading ? (
        <SkeletonCardList count={4} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {error ? (
            <View style={styles.errorCard}>
              <Ionicons name="cloud-offline-outline" size={20} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
              <PressableScale style={styles.retryBtn} onPress={load} scaleTo={0.94}>
                <Text style={styles.retryText}>Retry</Text>
              </PressableScale>
            </View>
          ) : (
            <>
              {/* Summary cards */}
              <FadeInView index={0}>
                <View style={styles.summaryRow}>
                  {SUMMARY.map(c => (
                    <View key={c.label} style={[styles.summaryCard, { backgroundColor: c.bg }]}>
                      <View style={[styles.summaryIcon, { backgroundColor: c.color }]}>
                        <Ionicons name={c.icon} size={15} color={COLORS.white} />
                      </View>
                      <Text style={styles.summaryVal} numberOfLines={1} adjustsFontSizeToFit>{c.value}</Text>
                      <Text style={styles.summaryLbl}>{c.label}</Text>
                    </View>
                  ))}
                </View>
              </FadeInView>

              {/* Earnings by route breakdown */}
              {breakdown.length > 0 && (
                <FadeInView index={1}>
                  <View style={styles.breakdownCard}>
                    <Text style={styles.breakdownTitle}>Earnings by Route</Text>
                    <View style={styles.breakdownBar}>
                      {breakdown.map((b, i) => (
                        <View key={i} style={{ width: `${Math.max(b.pct, 2)}%`, height: '100%', backgroundColor: b.color }} />
                      ))}
                    </View>
                    <View style={styles.legend}>
                      {breakdown.map((b, i) => (
                        <View key={i} style={styles.legendRow}>
                          <View style={[styles.legendDot, { backgroundColor: b.color }]} />
                          <Text style={styles.legendText} numberOfLines={1}>{b.route}</Text>
                          <Text style={styles.legendAmt}>{fmtMoney(b.amt)}</Text>
                          <Text style={styles.legendPct}>{b.pct.toFixed(0)}%</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </FadeInView>
              )}

              {/* Trip earnings */}
              <Text style={styles.sectionTitle}>Trip Earnings</Text>
              {periodTrips.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="wallet-outline" size={34} color={PURPLE.primary} />
                  </View>
                  <Text style={styles.emptyText}>No earnings in this period</Text>
                  <Text style={styles.emptySub}>Completed trips will appear here.</Text>
                </View>
              ) : (
                periodTrips.map((t, i) => (
                  <FadeInView key={t.id} index={i}>
                    <PressableScale style={styles.txCard} onPress={() => setSelected(t)} scaleTo={0.98}>
                      <View style={styles.txIconWrap}>
                        <Ionicons name="bus" size={16} color={PURPLE.primary} />
                      </View>
                      <View style={styles.txBody}>
                        <Text style={styles.txRoute} numberOfLines={1}>{t.route}</Text>
                        <Text style={styles.txDate}>{fmtDate(t.start)} · {fmtTime(t.start)}</Text>
                        <View style={styles.txPills}>
                          <View style={styles.txPill}>
                            <Ionicons name="people-outline" size={10} color={COLORS.textMuted} />
                            <Text style={styles.txPillText}>{t.pax} pax</Text>
                          </View>
                          <View style={styles.txPill}>
                            <Ionicons name="hourglass-outline" size={10} color={COLORS.textMuted} />
                            <Text style={styles.txPillText}>{fmtDur(t.durationMin)}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.txRight}>
                        <Text style={styles.txAmount}>+{fmtMoney(t.amount)}</Text>
                        <Ionicons name="chevron-forward" size={15} color={COLORS.textMuted} />
                      </View>
                    </PressableScale>
                  </FadeInView>
                ))
              )}
            </>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ── Trip detail sheet ── */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <PressableScale style={styles.modalOverlay} onPress={() => setSelected(null)} scaleTo={1} />
        {selected && (
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.sheetHandle} />

            {/* Amount header */}
            <View style={styles.sheetHeader}>
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <GradientFill id="earnSheet" colors={['#6D28D9', '#8B5CF6']} radius={20} vertical={false} />
              </View>
              <Text style={styles.sheetAmount}>+{fmtMoney(selected.amount)}</Text>
              <Text style={styles.sheetAmountSub}>{selected.route}</Text>
              <View style={styles.sheetStatusPill}>
                <Ionicons name="checkmark-circle" size={13} color={COLORS.white} />
                <Text style={styles.sheetStatusText}>{(selected.status || 'completed').charAt(0).toUpperCase() + (selected.status || 'completed').slice(1)}</Text>
              </View>
            </View>

            {/* Detail rows */}
            <View style={styles.detailCard}>
              <DetailRow icon="navigate-outline" label="Journey" value={`${selected.origin}  →  ${selected.destination}`} />
              <DetailRow icon="calendar-outline" label="Date" value={fmtDate(selected.start)} />
              <DetailRow icon="time-outline"     label="Time" value={fmtTime(selected.start)} />
              <DetailRow icon="hourglass-outline" label="Duration" value={fmtDur(selected.durationMin)} />
              <DetailRow icon="people-outline"   label="Passengers" value={selected.totalSeats ? `${selected.pax} / ${selected.totalSeats} seats` : `${selected.pax}`} />
              {selected.vehicle || selected.plate ? (
                <DetailRow icon="car-outline" label="Vehicle" value={[selected.vehicle, selected.plate].filter(Boolean).join(' · ')} />
              ) : null}
              <DetailRow icon="pricetag-outline" label="Trip ID" value={`#${selected.id}`} last />
            </View>

            <PressableScale style={styles.closeBtn} onPress={() => setSelected(null)} scaleTo={0.96}>
              <Text style={styles.closeText}>Close</Text>
            </PressableScale>
          </View>
        )}
      </Modal>
    </View>
  );
};

const DetailRow = ({ icon, label, value, last }) => (
  <View style={[styles.detailRow, last && { borderBottomWidth: 0 }]}>
    <View style={styles.detailIcon}>
      <Ionicons name={icon} size={15} color={PURPLE.primary} />
    </View>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} numberOfLines={2}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },

  /* Hero */
  hero: {
    backgroundColor: PURPLE.deep,
    paddingBottom: 16,
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroDecor1: { position: 'absolute', top: -70, right: -60, width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroDecor2: { position: 'absolute', bottom: -30, left: 30, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.05)' },
  heroTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 16,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },

  balanceBlock: { alignItems: 'center', marginBottom: 18, paddingHorizontal: 20 },
  balanceLbl: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  balanceCurrency: { fontSize: 22, fontWeight: '800', color: COLORS.white, marginTop: 6, marginRight: 2 },
  balanceAmt: { fontSize: 42, fontWeight: '900', color: COLORS.white, letterSpacing: -1.5 },
  perTripChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  perTripText: { fontSize: 11, fontWeight: '700', color: COLORS.white },

  periodWrap: {
    flexDirection: 'row', marginHorizontal: 20, gap: 4,
    backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 14, padding: 4,
  },
  periodBtn: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  periodBtnActive: { backgroundColor: COLORS.white },
  periodText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  periodTextActive: { color: PURPLE.dark, fontWeight: '800' },

  /* Summary cards */
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6 },
  summaryIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  summaryVal: { fontSize: 16, fontWeight: '900', color: COLORS.textPrimary },
  summaryLbl: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase' },

  /* Breakdown */
  breakdownCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 20,
    shadowColor: PURPLE.deep, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2,
  },
  breakdownTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 14 },
  breakdownBar: {
    flexDirection: 'row', height: 10, borderRadius: 99, overflow: 'hidden',
    backgroundColor: COLORS.border, gap: 2, marginBottom: 14,
  },
  legend: { gap: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  legendAmt: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
  legendPct: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, width: 36, textAlign: 'right' },

  sectionTitle: { fontSize: 16, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 12, letterSpacing: -0.2 },

  /* Trip card */
  txCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 10,
    shadowColor: PURPLE.deep, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
  },
  txIconWrap: { width: 42, height: 42, borderRadius: 13, backgroundColor: PURPLE.light, alignItems: 'center', justifyContent: 'center' },
  txBody: { flex: 1, minWidth: 0 },
  txRoute: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  txDate: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', marginTop: 2 },
  txPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  txPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surfaceAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  txPillText: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '700' },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { fontSize: 15, fontWeight: '900', color: COLORS.secondary },

  /* Empty / error */
  emptyWrap: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: PURPLE.light, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyText: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  emptySub: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  errorCard: {
    alignItems: 'center', gap: 10, padding: 24, backgroundColor: COLORS.white, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.dangerMid,
  },
  errorText: { fontSize: 13, color: COLORS.danger, fontWeight: '600', textAlign: 'center' },
  retryBtn: { backgroundColor: PURPLE.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontSize: 13, fontWeight: '800', color: COLORS.white },

  /* Detail sheet */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.white, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 20,
  },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { borderRadius: 20, padding: 20, alignItems: 'center', overflow: 'hidden', marginBottom: 16 },
  sheetAmount: { fontSize: 36, fontWeight: '900', color: COLORS.white, letterSpacing: -1 },
  sheetAmountSub: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginTop: 2 },
  sheetStatusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
  },
  sheetStatusText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  detailCard: {
    backgroundColor: COLORS.background, borderRadius: 16, paddingHorizontal: 14,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  detailIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: PURPLE.light, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600', width: 86 },
  detailValue: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'right' },
  closeBtn: { backgroundColor: COLORS.surfaceAlt, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeText: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
});

export default EarningsScreen;
