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
  const glowColor = driverMode ? COLORS.warningGlow : COLORS.primaryGlow;

  const bgColor = isPrimary ? color
    : isDanger ? COLORS.danger
    : 'transparent';

  const borderColor = isOutline ? color
    : isDanger ? COLORS.danger
    : 'transparent';

  const textColor = isPrimary || isDanger ? COLORS.white
    : isOutline ? color
    : COLORS.textSecondary;

  const shadowStyle = isPrimary && !disabled ? {
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6,
  } : {};

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
      style={[
        styles.base,
        { backgroundColor: bgColor, borderColor, borderWidth: isOutline ? 1.5 : 0 },
        shadowStyle,
        size === 'sm' && styles.sm,
        size === 'lg' && styles.lg,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {/* inner top highlight for primary */}
      {isPrimary && !disabled && (
        <View style={styles.innerHighlight} pointerEvents="none" />
      )}

      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <View style={styles.row}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text style={[
            styles.text,
            { color: textColor },
            size === 'sm' && styles.textSm,
            size === 'lg' && styles.textLg,
            textStyle,
          ]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: THEME.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  sm: { height: 40, paddingHorizontal: 16, borderRadius: THEME.borderRadius.md },
  lg: { height: 60, paddingHorizontal: 28, borderRadius: THEME.borderRadius.xl },
  disabled: { opacity: 0.45 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { marginRight: 8 },
  text: { fontSize: THEME.fontSize.base, fontWeight: THEME.fontWeight.bold, letterSpacing: 0.2 },
  textSm: { fontSize: THEME.fontSize.sm },
  textLg: { fontSize: THEME.fontSize.md },
  innerHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
  },
});

export default Button;
