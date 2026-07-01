import React, { useState, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, PURPLE } from '../constants/colors';
import PressableScale from '../components/common/PressableScale';
import { useApp } from '../context/AppContext';
import { FabOffsetContext } from '../context/FabOffsetContext';
import GradientFill from '../components/common/GradientFill';
import ChatbotScreen from '../screens/passenger/ChatbotScreen';
import { navigationRef } from './navigationRef';

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
import PersonalInfoScreen  from '../screens/passenger/PersonalInfoScreen';
import RatingsScreen       from '../screens/passenger/RatingsScreen';
import NearbyStopsScreen from '../screens/passenger/NearbyStopsScreen';
import ComplaintScreen from '../screens/passenger/ComplaintScreen';
import MyComplaintsScreen from '../screens/passenger/MyComplaintsScreen';
import PrivacyPolicyScreen from '../screens/passenger/PrivacyPolicyScreen';
import RateAppScreen       from '../screens/passenger/RateAppScreen';
import TaxiReservationScreen from '../screens/passenger/TaxiReservationScreen';
import MapLocationPickerScreen from '../screens/passenger/MapLocationPickerScreen';
import RequestStopScreen from '../screens/passenger/RequestStopScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Home"        component={HomeScreen} />
    <Stack.Screen name="Booking"     component={BookingScreen} />
    <Stack.Screen name="Ticket"      component={TicketScreen} />
    <Stack.Screen name="BusTracking" component={BusTrackingScreen} />
    <Stack.Screen name="Feedback"    component={FeedbackScreen} />
    <Stack.Screen name="TripPlanner"   component={TripPlannerScreen} />
    <Stack.Screen name="NearbyStops"       component={NearbyStopsScreen} />
    <Stack.Screen name="Complaint"         component={ComplaintScreen} />
    <Stack.Screen name="TaxiReservation"    component={TaxiReservationScreen} />
    <Stack.Screen name="MapLocationPicker" component={MapLocationPickerScreen} />
    <Stack.Screen name="RequestStop"       component={RequestStopScreen} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Profile"        component={ProfileScreen} />
    <Stack.Screen name="PersonalInfo"   component={PersonalInfoScreen} />
    <Stack.Screen name="Ratings"        component={RatingsScreen} />
    <Stack.Screen name="Wallet"         component={WalletScreen} />
    <Stack.Screen name="TripHistory"    component={TripHistoryScreen} />
    <Stack.Screen name="Notifications"  component={NotificationsScreen} />
    <Stack.Screen name="FavoriteRoutes" component={FavoriteRoutesScreen} />
    <Stack.Screen name="DeleteAccount"  component={DeleteAccountScreen} />
    <Stack.Screen name="Complaint"      component={ComplaintScreen} />
    <Stack.Screen name="MyComplaints"   component={MyComplaintsScreen} />
    <Stack.Screen name="FileComplaint"  component={ComplaintScreen} />
    <Stack.Screen name="PrivacyPolicy"  component={PrivacyPolicyScreen} />
    <Stack.Screen name="RateApp"        component={RateAppScreen} />
  </Stack.Navigator>
);

const TAB_CONFIG = {
  HomeStack:    { label: 'Home',    icon: 'home',    iconOutline: 'home-outline'    },
  TripHistory:  { label: 'Trips',   icon: 'receipt', iconOutline: 'receipt-outline' },
  Wallet:       { label: 'Wallet',  icon: 'wallet',  iconOutline: 'wallet-outline'  },
  ProfileStack: { label: 'Profile', icon: 'person',  iconOutline: 'person-outline'  },
};

const CustomTabBar = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const { t } = useApp();
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
          <PressableScale key={route.key} style={styles.tabItem} onPress={onPress} scaleTo={0.88}>
            {isFocused && <View style={styles.tabIndicator} />}
            <View style={[styles.tabBtn, isFocused && styles.tabBtnActive]}>
              <Ionicons
                name={isFocused ? cfg.icon : cfg.iconOutline}
                size={21}
                color={isFocused ? COLORS.white : COLORS.textMuted}
              />
            </View>
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {t(cfg.label)}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
};

const PassengerNavigator = () => {
  const insets = useSafeAreaInsets();
  const [chatOpen, setChatOpen] = useState(false);

  // Position the FAB above the tab bar: tab bar is ~65 px tall + bottom inset.
  // Screens with their own bottom action bar (e.g. seat booking's "Book Now")
  // push the FAB up further via FabOffsetContext so it never overlaps them.
  const [extraFabOffset, setExtraFabOffset] = useState(0);
  const fabBottom = 65 + Math.max(insets.bottom, 12) + 14 + extraFabOffset;

  // Handle actions returned by the chatbot backend
  const handleChatAction = useCallback((action) => {
    if (!action?.type) return;

    if (action.type === 'open_taxi_booking') {
      // Close the chatbot first, then navigate after the modal animates out
      setChatOpen(false);
      setTimeout(() => {
        if (navigationRef.isReady()) {
          navigationRef.navigate('HomeStack', {
            screen: 'TaxiReservation',
            params: {
              prefillPickup:      action.pickup      ?? '',
              prefillDestination: action.destination ?? '',
              prefillNotes:       action.notes       ?? '',
            },
          });
        }
      }, 350);
    }
  }, []);

  return (
    <FabOffsetContext.Provider value={setExtraFabOffset}>
      <View style={{ flex: 1 }}>
        <Tab.Navigator
          tabBar={props => <CustomTabBar {...props} />}
          screenOptions={{ headerShown: false }}
        >
          <Tab.Screen name="HomeStack"    component={HomeStack}         options={{ tabBarLabel: 'Home' }} />
          <Tab.Screen name="TripHistory"  component={TripHistoryScreen} options={{ tabBarLabel: 'Trips' }} />
          <Tab.Screen name="Wallet"       component={WalletScreen}      options={{ tabBarLabel: 'Wallet' }} />
          <Tab.Screen name="ProfileStack" component={ProfileStack}      options={{ tabBarLabel: 'Profile' }} />
        </Tab.Navigator>

        {/* ── Floating AI chat button ───────────────────────────────────── */}
        <PressableScale
          onPress={() => setChatOpen(true)}
          scaleTo={0.9}
          style={[styles.fab, { bottom: fabBottom }]}
        >
          <View style={StyleSheet.absoluteFill}>
            <GradientFill id="fab-grad" colors={PURPLE.gradient} />
          </View>
          <Ionicons name="chatbubble-ellipses" size={22} color={COLORS.white} />
        </PressableScale>

        {/* ── Chat modal ───────────────────────────────────────────────── */}
        <ChatbotScreen
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
          onAction={handleChatAction}
        />
      </View>
    </FabOffsetContext.Provider>
  );
};

const styles = StyleSheet.create({
  // Floating AI chat button
  fab: {
    position: 'absolute',
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: PURPLE.deep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
    elevation: 10,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
    paddingHorizontal: 8,
    shadowColor: PURPLE.deep,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
  },
  tabItem: {
    flex: 1, alignItems: 'center',
    paddingTop: 6,
  },
  // Slim accent bar that sits at the very top edge of the active tab.
  tabIndicator: {
    position: 'absolute',
    top: 0, width: 28, height: 3,
    borderRadius: 2, backgroundColor: PURPLE.primary,
  },
  tabBtn: {
    width: 50, height: 34, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: PURPLE.primary,
    shadowColor: PURPLE.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  tabLabel: {
    fontSize: 11, fontWeight: '600',
    color: COLORS.textMuted, marginTop: 5,
  },
  tabLabelActive: {
    color: PURPLE.primary, fontWeight: '800',
  },
});

export default PassengerNavigator;
