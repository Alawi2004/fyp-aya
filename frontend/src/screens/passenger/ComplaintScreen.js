import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, StatusBar, Image, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { formatDateTime } from '../../utils/formatters';
import { submitComplaint as submitComplaintApi } from '../../api/apiClient';

// expo-image-picker loaded optionally (not available offline)
let ImagePicker = null;
try { ImagePicker = require('expo-image-picker'); } catch (_) {}

// ── Config ────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'delay',      label: 'Service Delay',     icon: 'time-outline',            color: '#F59E0B' },
  { key: 'driver',     label: 'Driver Behaviour',  icon: 'person-outline',          color: '#EF4444' },
  { key: 'vehicle',    label: 'Vehicle Issue',      icon: 'build-outline',           color: '#8B5CF6' },
  { key: 'cleanliness',label: 'Cleanliness',        icon: 'sparkles-outline',        color: '#10B981' },
  { key: 'overcharge', label: 'Overcharging',       icon: 'cash-outline',            color: '#F97316' },
  { key: 'safety',     label: 'Safety Concern',     icon: 'shield-outline',          color: '#DC2626' },
  { key: 'lost',       label: 'Lost Item',          icon: 'bag-handle-outline',      color: '#8B5CF6' },
  { key: 'other',      label: 'Other',              icon: 'ellipsis-horizontal-outline', color: COLORS.textMuted },
];

const PRIORITIES = [
  { key: 'low',    label: 'Low',    color: COLORS.secondary },
  { key: 'medium', label: 'Medium', color: COLORS.warning   },
  { key: 'high',   label: 'High',   color: COLORS.danger    },
];

// ── Category chip ─────────────────────────────────────────────────────────────
const CategoryChip = ({ item, selected, onPress }) => (
  <TouchableOpacity
    style={[
      styles.catChip,
      selected && { backgroundColor: item.color + '18', borderColor: item.color },
    ]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <View style={[styles.catIcon, { backgroundColor: selected ? item.color : COLORS.surfaceAlt }]}>
      <Ionicons name={item.icon} size={16} color={selected ? COLORS.white : COLORS.textMuted} />
    </View>
    <Text style={[styles.catLabel, selected && { color: item.color, fontWeight: '700' }]}>
      {item.label}
    </Text>
    {selected && (
      <Ionicons name="checkmark-circle" size={14} color={item.color} />
    )}
  </TouchableOpacity>
);

// ── Main screen ───────────────────────────────────────────────────────────────
const ComplaintScreen = ({ navigation, route }) => {
  const insets          = useSafeAreaInsets();
  const { bookings }    = useApp();
  const { user }        = useAuth();
  const preselected     = route?.params?.booking ?? null;

  const [category,     setCategory]     = useState('');
  const [priority,     setPriority]     = useState('medium');
  const [linkedTrip,   setLinkedTrip]   = useState(preselected);
  const [description,  setDescription]  = useState('');
  const [photoUri,     setPhotoUri]      = useState(null);
  const [showTrips,    setShowTrips]    = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  const catObj = CATEGORIES.find(c => c.key === category);

  // ── Photo attachment ────────────────────────────────────────────────────────
  const handleAddPhoto = async () => {
    if (!ImagePicker) {
      Alert.alert('Unavailable', 'Photo attachments are not available on this build.');
      return;
    }
    const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      if (canAskAgain) {
        Alert.alert('Permission needed', 'Allow photo library access to attach an image to your complaint.');
      } else {
        Alert.alert(
          'Permission denied',
          'Photo access is blocked. Open Settings to enable it for Yalla Transit.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
      }
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, aspect: [4, 3], quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const removePhoto = () => setPhotoUri(null);

  // ── Submission ──────────────────────────────────────────────────────────────
  const validate = () => {
    if (!category)                           { Alert.alert('Category required', 'Please select a complaint category.'); return false; }
    if (description.trim().length < 20)      { Alert.alert('Description too short', 'Please describe the issue in at least 20 characters.'); return false; }
    return true;
  };

  const [trackingCode, setTrackingCode] = useState(null);

  const handleSubmit = async () => {
    if (!validate() || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitComplaintApi({
        category,
        description: description.trim(),
        priority,
        trip_id: linkedTrip?.trip_id ?? null,
        photoUri: photoUri && !photoUri.startsWith('mock://') ? photoUri : null,
      });
      setTrackingCode(res?.complaint?.tracking_code || null);
      setSubmitted(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Could not submit your complaint. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        <View style={styles.successWrap}>
          <View style={[styles.successIcon, { backgroundColor: catObj?.color + '18' || COLORS.primaryLight }]}>
            <Ionicons name="checkmark-circle" size={56} color={catObj?.color || COLORS.primary} />
          </View>
          <Text style={styles.successTitle}>Complaint Submitted</Text>
          <Text style={styles.successSub}>
            Your {catObj?.label.toLowerCase() || 'complaint'} report has been received.
            Our team will review it within 48 hours.
          </Text>
          <View style={styles.refNumCard}>
            <Text style={styles.refNumLabel}>Tracking Code</Text>
            <Text style={styles.refNum}>{trackingCode || '—'}</Text>
          </View>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Back to My Complaints</Text>
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
        <Text style={styles.headerTitle}>File a Complaint</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >
        {/* ── Category ── */}
        <Text style={styles.sectionLabel}>What is your complaint about? *</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map(item => (
            <CategoryChip
              key={item.key}
              item={item}
              selected={category === item.key}
              onPress={() => setCategory(item.key)}
            />
          ))}
        </View>

        {/* ── Linked Trip ── */}
        <Text style={styles.sectionLabel}>Linked Trip <Text style={styles.optional}>(optional)</Text></Text>
        <TouchableOpacity
          style={styles.tripPicker}
          onPress={() => setShowTrips(v => !v)}
        >
          <View style={styles.tripPickerLeft}>
            <Ionicons name="receipt-outline" size={18} color={COLORS.primary} />
            {linkedTrip ? (
              <View>
                <Text style={styles.tripPickerName}>{linkedTrip.bus?.name || 'Unknown Bus'}</Text>
                <Text style={styles.tripPickerDate}>{formatDateTime(linkedTrip.date)}</Text>
              </View>
            ) : (
              <Text style={styles.tripPickerPlaceholder}>Select a trip (optional)</Text>
            )}
          </View>
          <Ionicons name={showTrips ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
        </TouchableOpacity>

        {showTrips && (
          <View style={styles.tripDropdown}>
            <TouchableOpacity
              style={styles.tripDropdownItem}
              onPress={() => { setLinkedTrip(null); setShowTrips(false); }}
            >
              <Text style={styles.tripDropdownText}>No trip linked</Text>
            </TouchableOpacity>
            {(bookings || []).map(b => (
              <TouchableOpacity
                key={b._id}
                style={[styles.tripDropdownItem, linkedTrip?._id === b._id && styles.tripDropdownItemActive]}
                onPress={() => { setLinkedTrip(b); setShowTrips(false); }}
              >
                <Text style={[styles.tripDropdownText, linkedTrip?._id === b._id && { color: COLORS.primary, fontWeight: '700' }]}>
                  {b.bus?.name} — {formatDateTime(b.date)}
                </Text>
                {linkedTrip?._id === b._id && (
                  <Ionicons name="checkmark" size={14} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Priority ── */}
        <Text style={styles.sectionLabel}>Priority</Text>
        <View style={styles.priorityRow}>
          {PRIORITIES.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[
                styles.priorityBtn,
                priority === p.key && { backgroundColor: p.color + '18', borderColor: p.color },
              ]}
              onPress={() => setPriority(p.key)}
            >
              <View style={[styles.priorityDot, { backgroundColor: priority === p.key ? p.color : COLORS.border }]} />
              <Text style={[styles.priorityLabel, priority === p.key && { color: p.color, fontWeight: '700' }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Description ── */}
        <Text style={styles.sectionLabel}>Description *</Text>
        <TextInput
          style={styles.descInput}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the issue in detail. Include time, location, and any relevant information. (minimum 20 characters)"
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          maxLength={1000}
        />
        <Text style={[
          styles.charCount,
          description.length < 20 && description.length > 0 && { color: COLORS.danger },
        ]}>
          {description.length}/1000 {description.length < 20 && description.length > 0 ? `(${20 - description.length} more)` : ''}
        </Text>

        {/* ── Photo attachment ── */}
        <Text style={styles.sectionLabel}>Attach Photo <Text style={styles.optional}>(optional)</Text></Text>
        {photoUri ? (
          <View style={styles.photoPreview}>
            {photoUri.startsWith('mock://') ? (
              <View style={styles.photoMock}>
                <Ionicons name="image-outline" size={32} color={COLORS.primary} />
                <Text style={styles.photoMockText}>photo_attached.jpg</Text>
              </View>
            ) : (
              <Image source={{ uri: photoUri }} style={styles.photoImage} resizeMode="cover" />
            )}
            <TouchableOpacity style={styles.photoRemove} onPress={removePhoto}>
              <Ionicons name="close-circle" size={22} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.photoAdd} onPress={handleAddPhoto}>
            <Ionicons name="camera-outline" size={22} color={COLORS.primary} />
            <Text style={styles.photoAddText}>Take Photo / Choose from Library</Text>
          </TouchableOpacity>
        )}

        {/* ── Submitter info ── */}
        <View style={styles.submitterCard}>
          <Ionicons name="person-circle-outline" size={18} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.submitterName}>{user?.name || 'Passenger'}</Text>
            <Text style={styles.submitterNote}>
              Your contact details will be shared with our support team.
            </Text>
          </View>
        </View>

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !category || description.trim().length < 20) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !category || description.trim().length < 20}
          activeOpacity={0.85}
        >
          <Ionicons name="send-outline" size={18} color={COLORS.white} />
          <Text style={styles.submitBtnText}>
            {submitting ? 'Submitting…' : 'Submit Complaint'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Complaints are reviewed within 48 hours. For emergencies, please call our hotline.
        </Text>
      </ScrollView>
    </View>
  );
};

export default ComplaintScreen;

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },

  body: { padding: 16, paddingBottom: 48 },

  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: 10, marginTop: 18,
  },
  optional: { fontWeight: '400', color: COLORS.textMuted },

  /* Categories */
  catGrid: { gap: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.background, paddingHorizontal: 14, paddingVertical: 11,
  },
  catIcon: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  catLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },

  /* Trip picker */
  tripPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
    padding: 14, backgroundColor: COLORS.background,
  },
  tripPickerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tripPickerName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  tripPickerDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  tripPickerPlaceholder: { fontSize: 14, color: COLORS.textMuted },
  tripDropdown: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    marginTop: 4, backgroundColor: COLORS.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
    overflow: 'hidden',
  },
  tripDropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  tripDropdownItemActive: { backgroundColor: COLORS.primaryLight },
  tripDropdownText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500', flex: 1 },

  /* Priority */
  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 11,
    backgroundColor: COLORS.background,
  },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },

  /* Description */
  descInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
    padding: 14, fontSize: 14, color: COLORS.textPrimary,
    backgroundColor: COLORS.background, minHeight: 120, lineHeight: 22,
  },
  charCount: { fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginTop: 4 },

  /* Photo */
  photoAdd: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1.5, borderColor: COLORS.primaryMid, borderRadius: 14, borderStyle: 'dashed',
    paddingVertical: 20, backgroundColor: COLORS.primaryLight,
  },
  photoAddText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  photoPreview: { borderRadius: 14, overflow: 'hidden', position: 'relative' },
  photoImage: { width: '100%', height: 180, borderRadius: 14 },
  photoMock: {
    height: 100, backgroundColor: COLORS.primaryLight, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.primaryMid,
  },
  photoMockText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  photoRemove: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: COLORS.white, borderRadius: 11,
  },

  /* Submitter */
  submitterCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: COLORS.background, borderRadius: 12, padding: 12, marginTop: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  submitterName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  submitterNote: { fontSize: 12, color: COLORS.textMuted, lineHeight: 17 },

  /* Submit */
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, marginTop: 20,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: COLORS.border, shadowOpacity: 0 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  footerNote: {
    textAlign: 'center', fontSize: 11, color: COLORS.textMuted,
    marginTop: 14, lineHeight: 17,
  },

  /* Success */
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: {
    width: 100, height: 100, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  successTitle: { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 10 },
  successSub: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 23, marginBottom: 28 },
  refNumCard: {
    backgroundColor: COLORS.background, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 24, width: '100%',
  },
  refNumLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 },
  refNum: { fontSize: 22, fontWeight: '900', color: COLORS.primary, letterSpacing: 2 },
  doneBtn: {
    width: '100%', backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});
