import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, StatusBar, Platform,
} from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { setPickerResult } from '../../utils/locationPickerResult';

const DEFAULT_REGION = {
  latitude: 33.8938,
  longitude: 35.5018,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

const MapLocationPickerScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { field, title } = route?.params ?? {};
  const mapRef = useRef(null);

  const [region, setRegion]     = useState(DEFAULT_REGION);
  const [address, setAddress]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [locating, setLocating] = useState(true);
  const geocodeTimeout = useRef(null);

  // Jump to user's GPS position on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const r = {
            latitude:  pos.coords.latitude,
            longitude: pos.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
          setRegion(r);
          mapRef.current?.animateToRegion(r, 600);
          reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        }
      } catch (_) {}
      finally { setLocating(false); }
    })();
  }, []);

  const reverseGeocode = useCallback(async (lat, lng) => {
    setLoading(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const r = results[0];
      if (r) {
        const parts = [r.name, r.street, r.district, r.city].filter(Boolean);
        setAddress(parts.join(', ') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } else {
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch (_) {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce reverse geocoding while user pans
  const onRegionChangeComplete = useCallback((r) => {
    setRegion(r);
    clearTimeout(geocodeTimeout.current);
    geocodeTimeout.current = setTimeout(() => {
      reverseGeocode(r.latitude, r.longitude);
    }, 600);
  }, [reverseGeocode]);

  const goToMyLocation = async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const r = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      mapRef.current?.animateToRegion(r, 500);
    } catch (_) {}
  };

  const confirm = () => {
    setPickerResult({
      field,
      address,
      latLng: { latitude: region.latitude, longitude: region.longitude },
    });
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={DEFAULT_REGION}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
      />

      {/* Fixed center pin */}
      <View style={styles.pinWrap} pointerEvents="none">
        <Ionicons name="location" size={40} color={COLORS.primary} style={styles.pinIcon} />
        <View style={styles.pinShadow} />
      </View>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.titleText} numberOfLines={1}>
            {title || (field === 'pickup' ? 'Set Pickup Location' : 'Set Destination')}
          </Text>
        </View>
      </View>

      {/* My location button */}
      <TouchableOpacity style={[styles.myLocBtn, { bottom: 200 + insets.bottom }]} onPress={goToMyLocation} activeOpacity={0.85}>
        <Ionicons name="locate" size={20} color={COLORS.primary} />
      </TouchableOpacity>

      {/* Bottom sheet */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.addressRow}>
          <View style={[styles.dotIndicator, { backgroundColor: field === 'pickup' ? COLORS.secondary : COLORS.danger }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{field === 'pickup' ? 'PICKUP' : 'DESTINATION'}</Text>
            {loading || locating ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.addressLoading}>Finding address…</Text>
              </View>
            ) : (
              <Text style={styles.addressText} numberOfLines={2}>
                {address || 'Move the map to position the pin'}
              </Text>
            )}
          </View>
        </View>

        <Text style={styles.hint}>Pan the map to move the pin to your location</Text>

        <TouchableOpacity
          style={[styles.confirmBtn, (!address || loading) && styles.confirmBtnDisabled]}
          onPress={confirm}
          disabled={!address || loading}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
          <Text style={styles.confirmText}>Confirm Location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  titleWrap: {
    flex: 1, marginLeft: 10,
    backgroundColor: COLORS.white,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  titleText: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },

  // Center pin
  pinWrap: {
    position: 'absolute', top: '50%', left: '50%',
    marginLeft: -20, marginTop: -46,
    alignItems: 'center',
  },
  pinIcon: {
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  pinShadow: {
    width: 12, height: 6, borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginTop: -2,
  },

  // My location
  myLocBtn: {
    position: 'absolute', right: 16,
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },

  // Bottom sheet
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
  },
  addressRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8,
  },
  dotIndicator: {
    width: 12, height: 12, borderRadius: 6, marginTop: 16, flexShrink: 0,
  },
  fieldLabel: {
    fontSize: 10, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addressLoading: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  addressText: {
    fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 21,
  },
  hint: {
    fontSize: 12, color: COLORS.textMuted, textAlign: 'center',
    marginBottom: 14, fontWeight: '500',
  },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15,
  },
  confirmBtnDisabled: { backgroundColor: COLORS.border },
  confirmText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
});

export default MapLocationPickerScreen;
