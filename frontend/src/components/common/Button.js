import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { THEME } from '../../constants/theme';

const Button = ({
  title, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, icon, style, textStyle,
  driverMode = false,
}) => {
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';
  const color = driverMode ? COLORS.driverPrimary : COLORS.primary;

  const bgColor = isPrimary ? color
    : isDanger ? COLORS.danger
    : 'transparent';

  const borderColor = isOutline ? color
    : isDanger ? COLORS.danger
    : 'transparent';

  const textColor = isPrimary || isDanger ? COLORS.white
    : isOutline ? color
    : COLORS.textSecondary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.base,
        { backgroundColor: bgColor, borderColor, borderWidth: isOutline ? 1.5 : 0 },
        size === 'sm' && styles.sm,
        size === 'lg' && styles.lg,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <View style={styles.row}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text style={[styles.text, { color: textColor }, size === 'sm' && styles.textSm, size === 'lg' && styles.textLg, textStyle]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 52, borderRadius: THEME.borderRadius.md,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
  },
  sm: { height: 38, paddingHorizontal: 14, borderRadius: THEME.borderRadius.sm },
  lg: { height: 60, paddingHorizontal: 28, borderRadius: THEME.borderRadius.lg },
  disabled: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { marginRight: 8 },
  text: { fontSize: THEME.fontSize.base, fontWeight: THEME.fontWeight.semibold },
  textSm: { fontSize: THEME.fontSize.sm },
  textLg: { fontSize: THEME.fontSize.md },
});

export default Button;