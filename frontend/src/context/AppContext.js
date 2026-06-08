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

import React, { createContext, useState, useContext, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { registerPushToken, registerFcmToken } from '../api/apiClient';
import { getWalletApi } from '../api/walletApi';
import { getBookingsApi, cancelBookingApi } from '../api/bookingApi';
import { useAuth } from './AuthContext';

const AppContext = createContext();


export const AppProvider = ({ children }) => {
  const { user, role } = useAuth();

  // Load the real wallet balance from the DB as soon as a passenger is
  // authenticated — screens like Home/Profile/Booking read walletBalance
  // from context and never trigger a fetch themselves, so without this
  // they'd show the stale $0.00 default until the Wallet tab was opened.
  const [walletBalance, setWalletBalance] = useState(0);
  useEffect(() => {
    if (role !== 'passenger' || !user) return;
    let cancelled = false;
    getWalletApi()
      .then((res) => { if (!cancelled) setWalletBalance(res.data?.balance ?? 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [role, user]);

  // Register push tokens on mount (Expo + raw FCM) — best-effort, no throw
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        const granted = status === 'granted'
          ? true
          : (await Notifications.requestPermissionsAsync()).status === 'granted';
        if (!granted) return;

        // 1. Expo push token (routes through Expo's proxy → FCM/APNs)
        const { data: expoToken } = await Notifications.getExpoPushTokenAsync();
        if (expoToken) await registerPushToken(expoToken).catch(() => {});

        // 2. Raw device token (FCM on Android, APNs on iOS) for direct delivery
        const { data: deviceToken, type } = await Notifications.getDevicePushTokenAsync();
        if (deviceToken && (type === 'firebase' || type === 'ios')) {
          await registerFcmToken(deviceToken).catch(() => {});
        }
      } catch { /* entirely best-effort */ }
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

  // Pulls the passenger's real ticket bookings from the DB (joined with
  // trip/vehicle/route info server-side) and merges them with whatever
  // taxi reservations are already in state. Taxi bookings have no backend
  // table — they're a purely local/mock feature — so a DB refresh must
  // preserve them rather than replace the whole list.
  const refreshBookings = async () => {
    if (role !== 'passenger' || !user) return;
    try {
      const res = await getBookingsApi();
      const dbBookings = res.data ?? [];
      setBookings(prev => {
        const taxiOnly = prev.filter(b => b.type === 'taxi');
        return [...dbBookings, ...taxiOnly].sort((a, b) => new Date(b.date) - new Date(a.date));
      });
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

    // Taxi reservations are local-only mocks — there's nothing to cancel server-side.
    if (booking.type === 'taxi') {
      setBookings(prev => prev.map(b => (b._id === bookingId ? { ...b, status: 'cancelled' } : b)));
      addNotification({
        _id: Date.now().toString(),
        type: 'info',
        title: 'Booking Cancelled',
        body: `Your taxi reservation has been cancelled.`,
        time: 'Just now',
        read: false,
      });
      return { ok: true };
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
        body: `Your booking for ${booking.bus?.name} has been cancelled. $${refundAmount.toFixed(2)} refunded to wallet.`,
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
      activeBooking, setActiveBooking,
      bookings, addBooking, cancelBooking, refreshBookings,
      ratings, addRating, averageRating,
      notifications, addNotification,
      emergencyAlerts, sendEmergencyAlert,
      busLocations, updateBusLocation, getBusLocation,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);