import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { THEME } from '../../constants/theme';

const QUICK_COMMENTS = [
  'Great driver!',
  'Very punctual',
  'Clean and comfortable',
  'Smooth ride',
  'Very professional',
];

const RATING_LABELS = ['', 'Poor 😞', 'Fair 😐', 'Good 🙂', 'Very Good 😊', 'Excellent 🌟'];

const FeedbackScreen = ({ route, navigation }) => {
  const { booking } = route.params || {};
  const { addRating } = useApp();
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const scaleAnim = useState(new Animated.Value(1))[0];

  const animateStar = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.2, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleStarPress = (star) => {
    setRating(star);
    animateStar();
  };

  const handleQuickComment = (text) => {
    setComment(prev => prev ? `${prev}, ${text.toLowerCase()}` : text);
  };

  const handleSubmit = () => {
    if (rating === 0) return;
    addRating({
      passengerName: user?.name || 'Passenger',
      rating,
      comment,
      trip: booking?.bus?.route || booking?.bus?.name || 'Route A',
    });
    setSubmitted(true);
    setTimeout(() => navigation.navigate('Home'), 2000);
  };

  if (submitted) {
    return (
      <View style={styles.successScreen}>
        <View style={styles.successIconWrap}>
          <Ionicons name="star" size={48} color="#FFB300" />
        </View>
        <Text style={styles.successTitle}>Thank You!</Text>
        <Text style={styles.successSub}>Your feedback helps improve the service.</Text>
        <View style={styles.submittedRating}>
          {[1,2,3,4,5].map(s => (
            <Ionicons key={s} name={s <= rating ? 'star' : 'star-outline'} size={28} color="#FFB300" />
          ))}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
      </TouchableOpacity>

      <Text style={styles.title}>Rate Your Trip</Text>

      {/* Trip Info */}
      {booking && (
        <View style={styles.tripInfo}>
          <Ionicons name="bus" size={18} color={COLORS.primary} />
          <Text style={styles.tripName}>{booking.bus?.name || 'Express 101'}</Text>
          <Text style={styles.tripRoute}>{booking.bus?.origin} → {booking.bus?.destination}</Text>
        </View>
      )}

      {/* Stars */}
      <View style={styles.starsSection}>
        <Text style={styles.starsLabel}>How was your experience?</Text>
        <Animated.View style={[styles.starsRow, { transform: [{ scale: scaleAnim }] }]}>
          {[1,2,3,4,5].map(star => (
            <TouchableOpacity key={star} onPress={() => handleStarPress(star)} activeOpacity={0.8}>
              <Ionicons
                name={star <= rating ? 'star' : 'star-outline'}
                size={52}
                color={star <= rating ? '#FFB300' : COLORS.border}
              />
            </TouchableOpacity>
          ))}
        </Animated.View>
        {rating > 0 && (
          <Text style={styles.ratingLabel}>{RATING_LABELS[rating]}</Text>
        )}
      </View>

      {/* Quick comments */}
      {rating > 0 && (
        <View style={styles.quickSection}>
          <Text style={styles.quickLabel}>Quick tags</Text>
          <View style={styles.quickRow}>
            {QUICK_COMMENTS.map(qc => (
              <TouchableOpacity
                key={qc}
                style={[styles.quickTag, comment.toLowerCase().includes(qc.toLowerCase()) && styles.quickTagActive]}
                onPress={() => handleQuickComment(qc)}
              >
                <Text style={[styles.quickTagText, comment.toLowerCase().includes(qc.toLowerCase()) && styles.quickTagTextActive]}>
                  {qc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Comment box */}
      {rating > 0 && (
        <View style={styles.commentSection}>
          <Text style={styles.commentLabel}>Add a comment <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Tell us more about your experience..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      )}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, rating === 0 && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={rating === 0}
        activeOpacity={0.85}
      >
        <Ionicons name="send" size={18} color={COLORS.white} />
        <Text style={styles.submitText}>Submit Feedback</Text>
      </TouchableOpacity>

      {rating === 0 && (
        <Text style={styles.hintText}>Tap a star to rate your trip</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: THEME.spacing.lg, paddingTop: 52, paddingBottom: 40 },
  backBtn: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 16 },
  tripInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 12, marginBottom: 24 },
  tripName: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  tripRoute: { fontSize: 12, color: COLORS.textSecondary },
  starsSection: { alignItems: 'center', marginBottom: 28 },
  starsLabel: { fontSize: 15, color: COLORS.textSecondary, marginBottom: 16, fontWeight: '500' },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  ratingLabel: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginTop: 8 },
  quickSection: { marginBottom: 20 },
  quickLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 10 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickTag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border },
  quickTagActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  quickTagText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  quickTagTextActive: { color: COLORS.white },
  commentSection: { marginBottom: 24 },
  commentLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  optional: { fontWeight: '400', color: COLORS.textMuted },
  commentInput: { backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, padding: 14, fontSize: 14, color: COLORS.textPrimary, minHeight: 110 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.primary, borderRadius: 16, height: 56 },
  submitDisabled: { backgroundColor: COLORS.border },
  submitText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  hintText: { textAlign: 'center', color: COLORS.textMuted, fontSize: 13, marginTop: 12 },
  successScreen: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIconWrap: { width: 100, height: 100, borderRadius: 32, backgroundColor: '#FFF8E1', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 30, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  successSub: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 20 },
  submittedRating: { flexDirection: 'row', gap: 6 },
});

export default FeedbackScreen;