import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

const statusConfig = {
  active:    { bg: '#E8F5E9', text: COLORS.success,   label: 'Active' },
  delayed:   { bg: '#FFF8E1', text: COLORS.warning,   label: 'Delayed' },
  cancelled: { bg: '#FFEBEE', text: COLORS.danger,    label: 'Cancelled' },
  completed: { bg: '#E3F2FD', text: COLORS.info,      label: 'Completed' },
  boarding:  { bg: '#EDE7F6', text: '#5E35B1',        label: 'Boarding' },
  emergency: { bg: '#FFEBEE', text: COLORS.danger,    label: 'Emergency' },
  on_break:  { bg: '#FFF3E0', text: COLORS.driverPrimary, label: 'On Break' },
};

const Badge = ({ status, label, style }) => {
  const cfg = statusConfig[status] || { bg: COLORS.border, text: COLORS.textSecondary, label: label || status };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, style]}>
      <Text style={[styles.text, { color: cfg.text }]}>{label || cfg.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
});

export default Badge;