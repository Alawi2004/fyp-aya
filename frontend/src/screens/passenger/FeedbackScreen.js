import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Animated, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { submitRating } from '../../api/apiClient';

// ── Rating categories ─────────────────────────────────────────────────────────
const RATING_CATS = [
  { key: 'punctuality', label: 'Punctuality',      icon: 'time-outline',      color: COLORS.primary   },
  { key: 'driver',      label: 'Driver Behaviour', icon: 'person-outline',    color: '#7C3AED'        },
  { key: 'cleanliness', label: 'Cleanliness',      icon: 'sparkles-outline',  color: COLORS.secondary },
  { key: 'comfort',     label: 'Comfort',          icon: 'bed-outline',       color: '#F59E0B'        },
];

const QUICK_TAGS = [
  'Great driver!', 'Very punctual', 'Clean bus', 'Smooth ride',
  'Professional', 'On time', 'Comfortable seats', 'Friendly staff',
];

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

// ── Star row for one category ─────────────────────────────────────────────────
const CategoryStars = ({ label, icon, color, value, onChange }) => (
  <View style={styles.catRow}>
    <View style={styles.catRowLeft}>
      <View style={[styles.catIconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.catRowLabel}>{label}</Text>
    </View>
    <View style={styles.catStars}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
          <Ionicons
            name={n <= value ? 'star' : 'star-outline'}
            size={26}
            color={n <= value ? color : COLORS.border}
          />
        </TouchableOpacity>
      ))}
    </View>
    {value > 0 && (
      <Text style={[styles.catScore, { color }]}>{RATING_LABELS[value]}</Text>
    )}
  </View>
);

// ── Main screen ───────────────────────────────────────────────────────────────
const FeedbackScreen = ({ route, navigation }) => {
  const insets       = useSafeAreaInsets();
  const { booking }  = route.params || {};
  const { addRating } = useApp();
  const { user }     = useAuth();

  // Category sub-scores
  const [scores, setScores] = useState({ punctuality: 0, driver: 0, cleanliness: 0, comfort: 0 });

  const [comment,   setComment]   = useState('');
  const [activeTags, setActiveTags] = useState([]);
  const [submitted,  setSubmitted]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const setScore = (key, val) => {
    setScores(prev => ({ ...prev, [key]: val }));
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.08, duration: 80, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const toggleTag = (tag) => {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Compute overall as average of rated categories
  const ratedScores = Object.values(scores).filter(v => v > 0);
  const overall = ratedScores.length > 0
    ? Math.round(ratedScores.reduce((a, b) => a + b, 0) / ratedScores.length)
    : 0;
  const allRated = Object.values(scores).every(v => v > 0);

  const handleSubmit = async () => {
    if (!allRated || submitting) return;
    setSubmitting(true);
    const tagText = activeTags.length > 0 ? ` Tags: ${activeTags.join(', ')}.` : '';
    const fullComment = comment + tagText;

    // POST to real API — best-effort (don't block the success screen on failure)
    try {
      await submitRating({
        user_id:    user?._id ?? user?.user_id ?? null,
        trip_id:    booking?._id ?? booking?.trip_id ?? null,
        rating:     overall,
        comment:    fullComment || null,
        categories: { ...scores },   // extended payload — backend ignores unknown fields
      });
    } catch { /* API failure should not block the success screen */ }

    // Always update local AppContext state so the Ratings screen stays in sync
    addRating({
      passengerName: user?.name || 'Passenger',
      rating:        overall,
      comment:       fullComment,
      trip:          booking?.bus?.route || booking?.bus?.name || 'Route',
      categories:    { ...scores },
    });

    setSubmitting(false);
    setSubmitted(true);
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        <View style={styles.successWrap}>
          <Animated.View style={[styles.successStars, { transform: [{ scale: pulseAnim }] }]}>
            {[1, 2, 3, 4, 5].map(s => (
              <Ionicons
                key={s} name={s <= overall ? 'star' : 'star-outline'}
                size={32} color={s <= overall ? '#FFB300' : COLORS.border}
              />
            ))}
          </Animated.View>
          <Text style={styles.successTitle}>Thank You!</Text>
          <Text style={styles.successSub}>
            Your feedback helps us improve the service for everyone.
          </Text>
          <View style={styles.successGrid}>
            {RATING_CATS.map(c => (
              <View key={c.key} style={[styles.successCat, { borderColor: c.color + '33', backgroundColor: c.color + '0C' }]}>
                <Ionicons name={c.icon} size={14} color={c.color} />
                <Text style={[styles.successCatLabel, { color: c.color }]}>{c.label}</Text>
                <Text style={[styles.successCatScore, { color: c.color }]}>
                  {'★'.repeat(scores[c.key])}{'☆'.repeat(5 - scores[c.key])}
                </Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate Your Trip</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >
        {/* Trip info banner */}
        {booking && (
          <View style={styles.tripBanner}>
            <Ionicons name="bus" size={18} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.tripBannerName}>{booking.bus?.name || 'Express Service'}</Text>
              <Text style={styles.tripBannerRoute}>
                {booking.bus?.origin} → {booking.bus?.destination}
              </Text>
            </View>
          </View>
        )}

        {/* Overall score preview */}
        <View style={styles.overallCard}>
          <Text style={styles.overallLabel}>Overall Score</Text>
          <Animated.View style={[styles.overallStars, { transform: [{ scale: pulseAnim }] }]}>
            {[1, 2, 3, 4, 5].map(s => (
              <Ionicons
                key={s}
                name={s <= overall ? 'star' : 'star-outline'}
                size={36}
                color={s <= overall ? '#FFB300' : COLORS.border}
              />
            ))}
          </Animated.View>
          <Text style={styles.overallNote}>
            {overall > 0
              ? `${RATING_LABELS[overall]} — average of your category ratings`
              : 'Rate each category below to get your overall score'}
          </Text>
        </View>

        {/* Category sub-scores */}
        <Text style={styles.sectionLabel}>Rate each category</Text>
        <View style={styles.catCard}>
          {RATING_CATS.map((c, i) => (
            <React.Fragment key={c.key}>
              <CategoryStars
                label={c.label}
                icon={c.icon}
                color={c.color}
                value={scores[c.key]}
                onChange={val => setScore(c.key, val)}
              />
              {i < RATING_CATS.length - 1 && (
                <View style={styles.catDivider} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Quick tags (shown after all rated) */}
        {allRated && (
          <>
            <Text style={styles.sectionLabel}>Quick Tags <Text style={styles.optional}>(optional)</Text></Text>
            <View style={styles.tagRow}>
              {QUICK_TAGS.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tag, activeTags.includes(tag) && styles.tagActive]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[styles.tagText, activeTags.includes(tag) && styles.tagTextActive]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Comment box */}
        {allRated && (
          <>
            <Text style={styles.sectionLabel}>
              Comment <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={styles.commentBox}
              value={comment}
              onChangeText={setComment}
              placeholder="Share more details about your experience…"
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (!allRated || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!allRated || submitting}
          activeOpacity={0.85}
        >
          <Ionicons name={submitting ? 'hourglass-outline' : 'send'} size={18} color={COLORS.white} />
          <Text style={styles.submitBtnText}>{submitting ? 'Submitting…' : 'Submit Rating'}</Text>
        </TouchableOpacity>

        {!allRated && (
          <Text style={styles.hintText}>
            Rate all 4 categories to submit
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

export default FeedbackScreen;

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },

  body: { padding: 16, paddingBottom: 48 },

  tripBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.primaryLight, borderRadius: 14, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.primaryMid,
  },
  tripBannerName: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  tripBannerRoute: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },

  overallCard: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 20, alignItems: 'center',
    marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  overallLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  overallStars: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  overallNote: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10, marginTop: 6 },
  optional: { fontWeight: '400', color: COLORS.textMuted },

  catCard: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  catRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 140 },
  catIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  catRowLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, flex: 1 },
  catStars: { flexDirection: 'row', gap: 3 },
  catScore: { fontSize: 11, fontWeight: '700', width: 60, textAlign: 'right' },
  catDivider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: 10 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tag: {
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  tagActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tagText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  tagTextActive: { color: COLORS.white },

  commentBox: {
    backgroundColor: COLORS.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    padding: 14, fontSize: 14, color: COLORS.textPrimary,
    minHeight: 100, marginBottom: 16, lineHeight: 21,
  },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, marginTop: 4,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: COLORS.border, shadowOpacity: 0 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  hintText: { textAlign: 'center', color: COLORS.textMuted, fontSize: 12, marginTop: 10 },

  /* Success */
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  successStars: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  successTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  successSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  successGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', marginBottom: 28 },
  successCat: {
    width: '48%', borderRadius: 12, borderWidth: 1, padding: 10, gap: 4,
    alignItems: 'center',
  },
  successCatLabel: { fontSize: 11, fontWeight: '700' },
  successCatScore: { fontSize: 13, letterSpacing: 1 },
  doneBtn: {
    width: '100%', backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});
