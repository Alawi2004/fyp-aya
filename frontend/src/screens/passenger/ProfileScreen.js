import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, StatusBar, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { getProfileApi, getMyRatingsApi } from '../../api/authApi';
import { getWalletApi } from '../../api/walletApi';
import { COLORS, PURPLE } from '../../constants/colors';

const BRAND = PURPLE.gradient;

const CATEGORY_META = {
  regular:      { label: 'Regular Passenger', icon: 'person-outline',    color: COLORS.primary,    bg: COLORS.primaryLight,    discount: 'Full fare' },
  student:      { label: 'Student',           icon: 'school-outline',    color: '#7C3AED',         bg: '#F5F3FF',              discount: '30% off' },
  senior:       { label: 'Senior (60+)',      icon: 'walk-outline',      color: COLORS.secondary,  bg: COLORS.secondaryLight,  discount: '50% off' },
  employee:     { label: 'Employee',          icon: 'briefcase-outline', color: COLORS.warning,    bg: COLORS.warningLight,    discount: '25% off' },
  school_child: { label: 'School Child',      icon: 'bus-outline',       color: '#EA580C',         bg: '#FFF7ED',              discount: '50% off' },
};

// SVG gradient that measures its own box (matches the auth screens)
const GradientFill = ({ id, colors, vertical = false }) => {
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((p) => (p.w === width && p.h === height ? p : { w: width, h: height }));
      }}
    >
      {box.w > 0 && box.h > 0 && (
        <Svg width={box.w} height={box.h}>
          <Defs>
            <SvgGradient id={id} x1="0" y1="0" x2={vertical ? '0' : box.w} y2={box.h} gradientUnits="userSpaceOnUse">
              {colors.map((c, i) => <Stop key={i} offset={`${i / (colors.length - 1)}`} stopColor={c} />)}
            </SvgGradient>
          </Defs>
          <Rect x="0" y="0" width={box.w} height={box.h} fill={`url(#${id})`} />
        </Svg>
      )}
    </View>
  );
};

const MenuItem = ({ icon, label, value, onPress, danger = false, rightEl, last = false }) => (
  <TouchableOpacity style={[styles.menuItem, last && { borderBottomWidth: 0 }]} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
      <Ionicons name={icon} size={18} color={danger ? COLORS.danger : PURPLE.primary} />
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
  const { user, setUser, logout } = useAuth();
  const { walletBalance, updateBalance, bookings, refreshBookings } = useApp();

  const [refreshing, setRefreshing] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [ratingStats, setRatingStats] = useState({ count: 0, avg: null });

  // ── Pull everything fresh from the backend ──────────────────────────────────
  const loadAll = useCallback(async (showSpinner = false) => {
    if (showSpinner) setStatsLoading(true);

    const tasks = [
      // Fresh profile (name / phone / category / member-since) → context + storage
      getProfileApi()
        .then(async (raw) => {
          const merged = {
            ...user,
            ...raw,
            name: raw.full_name ?? raw.name ?? user?.name ?? '',
            _id: String(raw.user_id ?? user?._id ?? ''),
          };
          setUser(merged);
          await AsyncStorage.setItem('userData', JSON.stringify(merged));
        })
        .catch(() => {}),

      // Live wallet balance
      getWalletApi()
        .then((res) => updateBalance(res.data?.balance ?? 0))
        .catch(() => {}),

      // Real trip ratings → count + average
      getMyRatingsApi()
        .then((rows) => {
          const list = Array.isArray(rows) ? rows : [];
          const avg = list.length
            ? (list.reduce((s, r) => s + Number(r.rating || 0), 0) / list.length)
            : null;
          setRatingStats({ count: list.length, avg });
        })
        .catch(() => setRatingStats({ count: 0, avg: null })),

      // Real bookings (kept in AppContext)
      refreshBookings(),
    ];

    await Promise.allSettled(tasks);
    setStatsLoading(false);
  }, [user, setUser, updateBalance, refreshBookings]);

  // Refresh on every focus so stats are never stale
  useFocusEffect(useCallback(() => { loadAll(true); }, [loadAll]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll(false);
    setRefreshing(false);
  };

  // ── Derived (real) values ───────────────────────────────────────────────────
  const catKey = user?.category || 'regular';
  const cat = CATEGORY_META[catKey] || CATEGORY_META.regular;

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'P';

  const realBookings = (bookings || []).filter((b) => b.status !== 'cancelled');
  const totalTrips = realBookings.length;
  const completedTrips = (bookings || []).filter((b) => b.status === 'completed').length;

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : null;

  const isVerified = (user?.status || 'active') === 'active';
  const ratingDisplay = ratingStats.avg != null ? ratingStats.avg.toFixed(1) : '—';

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const StatValue = ({ children }) =>
    statsLoading
      ? <ActivityIndicator size="small" color={COLORS.white} style={{ height: 21 }} />
      : <Text style={styles.statValue}>{children}</Text>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND[0]} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PURPLE.primary} colors={[PURPLE.primary]} />
        }
      >
        {/* Hero */}
        <View style={[styles.hero, headerInsets]}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <GradientFill id="profileHero" colors={BRAND} vertical />
            <View style={styles.heroDecor1} />
            <View style={styles.heroDecor2} />
          </View>

          <TouchableOpacity
            style={[styles.editBtn, { top: headerInsets.paddingTop }]}
            onPress={() => navigation.push('PersonalInfo')}
            activeOpacity={0.85}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="create-outline" size={18} color={COLORS.white} />
          </TouchableOpacity>

          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{initials}</Text>
            {isVerified && (
              <View style={styles.avatarBadge}>
                <Ionicons name="checkmark" size={11} color={COLORS.white} />
              </View>
            )}
          </View>
          <Text style={styles.userName}>{user?.name || 'Passenger'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          {memberSince && (
            <View style={styles.sinceChip}>
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.85)" />
              <Text style={styles.sinceText}>Member since {memberSince}</Text>
            </View>
          )}

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <StatValue>${(walletBalance ?? 0).toFixed(2)}</StatValue>
              <Text style={styles.statLabel}>Balance</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <StatValue>{totalTrips}</StatValue>
              <Text style={styles.statLabel}>Trips</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <StatValue>{ratingDisplay}{ratingStats.avg != null ? ' ★' : ''}</StatValue>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {/* Account */}
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="person-circle-outline"
              label="Personal Info"
              value={user?.phone || 'Tap to add phone'}
              onPress={() => navigation.push('PersonalInfo')}
            />
            <MenuItem
              icon="wallet-outline"
              label="My Wallet"
              value={`$${(walletBalance ?? 0).toFixed(2)} available`}
              onPress={() => navigation.push('Wallet')}
            />
            <MenuItem
              icon="receipt-outline"
              label="Trip History"
              value={totalTrips ? `${totalTrips} booking${totalTrips === 1 ? '' : 's'}` : 'No trips yet'}
              onPress={() => navigation.push('TripHistory')}
            />
            <MenuItem
              icon="star-outline"
              label="My Ratings"
              value={ratingStats.count ? `${ratingStats.count} submitted` : 'None yet'}
              onPress={() => navigation.push('Ratings')}
            />
            <MenuItem
              icon="heart-outline"
              label="Favorite Routes"
              onPress={() => navigation.push('FavoriteRoutes')}
            />
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              onPress={() => navigation.push('Notifications')}
              last
            />
          </View>

          {/* Support */}
          <Text style={styles.sectionLabel}>Support</Text>
          <View style={styles.menuCard}>
            <MenuItem icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => navigation.push('PrivacyPolicy')} />
            <MenuItem icon="help-buoy-outline" label="Help & Support" onPress={() => navigation.push('MyComplaints')} />
            <MenuItem icon="star-outline" label="Rate the App" onPress={() => navigation.push('RateApp')} />
            <MenuItem icon="log-out-outline" label="Sign Out" onPress={handleLogout} danger last />
          </View>

          {/* Danger zone */}
          <Text style={styles.sectionLabel}>Danger Zone</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="trash-outline"
              label="Delete Account"
              value="30-day cooling-off period"
              onPress={() => navigation.push('DeleteAccount')}
              danger
              last
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Hero */
  hero: {
    paddingBottom: 30,
    alignItems: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroDecor1: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -70, right: -50,
  },
  heroDecor2: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: -30, left: -40,
  },
  editBtn: {
    position: 'absolute', right: 20,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    zIndex: 2,
  },
  avatarWrap: {
    width: 90, height: 90, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.35)',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '900', color: COLORS.white },
  avatarBadge: {
    position: 'absolute', bottom: -3, right: -3,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: COLORS.white,
  },
  userName: { fontSize: 22, fontWeight: '900', color: COLORS.white, letterSpacing: -0.3 },
  userEmail: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 3 },
  sinceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  sinceText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },

  statsRow: {
    flexDirection: 'row', marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20, paddingVertical: 14, paddingHorizontal: 8,
    width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '900', color: COLORS.white, height: 21 },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },

  /* Body */
  body: { padding: 16, paddingTop: 20 },

  /* Member card */
  memberCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 14, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  memberIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  memberTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  memberSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: '600' },
  memberBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  memberBadgeText: { fontSize: 11, fontWeight: '800' },

  /* Section */
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 8, marginLeft: 4, marginTop: 4,
  },
  menuCard: {
    backgroundColor: COLORS.white, borderRadius: 18,
    marginBottom: 16, overflow: 'hidden',
    shadowColor: PURPLE.deep, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  menuIcon: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: PURPLE.light,
    alignItems: 'center', justifyContent: 'center',
  },
  menuIconDanger: { backgroundColor: COLORS.dangerLight },
  menuLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  menuValue: { fontSize: 12, color: COLORS.textMuted, marginTop: 1, fontWeight: '600' },
});

export default ProfileScreen;
