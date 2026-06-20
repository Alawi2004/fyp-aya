import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Platform, StatusBar,
} from 'react-native';
import useHeaderInsets from '../../hooks/useHeaderInsets';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS, PURPLE } from '../../constants/colors';

const MENU_SECTIONS = [
  {
    title: 'Activity',
    items: [
      { icon: 'time-outline',       label: 'Trip History',     screen: 'DriverTripHistory', color: PURPLE.primary   },
      { icon: 'star-outline',       label: 'My Ratings',       screen: 'Ratings',           color: COLORS.warning   },
      { icon: 'cash-outline',       label: 'Earnings',         screen: 'Earnings',          color: COLORS.secondary },
    ],
  },
  {
    title: 'Vehicle',
    items: [
      { icon: 'car-outline',        label: 'Vehicle Status',   screen: 'VehicleStatus',     color: PURPLE.primary   },
      { icon: 'document-text-outline', label: 'Report Issue',  screen: 'IssueReport',       color: COLORS.warning   },
      { icon: 'warning-outline',    label: 'Emergency SOS',    screen: 'Emergency',         color: COLORS.danger    },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon: 'notifications-outline', label: 'Notifications', screen: 'NotificationsStack',  color: PURPLE.primary   },
      { icon: 'help-circle-outline', label: 'Help & Support',  screen: 'DriverHelpSupport',  color: COLORS.secondary },
      { icon: 'log-out-outline',    label: 'Sign Out',         screen: '__logout__',        color: COLORS.danger    },
    ],
  },
];

const DriverProfileScreen = ({ navigation }) => {
  const headerInsets = useHeaderInsets();
  const { user, logout } = useAuth();

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'DR';

  const handleItem = (item) => {
    if (item.screen === '__logout__') {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]);
      return;
    }
    if (!item.screen) {
      Alert.alert('Coming Soon', 'This feature is coming soon.');
      return;
    }
    navigation.navigate(item.screen);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* Header */}
      <View style={[styles.header, headerInsets]}>
        <View style={styles.headerDecor1} />
        <View style={styles.headerDecor2} />
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{initials}</Text>
            <View style={styles.avatarOnline} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.name ?? 'Driver'}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? 'driver@app.com'}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.profileBadge}>
                <Ionicons name="shield-checkmark" size={11} color={COLORS.secondary} />
                <Text style={styles.profileBadgeText}>Verified Driver</Text>
              </View>
              {user?.gender ? (
                <View style={[styles.profileBadge, styles.genderBadge]}>
                  <Ionicons
                    name={user.gender === 'female' ? 'female' : 'male'}
                    size={11}
                    color={user.gender === 'female' ? '#DB2777' : '#2563EB'}
                  />
                  <Text style={[styles.profileBadgeText, { color: user.gender === 'female' ? '#DB2777' : '#2563EB' }]}>
                    {user.gender.charAt(0).toUpperCase() + user.gender.slice(1)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.idChip}>
            <Text style={styles.idLabel}>ID</Text>
            <Text style={styles.idValue}>DRV-042</Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Trips Done',  value: '612', icon: 'receipt-outline',  color: PURPLE.primary   },
          { label: 'Avg Rating',  value: '4.8', icon: 'star',             color: COLORS.warning   },
          { label: 'On Time',     value: '94%', icon: 'time-outline',     color: COLORS.secondary },
          { label: 'Earned',      value: '$18k', icon: 'cash-outline',    color: COLORS.secondary },
        ].map((s, i) => (
          <View key={s.label} style={[styles.statCell, i < 3 && styles.statCellBorder]}>
            <Ionicons name={s.icon} size={15} color={s.color} />
            <Text style={styles.statVal}>{s.value}</Text>
            <Text style={styles.statLbl}>{s.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Assigned vehicle */}
        <TouchableOpacity
          style={styles.vehicleCard}
          onPress={() => navigation.navigate('VehicleStatus')}
          activeOpacity={0.85}
        >
          <View style={styles.vehicleLeft}>
            <View style={styles.vehicleIcon}>
              <Ionicons name="bus" size={20} color={PURPLE.primary} />
            </View>
            <View>
              <Text style={styles.vehicleTitle}>Assigned Vehicle</Text>
              <Text style={styles.vehicleId}>BUS-101 · WXY 1234</Text>
              <Text style={styles.vehicleModel}>Yutong ZK6122HQ · 2022</Text>
            </View>
          </View>
          <View style={styles.vehicleStatus}>
            <View style={styles.vehicleStatusDot} />
            <Text style={styles.vehicleStatusText}>Active</Text>
          </View>
        </TouchableOpacity>

        {/* Menu sections */}
        {MENU_SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.menuRow, i < section.items.length - 1 && styles.menuRowBorder]}
                  onPress={() => handleItem(item)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.color + '18' }]}>
                    <Ionicons name={item.icon} size={17} color={item.color} />
                  </View>
                  <Text style={[
                    styles.menuLabel,
                    item.screen === '__logout__' && { color: COLORS.danger },
                  ]}>
                    {item.label}
                  </Text>
                  {item.screen !== '__logout__' && (
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },

  /* Header */
  header: {
    backgroundColor: PURPLE.deep,
    paddingBottom: 0, overflow: 'hidden',
  },
  headerDecor1: {
    position: 'absolute', top: -50, right: -50,
    width: 190, height: 190, borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerDecor2: {
    position: 'absolute', top: 10, right: 80,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },

  /* Profile card */
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.white, margin: 16, marginTop: 0,
    borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  avatarWrap: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: PURPLE.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '900', color: COLORS.white },
  avatarOnline: {
    position: 'absolute', bottom: 2, right: 2,
    width: 13, height: 13, borderRadius: 6.5,
    backgroundColor: COLORS.secondary, borderWidth: 2, borderColor: COLORS.white,
  },
  profileName: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.2 },
  profileEmail: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500', marginTop: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  profileBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.secondaryLight, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
  },
  genderBadge: { backgroundColor: '#FDF2F8' },
  profileBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.secondary },
  idChip: {
    alignItems: 'center', backgroundColor: PURPLE.light,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
  },
  idLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  idValue: { fontSize: 13, fontWeight: '800', color: PURPLE.primary, marginTop: 2 },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 3 },
  statCellBorder: { borderRightWidth: 1, borderRightColor: COLORS.border },
  statVal: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  statLbl: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },

  /* Vehicle card */
  vehicleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 20,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  vehicleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicleIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: PURPLE.light, alignItems: 'center', justifyContent: 'center',
  },
  vehicleTitle: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  vehicleId: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2 },
  vehicleModel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', marginTop: 1 },
  vehicleStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.secondaryLight, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  vehicleStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.secondary },
  vehicleStatusText: { fontSize: 11, fontWeight: '700', color: COLORS.secondary },

  /* Sections */
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  menuCard: {
    backgroundColor: COLORS.white, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
});

export default DriverProfileScreen;
