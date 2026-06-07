import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { THEME } from '../../constants/theme';

const EmptyState = ({ icon = 'bus-outline', title, message }) => (
  <View style={styles.container}>
    <View style={styles.glowRing}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={44} color={COLORS.primary} />
      </View>
    </View>
    <Text style={styles.title}>{title}</Text>
    {message && <Text style={styles.message}>{message}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 56,
  },
  glowRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: COLORS.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: THEME.fontSize.lg,
    fontWeight: THEME.fontWeight.bold,
    color: COLORS.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  message: {
    fontSize: THEME.fontSize.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: THEME.fontWeight.medium,
  },
});

export default EmptyState;
