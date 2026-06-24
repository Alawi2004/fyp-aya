// Metro redirects every `import X from 'react-native'` in our source files here.
// The resolver SKIPS the redirect for this file and for AppText.js, so the
// require('react-native') below resolves to the real package (no circular loop).
//
// IMPORTANT: do NOT spread `{ ...RN }`. react-native exports most members as
// lazy getters, and spreading evaluates every one of them at import time —
// including optional native modules that don't exist in Expo Go, which throws
// "Invariant Violation: native module that doesn't exist" at boot. Instead we
// copy the property *descriptors* (getters stay lazy, evaluated only on access)
// and override just Text.
'use strict';
const RN = require('react-native');
const AppText = require('./components/common/AppText').default;

const shim = {};
Object.defineProperties(shim, Object.getOwnPropertyDescriptors(RN));
Object.defineProperty(shim, 'Text', {
  value: AppText,
  enumerable: true,
  configurable: true,
  writable: true,
});

module.exports = shim;
