import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, StatusBar, ActivityIndicator, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PURPLE } from '../../constants/colors';
import GradientFill from '../../components/common/GradientFill';
import FadeInView from '../../components/common/FadeInView';
import PressableScale from '../../components/common/PressableScale';
import { SkeletonCardList } from '../../components/common/Skeleton';
import { getMyComplaints, updateMyComplaint, deleteMyComplaint } from '../../api/apiClient';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '');

const CATEGORIES = [
  { key: 'delay',       label: 'Service Delay',    icon: 'time-outline',                color: '#F59E0B' },
  { key: 'driver',      label: 'Driver Behaviour', icon: 'person-outline',              color: '#EF4444' },
  { key: 'vehicle',     label: 'Vehicle Issue',    icon: 'build-outline',               color: '#8B5CF6' },
  { key: 'cleanliness', label: 'Cleanliness',      icon: 'sparkles-outline',            color: '#10B981' },
  { key: 'overcharge',  label: 'Overcharging',     icon: 'cash-outline',                color: '#F97316' },
  { key: 'safety',      label: 'Safety Concern',   icon: 'shield-outline',              color: '#DC2626' },
  { key: 'lost',        label: 'Lost Item',        icon: 'bag-handle-outline',          color: '#6366F1' },
  { key: 'other',       label: 'Other',            icon: 'ellipsis-horizontal-outline', color: COLORS.textMuted },
];
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

const PRIORITIES = [
  { key: 'low',    label: 'Low',    color: COLORS.secondary },
  { key: 'medium', label: 'Medium', color: COLORS.warning   },
  { key: 'high',   label: 'High',   color: COLORS.danger    },
];

const STATUS_META = {
  submitted:    { label: 'Submitted',    color: COLORS.info    },
  under_review: { label: 'Under Review', color: COLORS.warning },
  assigned:     { label: 'Assigned',     color: '#8B5CF6'      },
  resolved:     { label: 'Resolved',     color: COLORS.success },
  closed:       { label: 'Closed',       color: COLORS.textMuted },
};

// Only complaints still in 'submitted' status can be edited/deleted by the passenger —
// once staff start handling it, the record must stay stable for the audit trail.
const isEditable = (item) => item?.status === 'submitted';

const photoUrl = (path) => (path ? `${BASE_URL}${path}` : null);

// ── Complaint card ────────────────────────────────────────────────────────────
const ComplaintCard = ({ item, onEdit, onDelete }) => {
  const cat = CATEGORY_MAP[item.category] || CATEGORY_MAP.other;
  const status = STATUS_META[item.status] || STATUS_META.submitted;
  const dateStr = item.submitted_at
    ? new Date(item.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const editable = isEditable(item);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.catIcon, { backgroundColor: cat.color + '18' }]}>
          <Ionicons name={cat.icon} size={16} color={cat.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.catLabel}>{cat.label}</Text>
          <Text style={styles.trackingCode}>{item.tracking_code}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.color + '18' }]}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <Text style={styles.description} numberOfLines={3}>{item.description}</Text>

      {item.photo_url && (
        <Image source={{ uri: photoUrl(item.photo_url) }} style={styles.photo} resizeMode="cover" />
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.dateText}>{dateStr}</Text>
        <View style={[styles.priorityChip, { borderColor: (PRIORITIES.find(p => p.key === item.priority)?.color || COLORS.border) + '55' }]}>
          <Text style={[styles.priorityText, { color: PRIORITIES.find(p => p.key === item.priority)?.color || COLORS.textMuted }]}>
            {item.priority?.toUpperCase()} PRIORITY
          </Text>
        </View>
      </View>

      {item.status === 'resolved' && item.resolution_notes ? (
        <View style={styles.resolutionBox}>
          <Ionicons name="checkmark-done-outline" size={14} color={COLORS.success} />
          <Text style={styles.resolutionText}>{item.resolution_notes}</Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.cardActions}>
        {editable ? (
          <>
            <PressableScale style={styles.editBtn} onPress={() => onEdit(item)}>
              <Ionicons name="pencil-outline" size={14} color={PURPLE.primary} />
              <Text style={styles.editBtnText}>Edit</Text>
            </PressableScale>
            <PressableScale style={styles.deleteBtn} onPress={() => onDelete(item)}>
              <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </PressableScale>
          </>
        ) : (
          <View style={styles.lockedRow}>
            <Ionicons name="lock-closed-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.lockedText}>This complaint is being processed and can no longer be edited or deleted.</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ── Edit modal ────────────────────────────────────────────────────────────────
const EditModal = ({ visible, item, onClose, onSave }) => {
  const insets = useSafeAreaInsets();
  const [category,    setCategory]    = useState(item?.category || '');
  const [priority,    setPriority]    = useState(item?.priority || 'medium');
  const [description, setDescription] = useState(item?.description || '');
  const [saving,      setSaving]      = useState(false);

  React.useEffect(() => {
    if (item) {
      setCategory(item.category || '');
      setPriority(item.priority || 'medium');
      setDescription(item.description || '');
    }
  }, [item]);

  const valid = category && description.trim().length >= 20;

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const res = await updateMyComplaint(item.complaint_id, {
        category, priority, description: description.trim(),
      });
      onSave(res?.complaint || { ...item, category, priority, description: description.trim() });
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16, maxHeight: '85%' }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Edit Complaint</Text>

          <Text style={styles.modalLabel}>Category</Text>
          <View style={styles.chipWrap}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[styles.chip, category === c.key && { backgroundColor: c.color + '18', borderColor: c.color }]}
                onPress={() => setCategory(c.key)}
              >
                <Ionicons name={c.icon} size={13} color={category === c.key ? c.color : COLORS.textMuted} />
                <Text style={[styles.chipText, category === c.key && { color: c.color, fontWeight: '700' }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[styles.priorityBtn, priority === p.key && { backgroundColor: p.color + '18', borderColor: p.color }]}
                onPress={() => setPriority(p.key)}
              >
                <View style={[styles.priorityDot, { backgroundColor: priority === p.key ? p.color : COLORS.border }]} />
                <Text style={[styles.priorityBtnText, priority === p.key && { color: p.color, fontWeight: '700' }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>Description <Text style={styles.optional}>(min. 20 characters)</Text></Text>
          <TextInput
            style={styles.modalInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue…"
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={1000}
          />

          <View style={styles.modalBtns}>
            <PressableScale style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </PressableScale>
            <PressableScale
              style={[styles.modalSaveBtn, (!valid || saving) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!valid || saving}
            >
              {saving ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="checkmark" size={16} color={COLORS.white} />}
              <Text style={styles.modalSaveText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────────
const MyComplaintsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [complaints, setComplaints] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editItem,   setEditItem]   = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getMyComplaints();
      setComplaints(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!silent) Alert.alert('Error', err?.response?.data?.error || 'Could not load complaints.');
      setComplaints([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const handleDelete = (item) => {
    Alert.alert(
      'Delete Complaint',
      'Remove this complaint? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setComplaints(prev => prev.filter(c => c.complaint_id !== item.complaint_id));
            try {
              await deleteMyComplaint(item.complaint_id);
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.error || 'Could not delete this complaint.');
              load(true);
            }
          },
        },
      ],
    );
  };

  const handleEditSave = (updated) => {
    setComplaints(prev => prev.map(c => c.complaint_id === updated.complaint_id ? { ...c, ...updated } : c));
    setEditItem(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE.deep} />

      {/* Gradient header */}
      <View style={styles.hero}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GradientFill id="complaintsHero" colors={PURPLE.gradient} vertical />
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />
        </View>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>My Complaints</Text>
            {complaints.length > 0 && (
              <Text style={styles.headerSub}>{complaints.length} complaint{complaints.length !== 1 ? 's' : ''} filed</Text>
            )}
          </View>
          <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate('FileComplaint')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="add" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <SkeletonCardList count={4} />
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={c => String(c.complaint_id)}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={PURPLE.primary}
              colors={[PURPLE.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}><Ionicons name="document-text-outline" size={40} color={PURPLE.primary} /></View>
              <Text style={styles.emptyTitle}>No complaints filed</Text>
              <Text style={styles.emptySub}>Issues you report will appear here so you can track their progress.</Text>
              <PressableScale style={styles.emptyBtn} onPress={() => navigation.navigate('FileComplaint')}>
                <Ionicons name="add-circle-outline" size={16} color={COLORS.white} />
                <Text style={styles.emptyBtnText}>File a Complaint</Text>
              </PressableScale>
            </View>
          }
          renderItem={({ item, index }) => (
            <FadeInView index={index}>
              <ComplaintCard item={item} onEdit={setEditItem} onDelete={handleDelete} />
            </FadeInView>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      <EditModal visible={!!editItem} item={editItem} onClose={() => setEditItem(null)} onSave={handleEditSave} />
    </View>
  );
};

export default MyComplaintsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  newBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  /* Card */
  card: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  catIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  trackingCode: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },

  description: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginBottom: 10 },
  photo: { width: '100%', height: 140, borderRadius: 12, marginBottom: 10 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  dateText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },
  priorityChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  priorityText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  resolutionBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: COLORS.success + '12', borderRadius: 10, padding: 10, marginTop: 6,
  },
  resolutionText: { flex: 1, fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },

  cardActions: {
    flexDirection: 'row', gap: 8,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
    paddingTop: 10, marginTop: 10,
  },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: PURPLE.light, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: PURPLE.midStrong,
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: PURPLE.primary },
  deleteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: COLORS.dangerLight, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: '#FCA5A5',
  },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.danger },
  lockedRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockedText: { flex: 1, fontSize: 11, color: COLORS.textMuted, lineHeight: 16 },

  /* Empty state */
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 22, backgroundColor: PURPLE.light,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  emptySub:   { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24, marginBottom: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PURPLE.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  /* Edit modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8, marginTop: 4 },
  optional: { fontWeight: '400', color: COLORS.textMuted },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: COLORS.background,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },

  priorityRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  priorityBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 11,
    backgroundColor: COLORS.background,
  },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },

  modalInput: {
    backgroundColor: COLORS.background, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
    padding: 12, fontSize: 14, color: COLORS.textPrimary,
    minHeight: 90, marginBottom: 16, lineHeight: 21, textAlignVertical: 'top',
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.border,
  },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
  modalSaveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, backgroundColor: PURPLE.primary,
  },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
