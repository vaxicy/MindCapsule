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
    model: 'deepseek-ai/DeepSeek-V4-Flash',
    customModel: '',
    lang: 'zh',
    uiLang: 'zh',
    outputLang: 'auto'
  }),
  SILICONFLOW_ENDPOINT: 'https://api.siliconflow.cn/v1',
  SILICONFLOW_DEFAULT_MODEL: 'deepseek-ai/DeepSeek-V4-Flash',
  OPENAI_ENDPOINT: 'https://api.openai.com/v1',
  OPENAI_DEFAULT_MODEL: 'gpt-4o-mini'
});

if (typeof window !== 'undefined') window.MC_CONSTANTS = MC_CONSTANTS;
if (typeof module !== 'undefined' && module.exports) module.exports = { MC_CONSTANTS };
