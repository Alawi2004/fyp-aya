import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';

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
  const iconBg = dark ? 'rgba(255,255,255,0.2)' : COLORS.background;

  return (
    <View style={[styles.container, { backgroundColor, paddingTop: insets.top + 12 }]}>
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
        {subtitle ? <Text style={[styles.subtitle, { color: dark ? 'rgba(255,255,255,0.75)' : COLORS.textSecondary }]}>{subtitle}</Text> : null}
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
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  spacer: {
    width: 38,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
});

export default ScreenHeader;
