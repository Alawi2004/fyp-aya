import React, { forwardRef } from 'react';
import { Text, StyleSheet } from 'react-native';
import { getRTLLanguage } from '../../utils/rtlState';

// RTL-aware drop-in for react-native Text.
// Imported via rnShim.js so all source-file Text components automatically get
// right-aligned text when Arabic, without touching each screen individually.
// The layout (flex direction, icon positions, etc.) stays LTR — only text
// alignment changes.
const AppText = forwardRef(({ style, ...props }, ref) => {
  const isArabic = getRTLLanguage() === 'ar';
  return (
    <Text
      ref={ref}
      style={isArabic ? [styles.rtl, style] : style}
      {...props}
    />
  );
});

AppText.displayName = 'Text';

export default AppText;

const styles = StyleSheet.create({
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
});
