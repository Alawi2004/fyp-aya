import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';

import DriverDashboardScreen   from '../screens/driver/DriverDashboardScreen';
import DriverMapScreen         from '../screens/driver/DriverMapScreen';
import PassengerVerifyScreen   from '../screens/driver/PassengerVerifyScreen';
import PassengerListScreen     from '../screens/driver/PassengerListScreen';
import EarningsScreen          from '../screens/driver/EarningsScreen';
import DriverTripHistoryScreen from '../screens/driver/DriverTripHistoryScreen';
import IssueReportScreen       from '../screens/driver/IssueReportScreen';
import EmergencyScreen         from '../screens/driver/EmergencyScreen';
import RatingsScreen           from '../screens/driver/RatingsScreen';
import VehicleStatusScreen     from '../screens/driver/VehicleStatusScreen';
import DriverProfileScreen     from '../screens/driver/DriverProfileScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ── Dashboard tab stack ──────────────────────────────────────────────────────
const DashboardStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="DriverDashboard"   component={DriverDashboardScreen}  />
    <Stack.Screen name="DriverProfile"     component={DriverProfileScreen}    />
    <Stack.Screen name="PassengerVerify"   component={PassengerVerifyScreen}  />
    <Stack.Screen name="PassengerList"     component={PassengerListScreen}    />
    <Stack.Screen name="Emergency"         component={EmergencyScreen}        />
    <Stack.Screen name="IssueReport"       component={IssueReportScreen}      />
    <Stack.Screen name="Ratings"           component={RatingsScreen}          />
    <Stack.Screen name="DriverTripHistory" component={DriverTripHistoryScreen} />
    {/* Profile screen re-routes to VehicleStatus / Earnings via tab navigation */}
    <Stack.Screen name="VehicleStatus"     component={VehicleStatusScreen}    />
    <Stack.Screen name="Earnings"          component={EarningsScreen}         />
  </Stack.Navigator>
);

// ── Map tab stack ────────────────────────────────────────────────────────────
const MapStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="DriverMap"         component={DriverMapScreen}        />
    <Stack.Screen name="PassengerVerify"   component={PassengerVerifyScreen}  />
    <Stack.Screen name="PassengerList"     component={PassengerListScreen}    />
    <Stack.Screen name="Emergency"         component={EmergencyScreen}        />
    <Stack.Screen name="IssueReport"       component={IssueReportScreen}      />
  </Stack.Navigator>
);

// ── Vehicle tab stack (fixes IssueReport navigation from VehicleStatus) ─────
const VehicleStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="VehicleStatusMain" component={VehicleStatusScreen}    />
    <Stack.Screen name="IssueReport"       component={IssueReportScreen}      />
    <Stack.Screen name="Emergency"         component={EmergencyScreen}        />
  </Stack.Navigator>
);

// ── Earnings tab stack ───────────────────────────────────────────────────────
const EarningsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="EarningsMain"      component={EarningsScreen}         />
    <Stack.Screen name="DriverTripHistory" component={DriverTripHistoryScreen} />
  </Stack.Navigator>
);

// ── History tab stack ────────────────────────────────────────────────────────
const HistoryStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="HistoryMain"       component={DriverTripHistoryScreen} />
    <Stack.Screen name="Ratings"           component={RatingsScreen}           />
  </Stack.Navigator>
);

// ── Tab config ───────────────────────────────────────────────────────────────
const TAB_CONFIG = {
  DashboardStack: { label: 'Dashboard', icon: 'speedometer',  iconOutline: 'speedometer-outline' },
  MapStack:       { label: 'Navigate',  icon: 'navigate',     iconOutline: 'navigate-outline'    },
  VehicleStack:   { label: 'Vehicle',   icon: 'car',          iconOutline: 'car-outline'          },
  EarningsStack:  { label: 'Earnings',  icon: 'cash',         iconOutline: 'cash-outline'         },
  HistoryStack:   { label: 'History',   icon: 'time',         iconOutline: 'time-outline'         },
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
        if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
      };

      return (
        <View key={route.key} style={styles.tabItem}>
          <View
            onTouchEnd={onPress}
            style={[styles.tabBtn, isFocused && styles.tabBtnActive]}
          >
            <Ionicons
              name={isFocused ? cfg.icon : cfg.iconOutline}
              size={21}
              color={isFocused ? COLORS.primary : COLORS.textMuted}
            />
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {cfg.label}
            </Text>
            {isFocused && <View style={styles.tabDot} />}
          </View>
        </View>
      );
    })}
  </View>
  );
};

const DriverNavigator = () => (
  <Tab.Navigator
    tabBar={props => <CustomTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="DashboardStack" component={DashboardStack} options={{ tabBarLabel: 'Dashboard' }} />
    <Tab.Screen name="MapStack"       component={MapStack}       options={{ tabBarLabel: 'Navigate'  }} />
    <Tab.Screen name="VehicleStack"   component={VehicleStack}   options={{ tabBarLabel: 'Vehicle'   }} />
    <Tab.Screen name="EarningsStack"  component={EarningsStack}  options={{ tabBarLabel: 'Earnings'  }} />
    <Tab.Screen name="HistoryStack"   component={HistoryStack}   options={{ tabBarLabel: 'History'   }} />
  </Tab.Navigator>
);

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    paddingHorizontal: 4,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 16,
  },
  tabItem:      { flex: 1, alignItems: 'center' },
  tabBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 6, paddingHorizontal: 8,
    borderRadius: 14, position: 'relative',
  },
  tabBtnActive:   { backgroundColor: COLORS.primaryLight },
  tabLabel:       { fontSize: 9, fontWeight: '600', color: COLORS.textMuted, marginTop: 3 },
  tabLabelActive: { color: COLORS.primary, fontWeight: '700' },
  tabDot: {
    position: 'absolute', bottom: -6,
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
});

export default DriverNavigator;
