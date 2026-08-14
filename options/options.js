(function () {
  const STORAGE_KEYS = window.MC_STORAGE_KEYS;
  const { DEFAULTS, PROVIDERS, SILICONFLOW_ENDPOINT, SILICONFLOW_DEFAULT_MODEL, OPENAI_ENDPOINT, OPENAI_DEFAULT_MODEL } = window.MC_CONSTANTS;
  const $ = (sel) => document.querySelector(sel);

  const els = {
    form: $('#settingsForm'),
    uiLang: $('#uiLang'),
    outputLang: $('#outputLang'),
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

  function defaultModelFor(provider) {
    if (provider === PROVIDERS.OPENAI) return OPENAI_DEFAULT_MODEL;
    if (provider === PROVIDERS.SILICONFLOW) return SILICONFLOW_DEFAULT_MODEL;
    return '';
  }

  function updateUI(prevProvider) {
    const provider = els.provider.value;
    const isCustom = provider === PROVIDERS.CUSTOM_OPENAI;
    els.endpointField.hidden = !isCustom;
    els.customModelField.hidden = !isCustom;
    if (isCustom) {
      els.modelField.hidden = true;
    } else {
      els.modelField.hidden = false;
      const defaultModel = defaultModelFor(provider);
      els.model.placeholder = defaultModel;
      els.modelHint.textContent = window.MC_T('useDefaultModel', window.MC_LANG());
      if (prevProvider && provider !== prevProvider) {
        const prevDefault = defaultModelFor(prevProvider);
        const current = els.model.value.trim();
        if (!current || current === prevDefault) {
          els.model.value = defaultModel;
        }
      }
    }
  }

  async function loadSettings() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const settings = data[STORAGE_KEYS.SETTINGS] || {};
    els.uiLang.value = settings.uiLang || DEFAULTS.uiLang;
    els.outputLang.value = settings.outputLang || DEFAULTS.outputLang;
    els.provider.value = settings.provider || DEFAULTS.provider;
    els.apiKey.value = settings.apiKey || '';
    els.endpoint.value = settings.endpoint || '';
    const defaultModel = els.provider.value === PROVIDERS.OPENAI ? OPENAI_DEFAULT_MODEL : SILICONFLOW_DEFAULT_MODEL;
    els.model.value = settings.model || defaultModel;
    els.model.placeholder = defaultModel;
    els.customModel.value = settings.customModel || '';
    updateUI();
  }

  function collectSettings() {
    const provider = els.provider.value;
    const isCustom = provider === PROVIDERS.CUSTOM_OPENAI;
    let endpoint = SILICONFLOW_ENDPOINT;
    if (provider === PROVIDERS.OPENAI) endpoint = OPENAI_ENDPOINT;
    else if (isCustom) endpoint = els.endpoint.value.trim().replace(/\/$/, '');
    return {
      uiLang: els.uiLang.value,
      outputLang: els.outputLang.value,
      provider,
      apiKey: els.apiKey.value.trim(),
      endpoint,
      model: isCustom ? '' : (els.model.value.trim() || defaultModelFor(provider)),
      customModel: isCustom ? (els.customModel.value.trim() || '') : ''
    };
  }

  async function persistSettings(showTip = true) {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: collectSettings() });
    if (showTip) {
      els.saveStatus.textContent = window.MC_T('saved', window.MC_LANG());
      els.saveStatus.classList.add('visible');
      setTimeout(() => els.saveStatus.classList.remove('visible'), 2000);
    }
  }

  async function saveSettings(e) {
    e.preventDefault();
    await persistSettings(true);
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  const autoSave = debounce(() => persistSettings(true), 500);

  function attachAutoSave() {
    [els.uiLang, els.outputLang].forEach((el) => {
      el.addEventListener('change', () => persistSettings(true));
    });
    els.provider.addEventListener('change', async () => {
      const saved = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      const prevProvider = saved[STORAGE_KEYS.SETTINGS]?.provider || els.provider.value;
      updateUI(prevProvider);
      await persistSettings(true);
    });
    [els.apiKey, els.endpoint, els.model, els.customModel].forEach((el) => {
      el.addEventListener('input', autoSave);
    });
  }

  applyStaticI18n();
  updateUI();           // avoid flash of old UI before settings load
  loadSettings().then(() => {
    attachAutoSave();
  });
  els.form.addEventListener('submit', saveSettings);

  // Keep the UI-language select in sync when changed elsewhere (e.g. the
  // YouTube panel's in-panel language toggle writes mc_settings.uiLang).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEYS.SETTINGS]) return;
    const newVal = changes[STORAGE_KEYS.SETTINGS].newValue;
    if (newVal && newVal.uiLang && newVal.uiLang !== els.uiLang.value) {
      els.uiLang.value = newVal.uiLang;
    }
  });
})();
