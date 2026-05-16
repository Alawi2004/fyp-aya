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
import { registerPushToken } from '../api/apiClient';

const AppContext = createContext();

const MOCK_RATINGS = [
  { _id: '1', passengerName: 'Sarah Johnson', rating: 5, comment: 'Very smooth ride, driver was professional!', trip: 'Route A', date: '2024-01-15', avatar: 'S' },
  { _id: '2', passengerName: 'Mike Davis', rating: 4, comment: 'Good trip, slightly delayed but driver communicated well.', trip: 'Route B', date: '2024-01-14', avatar: 'M' },
  { _id: '3', passengerName: 'Emma Wilson', rating: 5, comment: 'Excellent service, very clean bus!', trip: 'Route A', date: '2024-01-13', avatar: 'E' },
  { _id: '4', passengerName: 'James Brown', rating: 3, comment: 'Average experience, bus was a bit crowded.', trip: 'Route C', date: '2024-01-12', avatar: 'J' },
];

const MOCK_BOOKINGS = [
  { _id: 'b1', bus: { _id: 'bus1', name: 'Express 101', route: 'Route A', origin: 'Central Station', destination: 'Airport' }, seatId: 'B3', price: 4.50, date: new Date().toISOString(), status: 'upcoming' },
  { _id: 'b2', bus: { _id: 'bus2', name: 'City Line 5', route: 'Route B', origin: 'Mall Junction', destination: 'University' }, seatId: 'A1', price: 2.00, date: new Date(Date.now() - 86400000).toISOString(), status: 'completed' },
  { _id: 'b3', bus: { _id: 'bus3', name: 'Metro Bus 7', route: 'Route C', origin: 'Hospital', destination: 'Market' }, seatId: 'C4', price: 1.50, date: new Date(Date.now() - 172800000).toISOString(), status: 'completed' },
];

export const AppProvider = ({ children }) => {
  // Register Expo push token once on mount so the backend can target this device
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        const granted = status === 'granted'
          ? true
          : (await Notifications.requestPermissionsAsync()).status === 'granted';
        if (!granted) return;
        const { data: token } = await Notifications.getExpoPushTokenAsync();
        if (token) await registerPushToken(token);
      } catch { /* push token registration is best-effort */ }
    })();
  }, []);

  const [walletBalance, setWalletBalance] = useState(35.50);
  const [ratings, setRatings] = useState(MOCK_RATINGS);
  const [bookings, setBookings] = useState(MOCK_BOOKINGS);
  const [activeBooking, setActiveBooking] = useState(null);
  const [notifications, setNotifications] = useState([
    { _id: '1', type: 'arrival', title: 'Bus arriving soon', body: 'Express 101 is 5 minutes away.', time: '2 min ago', read: false },
    { _id: '2', type: 'delay', title: 'Trip delayed', body: 'City Line 5 delayed by 10 minutes.', time: '15 min ago', read: false },
  ]);
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);

  // GPS state — driver writes, passenger reads
  const [busLocations, setBusLocations] = useState({
    bus1: { latitude: 33.8938, longitude: 35.5018, heading: 45, speed: 40, updatedAt: new Date() },
    bus2: { latitude: 33.9100, longitude: 35.5200, heading: 90, speed: 35, updatedAt: new Date() },
  });

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