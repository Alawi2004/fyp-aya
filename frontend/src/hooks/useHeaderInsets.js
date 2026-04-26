import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Returns the correct paddingTop for screen headers on all devices.
 * Accounts for notch, Dynamic Island, and Android status bar.
 *
 * @param {number} extraPadding - Additional padding below the safe area (default: 12)
 * @returns {{ paddingTop: number }}
 */
const useHeaderInsets = (extraPadding = 12) => {
  const insets = useSafeAreaInsets();
  return { paddingTop: insets.top + extraPadding };
};

export default useHeaderInsets;
