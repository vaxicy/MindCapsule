// Shared constants. Colors/derived values are sourced from a single place when possible.
const MC_CONSTANTS = Object.freeze({
  PROVIDERS: Object.freeze({
    SILICONFLOW: 'siliconflow',
    OPENAI: 'openai',
    CUSTOM_OPENAI: 'custom_openai'
  }),
  // Per-provider slot config. Each provider keeps its own apiKey/baseUrl/model
  // so switching providers never overwrites another provider's settings.
  PROVIDER_CONFIGS: Object.freeze({
    siliconflow: Object.freeze({
      apiKey: '',
      baseUrl: 'https://api.siliconflow.cn/v1',
      model: 'deepseek-ai/DeepSeek-V4-Flash'
    }),
    openai: Object.freeze({
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini'
    }),
    custom_openai: Object.freeze({
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: ''
    })
  }),
  DEFAULTS: Object.freeze({
    provider: 'siliconflow',
    // Legacy flat fields kept for one-time migration only.
    apiKey: '',
    endpoint: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V4-Flash',
    customModel: '',
    providerConfigs: Object.freeze({
      siliconflow: { apiKey: '', baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V4-Flash' },
      openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      custom_openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: '' }
    }),
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
