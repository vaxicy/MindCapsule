// Centralized storage keys to avoid silent data loss across contexts.
// Exposed as window.MC_STORAGE_KEYS = { SETTINGS: '...', ... }
const STORAGE_KEYS = Object.freeze({
  SETTINGS: 'mc_settings',
  HISTORY: 'mc_history',
  LAST_RESULT: 'mc_lastResult',
  ANALYSIS_STATUS: 'mc_analysis_status'
});

if (typeof window !== 'undefined') window.MC_STORAGE_KEYS = STORAGE_KEYS;
if (typeof module !== 'undefined' && module.exports) module.exports = { STORAGE_KEYS };
