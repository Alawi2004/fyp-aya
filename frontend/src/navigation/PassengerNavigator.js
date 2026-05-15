import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';

import HomeScreen from '../screens/passenger/HomeScreen';
import BusTrackingScreen from '../screens/passenger/BusTrackingScreen';
import BookingScreen from '../screens/passenger/BookingScreen';
import TicketScreen from '../screens/passenger/TicketScreen';
import TripHistoryScreen from '../screens/passenger/TripHistoryScreen';
import ProfileScreen from '../screens/passenger/ProfileScreen';
import WalletScreen from '../screens/passenger/WalletScreen';
import NotificationsScreen from '../screens/passenger/NotificationsScreen';
import FeedbackScreen from '../screens/passenger/FeedbackScreen';
import FavoriteRoutesScreen from '../screens/passenger/FavoriteRoutesScreen';
import TripPlannerScreen from '../screens/passenger/TripPlannerScreen';
import DeleteAccountScreen from '../screens/passenger/DeleteAccountScreen';
import NfcCardScreen from '../screens/passenger/NfcCardScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Home"        component={HomeScreen} />
    <Stack.Screen name="Booking"     component={BookingScreen} />
    <Stack.Screen name="Ticket"      component={TicketScreen} />
    <Stack.Screen name="BusTracking" component={BusTrackingScreen} />
    <Stack.Screen name="Feedback"    component={FeedbackScreen} />
    <Stack.Screen name="TripPlanner" component={TripPlannerScreen} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Profile"        component={ProfileScreen} />
    <Stack.Screen name="Wallet"         component={WalletScreen} />
    <Stack.Screen name="TripHistory"    component={TripHistoryScreen} />
    <Stack.Screen name="Notifications"  component={NotificationsScreen} />
    <Stack.Screen name="FavoriteRoutes" component={FavoriteRoutesScreen} />
    <Stack.Screen name="DeleteAccount"  component={DeleteAccountScreen} />
    <Stack.Screen name="NfcCard"        component={NfcCardScreen} />
  </Stack.Navigator>
);

const TAB_CONFIG = {
  HomeStack:    { label: 'Home',    icon: 'home',    iconOutline: 'home-outline'    },
  TripHistory:  { label: 'Trips',   icon: 'receipt', iconOutline: 'receipt-outline' },
  Wallet:       { label: 'Wallet',  icon: 'wallet',  iconOutline: 'wallet-outline'  },
  ProfileStack: { label: 'Profile', icon: 'person',  iconOutline: 'person-outline'  },
};

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  return (
  <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
    {state.routes.map((route, index) => {
      const isFocused = state.index === index;
      const cfg = TAB_CONFIG[route.name] || {};

      const onPress = () => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      };

      return (
        <View key={route.key} style={styles.tabItem}>
          <View
            onTouchEnd={onPress}
            style={[styles.tabBtn, isFocused && styles.tabBtnActive]}
          >
            <Ionicons
              name={isFocused ? cfg.icon : cfg.iconOutline}
              size={22}
              color={isFocused ? COLORS.primary : COLORS.textMuted}
            />
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {cfg.label}
            </Text>
            {isFocused && <View style={styles.tabIndicator} />}
          </View>
        </View>
      );
    })}
  </View>
  );
};

const PassengerNavigator = () => (
  <Tab.Navigator
    tabBar={props => <CustomTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="HomeStack"    component={HomeStack}        options={{ tabBarLabel: 'Home' }} />
    <Tab.Screen name="TripHistory"  component={TripHistoryScreen} options={{ tabBarLabel: 'Trips' }} />
    <Tab.Screen name="Wallet"       component={WalletScreen}      options={{ tabBarLabel: 'Wallet' }} />
    <Tab.Screen name="ProfileStack" component={ProfileStack}      options={{ tabBarLabel: 'Profile' }} />
  </Tab.Navigator>
);

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    paddingHorizontal: 8,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 16,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 6, paddingHorizontal: 16,
    borderRadius: 14, position: 'relative',
  },
  tabBtnActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabLabel: {
    fontSize: 11, fontWeight: '600',
    color: COLORS.textMuted, marginTop: 3,
  },
  tabLabelActive: {
    color: COLORS.primary, fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -6, width: 4, height: 4,
    borderRadius: 2, backgroundColor: COLORS.primary,
  },
});

export default PassengerNavigator;
