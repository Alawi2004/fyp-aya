import { createNavigationContainerRef } from '@react-navigation/native';

// Module-level navigation ref — set on the NavigationContainer in AppNavigator.
// Use this to navigate from outside the React component tree (e.g. chatbot actions).
export const navigationRef = createNavigationContainerRef();
