// Metro redirects every `import X from 'react-native'` in our source files here.
// The resolver SKIPS the redirect for this file and for AppText.js, so the
// require('react-native') below resolves to the real package (no circular loop).
'use strict';
const RN = require('react-native');
const AppText = require('./components/common/AppText').default;
module.exports = { ...RN, Text: AppText };
