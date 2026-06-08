import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { THEME } from '../../constants/theme';

const ScreenHeader = ({
  title,
  subtitle,
  onBack,
  rightElement,
  backgroundColor = COLORS.white,
  titleColor = COLORS.textPrimary,
  dark = false,
}) => {
  const insets = useSafeAreaInsets();
  const textColor = dark ? COLORS.white : COLORS.textPrimary;
  const iconBg = dark ? 'rgba(255,255,255,0.18)' : COLORS.background;

  return (
    <View style={[
      styles.container,
      { backgroundColor, paddingTop: insets.top + 12 },
      !dark && styles.shadowLight,
    ]}>
      {onBack ? (
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: iconBg }]}
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={dark ? COLORS.white : COLORS.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.spacer} />
      )}

      <View style={styles.center}>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: dark ? 'rgba(255,255,255,0.7)' : COLORS.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.spacer}>
        {rightElement || null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  shadowLight: {
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  spacer: {
    width: 40,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: THEME.fontSize.md,
    fontWeight: THEME.fontWeight.bold,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: THEME.fontSize.xs,
    marginTop: 2,
    fontWeight: THEME.fontWeight.medium,
  },
});

export default ScreenHeader;
