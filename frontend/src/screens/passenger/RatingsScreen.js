import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, StatusBar, ActivityIndicator, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import apiClient from '../../api/apiClient';

// ── Star row ──────────────────────────────────────────────────────────────────
const Stars = ({ rating, size = 14 }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map(s => (
      <Ionicons
        key={s}
        name={s <= rating ? 'star' : 'star-outline'}
        size={size}
        color={s <= rating ? '#F59E0B' : COLORS.border}
      />
    ))}
  </View>
);

// ── Interactive star picker ───────────────────────────────────────────────────
const StarPicker = ({ value, onChange, size = 36 }) => (
  <View style={{ flexDirection: 'row', gap: 8 }}>
    {[1, 2, 3, 4, 5].map(s => (
      <TouchableOpacity
        key={s}
        onPress={() => onChange(s)}
        hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
      >
        <Ionicons
          name={s <= value ? 'star' : 'star-outline'}
          size={size}
          color={s <= value ? '#F59E0B' : COLORS.border}
        />
      </TouchableOpacity>
    ))}
  </View>
);

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

const EDIT_WINDOW_HOURS = 24;

// A rating can only be edited within 24h of being posted.
const isEditable = (item) => {
  if (!item?.created_at) return false;
  const hours = (Date.now() - new Date(item.created_at).getTime()) / 36e5;
  return hours <= EDIT_WINDOW_HOURS;
};

// ── Rating card ───────────────────────────────────────────────────────────────
const RatingCard = ({ item, onEdit, onDelete }) => {
  const dateStr = item.created_at
    ? new Date(item.created_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : '';

  const editable = isEditable(item);

  return (
    <View style={styles.card}>
      {/* Route + date */}
      <View style={styles.cardTop}>
        <View style={styles.routeIcon}>
          <Ionicons name="bus-outline" size={16} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.routeName} numberOfLines={1}>
            {item.route_name || 'General Rating'}
          </Text>
          {item.driver_name ? (
            <Text style={styles.driverName}>Driver: {item.driver_name}</Text>
          ) : null}
        </View>
        <Text style={styles.dateText}>{dateStr}</Text>
      </View>

      {/* Stars + label */}
      <View style={styles.starsRow}>
        <Stars rating={item.rating} size={16} />
        <Text style={styles.ratingLabel}>{RATING_LABELS[item.rating] || ''}</Text>
      </View>

      {/* Comment */}
      {item.comment ? (
        <Text style={styles.comment}>{item.comment}</Text>
      ) : null}

      {/* Actions */}
      <View style={styles.cardActions}>
        {editable ? (
          <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(item)} activeOpacity={0.7}>
            <Ionicons name="pencil-outline" size={14} color={COLORS.primary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.editBtn, styles.editBtnLocked]}>
            <Ionicons name="lock-closed-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.editBtnLockedText}>Edit locked</Text>
          </View>
        )}
        <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item)} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
      {!editable && (
        <Text style={styles.lockHint}>Ratings can be edited within 24 hours of posting.</Text>
      )}
    </View>
  );
};

// ── Edit modal ────────────────────────────────────────────────────────────────
const EditModal = ({ visible, item, onClose, onSave }) => {
  const insets = useSafeAreaInsets();
  const [rating,  setRating]  = useState(item?.rating  || 0);
  const [comment, setComment] = useState(item?.comment || '');
  const [saving,  setSaving]  = useState(false);

  // Re-init when item changes
  React.useEffect(() => {
    if (item) {
      setRating(item.rating || 0);
      setComment(item.comment || '');
    }
  }, [item]);

  const handleSave = async () => {
    if (!rating) return;
    setSaving(true);
    try {
      const res = await apiClient.put(`/ratings/${item.rating_id}`, {
        rating,
        comment: comment.trim() || null,
      });
      onSave({ ...item, rating, comment: comment.trim() || null });
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          {/* Handle */}
          <View style={styles.modalHandle} />

          <Text style={styles.modalTitle}>Edit Rating</Text>

          {/* Stars */}
          <Text style={styles.modalLabel}>Your Rating</Text>
          <View style={styles.modalStarsWrap}>
            <StarPicker value={rating} onChange={setRating} size={38} />
            {rating > 0 && (
              <Text style={styles.modalRatingLabel}>{RATING_LABELS[rating]}</Text>
            )}
          </View>

          {/* Comment */}
          <Text style={styles.modalLabel}>Comment <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.modalInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Share your thoughts…"
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={1000}
          />

          {/* Buttons */}
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, (!rating || saving) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!rating || saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Ionicons name="checkmark" size={16} color={COLORS.white} />
              }
              <Text style={styles.modalSaveText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────────
const RatingsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [ratings,    setRatings]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editItem,   setEditItem]   = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiClient.get('/ratings/me');
      setRatings(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (!silent) {
        Alert.alert('Error', err?.response?.data?.error || 'Could not load ratings.');
      }
      setRatings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (item) => {
    Alert.alert(
      'Delete Rating',
      'Remove this rating? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Optimistic remove
            setRatings(prev => prev.filter(r => r.rating_id !== item.rating_id));
            try {
              await apiClient.delete(`/ratings/${item.rating_id}`);
            } catch {
              load(true); // Revert on failure
            }
          },
        },
      ],
    );
  };

  const handleEdit = (item) => {
    setEditItem(item);
  };

  const handleEditSave = (updated) => {
    setRatings(prev =>
      prev.map(r => r.rating_id === updated.rating_id ? { ...r, ...updated } : r)
    );
    setEditItem(null);
  };

  const avgRating = ratings.length
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
    : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

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
          <Text style={styles.headerTitle}>My Ratings</Text>
          {ratings.length > 0 && (
            <Text style={styles.headerSub}>
              {ratings.length} review{ratings.length !== 1 ? 's' : ''} · avg {avgRating} ⭐
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => load()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="refresh-outline" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={ratings}
          keyExtractor={r => String(r.rating_id)}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="star-outline" size={40} color={COLORS.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No ratings yet</Text>
              <Text style={styles.emptySub}>
                Rate your trips after completing a booking — they'll appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <RatingCard
              item={item}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      {/* Edit modal */}
      <EditModal
        visible={!!editItem}
        item={editItem}
        onClose={() => setEditItem(null)}
        onSave={handleEditSave}
      />
    </View>
  );
};

export default RatingsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* Header */
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
  refreshBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  /* Card */
  card: {
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10,
  },
  routeIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  routeName:  { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  driverName: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  dateText:   { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', marginTop: 2 },

  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  ratingLabel: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  comment:  { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginBottom: 10 },

  cardActions: {
    flexDirection: 'row', gap: 8,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
    paddingTop: 10, marginTop: 4,
  },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.primaryMid,
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  editBtnLocked: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  editBtnLockedText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  lockHint: {
    fontSize: 11, color: COLORS.textMuted, marginTop: 8, textAlign: 'center',
  },
  deleteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: COLORS.dangerLight,
    paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: '#FCA5A5',
  },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.danger },

  /* Empty state */
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  emptySub:   { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },

  /* Edit modal */
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 16,
  },
  modalLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10,
  },
  optional: { fontWeight: '400', color: COLORS.textMuted },
  modalStarsWrap: {
    alignItems: 'center', marginBottom: 20, gap: 8,
  },
  modalRatingLabel: {
    fontSize: 14, fontWeight: '700', color: '#F59E0B',
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border,
    padding: 12, fontSize: 14, color: COLORS.textPrimary,
    minHeight: 100, marginBottom: 16, lineHeight: 21,
    textAlignVertical: 'top',
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
  modalSaveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
