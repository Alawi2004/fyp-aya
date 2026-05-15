import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, StatusBar,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { COLORS } from '../../constants/colors';

const CATEGORY_META = {
  regular:      { label: 'Regular Passenger', icon: 'person-outline',    color: COLORS.primary,  bg: COLORS.primaryLight,  discount: 'Full fare' },
  student:      { label: 'Student',           icon: 'school-outline',    color: '#7C3AED',        bg: '#F5F3FF',            discount: '30% off' },
  senior:       { label: 'Senior (60+)',      icon: 'walk-outline',      color: COLORS.secondary, bg: COLORS.secondaryLight, discount: '50% off' },
  employee:     { label: 'Employee',          icon: 'briefcase-outline', color: COLORS.warning,   bg: COLORS.warningLight,  discount: '25% off' },
  school_child: { label: 'School Child',      icon: 'bus-outline',       color: '#EA580C',        bg: '#FFF7ED',            discount: '50% off' },
};

const MenuItem = ({ icon, label, value, onPress, danger = false, rightEl }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
      <Ionicons name={icon} size={18} color={danger ? COLORS.danger : COLORS.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.menuLabel, danger && { color: COLORS.danger }]}>{label}</Text>
      {value ? <Text style={styles.menuValue}>{value}</Text> : null}
    </View>
    {rightEl || <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />}
  </TouchableOpacity>
);

const ProfileScreen = ({ navigation }) => {
  const headerInsets = useHeaderInsets();
  const { user, logout } = useAuth();
  const { walletBalance, bookings } = useApp();

  const catKey = user?.category || 'regular';
  const cat = CATEGORY_META[catKey] || CATEGORY_META.regular;

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'P';

  const totalTrips = bookings?.length || 24;
  const completedTrips = bookings?.filter(b => b.status === 'completed').length || 18;

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

        {/* Hero */}
        <View style={[styles.hero, headerInsets]}>
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />

          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{initials}</Text>
            <View style={styles.avatarBadge}>
              <Ionicons name="checkmark" size={10} color={COLORS.white} />
            </View>
          </View>
          <Text style={styles.userName}>{user?.name || 'Passenger'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>${walletBalance?.toFixed(2) ?? '0.00'}</Text>
              <Text style={styles.statLabel}>Balance</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{totalTrips}</Text>
              <Text style={styles.statLabel}>Total Trips</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>4.8 ⭐</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>
        </View>

        {/* Membership Badge */}
        <View style={styles.body}>
          <View style={styles.memberCard}>
            <View style={[styles.memberIcon, { backgroundColor: cat.bg }]}>
              <Ionicons name={cat.icon} size={20} color={cat.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberTitle}>{cat.label}</Text>
              <Text style={styles.memberSub}>{completedTrips} completed trips · {cat.discount} fare</Text>
            </View>
            <View style={[styles.memberBadge, { backgroundColor: cat.bg }]}>
              <Text style={[styles.memberBadgeText, { color: cat.color }]}>Active</Text>
            </View>
          </View>

          {/* Account */}
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="person-circle-outline"
              label="Personal Info"
              value={user?.phone || 'Tap to update'}
              onPress={() => {}}
            />
            <MenuItem
              icon="wallet-outline"
              label="My Wallet"
              value={`$${walletBalance?.toFixed(2) ?? '0.00'} available`}
              onPress={() => navigation.navigate('Wallet')}
            />
            <MenuItem
              icon="receipt-outline"
              label="Trip History"
              value={`${totalTrips} bookings`}
              onPress={() => navigation.navigate('TripHistory')}
            />
            <MenuItem
              icon="heart-outline"
              label="Favorite Routes"
              onPress={() => navigation.navigate('FavoriteRoutes')}
            />
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              onPress={() => navigation.navigate('Notifications')}
            />
          </View>

          {/* Support */}
          <Text style={styles.sectionLabel}>Support</Text>
          <View style={styles.menuCard}>
            <MenuItem icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => {}} />
            <MenuItem icon="help-buoy-outline" label="Help & Support" onPress={() => {}} />
            <MenuItem icon="star-outline" label="Rate the App" onPress={() => {}} />
            <MenuItem
              icon="log-out-outline"
              label="Sign Out"
              onPress={handleLogout}
              danger
            />
          </View>

          {/* Danger zone */}
          <Text style={styles.sectionLabel}>Danger Zone</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="trash-outline"
              label="Delete Account"
              value="30-day cooling off period"
              onPress={() => navigation.navigate('DeleteAccount')}
              danger
            />
          </View>

          <Text style={styles.version}>RideAya v1.0.0 · Made with ❤️</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Hero */
  hero: {
    backgroundColor: COLORS.headerBg,
    paddingBottom: 32,
    alignItems: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  heroDecor1: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -60, right: -50,
  },
  heroDecor2: {
    position: 'absolute',
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -20, left: -30,
  },
  avatarWrap: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: COLORS.white },
  avatarBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  userName: { fontSize: 22, fontWeight: '800', color: COLORS.white, letterSpacing: -0.3 },
  userEmail: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 3 },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18, paddingVertical: 14, paddingHorizontal: 8,
    width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },

  /* Body */
  body: { padding: 16, paddingTop: 20 },

  /* Member card */
  memberCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 14, marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  memberIcon: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  memberTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  memberSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },
  memberBadge: {
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  memberBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.secondary },

  /* Section */
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 8, marginLeft: 4, marginTop: 4,
  },
  menuCard: {
    backgroundColor: COLORS.white, borderRadius: 18,
    marginBottom: 16, overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  menuIcon: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  menuIconDanger: { backgroundColor: COLORS.dangerLight },
  menuLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  menuValue: { fontSize: 12, color: COLORS.textMuted, marginTop: 1, fontWeight: '500' },

  version: {
    textAlign: 'center', fontSize: 12,
    color: COLORS.textMuted, marginTop: 4, marginBottom: 8,
  },
});

export default ProfileScreen;
