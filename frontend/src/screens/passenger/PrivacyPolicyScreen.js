import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PURPLE } from '../../constants/colors';
import GradientFill from '../../components/common/GradientFill';
import FadeInView from '../../components/common/FadeInView';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SECTIONS = [
  {
    title: 'Information We Collect',
    icon: 'document-text-outline',
    color: '#7C3AED',
    body: 'We collect information you provide when creating an account: name, email, phone, and date of birth. We also collect trip and booking data, payment information, location data when using transit tracking, and any feedback or ratings you submit.',
  },
  {
    title: 'How We Use Your Information',
    icon: 'settings-outline',
    color: '#8B5CF6',
    body: 'Your data is used to provide and improve our bus transit services, process bookings and payments, send service notifications, personalise your experience, ensure safety and security, and comply with legal obligations.',
  },
  {
    title: 'Location Data',
    icon: 'location-outline',
    color: '#10B981',
    body: 'When using bus tracking, we may access your device location to show nearby stops and real-time bus positions. We do not store your location history beyond the current session unless required for trip records.',
  },
  {
    title: 'Data Sharing',
    icon: 'share-social-outline',
    color: '#F59E0B',
    body: 'We do not sell your personal data. We may share information with transport operators to fulfil bookings, payment processors for transactions, and authorities when required by law. All partners are contractually bound to protect your data.',
  },
  {
    title: 'Data Retention',
    icon: 'time-outline',
    color: '#EF4444',
    body: 'Account information is kept while your account is active. Trip and booking records are retained for 3 years for legal and accounting purposes. You may request deletion at any time through the Delete Account feature.',
  },
  {
    title: 'Your Rights',
    icon: 'shield-outline',
    color: '#06B6D4',
    body: 'You have the right to access, correct, or delete your personal data. You may also request a copy of your data or withdraw consent at any time. Contact us through Help & Support to exercise these rights.',
  },
  {
    title: 'Security',
    icon: 'lock-closed-outline',
    color: '#F97316',
    body: 'We use industry-standard TLS encryption for data in transit and secure storage for data at rest. Access tokens expire after 15 minutes. We encourage you to use a strong password and keep your device locked.',
  },
  {
    title: "Children's Privacy",
    icon: 'people-outline',
    color: '#EC4899',
    body: 'Yalla Transit is not directed at children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us with data, please contact us immediately.',
  },
  {
    title: 'Policy Changes',
    icon: 'refresh-outline',
    color: '#8B5CF6',
    body: 'We may update this policy from time to time. Significant changes will be announced via in-app notification. Continued use of the app after changes means you accept the updated policy.',
  },
  {
    title: 'Contact Us',
    icon: 'mail-outline',
    color: '#14B8A6',
    body: 'For questions about this Privacy Policy or how we handle your data, please use the Help & Support section in the app.',
  },
];

const PolicyCard = ({ item, index }) => {
  const [open, setOpen] = useState(index === 0);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  };

  return (
    <TouchableOpacity
      style={[styles.card, open && { borderLeftColor: item.color, borderLeftWidth: 3 }]}
      onPress={toggle}
      activeOpacity={0.75}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: item.color + '18' }]}>
          <Ionicons name={item.icon} size={18} color={item.color} />
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {String(index + 1).padStart(2, '0')}. {item.title}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={COLORS.textMuted}
          style={{ marginLeft: 4 }}
        />
      </View>
      {open && (
        <Text style={styles.cardBody}>{item.body}</Text>
      )}
    </TouchableOpacity>
  );
};

const PrivacyPolicyScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* Gradient header */}
      <View style={styles.hero}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill id="privacyHero" colors={PURPLE.gradient} vertical />
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />
        </View>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Privacy Policy</Text>
            <Text style={styles.headerSub}>Last updated: June 2026</Text>
          </View>
          <View style={styles.headerBadge}>
            <Ionicons name="shield-checkmark" size={14} color={COLORS.white} />
            <Text style={styles.headerBadgeText}>Secure</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
      >
        {/* Intro card */}
        <View style={styles.introCard}>
          <View style={styles.introIconRow}>
            <View style={styles.introIconWrap}>
              <Ionicons name="shield-checkmark" size={28} color={PURPLE.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.introTitle}>Your Privacy Matters</Text>
              <Text style={styles.introSub}>Yalla Transit · Effective June 2026</Text>
            </View>
          </View>
          <Text style={styles.introBody}>
            We are committed to protecting your personal information. This policy explains how we
            collect, use, and safeguard your data when you use Yalla Transit.
          </Text>

          {/* Trust badges */}
          <View style={styles.badgeRow}>
            {[
              { icon: 'lock-closed-outline',    label: 'Encrypted' },
              { icon: 'eye-off-outline',        label: 'Not Sold' },
              { icon: 'checkmark-circle-outline', label: 'Compliant' },
            ].map(b => (
              <View key={b.label} style={styles.trustBadge}>
                <Ionicons name={b.icon} size={14} color={PURPLE.primary} />
                <Text style={styles.trustBadgeText}>{b.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Section label */}
        <Text style={styles.sectionLabel}>POLICY DETAILS — TAP TO EXPAND</Text>

        {/* Collapsible policy sections */}
        {SECTIONS.map((item, index) => (
          <FadeInView key={item.title} index={index} stagger={55}>
            <PolicyCard item={item} index={index} />
          </FadeInView>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.footerText}>
            Your use of Yalla Transit is also governed by our Terms of Service.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default PrivacyPolicyScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Hero */
  hero: {
    backgroundColor: PURPLE.deep,
    overflow: 'hidden',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  heroDecor1: {
    position: 'absolute', width: 190, height: 190, borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -50,
  },
  heroDecor2: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: -20, left: -30,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 18,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  headerBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.white },

  body: { padding: 16, paddingBottom: 48 },

  /* Intro card */
  introCard: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 18,
    marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  introIconRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12,
  },
  introIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: PURPLE.light,
    alignItems: 'center', justifyContent: 'center',
  },
  introTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  introSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },
  introBody:  { fontSize: 13, color: COLORS.textSecondary, lineHeight: 21, marginBottom: 14 },
  badgeRow:   { flexDirection: 'row', gap: 8 },
  trustBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: PURPLE.light, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: PURPLE.midStrong,
  },
  trustBadgeText: { fontSize: 11, fontWeight: '700', color: PURPLE.primary },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 10, marginLeft: 4,
  },

  /* Policy card */
  card: {
    backgroundColor: COLORS.white, borderRadius: 14,
    marginBottom: 8, overflow: 'hidden',
    borderLeftWidth: 0, borderLeftColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  cardIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: {
    flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.textPrimary,
  },
  cardBody: {
    fontSize: 13, color: COLORS.textSecondary, lineHeight: 21,
    paddingHorizontal: 14, paddingBottom: 14,
  },

  footer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 12, paddingHorizontal: 4,
  },
  footerText: { flex: 1, fontSize: 12, color: COLORS.textMuted, lineHeight: 18 },
});
