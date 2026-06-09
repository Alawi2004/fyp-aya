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
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { getStopsApi } from '../../api/stopsApi';
import { getMultiTripRouteApi } from '../../api/multiTripApi';
import { getBusDetailsApi } from '../../api/busApi';
import { useApp } from '../../context/AppContext';
import { stopsWithDistance, formatDist } from '../../utils/mockStops';
import MultiTripBottomSheet from '../../components/passenger/MultiTripBottomSheet';

const LBP_PER_USD = 89_500;

const NOM = 'https://nominatim.openstreetmap.org';
const NOM_HEADERS = { 'User-Agent': 'FYP-AYA Transit App (student project)', 'Accept-Language': 'en' };

const MODES = [
  { key: 'fastest', label: 'Fastest', icon: 'flash-outline' },
  { key: 'easiest', label: 'Easiest', icon: 'leaf-outline' },
  { key: 'cheapest', label: 'Cheapest', icon: 'cash-outline' },
];

const money = (v) => `${Number(v || 0).toLocaleString()} LBP`;

// ── Haversine distance (km) ────────────────────────────────────────────────────
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Find the stop nearest to a lat/lng, returns { stop, distKm, walkMins } or null
const findNearestStop = (stops, lat, lng) => {
  let best = null;
  let bestDist = Infinity;
  for (const s of stops) {
    if (!s.latitude || !s.longitude) continue;
    const d = haversineKm(lat, lng, parseFloat(s.latitude), parseFloat(s.longitude));
    if (d < bestDist) { bestDist = d; best = s; }
  }
  if (!best) return null;
  return { stop: best, distKm: bestDist, walkMins: Math.max(1, Math.round(bestDist / 5 * 60)) };
};

// ── Stop Picker Modal ──────────────────────────────────────────────────────────
// Two modes:
//   'stops'   — search bus stop names (existing behaviour + GPS nearby)
//   'address' — type any address → Nominatim → nearest stop auto-selected
const StopPickerModal = ({ visible, onClose, onSelect, title, stops, loadingStops, userLocation }) => {
  const [searchMode, setSearchMode]       = useState('stops');
  const [query,      setQuery]            = useState('');
  const [addrResults, setAddrResults]     = useState([]);
  const [addrLoading, setAddrLoading]     = useState(false);
  const [gpsLoading,  setGpsLoading]      = useState(false);
  const addrTimerRef = useRef(null);

  // ── stops mode helpers ────────────────────────────────────────────────────
  const filtered = useMemo(
    () => stops.filter((s) => s.stop_name.toLowerCase().includes(query.toLowerCase())),
    [stops, query],
  );

  const nearbyStops = useMemo(() => {
    if (!userLocation || query || searchMode !== 'stops') return [];
    return stopsWithDistance(stops, userLocation.latitude, userLocation.longitude).slice(0, 5);
  }, [userLocation, stops, query, searchMode]);

  // ── close / select helpers ────────────────────────────────────────────────
  const reset = () => {
    setQuery('');
    setAddrResults([]);
    setAddrLoading(false);
    clearTimeout(addrTimerRef.current);
    setSearchMode('stops');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSelect = (stop, walkInfo = null) => {
    reset();
    onSelect(stop, walkInfo);
  };

  // ── address mode: Nominatim search ───────────────────────────────────────
  const onQueryChange = (text) => {
    setQuery(text);
    if (searchMode !== 'address') return;
    clearTimeout(addrTimerRef.current);
    setAddrResults([]);
    if (text.trim().length < 3) { setAddrLoading(false); return; }
    setAddrLoading(true);
    addrTimerRef.current = setTimeout(async () => {
      try {
        const url = `${NOM}/search?q=${encodeURIComponent(text.trim())}&format=json&limit=5&addressdetails=1&countrycodes=lb`;
        const res = await fetch(url, { headers: NOM_HEADERS });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setAddrResults(data.map(p => ({
          label: p.display_name,
          lat:   parseFloat(p.lat),
          lng:   parseFloat(p.lon),
        })));
      } catch {}
      setAddrLoading(false);
    }, 500);
  };

  const selectAddress = (addr) => {
    if (loadingStops || !stops.length) {
      Alert.alert('Loading', 'Bus stop data is still loading. Please wait a moment.');
      return;
    }
    const found = findNearestStop(stops, addr.lat, addr.lng);
    if (!found) {
      Alert.alert('No nearby stop', 'Could not find a bus stop near this address.');
      return;
    }
    handleSelect(found.stop, { distKm: found.distKm, walkMins: found.walkMins });
  };

  // ── GPS → nearest stop ────────────────────────────────────────────────────
  const useGpsNearest = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is needed to find your nearest stop.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      if (!stops.length) { Alert.alert('Loading', 'Stop data not ready yet.'); return; }
      const found = findNearestStop(stops, latitude, longitude);
      if (!found) { Alert.alert('Not found', 'No bus stop found near your location.'); return; }
      handleSelect(found.stop, { distKm: found.distKm, walkMins: found.walkMins });
    } catch {
      Alert.alert('Error', 'Could not get your location.');
    } finally {
      setGpsLoading(false);
    }
  };

  const StopRow = ({ item, isNearby, walkInfo }) => (
    <TouchableOpacity
      style={pickerStyles.stopItem}
      onPress={() => handleSelect(item, walkInfo ?? null)}
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

        {/* ── Header ── */}
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

        {/* ── Mode tabs ── */}
        <View style={pickerStyles.modeTabs}>
          <TouchableOpacity
            style={[pickerStyles.modeTab, searchMode === 'stops' && pickerStyles.modeTabActive]}
            onPress={() => { setSearchMode('stops'); setQuery(''); setAddrResults([]); }}
            activeOpacity={0.8}
          >
            <Ionicons name="bus-outline" size={14} color={searchMode === 'stops' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[pickerStyles.modeTabText, searchMode === 'stops' && pickerStyles.modeTabTextActive]}>
              Bus Stops
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[pickerStyles.modeTab, searchMode === 'address' && pickerStyles.modeTabActive]}
            onPress={() => { setSearchMode('address'); setQuery(''); setAddrResults([]); }}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={14} color={searchMode === 'address' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[pickerStyles.modeTabText, searchMode === 'address' && pickerStyles.modeTabTextActive]}>
              By Address
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── GPS button (both modes) ── */}
        <TouchableOpacity style={pickerStyles.gpsBtn} onPress={useGpsNearest} disabled={gpsLoading} activeOpacity={0.8}>
          {gpsLoading
            ? <ActivityIndicator size="small" color={COLORS.secondary} />
            : <Ionicons name="navigate" size={15} color={COLORS.secondary} />}
          <Text style={pickerStyles.gpsBtnText}>
            {gpsLoading ? 'Finding nearest stop…' : 'Use my current location'}
          </Text>
        </TouchableOpacity>

        {/* ── Search input ── */}
        <View style={pickerStyles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={pickerStyles.searchInput}
            value={query}
            onChangeText={onQueryChange}
            placeholder={searchMode === 'address' ? 'Type an address or place name…' : 'Search stop name…'}
            placeholderTextColor={COLORS.textMuted}
            autoFocus
          />
          {query ? (
            <TouchableOpacity onPress={() => onQueryChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Address mode hint ── */}
        {searchMode === 'address' && !query && (
          <View style={pickerStyles.addrHint}>
            <Ionicons name="information-circle-outline" size={15} color={COLORS.primary} />
            <Text style={pickerStyles.addrHintText}>
              Type any address in Lebanon — we'll find the nearest bus stop automatically.
            </Text>
          </View>
        )}

        {/* ── Results ── */}
        {loadingStops ? (
          <ActivityIndicator style={{ marginTop: 48 }} size="large" color={COLORS.primary} />
        ) : searchMode === 'address' ? (
          /* ── Address results ── */
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
            {addrLoading ? (
              <View style={pickerStyles.centerWrap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={pickerStyles.centerText}>Searching addresses…</Text>
              </View>
            ) : addrResults.length > 0 ? (
              addrResults.map((addr, i) => (
                <TouchableOpacity
                  key={i}
                  style={pickerStyles.addrItem}
                  onPress={() => selectAddress(addr)}
                  activeOpacity={0.76}
                >
                  <View style={pickerStyles.addrIconWrap}>
                    <Ionicons name="location" size={18} color="#EA4335" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={pickerStyles.addrLabel} numberOfLines={2}>{addr.label}</Text>
                    <Text style={pickerStyles.addrSub}>Tap to find nearest bus stop</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              ))
            ) : query.length >= 3 ? (
              <View style={pickerStyles.centerWrap}>
                <Ionicons name="search-outline" size={36} color={COLORS.textMuted} />
                <Text style={pickerStyles.centerText}>No results found in Lebanon</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : (
          /* ── Bus stop list ── */
          <FlatList
            data={query ? filtered : stops}
            keyExtractor={(item) => String(item.stop_id)}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              !query && nearbyStops.length > 0 ? (
                <>
                  <View style={pickerStyles.sectionHeader}>
                    <Ionicons name="locate-outline" size={14} color={COLORS.secondary} />
                    <Text style={pickerStyles.sectionTitle}>Nearest to you</Text>
                  </View>
                  {nearbyStops.map((s) => (
                    <StopRow
                      key={`nearby-${s.stop_id}`}
                      item={s}
                      isNearby
                      walkInfo={{ distKm: s.distKm, walkMins: s.walkMins }}
                    />
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

  const [stops,        setStops]        = useState([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  const [fromStop,     setFromStop]     = useState(route?.params?.initialFromStop ?? null);
  const [toStop,       setToStop]       = useState(null);
  const [fromWalkInfo, setFromWalkInfo] = useState(null); // { distKm, walkMins } when chosen via address/GPS
  const [toWalkInfo,   setToWalkInfo]   = useState(null);
  const [mode,         setMode]         = useState('fastest');

  const [pickerFor,    setPickerFor]    = useState(null);
  const [searching,    setSearching]    = useState(false);
  const [result,       setResult]       = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [selectedAlt,  setSelectedAlt]  = useState(null);
  const [error,        setError]        = useState(null);

  // Per-leg booking loading state: { [trip_id]: true }
  const [bookingLoading, setBookingLoading] = useState({});

  // Departure time picker
  const [departureTime, setDepartureTime] = useState(new Date());
  const [showDTPicker,  setShowDTPicker]  = useState(false);
  const [dtPickerMode,  setDtPickerMode]  = useState('date'); // 'date' | 'time' (Android only)

  const isLeaveNow = Date.now() - departureTime.getTime() < 120_000;

  const formatDepTime = (d) => {
    const now      = new Date();
    const today    = now.toDateString() === d.toDateString();
    const tomorrow = new Date(now.getTime() + 86_400_000).toDateString() === d.toDateString();
    const dayPart  = today    ? 'Today'
                  : tomorrow  ? 'Tomorrow'
                  : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${dayPart}, ${timePart}`;
  };

  const onDTChange = (event, selected) => {
    if (event.type === 'dismissed' || !selected) {
      setShowDTPicker(false);
      setDtPickerMode('date');
      return;
    }
    if (Platform.OS === 'android') {
      if (dtPickerMode === 'date') {
        const next = new Date(selected);
        next.setHours(departureTime.getHours(), departureTime.getMinutes(), 0, 0);
        setDepartureTime(next);
        setDtPickerMode('time'); // show time picker next
      } else {
        const next = new Date(departureTime);
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
        setDepartureTime(next);
        setShowDTPicker(false);
        setDtPickerMode('date');
        if (fromStop && toStop && fromStop.stop_id !== toStop.stop_id) {
          runSearch(mode, fromStop, toStop, next);
        }
      }
    } else {
      // iOS: datetime spinner updates live; commit on "Done"
      setDepartureTime(selected);
    }
  };

  const confirmIOSTime = () => {
    setShowDTPicker(false);
    if (fromStop && toStop && fromStop.stop_id !== toStop.stop_id) {
      runSearch(mode, fromStop, toStop, departureTime);
    }
  };

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

  // walkInfo is { distKm, walkMins } or null — set when stop was chosen via address/GPS
  const handleSelectStop = (stop, walkInfo = null) => {
    if (pickerFor === 'from') { setFromStop(stop); setFromWalkInfo(walkInfo); }
    else                      { setToStop(stop);   setToWalkInfo(walkInfo);   }
    setPickerFor(null);
  };

  const swap = () => {
    setFromStop(toStop);   setFromWalkInfo(toWalkInfo);
    setToStop(fromStop);   setToWalkInfo(fromWalkInfo);
    setResult(null);
    setAlternatives([]);
    setSelectedAlt(null);
    setError(null);
  };

  const runSearch = useCallback(
    async (searchMode = mode, from = fromStop, to = toStop, depTime = departureTime) => {
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
          startId:       from.stop_id,
          endId:         to.stop_id,
          mode:          searchMode,
          alternatives:  true,
          departureTime: depTime.toISOString(),
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
    [mode, fromStop, toStop, departureTime],
  );

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (fromStop && toStop) runSearch(newMode, fromStop, toStop, departureTime);
  };

  const displayTrip = selectedAlt !== null ? alternatives[selectedAlt] : result;
  const canSearch   = !!(fromStop && toStop && fromStop.stop_id !== toStop.stop_id);

  // ── Book a specific bus leg ──────────────────────────────────────────────
  const handleBookLeg = async (segment) => {
    const tripId = segment.trip_id;
    if (!tripId) {
      Alert.alert(
        'No trip scheduled',
        `No trip runs on this route at ${formatDepTime(departureTime)}. Try a different departure time using the "Leave at" picker.`,
        [
          { text: 'Change time', onPress: () => { setDtPickerMode('date'); setShowDTPicker(true); } },
          { text: 'OK', style: 'cancel' },
        ],
      );
      return;
    }
    setBookingLoading(prev => ({ ...prev, [tripId]: true }));
    try {
      const res = await getBusDetailsApi(tripId);
      const details = res.data ?? {};
      const arrivalDate = new Date(departureTime.getTime() + segment.estimated_time_min * 60_000);
      const bus = {
        _id:            tripId,
        name:           segment.route_name || `Bus ${segment.line || ''}`,
        origin:         segment.from,
        destination:    segment.to,
        duration:       `${segment.estimated_time_min} min`,
        price:          ((segment.price || 0) / LBP_PER_USD).toFixed(2),
        bookedSeatsCsv: details.bookedSeatsCsv ?? '',
        totalSeats:     details.totalSeats ?? 30,
        departureTime:  formatDepTime(departureTime),
        arrivalTime:    `~${formatDepTime(arrivalDate)}`,
        type:           'bus',
      };
      navigation.navigate('Booking', { bus });
    } catch {
      Alert.alert('Error', 'Could not load trip details. Please try again.');
    } finally {
      setBookingLoading(prev => ({ ...prev, [tripId]: false }));
    }
  };

  // ── Share ──────────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!displayTrip || !fromStop || !toStop) return;
    const segments  = displayTrip.segments || [];
    const modeLabel = mode === 'fastest' ? 'Fastest' : mode === 'easiest' ? 'Easiest' : 'Cheapest';
    const mapsLink  = (name) =>
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

  // ── Bus legs from the displayed route ────────────────────────────────────
  const busLegs = useMemo(
    () => (displayTrip?.segments ?? []).filter(s => s.type === 'bus'),
    [displayTrip],
  );

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
                {fromStop ? fromStop.stop_name : 'Search stop or address…'}
              </Text>
              {fromStop && fromWalkInfo ? (
                <View style={styles.walkHint}>
                  <Ionicons name="walk-outline" size={11} color={COLORS.secondary} />
                  <Text style={styles.walkHintText}>
                    {fromWalkInfo.distKm < 1
                      ? `${Math.round(fromWalkInfo.distKm * 1000)} m`
                      : `${fromWalkInfo.distKm.toFixed(1)} km`} walk · {fromWalkInfo.walkMins} min
                  </Text>
                </View>
              ) : null}
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
                {toStop ? toStop.stop_name : 'Search stop or address…'}
              </Text>
              {toStop && toWalkInfo ? (
                <View style={styles.walkHint}>
                  <Ionicons name="walk-outline" size={11} color={COLORS.danger} />
                  <Text style={[styles.walkHintText, { color: COLORS.danger }]}>
                    {toWalkInfo.distKm < 1
                      ? `${Math.round(toWalkInfo.distKm * 1000)} m`
                      : `${toWalkInfo.distKm.toFixed(1)} km`} walk · {toWalkInfo.walkMins} min
                  </Text>
                </View>
              ) : null}
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

          {/* ── Leave at ── */}
          <View style={styles.leaveAtRow}>
            <TouchableOpacity
              style={styles.leaveAtBtn}
              onPress={() => { setDtPickerMode('date'); setShowDTPicker(true); }}
              activeOpacity={0.82}
            >
              <Ionicons name="time-outline" size={15} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.leaveAtLabel}>Leave at</Text>
                <Text style={styles.leaveAtValue} numberOfLines={1}>
                  {isLeaveNow ? 'Now (leave immediately)' : formatDepTime(departureTime)}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={14} color={COLORS.textMuted} />
            </TouchableOpacity>
            {!isLeaveNow && (
              <TouchableOpacity
                style={styles.leaveNowBtn}
                onPress={() => { const d = new Date(); setDepartureTime(d); }}
                activeOpacity={0.8}
              >
                <Text style={styles.leaveNowText}>Now</Text>
              </TouchableOpacity>
            )}
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
                <Text style={styles.searchBtnText}>
                  {isLeaveNow ? 'Find Route' : `Find Route · ${formatDepTime(departureTime)}`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Android datetime picker (shows as dialog) ── */}
        {showDTPicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={departureTime}
            mode={dtPickerMode}
            display="default"
            onChange={onDTChange}
            minimumDate={new Date()}
          />
        )}

        {/* ── iOS datetime picker (bottom sheet modal) ── */}
        {Platform.OS === 'ios' && (
          <Modal
            visible={showDTPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowDTPicker(false)}
          >
            <View style={styles.dtOverlay}>
              <View style={styles.dtSheet}>
                <View style={styles.dtSheetHeader}>
                  <TouchableOpacity onPress={() => setShowDTPicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.dtCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.dtSheetTitle}>Choose departure time</Text>
                  <TouchableOpacity onPress={confirmIOSTime} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.dtDone}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={departureTime}
                  mode="datetime"
                  display="spinner"
                  onChange={onDTChange}
                  minimumDate={new Date()}
                  style={{ width: '100%' }}
                />
              </View>
            </View>
          </Modal>
        )}

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

                  {!sufficient && (
                    <View style={styles.fareWarning}>
                      <Ionicons name="wallet-outline" size={15} color={COLORS.danger} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fareWarningText}>
                          Your wallet is ${shortfall.toFixed(2)} short for this trip. Top up before booking.
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

            {/* ── Book Legs ── */}
            {busLegs.length === 0 ? (
              // Walk-only route
              <View style={styles.walkOnlyCard}>
                <Ionicons name="walk" size={22} color={COLORS.secondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.walkOnlyTitle}>Walk-only route</Text>
                  <Text style={styles.walkOnlySub}>No bus booking needed for this journey.</Text>
                </View>
              </View>
            ) : busLegs.length === 1 ? (
              // Single leg — direct book button
              <TouchableOpacity
                style={[styles.bookNowBtn, bookingLoading[busLegs[0].trip_id] && styles.bookNowBtnLoading]}
                onPress={() => handleBookLeg(busLegs[0])}
                disabled={!!bookingLoading[busLegs[0].trip_id]}
                activeOpacity={0.85}
              >
                {bookingLoading[busLegs[0].trip_id] ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Ionicons name="ticket-outline" size={18} color={COLORS.white} />
                )}
                <Text style={styles.bookNowText}>
                  {bookingLoading[busLegs[0].trip_id] ? 'Loading…' : 'Book This Trip'}
                </Text>
              </TouchableOpacity>
            ) : (
              // Multi-leg — one card per bus segment
              <View style={styles.legsCard}>
                <View style={styles.legsHeader}>
                  <Ionicons name="git-branch-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.legsTitle}>Book your {busLegs.length} bus legs</Text>
                </View>
                <Text style={styles.legsSubtitle}>Book each leg separately — they deduct from your wallet individually.</Text>
                {busLegs.map((seg, i) => {
                  const isLoading = !!bookingLoading[seg.trip_id];
                  return (
                    <View key={i} style={styles.legRow}>
                      <View style={styles.legNumBadge}>
                        <Text style={styles.legNumText}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.legRouteName} numberOfLines={1}>
                          {seg.route_name || `Bus ${seg.line || ''}`}
                        </Text>
                        <Text style={styles.legStops} numberOfLines={1}>
                          {seg.from} → {seg.to}
                        </Text>
                        <Text style={styles.legMeta}>
                          {seg.estimated_time_min} min · {money(seg.price)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.legBookBtn, isLoading && { opacity: 0.6 }]}
                        onPress={() => handleBookLeg(seg)}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        {isLoading
                          ? <ActivityIndicator size="small" color={COLORS.white} />
                          : <Text style={styles.legBookBtnText}>Book</Text>}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
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
              Search by bus stop name or type any address — we'll find the nearest stop automatically.
            </Text>
            <View style={styles.featureList}>
              {[
                { icon: 'location-outline',  text: 'Search by address or stop name' },
                { icon: 'flash-outline',      text: 'Fastest, easiest, or cheapest routes' },
                { icon: 'ticket-outline',     text: 'Book your seat directly from the plan' },
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
        title={pickerFor === 'from' ? 'Select Origin' : 'Select Destination'}
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
  container:   { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: COLORS.headerBg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white, letterSpacing: -0.2 },

  scroll:        { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48, gap: 14 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 16,
    shadowColor: '#1E293B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  stopRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  stopDot:     { width: 12, height: 12, borderRadius: 6, flexShrink: 0, marginTop: 2, alignSelf: 'flex-start' },
  stopTextWrap:{ flex: 1 },
  stopLabel:   { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  stopValue:   { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  stopPlaceholder: { color: COLORS.textMuted, fontWeight: '500' },

  walkHint:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  walkHintText: { fontSize: 11, fontWeight: '600', color: COLORS.secondary },

  dividerRow:   { flexDirection: 'row', alignItems: 'center', paddingLeft: 4, marginVertical: 2 },
  dividerLeft:  { width: 12, alignItems: 'center', marginRight: 12 },
  routeConnector: { width: 2, height: 20, backgroundColor: COLORS.border, borderRadius: 1 },
  swapBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.primaryMid,
  },

  modeRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 14 },
  modeTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  modeTabActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeTabText:      { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  modeTabTextActive:{ color: COLORS.white },

  // Leave at
  leaveAtRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  leaveAtBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.background, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.primaryMid,
  },
  leaveAtLabel: { fontSize: 10, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  leaveAtValue: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginTop: 1 },
  leaveNowBtn: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primaryMid,
  },
  leaveNowText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },

  // iOS datetime modal
  dtOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  dtSheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  dtSheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  dtSheetTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  dtCancel:     { fontSize: 15, fontWeight: '600', color: COLORS.textMuted },
  dtDone:       { fontSize: 15, fontWeight: '800', color: COLORS.primary },

  searchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14,
  },
  searchBtnDisabled: { backgroundColor: COLORS.border },
  searchBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white },

  errorCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: COLORS.dangerLight, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.dangerMid, padding: 14,
  },
  errorText: { flex: 1, fontSize: 14, color: COLORS.dangerDark, fontWeight: '600', lineHeight: 20 },

  routeBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primaryMid,
  },
  routeBadgeDirect:    { backgroundColor: COLORS.secondaryLight, borderColor: COLORS.secondaryMid },
  routeBadgeText:      { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  routeBadgeTextDirect:{ color: COLORS.secondary },
  directAvailBadge: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: COLORS.warningLight, borderWidth: 1, borderColor: COLORS.warningMid,
  },
  directAvailText: { fontSize: 11, fontWeight: '700', color: COLORS.warningDark },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primaryMid,
  },
  shareBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  fareCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: COLORS.primaryMid,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  fareHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  fareIconWrap: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  fareTitle:   { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, flex: 1 },
  fareSuffBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
  },
  fareSuffText: { fontSize: 11, fontWeight: '700' },
  fareTotalRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 12, padding: 12, marginBottom: 12,
  },
  fareStat:      { flex: 1, alignItems: 'center' },
  fareStatLabel: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 4 },
  fareStatValue: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  fareStatSub:   { fontSize: 10, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },
  fareStatDivider:{ width: 1, height: 36, backgroundColor: COLORS.border, marginHorizontal: 4 },
  fareBreakdown: { gap: 6, marginBottom: 10, borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: 10 },
  fareBreakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fareSegIcon:   { width: 22, height: 22, borderRadius: 6, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  fareSegName:   { flex: 1, fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  fareSegPrice:  { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  fareWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.dangerLight, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: COLORS.dangerMid,
  },
  fareWarningText: { fontSize: 12, color: COLORS.danger, fontWeight: '600', lineHeight: 18 },
  fareTopUpBtn:    { backgroundColor: COLORS.danger, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  fareTopUpText:   { fontSize: 12, fontWeight: '700', color: COLORS.white },

  altSection: { gap: 10 },
  altTitle:   { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.1 },
  altScroll:  { gap: 10, paddingBottom: 2 },

  // Walk-only
  walkOnlyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.secondaryLight, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.secondaryMid,
  },
  walkOnlyTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  walkOnlySub:   { fontSize: 12, color: COLORS.textMuted, fontWeight: '500', marginTop: 2 },

  // Single-leg book button
  bookNowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  bookNowBtnLoading: { opacity: 0.7 },
  bookNowText: { fontSize: 16, fontWeight: '800', color: COLORS.white, letterSpacing: 0.2 },

  // Multi-leg card
  legsCard: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 16,
    borderWidth: 1.5, borderColor: COLORS.primaryMid,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
    gap: 12,
  },
  legsHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legsTitle:    { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  legsSubtitle: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500', marginTop: -6 },
  legRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.background, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  legNumBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  legNumText:    { fontSize: 13, fontWeight: '800', color: COLORS.white },
  legRouteName:  { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  legStops:      { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', marginTop: 1 },
  legMeta:       { fontSize: 11, fontWeight: '600', color: COLORS.primary, marginTop: 2 },
  legBookBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, minWidth: 56, alignItems: 'center',
  },
  legBookBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.white },

  // Empty state
  emptyState:    { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18, borderWidth: 1, borderColor: COLORS.primaryMid,
  },
  emptyTitle:    { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  featureList:   { width: '100%', gap: 10 },
  featureItem:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  featureIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  featureText:   { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
});

// ── Picker styles ─────────────────────────────────────────────────────────────
const pickerStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },

  // Mode tabs
  modeTabs: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
  },
  modeTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  modeTabActive:    { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  modeTabText:      { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  modeTabTextActive:{ color: COLORS.primary },

  // GPS button
  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start', marginHorizontal: 16, marginTop: 10, marginBottom: 2,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.secondaryLight, borderWidth: 1, borderColor: COLORS.secondary + '50',
  },
  gpsBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.secondary },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 14,
    paddingHorizontal: 14, height: 48, margin: 16, marginTop: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },

  // Address mode hint
  addrHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 16, marginTop: -4, marginBottom: 8,
    backgroundColor: COLORS.primaryLight, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.primaryMid,
  },
  addrHintText: { flex: 1, fontSize: 12, color: COLORS.primary, fontWeight: '600', lineHeight: 17 },

  // Address results
  addrItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  addrIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center',
  },
  addrLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 19 },
  addrSub:   { fontSize: 11, color: COLORS.primary, fontWeight: '600', marginTop: 2 },

  // Centre wrap for loading / empty
  centerWrap: { alignItems: 'center', paddingTop: 60, gap: 10 },
  centerText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },

  // Stop items (stops mode)
  stopItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  stopIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  stopName:   { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  stopCoords: { fontSize: 12, color: COLORS.textMuted },
  stopDist:   { fontSize: 12, color: COLORS.secondary, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: COLORS.background,
  },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
});

// ── Chip styles ───────────────────────────────────────────────────────────────
const chipStyles = StyleSheet.create({
  wrap: {
    width: 160, borderRadius: 14, padding: 12,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, gap: 4,
  },
  wrapActive:    { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  label:         { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelActive:   { color: COLORS.primary },
  summary:       { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 18 },
  summaryActive: { color: COLORS.primaryDark },
  metaRow:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta:          { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  metaActive:    { color: COLORS.primary },
});

export default TripPlannerScreen;
