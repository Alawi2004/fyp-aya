import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { THEME } from '../../constants/theme';

const Card = ({ children, style, variant = 'default' }) => (
  <View style={[
    styles.card,
    variant === 'elevated' && styles.elevated,
    variant === 'outlined' && styles.outlined,
    style,
  ]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    ...THEME.shadow.sm,
  },
  elevated: { ...THEME.shadow.md },
  outlined: { borderWidth: 1, borderColor: COLORS.border, shadowOpacity: 0 },
});

export default Card;