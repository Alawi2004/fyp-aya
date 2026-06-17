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

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import Constants from 'expo-constants';
import apiClient, { registerPushToken, registerFcmToken } from '../api/apiClient';

// Expo Go removed Android push notifications in SDK 53 — skip registration there
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';
// Lazy-load to avoid the module emitting warnings when imported in Expo Go
const Notifications = IS_EXPO_GO ? null : require('expo-notifications');
import { getWalletApi } from '../api/walletApi';
import { getBookingsApi, cancelBookingApi } from '../api/bookingApi';
import { cancelTaxiReservation } from '../api/apiClient';
import { useAuth } from './AuthContext';

const AppContext = createContext();


export const AppProvider = ({ children }) => {
  const { user, role } = useAuth();

  // Load the real wallet balance from the DB as soon as a passenger is
  // authenticated — screens like Home/Profile/Booking read walletBalance
  // from context and never trigger a fetch themselves, so without this
  // they'd show the stale $0.00 default until the Wallet tab was opened.
  const [walletBalance, setWalletBalance] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [supportPhone, setSupportPhone] = useState('+961 1 999 000');
  const [supportEmail, setSupportEmail] = useState('support@yallatransit.lb');

  useEffect(() => {
    if (role !== 'passenger' || !user) return;
    let cancelled = false;
    getWalletApi()
      .then((res) => { if (!cancelled) setWalletBalance(res.data?.balance ?? 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [role, user]);

  useEffect(() => {
    if (!user) return;
    apiClient.get('/settings')
      .then((res) => {
        const flat = res.data?.flat ?? {};
        if (flat['app.currency']) setCurrency(flat['app.currency']);
        const rate = parseFloat(flat['app.exchange_rate']);
        if (rate > 0) setExchangeRate(rate);
      })
      .catch(() => {});
  }, [user]);

  // Fetch public settings (support phone/email) — no auth required
  useEffect(() => {
    apiClient.get('/settings/public')
      .then((res) => {
        if (res.data?.['app.support_phone']) setSupportPhone(res.data['app.support_phone']);
        if (res.data?.['app.support_email']) setSupportEmail(res.data['app.support_email']);
      })
      .catch(() => {});
  }, []);

  const fmtMoney = useCallback((n) => {
    const v = (parseFloat(n) || 0) * exchangeRate;
    const dec = exchangeRate >= 100 ? 0 : 2;
    return `${currency} ${v.toLocaleString('en', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
  }, [currency, exchangeRate]);

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
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);