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

const AppContext = createContext();


export const AppProvider = ({ children }) => {
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

  const [walletBalance, setWalletBalance] = useState(0);
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

  const addBooking = (booking) => {
    setBookings(prev => [booking, ...prev]);
  };

  const cancelBooking = (bookingId) => {
    setBookings(prev =>
      prev.map(b => b._id === bookingId ? { ...b, status: 'cancelled' } : b)
    );
    // Refund wallet
    const booking = bookings.find(b => b._id === bookingId);
    if (booking) {
      setWalletBalance(prev => prev + parseFloat(booking.price));
      addNotification({
        _id: Date.now().toString(),
        type: 'info',
        title: 'Booking Cancelled',
        body: `Your booking for ${booking.bus?.name} has been cancelled. $${booking.price} refunded to wallet.`,
        time: 'Just now',
        read: false,
      });
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
      bookings, addBooking, cancelBooking,
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