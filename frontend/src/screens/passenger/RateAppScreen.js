import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import apiClient from '../../api/apiClient';

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

const RateAppScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [rating,     setRating]     = useState(0);
  const [comment,    setComment]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

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
          <View style={styles.successIconWrap}>
            <Ionicons name="heart" size={48} color={COLORS.primary} />
          </View>
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
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >
        <View style={styles.card}>
          <View style={styles.appIconWrap}>
            <Ionicons name="bus" size={36} color={COLORS.white} />
          </View>
          <Text style={styles.appName}>Yalla Transit</Text>
          <Text style={styles.promptText}>How would you rate your experience?</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(s => (
              <TouchableOpacity
                key={s}
                onPress={() => setRating(s)}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              >
                <Ionicons
                  name={s <= rating ? 'star' : 'star-outline'}
                  size={44}
                  color={s <= rating ? '#FFB300' : COLORS.border}
                />
              </TouchableOpacity>
            ))}
          </View>

          {rating > 0 && (
            <Text style={styles.ratingLabel}>{STAR_LABELS[rating]}</Text>
          )}
        </View>

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

        <TouchableOpacity
          style={[styles.submitBtn, (!rating || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!rating || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="send" size={18} color={COLORS.white} />
          )}
          <Text style={styles.submitBtnText}>
            {submitting ? 'Submitting…' : 'Submit Feedback'}
          </Text>
        </TouchableOpacity>

        {!rating && (
          <Text style={styles.hintText}>Tap a star to rate</Text>
        )}
      </ScrollView>
    </View>
  );
};

export default RateAppScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: COLORS.headerBg,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 18,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  body: { padding: 16, paddingBottom: 48 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 20,
    padding: 24, alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  appIconWrap: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
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
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, marginTop: 8,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: COLORS.border, shadowOpacity: 0 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  hintText: { textAlign: 'center', color: COLORS.textMuted, fontSize: 12, marginTop: 10 },

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  successIconWrap: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  successTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  successSub: {
    fontSize: 14, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 21, marginBottom: 24,
  },
  doneBtn: {
    width: '100%', backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 12,
  },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});
