import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PURPLE } from '../../constants/colors';
import { useApp } from '../../context/AppContext';

const FAQS = [
  {
    section: 'Trips & Schedule',
    icon: 'calendar-outline',
    color: PURPLE.primary,
    items: [
      {
        q: 'How do I start a trip?',
        a: 'Go to your Dashboard and tap the active trip card. Once you are at the starting stop, tap "Start Trip" to begin. Make sure passengers can board before departing.',
      },
      {
        q: 'What do I do if a trip is delayed?',
        a: 'Tap the delay icon on the trip screen to file a delay report. Select the reason and estimated delay time. Passengers will be notified automatically.',
      },
      {
        q: 'How do I view my weekly schedule?',
        a: 'Go to History → Weekly Schedule. Your assigned routes and shift times are displayed there.',
      },
      {
        q: 'What happens if I miss a stop?',
        a: 'Continue on the route and report the missed stop through the Issue Report screen. Dispatch will be informed and can advise you on next steps.',
      },
    ],
  },
  {
    section: 'Vehicle & Issues',
    icon: 'car-outline',
    color: '#8B5CF6',
    items: [
      {
        q: 'How do I report a vehicle issue?',
        a: 'Navigate to Profile → Report Issue or use the Vehicle tab. Describe the fault and submit. Maintenance staff will be alerted immediately.',
      },
      {
        q: 'What should I do in an emergency?',
        a: 'Use the Emergency SOS button available on your profile or dashboard. This will alert dispatch with your location and priority status.',
      },
      {
        q: 'Where can I check my vehicle status?',
        a: 'Tap the Vehicle tab in the bottom navigation bar or go to Profile → Vehicle Status.',
      },
    ],
  },
  {
    section: 'Earnings & Ratings',
    icon: 'cash-outline',
    color: COLORS.secondary,
    items: [
      {
        q: 'How are my earnings calculated?',
        a: 'Earnings are based on completed trips. Each trip has a fixed rate set by management. Bonuses may apply for on-time performance.',
      },
      {
        q: 'When are earnings paid out?',
        a: 'Earnings are processed weekly. Contact HR or your fleet manager for specific payout dates and methods.',
      },
      {
        q: 'How are driver ratings collected?',
        a: 'Passengers can rate their experience after each trip. Your average rating is visible under Profile → My Ratings.',
      },
      {
        q: 'Can I dispute a rating?',
        a: 'If you believe a rating is unfair, contact support via the details below. Provide the trip date and a brief explanation.',
      },
    ],
  },
  {
    section: 'Account & App',
    icon: 'person-circle-outline',
    color: '#F59E0B',
    items: [
      {
        q: 'How do I update my personal information?',
        a: 'Go to Profile → Personal Info. You can update your contact details there.',
      },
      {
        q: 'The app is not working correctly. What should I do?',
        a: 'Try closing and reopening the app. If the problem persists, contact technical support using the details below and describe what happened.',
      },
      {
        q: 'How do I sign out?',
        a: 'Scroll to the bottom of your Profile page and tap Sign Out.',
      },
    ],
  },
];

const makeContactCards = (phone, email) => [
  {
    icon: 'call-outline',
    label: 'Support Hotline',
    value: phone,
    sub: 'Available 24/7',
    color: PURPLE.primary,
    onPress: () => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`),
  },
  {
    icon: 'mail-outline',
    label: 'Support Email',
    value: email,
    sub: 'Reply within 24 hours',
    color: '#8B5CF6',
    onPress: () => Linking.openURL(`mailto:${email}`),
  },
];

// ── FAQ accordion item ────────────────────────────────────────────────────────
const FaqItem = ({ item }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.faqItem}>
      <TouchableOpacity
        style={styles.faqQuestion}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.7}
      >
        <Text style={styles.faqQuestionText}>{item.q}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={COLORS.textMuted}
        />
      </TouchableOpacity>
      {open && <Text style={styles.faqAnswer}>{item.a}</Text>}
    </View>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────────
const DriverHelpSupportScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { supportPhone, supportEmail } = useApp();
  const CONTACT_CARDS = makeContactCards(supportPhone, supportEmail);

  const handleContact = (card) => {
    Alert.alert(card.label, card.value, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open', onPress: card.onPress },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Help & Support</Text>
          <Text style={styles.headerSub}>Driver assistance centre</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="help-buoy-outline" size={22} color={COLORS.white} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Contact cards */}
        <Text style={styles.sectionLabel}>Contact Us</Text>
        <View style={styles.contactRow}>
          {CONTACT_CARDS.map(card => (
            <TouchableOpacity
              key={card.label}
              style={styles.contactCard}
              onPress={() => handleContact(card)}
              activeOpacity={0.75}
            >
              <View style={[styles.contactIconWrap, { backgroundColor: card.color + '18' }]}>
                <Ionicons name={card.icon} size={20} color={card.color} />
              </View>
              <Text style={styles.contactLabel}>{card.label}</Text>
              <Text style={styles.contactValue} numberOfLines={1}>{card.value}</Text>
              <Text style={styles.contactSub}>{card.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* FAQ sections */}
        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Frequently Asked Questions</Text>
        {FAQS.map(section => (
          <View key={section.section} style={styles.faqSection}>
            <View style={styles.faqSectionHeader}>
              <View style={[styles.faqSectionIcon, { backgroundColor: section.color + '18' }]}>
                <Ionicons name={section.icon} size={16} color={section.color} />
              </View>
              <Text style={[styles.faqSectionTitle, { color: section.color }]}>{section.section}</Text>
            </View>
            <View style={styles.faqCard}>
              {section.items.map((item, i) => (
                <View key={item.q}>
                  <FaqItem item={item} />
                  {i < section.items.length - 1 && <View style={styles.faqDivider} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Footer note */}
        <View style={styles.footerNote}>
          <Ionicons name="information-circle-outline" size={15} color={COLORS.textMuted} />
          <Text style={styles.footerText}>
            For urgent on-road issues, always use Emergency SOS from your dashboard.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
};

export default DriverHelpSupportScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: PURPLE.deep,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 18,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  scroll: { padding: 16 },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },

  /* Contact cards */
  contactRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  contactCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 16,
    padding: 12, alignItems: 'center',
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  contactIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  contactLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', textAlign: 'center' },
  contactValue: { fontSize: 11, fontWeight: '700', color: COLORS.textPrimary, marginTop: 3, textAlign: 'center' },
  contactSub:   { fontSize: 10, color: COLORS.textMuted, marginTop: 2, textAlign: 'center' },

  /* FAQ */
  faqSection: { marginBottom: 16 },
  faqSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  faqSectionIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  faqSectionTitle: { fontSize: 13, fontWeight: '800' },

  faqCard: {
    backgroundColor: COLORS.white, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  faqItem: { paddingHorizontal: 16, paddingVertical: 14 },
  faqQuestion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  faqQuestionText: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 20 },
  faqAnswer: {
    fontSize: 13, color: COLORS.textSecondary, lineHeight: 20,
    marginTop: 10, paddingRight: 4,
  },
  faqDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 0 },

  /* Footer */
  footerNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: PURPLE.light, borderRadius: 12, padding: 12, marginTop: 4,
  },
  footerText: { flex: 1, fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
});
