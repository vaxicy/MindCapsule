(function () {
  const STORAGE_KEYS = window.MC_STORAGE_KEYS;
  const { DEFAULTS, PROVIDERS, SILICONFLOW_ENDPOINT, SILICONFLOW_DEFAULT_MODEL, OPENAI_ENDPOINT, OPENAI_DEFAULT_MODEL } = window.MC_CONSTANTS;
  const $ = (sel) => document.querySelector(sel);

  const els = {
    form: $('#settingsForm'),
    provider: $('#provider'),
    apiKey: $('#apiKey'),
    endpoint: $('#endpoint'),
    endpointField: $('#endpointField'),
    model: $('#model'),
    modelField: $('#modelField'),
    modelHint: $('#modelHint'),
    customModel: $('#customModel'),
    customModelField: $('#customModelField'),
    saveStatus: $('#saveStatus')
  };

  function applyStaticI18n() {
    const lang = window.MC_LANG();
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const text = window.MC_T(key, lang);
      if (el.tagName === 'OPTION') el.textContent = text;
      else el.textContent = text;
    });
  }

  function updateUI() {
    const isCustom = els.provider.value === PROVIDERS.CUSTOM_OPENAI;
    els.endpointField.hidden = !isCustom;
    els.customModelField.hidden = !isCustom;
    if (isCustom) {
      els.modelField.hidden = true;
    } else {
      els.modelField.hidden = false;
      const hintKey = els.provider.value === PROVIDERS.OPENAI ? 'openAIModel' : 'siliconFlowModel';
      const defaultModel = els.provider.value === PROVIDERS.OPENAI ? OPENAI_DEFAULT_MODEL : SILICONFLOW_DEFAULT_MODEL;
      els.modelHint.textContent = window.MC_T(hintKey, window.MC_LANG()) + ': ' + defaultModel;
    }
  }

  async function loadSettings() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const settings = data[STORAGE_KEYS.SETTINGS] || {};
    els.provider.value = settings.provider || DEFAULTS.provider;
    els.apiKey.value = settings.apiKey || '';
    els.endpoint.value = settings.endpoint || '';
    const defaultModel = els.provider.value === PROVIDERS.OPENAI ? OPENAI_DEFAULT_MODEL : SILICONFLOW_DEFAULT_MODEL;
    els.model.value = settings.model || defaultModel;
    els.customModel.value = settings.customModel || '';
    updateUI();
  }

  async function saveSettings(e) {
    e.preventDefault();
    const provider = els.provider.value;
    const isCustom = provider === PROVIDERS.CUSTOM_OPENAI;
    let endpoint = SILICONFLOW_ENDPOINT;
    if (provider === PROVIDERS.OPENAI) endpoint = OPENAI_ENDPOINT;
    else if (isCustom) endpoint = els.endpoint.value.trim().replace(/\/$/, '');
    const settings = {
      provider,
      apiKey: els.apiKey.value.trim(),
      endpoint,
      model: isCustom ? '' : (els.model.value.trim() || (provider === PROVIDERS.OPENAI ? OPENAI_DEFAULT_MODEL : SILICONFLOW_DEFAULT_MODEL)),
      customModel: isCustom ? (els.customModel.value.trim() || '') : ''
    };

    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
    els.saveStatus.textContent = window.MC_T('saved', window.MC_LANG());
    els.saveStatus.classList.add('visible');
    setTimeout(() => els.saveStatus.classList.remove('visible'), 2000);
  }

  applyStaticI18n();
  updateUI();           // avoid flash of old UI before settings load
  loadSettings();
  els.provider.addEventListener('change', updateUI);
  els.form.addEventListener('submit', saveSettings);
})();
