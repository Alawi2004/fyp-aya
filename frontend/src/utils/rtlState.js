// Module-level language tracker for AppText.
// Updated by applyLanguage in AppContext; read on every render by AppText.
// The key-based remount in App.js ensures all AppText instances re-render
// immediately after a language direction switch.
let _language = 'en';
export const setRTLLanguage = (lang) => { _language = lang; };
export const getRTLLanguage = () => _language;
