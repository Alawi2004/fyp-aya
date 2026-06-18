// import React, { createContext, useState, useContext } from 'react';

// const AppContext = createContext();

// export const AppProvider = ({ children }) => {
//   const [notifications, setNotifications] = useState([]);
//   const [walletBalance, setWalletBalance] = useState(0);
//   const [activeBooking, setActiveBooking] = useState(null);

//   const addNotification = (notif) => {
//     setNotifications(prev => [notif, ...prev]);
//   };

//   const updateBalance = (amount) => {
//     setWalletBalance(amount);
//   };

//   return (
//     <AppContext.Provider value={{
//       notifications, addNotification,
//       walletBalance, updateBalance,
//       activeBooking, setActiveBooking,
//     }}>
//       {children}
//     </AppContext.Provider>
//   );
// };

// export const useApp = () => useContext(AppContext);

import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { I18nManager, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import apiClient, { registerPushToken, registerFcmToken } from '../api/apiClient';
import { t as _t } from '../i18n/translations';

// Expo Go removed Android push notifications in SDK 53 — skip registration there
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';
// Lazy-load to avoid the module emitting warnings when imported in Expo Go
const Notifications = IS_EXPO_GO ? null : require('expo-notifications');
import { getWalletApi } from '../api/walletApi';
import { getBookingsApi, cancelBookingApi } from '../api/bookingApi';
import { cancelTaxiReservation } from '../api/apiClient';
import { useAuth } from './AuthContext';

const AppContext = createContext();

// Approximate rates vs USD — used as fallback when the live API is unavailable
// or doesn't support the requested currency (e.g. LBP).
const FALLBACK_RATES_VS_USD = {
  USD: 1, EUR: 0.92, GBP: 0.79,
  LBP: 89500, AED: 3.67, SAR: 3.75, TRY: 32.5,
};

// Returns how many `to` units equal 1 `from` unit.
// Primary: fawazahmed0 open-source API (no key, 150+ currencies).
// Fallback: ratio of hardcoded USD rates.
async function fetchConversionRate(from, to) {
  if (from === to) return 1;
  try {
    const res = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from.toLowerCase()}.json`,
      { signal: AbortSignal.timeout?.(5000) }
    );
    const data = await res.json();
    const rate = data?.[from.toLowerCase()]?.[to.toLowerCase()];
    if (rate) return rate;
  } catch { /* fall through to hardcoded fallback */ }
  const fromUsd = FALLBACK_RATES_VS_USD[from] ?? 1;
  const toUsd   = FALLBACK_RATES_VS_USD[to]   ?? 1;
  return toUsd / fromUsd;
}

export const AppProvider = ({ children }) => {
  const { user, role } = useAuth();

  // Load the real wallet balance from the DB as soon as a passenger is
  // authenticated — screens like Home/Profile/Booking read walletBalance
  // from context and never trigger a fetch themselves, so without this
  // they'd show the stale $0.00 default until the Wallet tab was opened.
  const [walletBalance, setWalletBalance] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  // The backend's base currency and its rate — used to derive cross-currency rates.
  const backendCurrencyRef = useRef('USD');
  const backendRateRef = useRef(1);
  const [supportPhone, setSupportPhone] = useState('+961 1 999 000');
  const [supportEmail, setSupportEmail] = useState('support@yallatransit.lb');
  const [language, setLanguage] = useState('en');
  const [walletLimits, setWalletLimits] = useState({ minTopup: 5, maxTopup: 500, maxBalance: 1000, lowBalanceAlert: 5 });
  const [gpsSettings, setGpsSettings]  = useState({ updateIntervalSec: 10, staleThresholdSec: 60, geofenceRadiusM: 150 });

  useEffect(() => {
    if (role !== 'passenger' || !user) return;
    let cancelled = false;
    getWalletApi()
      .then((res) => { if (!cancelled) setWalletBalance(res.data?.balance ?? 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [role, user]);

  // Applies a display currency by fetching the real conversion rate from the
  // backend's base currency to `targetCode`, then updating both currency + rate.
  const applyConversion = useCallback(async (targetCode) => {
    setCurrency(targetCode);
    const convRate = await fetchConversionRate(backendCurrencyRef.current, targetCode);
    setExchangeRate(backendRateRef.current * convRate);
  }, []);

  // Restore user's currency preference immediately (no flash of wrong symbol),
  // then the backend-settings effect below will correct the exchange rate.
  useEffect(() => {
    AsyncStorage.getItem('app.currency').then((saved) => {
      if (saved) setCurrency(saved);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    apiClient.get('/settings')
      .then(async (res) => {
        const flat = res.data?.flat ?? {};
        const bCurrency = flat['app.currency'] || 'USD';
        const bRate = parseFloat(flat['app.exchange_rate']);
        backendCurrencyRef.current = bCurrency;
        if (bRate > 0) backendRateRef.current = bRate;

        // If the user has a preference, recalculate its rate against the now-known
        // backend base; otherwise fall back to whatever the admin configured.
        const userPref = await AsyncStorage.getItem('app.currency');
        if (userPref) {
          applyConversion(userPref);
        } else {
          setCurrency(bCurrency);
          if (bRate > 0) setExchangeRate(bRate);
        }
      })
      .catch(() => {});
  }, [user, applyConversion]);

  const setPreferredCurrency = useCallback((code) => {
    AsyncStorage.setItem('app.currency', code).catch(() => {});
    applyConversion(code);
  }, [applyConversion]);

  // Fetch public settings (support phone/email/language/limits) — no auth required.
  // Called on mount and every time the app comes to the foreground so admin
  // changes to language (or wallet/GPS limits) take effect without a full restart.
  const applyLanguageRef = useRef(null);
  const fetchPublicSettings = useCallback(async () => {
    try {
      const res = await apiClient.get('/settings/public');
      if (res.data?.['app.support_phone']) setSupportPhone(res.data['app.support_phone']);
      if (res.data?.['app.support_email']) setSupportEmail(res.data['app.support_email']);
      const lang = res.data?.['app.language'];
      if (lang && applyLanguageRef.current) applyLanguageRef.current(lang);
      const minTopup    = parseFloat(res.data?.['wallet.min_topup']);
      const maxTopup    = parseFloat(res.data?.['wallet.max_topup']);
      const maxBalance  = parseFloat(res.data?.['wallet.max_balance']);
      const lowBalAlert = parseFloat(res.data?.['wallet.low_balance_alert']);
      setWalletLimits({
        minTopup:        isNaN(minTopup)    ? 5    : minTopup,
        maxTopup:        isNaN(maxTopup)    ? 500  : maxTopup,
        maxBalance:      isNaN(maxBalance)  ? 1000 : maxBalance,
        lowBalanceAlert: isNaN(lowBalAlert) ? 5    : lowBalAlert,
      });
      const updateInt = parseFloat(res.data?.['gps.update_interval_sec']);
      const staleInt  = parseFloat(res.data?.['gps.stale_threshold_sec']);
      const geoRad    = parseFloat(res.data?.['gps.geofence_radius_m']);
      setGpsSettings({
        updateIntervalSec: isNaN(updateInt) ? 10  : updateInt,
        staleThresholdSec: isNaN(staleInt)  ? 60  : staleInt,
        geofenceRadiusM:   isNaN(geoRad)    ? 150 : geoRad,
      });
    } catch { /* backend unavailable — keep current values */ }
  }, []);

  useEffect(() => {
    // On first mount: restore persisted language immediately (no flash), then
    // fetch from API so any admin change takes effect even across restarts.
    AsyncStorage.getItem('app.language').then((stored) => {
      if (stored && applyLanguageRef.current) applyLanguageRef.current(stored);
    });
    fetchPublicSettings();

    // Re-fetch whenever the app returns to foreground
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') fetchPublicSettings();
    });
    return () => sub.remove();
  }, [fetchPublicSettings]);

  const applyLanguage = useCallback((lang) => {
    setLanguage(lang);
    apiClient.defaults.headers.common['Accept-Language'] = lang;
    const isRTL = lang === 'ar';
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.allowRTL(isRTL);
      I18nManager.forceRTL(isRTL);
    }
    AsyncStorage.setItem('app.language', lang).catch(() => {});
  }, []);

  // Keep a stable ref so fetchPublicSettings (and the AsyncStorage restore) can
  // call applyLanguage without capturing a stale closure.
  applyLanguageRef.current = applyLanguage;

  const fmtMoney = useCallback((n) => {
    const v = (parseFloat(n) || 0) * exchangeRate;
    const dec = exchangeRate >= 100 ? 0 : 2;
    return `${currency} ${v.toLocaleString('en', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
  }, [currency, exchangeRate]);

  // Translate a string to the current app language
  const t = useCallback((key) => _t(key, language), [language]);

  // Register push tokens on mount — skipped in Expo Go (removed in SDK 53)
  useEffect(() => {
    if (IS_EXPO_GO) return;
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        const granted = status === 'granted'
          ? true
          : (await Notifications.requestPermissionsAsync()).status === 'granted';
        if (!granted) return;

        const { data: expoToken } = await Notifications.getExpoPushTokenAsync();
        if (expoToken) await registerPushToken(expoToken).catch(() => {});

        const { data: deviceToken, type } = await Notifications.getDevicePushTokenAsync();
        if (deviceToken && (type === 'firebase' || type === 'ios')) {
          await registerFcmToken(deviceToken).catch(() => {});
        }
      } catch { /* best-effort */ }
    })();
  }, []);

  const [ratings, setRatings] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);

  // GPS state — driver writes, passenger reads
  const [busLocations, setBusLocations] = useState({});

  const updateBalance = (amount) => setWalletBalance(amount);

  // Driver calls this every 5 seconds
  const updateBusLocation = (busId, location) => {
    setBusLocations(prev => ({
      ...prev,
      [busId]: { ...location, updatedAt: new Date() },
    }));
  };

  const getBusLocation = (busId) => busLocations[busId] || null;

  const addRating = (ratingData) => {
    const newRating = {
      _id: Date.now().toString(),
      passengerName: ratingData.passengerName || 'Anonymous',
      avatar: ratingData.passengerName?.[0] || 'A',
      rating: ratingData.rating,
      comment: ratingData.comment || '',
      trip: ratingData.trip || 'Unknown Route',
      date: new Date().toISOString().split('T')[0],
    };
    setRatings(prev => [newRating, ...prev]);
    return newRating;
  };

  // Pulls all bookings (bus tickets + taxi reservations) from the DB.
  // Taxi reservations are now fully persisted server-side, so the DB
  // response is the single source of truth — no local merging needed.
  const refreshBookings = async () => {
    if (role !== 'passenger' || !user) return;
    try {
      const res = await getBookingsApi();
      setBookings(res.data ?? []);
    } catch { /* best-effort — leave whatever's already in state */ }
  };

  // Reload bookings whenever the passenger session changes, so a fresh
  // login/app-restart shows real DB-backed "Upcoming Trips" immediately.
  useEffect(() => { refreshBookings(); }, [role, user]);

  // Used for purely-local entries that have no backend record (taxi
  // reservations). Real ticket bookings come from refreshBookings() instead.
  const addBooking = (booking) => {
    setBookings(prev => [booking, ...prev]);
  };

  const cancelBooking = async (bookingId) => {
    const booking = bookings.find(b => b._id === bookingId);
    if (!booking) return { ok: false, error: 'Booking not found' };

    // Taxi reservations: call server to cancel and refund
    if (booking.type === 'taxi') {
      const reservationId = String(bookingId).replace('taxi_', '');
      try {
        const data = await cancelTaxiReservation(reservationId);
        setBookings(prev => prev.map(b => (b._id === bookingId ? { ...b, status: 'cancelled' } : b)));
        if (typeof data.newBalance === 'number') setWalletBalance(data.newBalance);
        const refundAmount = parseFloat(data.refund ?? 0);
        addNotification({
          _id: Date.now().toString(),
          type: 'info',
          title: 'Reservation Cancelled',
          body: refundAmount > 0
            ? `Your taxi reservation has been cancelled. ${currency} ${refundAmount.toFixed(2)} refunded to wallet.`
            : 'Your taxi reservation has been cancelled.',
          time: 'Just now',
          read: false,
        });
        return { ok: true, refund: refundAmount };
      } catch (err) {
        return { ok: false, error: err?.response?.data?.error || 'Could not cancel this reservation. Please try again.' };
      }
    }

    try {
      const res = await cancelBookingApi(bookingId);
      const { newBalance, refund } = res.data ?? {};
      setBookings(prev => prev.map(b => (b._id === bookingId ? { ...b, status: 'cancelled' } : b)));
      if (typeof newBalance === 'number') setWalletBalance(newBalance);
      const refundAmount = parseFloat(refund ?? booking.price ?? 0);
      addNotification({
        _id: Date.now().toString(),
        type: 'info',
        title: 'Booking Cancelled',
        body: `Your booking for ${booking.bus?.name} has been cancelled. ${currency} ${refundAmount.toFixed(2)} refunded to wallet.`,
        time: 'Just now',
        read: false,
      });
      return { ok: true, refund: refundAmount };
    } catch (err) {
      return { ok: false, error: err?.response?.data?.error || 'Could not cancel this booking. Please try again.' };
    }
  };

  const sendEmergencyAlert = (alertData) => {
    const alert = {
      _id: Date.now().toString(),
      ...alertData,
      time: new Date().toISOString(),
    };
    setEmergencyAlerts(prev => [alert, ...prev]);
    setNotifications(prev => [{
      _id: Date.now().toString(),
      type: 'emergency',
      title: '🚨 Emergency Alert',
      body: `Emergency reported on ${alertData.route || 'your route'}. Please stay calm.`,
      time: 'Just now',
      read: false,
    }, ...prev]);
  };

  const addNotification = (notif) => setNotifications(prev => [notif, ...prev]);

  const averageRating = ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
    : '0.0';

  return (
    <AppContext.Provider value={{
      walletBalance, updateBalance,
      currency, exchangeRate, fmtMoney,
      activeBooking, setActiveBooking,
      bookings, addBooking, cancelBooking, refreshBookings,
      ratings, addRating, averageRating,
      notifications, addNotification,
      emergencyAlerts, sendEmergencyAlert,
      busLocations, updateBusLocation, getBusLocation,
      supportPhone, supportEmail,
      language, applyLanguage, t,
      setPreferredCurrency,
      walletLimits,
      gpsSettings,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);