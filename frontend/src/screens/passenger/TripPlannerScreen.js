import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Share,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { getStopsApi } from '../../api/stopsApi';
import { getMultiTripRouteApi } from '../../api/multiTripApi';
import { useApp } from '../../context/AppContext';
import { MOCK_STOPS, stopsWithDistance, formatDist } from '../../utils/mockStops';
import MultiTripBottomSheet from '../../components/passenger/MultiTripBottomSheet';

// Approximate exchange rate used only for balance sufficiency check (display purposes)
const LBP_PER_USD = 89_500;

const MODES = [
  { key: 'fastest', label: 'Fastest', icon: 'flash-outline' },
  { key: 'easiest', label: 'Easiest', icon: 'leaf-outline' },
  { key: 'cheapest', label: 'Cheapest', icon: 'cash-outline' },
];

const money = (v) => `${Number(v || 0).toLocaleString()} LBP`;

// ── Stop Picker Modal (with GPS auto-suggest) ──────────────────────────────────
const StopPickerModal = ({ visible, onClose, onSelect, title, stops, loadingStops, userLocation }) => {
  const [query, setQuery] = useState('');

  const allStops = useMemo(() => {
    if (stops.length > 0) return stops;
    return MOCK_STOPS;
  }, [stops]);

  const filtered = useMemo(
    () => allStops.filter((s) => s.stop_name.toLowerCase().includes(query.toLowerCase())),
    [allStops, query],
  );

  // Nearest stops for auto-suggest (only when query is empty and location is known)
  const nearbyStops = useMemo(() => {
    if (!userLocation || query) return [];
    return stopsWithDistance(allStops, userLocation.latitude, userLocation.longitude).slice(0, 5);
  }, [userLocation, allStops, query]);

  const handleClose = () => { setQuery(''); onClose(); };
  const handleSelect = (stop) => { setQuery(''); onSelect(stop); };

  const StopRow = ({ item, isNearby }) => (
    <TouchableOpacity
      style={pickerStyles.stopItem}
      onPress={() => handleSelect(item)}
      activeOpacity={0.76}
    >
      <View style={[pickerStyles.stopIconWrap, isNearby && { backgroundColor: COLORS.secondaryLight }]}>
        <Ionicons
          name={isNearby ? 'walk-outline' : 'location-outline'}
          size={18}
          color={isNearby ? COLORS.secondary : COLORS.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={pickerStyles.stopName}>{item.stop_name}</Text>
        {isNearby && item.distKm != null ? (
          <Text style={pickerStyles.stopDist}>
            {formatDist(item.distKm)} · {item.walkMins} min walk
          </Text>
        ) : item.latitude && item.longitude ? (
          <Text style={pickerStyles.stopCoords}>
            {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={pickerStyles.container}>
        <View style={pickerStyles.header}>
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={pickerStyles.closeBtn}
          >
            <Ionicons name="close" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={pickerStyles.title}>{title}</Text>
          <View style={{ width: 38 }} />
        </View>

        <View style={pickerStyles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={pickerStyles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search stop name…"
            placeholderTextColor={COLORS.textMuted}
            autoFocus
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {loadingStops ? (
          <ActivityIndicator style={{ marginTop: 48 }} size="large" color={COLORS.primary} />
        ) : (
          <FlatList
            data={query ? filtered : allStops}
            keyExtractor={(item) => String(item.stop_id)}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              !query && nearbyStops.length > 0 ? (
                <>
                  {/* ── Nearby GPS suggestions ── */}
                  <View style={pickerStyles.sectionHeader}>
                    <Ionicons name="locate-outline" size={14} color={COLORS.secondary} />
                    <Text style={pickerStyles.sectionTitle}>Nearest to you</Text>
                  </View>
                  {nearbyStops.map((s) => (
                    <StopRow key={`nearby-${s.stop_id}`} item={s} isNearby />
                  ))}
                  <View style={pickerStyles.sectionDivider} />
                  <View style={pickerStyles.sectionHeader}>
                    <Ionicons name="list-outline" size={14} color={COLORS.textMuted} />
                    <Text style={pickerStyles.sectionTitle}>All stops</Text>
                  </View>
                </>
              ) : null
            }
            renderItem={({ item }) => <StopRow item={item} isNearby={false} />}
            ListEmptyComponent={
              <View style={pickerStyles.emptyWrap}>
                <Ionicons name="search-outline" size={36} color={COLORS.border} />
                <Text style={pickerStyles.emptyText}>
                  {query ? `No stops match "${query}"` : 'No stops available'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
};

// ── Alternative Route Chip ─────────────────────────────────────────────────────
const AlternativeChip = ({ alt, label, selected, onPress }) => (
  <TouchableOpacity
    style={[chipStyles.wrap, selected && chipStyles.wrapActive]}
    onPress={onPress}
    activeOpacity={0.82}
  >
    <Text style={[chipStyles.label, selected && chipStyles.labelActive]}>{label}</Text>
    <Text style={[chipStyles.summary, selected && chipStyles.summaryActive]} numberOfLines={1}>
      {alt.summary}
    </Text>
    <View style={chipStyles.metaRow}>
      <Ionicons
        name="time-outline"
        size={11}
        color={selected ? COLORS.primary : COLORS.textMuted}
      />
      <Text style={[chipStyles.meta, selected && chipStyles.metaActive]}>
        {alt.total_duration_min} min · {money(alt.total_price)}
      </Text>
    </View>
  </TouchableOpacity>
);

// ── Main Screen ────────────────────────────────────────────────────────────────
const TripPlannerScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { walletBalance } = useApp();

  const [stops, setStops] = useState([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  // Accept a pre-selected stop coming from NearbyStopsScreen
  const [fromStop, setFromStop] = useState(route?.params?.initialFromStop ?? null);
  const [toStop, setToStop] = useState(null);
  const [mode, setMode] = useState('fastest');

  const [pickerFor, setPickerFor] = useState(null);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [selectedAlt, setSelectedAlt] = useState(null);
  const [error, setError] = useState(null);

  // Fetch GPS location once for auto-suggest (silent — no prompt unless permitted)
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .then((pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }))
          .catch(() => {});
      } else {
        Location.requestForegroundPermissionsAsync().then(({ status: s }) => {
          if (s === 'granted') {
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
              .then((pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }))
              .catch(() => {});
          }
        });
      }
    });
  }, []);

  const loadStops = useCallback(async () => {
    if (stops.length) return;
    setLoadingStops(true);
    try {
      const res = await getStopsApi();
      setStops(res.data || []);
    } catch {
      setStops([]);
    } finally {
      setLoadingStops(false);
    }
  }, [stops.length]);

  const openPicker = (field) => {
    loadStops();
    setPickerFor(field);
  };

  const handleSelectStop = (stop) => {
    if (pickerFor === 'from') setFromStop(stop);
    else setToStop(stop);
    setPickerFor(null);
  };

  const swap = () => {
    const prev = fromStop;
    setFromStop(toStop);
    setToStop(prev);
    setResult(null);
    setAlternatives([]);
    setSelectedAlt(null);
    setError(null);
  };

  const runSearch = useCallback(
    async (searchMode = mode, from = fromStop, to = toStop) => {
      if (!from || !to) return;
      if (from.stop_id === to.stop_id) {
        setError('Origin and destination cannot be the same stop.');
        return;
      }
      setSearching(true);
      setResult(null);
      setAlternatives([]);
      setSelectedAlt(null);
      setError(null);
      try {
        const res = await getMultiTripRouteApi({
          startId: from.stop_id,
          endId: to.stop_id,
          mode: searchMode,
          alternatives: true,
        });
        const data = res.data;
        if (data.route_type === 'unavailable') {
          setError(data.message || 'No route found between these stops.');
        } else {
          setResult(data);
          setAlternatives(data.alternatives || []);
        }
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          'Failed to find route. Please check your connection.';
        setError(msg);
      } finally {
        setSearching(false);
      }
    },
    [mode, fromStop, toStop],
  );

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (fromStop && toStop) runSearch(newMode, fromStop, toStop);
  };

  const displayTrip = selectedAlt !== null ? alternatives[selectedAlt] : result;
  const canSearch = !!(fromStop && toStop && fromStop.stop_id !== toStop.stop_id);

  const handleShare = useCallback(async () => {
    if (!displayTrip || !fromStop || !toStop) return;
    const segments   = displayTrip.segments || [];
    const modeLabel  = mode === 'fastest' ? 'Fastest' : mode === 'easiest' ? 'Easiest' : 'Cheapest';
    const mapsLink   = (name) =>
      `https://maps.google.com/search/?q=${encodeURIComponent(name + ' Beirut Lebanon')}`;

    const divider = '─────────────────────';

    const segLines = segments.flatMap((s, i) => {
      const num = `${i + 1}.`;
      if (s.type === 'walk') {
        return [
          `${num} 🚶 Walk  ${s.estimated_time_min} min${s.distance_m ? ` (${s.distance_m} m)` : ''}`,
          `   From: ${s.from}`,
          `   To:   ${s.to}`,
          `   📍 ${mapsLink(s.to)}`,
        ];
      }
      return [
        `${num} 🚌 Bus ${s.line} — ${s.route_name || 'Route'}  (${s.estimated_time_min} min · ${money(s.price)})`,
        `   Board at:  ${s.from}`,
        `   Exit at:   ${s.to}${s.stops ? ` (${s.stops} stop${s.stops === 1 ? '' : 's'})` : ''}`,
        s.boarding_instruction ? `   ℹ️  ${s.boarding_instruction}` : null,
        `   📍 ${mapsLink(s.from)}`,
      ].filter(Boolean);
    });

    const message = [
      '🚌 TRIP PLAN — Yalla Transit',
      divider,
      `📍 From:  ${fromStop.stop_name}`,
      `🏁 To:    ${toStop.stop_name}`,
      `🕐 Time:  ${displayTrip.total_duration_min} min  |  💰 ${money(displayTrip.total_price)}`,
      displayTrip.total_transfers
        ? `🔄 Transfers: ${displayTrip.total_transfers}`
        : `✅ Direct route`,
      `⚡ Mode:  ${modeLabel}`,
      divider,
      'ROUTE STEPS:',
      '',
      ...segLines,
      '',
      divider,
      `📲 Open in Yalla Transit for live bus tracking`,
    ].join('\n');

    try {
      await Share.share({ title: 'My Trip Plan — Yalla Transit', message });
    } catch (_) {}
  }, [displayTrip, fromStop, toStop, mode]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan a Trip</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Search Card ── */}
        <View style={styles.card}>
          {/* From stop */}
          <TouchableOpacity
            style={styles.stopRow}
            onPress={() => openPicker('from')}
            activeOpacity={0.78}
          >
            <View style={[styles.stopDot, { backgroundColor: COLORS.secondary }]} />
            <View style={styles.stopTextWrap}>
              <Text style={styles.stopLabel}>From</Text>
              <Text
                style={[styles.stopValue, !fromStop && styles.stopPlaceholder]}
                numberOfLines={1}
              >
                {fromStop ? fromStop.stop_name : 'Select origin stop'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* Divider + swap */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLeft}>
              <View style={styles.routeConnector} />
            </View>
            <TouchableOpacity onPress={swap} style={styles.swapBtn} activeOpacity={0.8}>
              <Ionicons name="swap-vertical" size={17} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* To stop */}
          <TouchableOpacity
            style={styles.stopRow}
            onPress={() => openPicker('to')}
            activeOpacity={0.78}
          >
            <View style={[styles.stopDot, { backgroundColor: COLORS.danger }]} />
            <View style={styles.stopTextWrap}>
              <Text style={styles.stopLabel}>To</Text>
              <Text
                style={[styles.stopValue, !toStop && styles.stopPlaceholder]}
                numberOfLines={1}
              >
                {toStop ? toStop.stop_name : 'Select destination stop'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* Mode selector */}
          <View style={styles.modeRow}>
            {MODES.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.modeTab, mode === m.key && styles.modeTabActive]}
                onPress={() => handleModeChange(m.key)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={m.icon}
                  size={13}
                  color={mode === m.key ? COLORS.white : COLORS.textMuted}
                />
                <Text style={[styles.modeTabText, mode === m.key && styles.modeTabTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search button */}
          <TouchableOpacity
            style={[styles.searchBtn, (!canSearch || searching) && styles.searchBtnDisabled]}
            onPress={() => runSearch()}
            disabled={!canSearch || searching}
            activeOpacity={0.85}
          >
            {searching ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="search" size={17} color={COLORS.white} />
                <Text style={styles.searchBtnText}>Find Route</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Error ── */}
        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={20} color={COLORS.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Results ── */}
        {displayTrip ? (
          <>
            {/* Route type badge + Share */}
            <View style={styles.routeBadgeRow}>
              <View style={[
                styles.routeBadge,
                displayTrip.route_type === 'direct' && styles.routeBadgeDirect,
              ]}>
                <Ionicons
                  name={displayTrip.route_type === 'direct' ? 'checkmark-circle' : 'git-branch-outline'}
                  size={14}
                  color={displayTrip.route_type === 'direct' ? COLORS.secondary : COLORS.primary}
                />
                <Text style={[
                  styles.routeBadgeText,
                  displayTrip.route_type === 'direct' && styles.routeBadgeTextDirect,
                ]}>
                  {displayTrip.route_type === 'direct' ? 'Direct route' : `${displayTrip.total_transfers} transfer${displayTrip.total_transfers !== 1 ? 's' : ''}`}
                </Text>
              </View>
              {result?.direct_available && displayTrip.route_type !== 'direct' && (
                <View style={styles.directAvailBadge}>
                  <Text style={styles.directAvailText}>Direct also available</Text>
                </View>
              )}
              {/* Share button */}
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
                <Ionicons name="share-social-outline" size={14} color={COLORS.primary} />
                <Text style={styles.shareBtnText}>Share</Text>
              </TouchableOpacity>
            </View>

            {/* ── Fare Estimate Card ── */}
            {(() => {
              const fareUsd    = displayTrip.total_price / LBP_PER_USD;
              const sufficient = walletBalance >= fareUsd;
              const shortfall  = fareUsd - walletBalance;
              const busSeg     = (displayTrip.segments || []).filter(s => s.type !== 'walk');
              return (
                <View style={styles.fareCard}>
                  {/* Header row */}
                  <View style={styles.fareHeader}>
                    <View style={styles.fareIconWrap}>
                      <Ionicons name="pricetag-outline" size={18} color={COLORS.primary} />
                    </View>
                    <Text style={styles.fareTitle}>Fare Estimate</Text>
                    <View style={[
                      styles.fareSuffBadge,
                      { backgroundColor: sufficient ? COLORS.secondaryLight : COLORS.dangerLight,
                        borderColor:      sufficient ? COLORS.secondaryMid  : COLORS.dangerMid },
                    ]}>
                      <Ionicons
                        name={sufficient ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                        size={13}
                        color={sufficient ? COLORS.secondary : COLORS.danger}
                      />
                      <Text style={[styles.fareSuffText, { color: sufficient ? COLORS.secondary : COLORS.danger }]}>
                        {sufficient ? 'Balance OK' : 'Low Balance'}
                      </Text>
                    </View>
                  </View>

                  {/* Total fare + trip summary */}
                  <View style={styles.fareTotalRow}>
                    <View style={styles.fareStat}>
                      <Text style={styles.fareStatLabel}>TOTAL FARE</Text>
                      <Text style={styles.fareStatValue}>{money(displayTrip.total_price)}</Text>
                      <Text style={styles.fareStatSub}>≈ ${fareUsd.toFixed(2)} USD</Text>
                    </View>
                    <View style={styles.fareStatDivider} />
                    <View style={styles.fareStat}>
                      <Text style={styles.fareStatLabel}>DURATION</Text>
                      <Text style={styles.fareStatValue}>{displayTrip.total_duration_min} min</Text>
                      <Text style={styles.fareStatSub}>{displayTrip.total_transfers ?? 0} transfer{displayTrip.total_transfers !== 1 ? 's' : ''}</Text>
                    </View>
                    <View style={styles.fareStatDivider} />
                    <View style={styles.fareStat}>
                      <Text style={styles.fareStatLabel}>YOUR BALANCE</Text>
                      <Text style={[styles.fareStatValue, { color: sufficient ? COLORS.secondary : COLORS.danger }]}>
                        ${walletBalance.toFixed(2)}
                      </Text>
                      <Text style={styles.fareStatSub}>USD</Text>
                    </View>
                  </View>

                  {/* Per-segment fare breakdown */}
                  {busSeg.length > 0 && (
                    <View style={styles.fareBreakdown}>
                      {busSeg.map((s, i) => (
                        <View key={i} style={styles.fareBreakdownRow}>
                          <View style={styles.fareSegIcon}>
                            <Ionicons name="bus-outline" size={12} color={COLORS.primary} />
                          </View>
                          <Text style={styles.fareSegName} numberOfLines={1}>
                            {s.from} → {s.to}
                          </Text>
                          <Text style={styles.fareSegPrice}>{money(s.price)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Insufficient balance warning */}
                  {!sufficient && (
                    <View style={styles.fareWarning}>
                      <Ionicons name="wallet-outline" size={15} color={COLORS.danger} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fareWarningText}>
                          Your wallet is ${shortfall.toFixed(2)} short for this trip.
                          Top up before booking.
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.fareTopUpBtn}
                        onPress={() => navigation.navigate('ProfileStack', { screen: 'Wallet' })}
                      >
                        <Text style={styles.fareTopUpText}>Top Up</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Embedded route sheet */}
            <MultiTripBottomSheet
              trip={displayTrip}
              mode={mode}
              activeSegmentIndex={0}
              onModeChange={handleModeChange}
              embedded
            />

            {/* ── Alternatives ── */}
            {(result && alternatives.length > 0) ? (
              <View style={styles.altSection}>
                <Text style={styles.altTitle}>Alternative Routes</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.altScroll}
                >
                  {/* Best / primary */}
                  <AlternativeChip
                    alt={result}
                    label="Best"
                    selected={selectedAlt === null}
                    onPress={() => setSelectedAlt(null)}
                  />
                  {alternatives.map((alt, i) => (
                    <AlternativeChip
                      key={i}
                      alt={alt}
                      label={`Alt ${i + 1}`}
                      selected={selectedAlt === i}
                      onPress={() => setSelectedAlt(i)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </>
        ) : null}

        {/* ── Empty / intro state ── */}
        {!searching && !result && !error ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="map-outline" size={44} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>Plan your journey</Text>
            <Text style={styles.emptySubtitle}>
              Select your origin and destination stops above. The system will find the best route —
              including multi-line connections with up to 3 transfers.
            </Text>
            <View style={styles.featureList}>
              {[
                { icon: 'flash-outline', text: 'Fastest route' },
                { icon: 'leaf-outline', text: 'Easiest transfers' },
                { icon: 'cash-outline', text: 'Cheapest fare' },
              ].map((f) => (
                <View key={f.icon} style={styles.featureItem}>
                  <View style={styles.featureIconWrap}>
                    <Ionicons name={f.icon} size={16} color={COLORS.primary} />
                  </View>
                  <Text style={styles.featureText}>{f.text}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Stop Picker Modal ── */}
      <StopPickerModal
        visible={pickerFor !== null}
        title={pickerFor === 'from' ? 'Select Origin Stop' : 'Select Destination Stop'}
        stops={stops}
        loadingStops={loadingStops}
        onSelect={handleSelectStop}
        onClose={() => setPickerFor(null)}
        userLocation={userLocation}
      />
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  /* Header */
  header: {
    backgroundColor: COLORS.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.2,
  },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
    gap: 14,
  },

  /* Search card */
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stopTextWrap: { flex: 1 },
  stopLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  stopValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  stopPlaceholder: {
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    marginVertical: 2,
  },
  dividerLeft: {
    width: 12,
    alignItems: 'center',
    marginRight: 12,
  },
  routeConnector: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border,
    borderRadius: 1,
  },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryMid,
  },

  /* Mode tabs */
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    marginBottom: 14,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  modeTabTextActive: {
    color: COLORS.white,
  },

  /* Search button */
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  searchBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  searchBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
  },

  /* Error */
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.dangerLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.dangerMid,
    padding: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.dangerDark,
    fontWeight: '600',
    lineHeight: 20,
  },

  /* Route badge row */
  routeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryMid,
  },
  routeBadgeDirect: {
    backgroundColor: COLORS.secondaryLight,
    borderColor: COLORS.secondaryMid,
  },
  routeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  routeBadgeTextDirect: {
    color: COLORS.secondary,
  },
  directAvailBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.warningLight,
    borderWidth: 1,
    borderColor: COLORS.warningMid,
  },
  directAvailText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.warningDark,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryMid,
  },
  shareBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  /* Alternatives */
  /* Fare Estimate Card */
  fareCard: {
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 16, borderWidth: 1.5, borderColor: COLORS.primaryMid,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  fareHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  fareIconWrap: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  fareTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, flex: 1 },
  fareSuffBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
  },
  fareSuffText: { fontSize: 11, fontWeight: '700' },

  fareTotalRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 12, padding: 12, marginBottom: 12,
  },
  fareStat: { flex: 1, alignItems: 'center' },
  fareStatLabel: {
    fontSize: 9, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 4,
  },
  fareStatValue: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  fareStatSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },
  fareStatDivider: { width: 1, height: 36, backgroundColor: COLORS.border, marginHorizontal: 4 },

  fareBreakdown: {
    gap: 6, marginBottom: 10,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: 10,
  },
  fareBreakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fareSegIcon: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  fareSegName: { flex: 1, fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  fareSegPrice: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },

  fareWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.dangerLight, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: COLORS.dangerMid,
  },
  fareWarningText: { fontSize: 12, color: COLORS.danger, fontWeight: '600', lineHeight: 18 },
  fareTopUpBtn: {
    backgroundColor: COLORS.danger, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  fareTopUpText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  altSection: {
    gap: 10,
  },
  altTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.1,
  },
  altScroll: {
    gap: 10,
    paddingBottom: 2,
  },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.primaryMid,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  featureList: {
    width: '100%',
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});

// ── Picker styles ─────────────────────────────────────────────────────────────
const pickerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    margin: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  stopIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  stopCoords: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  stopDist: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
});

// ── Chip styles ───────────────────────────────────────────────────────────────
const chipStyles = StyleSheet.create({
  wrap: {
    width: 160,
    borderRadius: 14,
    padding: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 4,
  },
  wrapActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelActive: {
    color: COLORS.primary,
  },
  summary: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  summaryActive: {
    color: COLORS.primaryDark,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  metaActive: {
    color: COLORS.primary,
  },
});

export default TripPlannerScreen;
