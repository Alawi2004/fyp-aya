/**
 * SafeScreen — reusable safe-area-aware screen wrapper.
 *
 * Usage (no keyboard):
 *   <SafeScreen>...</SafeScreen>
 *
 * Usage (screen has text inputs):
 *   <SafeScreen keyboard>...</SafeScreen>
 *
 * Props:
 *   children      — screen content
 *   style         — extra style on the root SafeAreaView
 *   bg            — background color (default COLORS.background)
 *   statusBar     — 'light-content' | 'dark-content' (default 'dark-content')
 *   statusBarBg   — Android status-bar background color
 *   keyboard      — wrap with KeyboardAvoidingView (default false)
 *   edges         — SafeAreaView edges (default ['top','bottom','left','right'])
 */
import React from 'react';
import {
  KeyboardAvoidingView, Platform, StatusBar, StyleSheet, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';

const SafeScreen = ({
  children,
  style,
  bg = COLORS.background,
  statusBar = 'dark-content',
  statusBarBg,
  keyboard = false,
  edges = ['top', 'bottom', 'left', 'right'],
}) => {
  const content = keyboard ? (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {children}
    </KeyboardAvoidingView>
  ) : children;

  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: bg }, style]}>
      <StatusBar
        barStyle={statusBar}
        backgroundColor={statusBarBg ?? bg}
        translucent={false}
      />
      {content}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default SafeScreen;
