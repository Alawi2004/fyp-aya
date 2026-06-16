import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, StatusBar, Alert, ActivityIndicator, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PURPLE } from '../../constants/colors';
import GradientFill from '../../components/common/GradientFill';
import FadeInView from '../../components/common/FadeInView';
import PressableScale from '../../components/common/PressableScale';
import StarRatingInput from '../../components/common/StarRatingInput';
import apiClient from '../../api/apiClient';

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

const RateAppScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [rating,     setRating]     = useState(0);
  const [comment,    setComment]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  // Success-state pop
  const successScale = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (submitted) {
      successScale.setValue(0.5);
      Animated.spring(successScale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }).start();
    }
  }, [submitted, successScale]);

  const handleSubmit = async () => {
    if (!rating || submitting) return;
    setSubmitting(true);
    try {
      await apiClient.post('/ratings/app', {
        rating,
        comment: comment.trim() || null,
      });
      setSubmitted(true);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Could not submit feedback. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        <View style={styles.successWrap}>
          <Animated.View style={[styles.successIconWrap, { transform: [{ scale: successScale }] }]}>
            <Ionicons name="heart" size={48} color={PURPLE.primary} />
          </Animated.View>
          <Text style={styles.successTitle}>Thank You!</Text>
          <Text style={styles.successSub}>
            Your feedback helps us make Yalla Transit better for everyone.
          </Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(s => (
              <Ionicons
                key={s}
                name={s <= rating ? 'star' : 'star-outline'}
                size={28}
                color={s <= rating ? '#FFB300' : COLORS.border}
              />
            ))}
          </View>
          <PressableScale style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* Gradient header */}
      <View style={styles.hero}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill id="rateAppHero" colors={PURPLE.gradient} vertical />
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
            <Text style={styles.headerTitle}>Rate the App</Text>
            <Text style={styles.headerSub}>Tell us what you think</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >
        <FadeInView index={0}>
          <View style={styles.card}>
            <View style={styles.appIconWrap}>
              <Ionicons name="bus" size={36} color={COLORS.white} />
            </View>
            <Text style={styles.appName}>Yalla Transit</Text>
            <Text style={styles.promptText}>How would you rate your experience?</Text>

            <View style={styles.starsRow}>
              <StarRatingInput value={rating} onChange={setRating} size={44} gap={8} />
            </View>

            {rating > 0 && (
              <Text style={styles.ratingLabel}>{STAR_LABELS[rating]}</Text>
            )}
          </View>
        </FadeInView>

        <FadeInView index={1}>
          <Text style={styles.sectionLabel}>
            Comments <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.commentBox}
            value={comment}
            onChangeText={setComment}
            placeholder="Share what you love or what we can improve…"
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={1000}
          />
          {comment.length > 0 && (
            <Text style={styles.charCount}>{comment.length}/1000</Text>
          )}

          <PressableScale
            style={[styles.submitBtn, (!rating || submitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!rating || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="send" size={18} color={COLORS.white} />
            )}
            <Text style={styles.submitBtnText}>
              {submitting ? 'Submitting…' : 'Submit Feedback'}
            </Text>
          </PressableScale>

          {!rating && (
            <Text style={styles.hintText}>Tap a star to rate</Text>
          )}
        </FadeInView>
      </ScrollView>
    </View>
  );
};

export default RateAppScreen;

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
    paddingHorizontal: 16, paddingBottom: 20,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  body: { padding: 16, paddingBottom: 48 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 20,
    padding: 24, alignItems: 'center', marginBottom: 20,
    shadowColor: PURPLE.deep, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 14, elevation: 3,
  },
  appIconWrap: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: PURPLE.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowColor: PURPLE.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32, shadowRadius: 12, elevation: 4,
  },
  appName: {
    fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4,
  },
  promptText: {
    fontSize: 14, color: COLORS.textSecondary, marginBottom: 20, textAlign: 'center',
  },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  ratingLabel: {
    fontSize: 16, fontWeight: '700', color: '#FFB300',
    marginTop: 4,
  },

  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: 10, marginTop: 4,
  },
  optional: { fontWeight: '400', color: COLORS.textMuted },

  commentBox: {
    backgroundColor: COLORS.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    padding: 14, fontSize: 14, color: COLORS.textPrimary,
    minHeight: 120, marginBottom: 4, lineHeight: 21,
  },
  charCount: {
    textAlign: 'right', fontSize: 11, color: COLORS.textMuted,
    marginBottom: 16,
  },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: PURPLE.primary, borderRadius: 14, paddingVertical: 16, marginTop: 8,
    shadowColor: PURPLE.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32, shadowRadius: 12, elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: COLORS.border, shadowOpacity: 0 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  hintText: { textAlign: 'center', color: COLORS.textMuted, fontSize: 12, marginTop: 10 },

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  successIconWrap: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: PURPLE.light,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  successTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  successSub: {
    fontSize: 14, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 21, marginBottom: 24,
  },
  doneBtn: {
    width: '100%', backgroundColor: PURPLE.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 12,
  },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});
