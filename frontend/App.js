import React from 'react';
import { I18nManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AuthProvider } from './src/context/AuthContext';
import { AppProvider, useApp } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setRTLLanguage } from './src/utils/rtlState';

// Ensure layout is always LTR — Arabic text direction is handled per-component
// via AppText (see src/rnShim.js + src/components/common/AppText.js).
// This clears any RTL flag that may have been persisted by a previous app version.
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

// Seed rtlState from AsyncStorage before the first render so AppText picks up
// the correct direction even before AppContext's useEffect fires.
AsyncStorage.getItem('app.language').then((lang) => {
  if (lang) setRTLLanguage(lang);
});

// Keyed on layout direction so the entire UI tree remounts cleanly whenever
// the user switches between Arabic and another language, ensuring every AppText
// re-reads rtlState and applies the correct alignment.
function AppShell() {
  const { language } = useApp();
  const directionKey = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <GestureHandlerRootView key={directionKey} style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppNavigator />
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </AuthProvider>
  );
}
