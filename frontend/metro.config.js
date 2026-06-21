const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Redirect every `import/require 'react-native'` from OUR source files to
// rnShim.js, which re-exports the real react-native but swaps Text for AppText.
// This gives all screens RTL-aware text without touching each file individually.
//
// The redirect is skipped for:
//  - node_modules  (library code uses the real Text, preserving their styles)
//  - rnShim.js     (needs the real react-native to re-export it)
//  - AppText.js    (wraps the real Text — must not import itself)
const SKIP = ['rnShim.js', 'AppText.js'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'react-native' &&
    !context.originModulePath.includes('node_modules') &&
    !SKIP.some((f) => context.originModulePath.endsWith(f))
  ) {
    return {
      filePath: path.resolve(__dirname, 'src/rnShim.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
