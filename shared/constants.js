// Shared constants. Colors/derived values are sourced from a single place when possible.
const MC_CONSTANTS = Object.freeze({
  PROVIDERS: Object.freeze({
    SILICONFLOW: 'siliconflow',
    OPENAI: 'openai',
    CUSTOM_OPENAI: 'custom_openai'
  }),
  DEFAULTS: Object.freeze({
    provider: 'siliconflow',
    apiKey: '',
    endpoint: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-72B-Instruct',
    customModel: '',
    lang: 'zh',
    uiLang: 'zh',
    outputLang: 'auto'
  }),
  SILICONFLOW_ENDPOINT: 'https://api.siliconflow.cn/v1',
  SILICONFLOW_DEFAULT_MODEL: 'Qwen/Qwen2.5-72B-Instruct',
  OPENAI_ENDPOINT: 'https://api.openai.com/v1',
  OPENAI_DEFAULT_MODEL: 'gpt-4o-mini'
});

if (typeof window !== 'undefined') window.MC_CONSTANTS = MC_CONSTANTS;
if (typeof module !== 'undefined' && module.exports) module.exports = { MC_CONSTANTS };
