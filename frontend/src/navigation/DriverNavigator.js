import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, PURPLE } from '../constants/colors';
import PressableScale from '../components/common/PressableScale';
import { useApp } from '../context/AppContext';
import { DriverLocationProvider } from '../context/DriverLocationContext';

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
import TripChecklistScreen     from '../screens/driver/TripChecklistScreen';
import DelayReportScreen              from '../screens/driver/DelayReportScreen';
import WeeklyScheduleScreen           from '../screens/driver/WeeklyScheduleScreen';
import DriverNotificationsScreen      from '../screens/driver/DriverNotificationsScreen';
import DriverHelpSupportScreen        from '../screens/driver/DriverHelpSupportScreen';
import ScheduleServiceScreen          from '../screens/driver/ScheduleServiceScreen';

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
    <Stack.Screen name="TripChecklist"     component={TripChecklistScreen}    />
    <Stack.Screen name="DriverMap"         component={DriverMapScreen}        />
    <Stack.Screen name="DelayReport"       component={DelayReportScreen}      />
    <Stack.Screen name="WeeklySchedule"   component={WeeklyScheduleScreen}   />
    <Stack.Screen name="DriverHelpSupport"  component={DriverHelpSupportScreen} />
    <Stack.Screen name="ScheduleService"    component={ScheduleServiceScreen}   />
    {/* Notifications now opened from the dashboard bell (Inbox tab removed) */}
    <Stack.Screen name="DriverNotifications" component={DriverNotificationsScreen} />
  </Stack.Navigator>
);

// ── Map tab stack ────────────────────────────────────────────────────────────
const MapStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="DriverMap"         component={DriverMapScreen}        />
    <Stack.Screen name="TripChecklist"     component={TripChecklistScreen}    />
    <Stack.Screen name="PassengerVerify"   component={PassengerVerifyScreen}  />
    <Stack.Screen name="PassengerList"     component={PassengerListScreen}    />
    <Stack.Screen name="Emergency"         component={EmergencyScreen}        />
    <Stack.Screen name="IssueReport"       component={IssueReportScreen}      />
    <Stack.Screen name="DelayReport"       component={DelayReportScreen}      />
  </Stack.Navigator>
);

// ── Vehicle tab stack (fixes IssueReport navigation from VehicleStatus) ─────
const VehicleStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="VehicleStatusMain" component={VehicleStatusScreen}    />
    <Stack.Screen name="IssueReport"       component={IssueReportScreen}      />
    <Stack.Screen name="Emergency"         component={EmergencyScreen}        />
    <Stack.Screen name="ScheduleService"   component={ScheduleServiceScreen}  />
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
    <Stack.Screen name="WeeklySchedule"   component={WeeklyScheduleScreen}   />
  </Stack.Navigator>
);

// ── Tab config ───────────────────────────────────────────────────────────────
const TAB_CONFIG = {
  DashboardStack:      { label: 'Dashboard', icon: 'speedometer',      iconOutline: 'speedometer-outline'      },
  MapStack:            { label: 'Navigate',  icon: 'navigate',         iconOutline: 'navigate-outline'         },
  VehicleStack:        { label: 'Vehicle',   icon: 'car',              iconOutline: 'car-outline'              },
  EarningsStack:       { label: 'Earnings',  icon: 'cash',             iconOutline: 'cash-outline'             },
  HistoryStack:        { label: 'History',   icon: 'time',             iconOutline: 'time-outline'             },
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
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
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

const DriverNavigator = () => (
  // Single GPS owner for the whole driver app — one watcher, one broadcaster.
  <DriverLocationProvider>
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="DashboardStack"     component={DashboardStack}     options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="MapStack"           component={MapStack}           options={{ tabBarLabel: 'Navigate'  }} />
      <Tab.Screen name="VehicleStack"       component={VehicleStack}       options={{ tabBarLabel: 'Vehicle'   }} />
      <Tab.Screen name="EarningsStack"      component={EarningsStack}      options={{ tabBarLabel: 'Earnings'  }} />
      <Tab.Screen name="HistoryStack"       component={HistoryStack}       options={{ tabBarLabel: 'History'   }} />
    </Tab.Navigator>
  </DriverLocationProvider>
);

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
    paddingHorizontal: 6,
    shadowColor: PURPLE.deep,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingTop: 6 },
  tabIndicator: {
    position: 'absolute',
    top: 0, width: 26, height: 3,
    borderRadius: 2, backgroundColor: PURPLE.primary,
  },
  tabBtn: {
    width: 48, height: 34, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: PURPLE.primary,
    shadowColor: PURPLE.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 5,
  },
  tabLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, marginTop: 5 },
  tabLabelActive: { color: PURPLE.primary, fontWeight: '800' },
});

export default DriverNavigator;
