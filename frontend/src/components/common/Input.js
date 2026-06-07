import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { THEME } from '../../constants/theme';

const Input = ({
  label, value, onChangeText, placeholder, secureTextEntry,
  keyboardType = 'default', error, icon, multiline = false,
  editable = true, style, inputStyle,
}) => {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[
        styles.inputWrap,
        focused && styles.focused,
        error && styles.error,
        !editable && styles.disabled,
      ]}>
        {icon && <View style={styles.iconLeft}>{icon}</View>}
        <TextInput
          style={[styles.input, icon && styles.inputWithIcon, multiline && styles.multiline, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline={multiline}
          editable={editable}
          autoCapitalize="none"
        />
        {secureTextEntry && (
          <TouchableOpacity style={styles.iconRight} onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: THEME.spacing.md },
  label: {
    fontSize: THEME.fontSize.sm,
    fontWeight: THEME.fontWeight.semibold,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  focused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 0,
  },
  error: { borderColor: COLORS.danger },
  disabled: { opacity: 0.55 },
  iconLeft: { paddingLeft: 14 },
  iconRight: { paddingRight: 14 },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: 14,
    fontSize: THEME.fontSize.base,
    color: COLORS.textPrimary,
    fontWeight: THEME.fontWeight.medium,
  },
  inputWithIcon: { paddingLeft: 10 },
  multiline: { height: 104, textAlignVertical: 'top', paddingTop: 14 },
  errorText: {
    fontSize: THEME.fontSize.xs,
    color: COLORS.danger,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: THEME.fontWeight.medium,
  },
});

export default Input;
