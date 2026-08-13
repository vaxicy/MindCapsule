(function () {
  const { STORAGE_KEYS } = window.MC_STORAGE_KEYS;
  const { DEFAULTS, PROVIDERS, SILICONFLOW_ENDPOINT, SILICONFLOW_DEFAULT_MODEL } = window.MC_CONSTANTS;
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
      els.modelHint.textContent = window.MC_T('siliconFlowModel', window.MC_LANG()) + ': ' + SILICONFLOW_DEFAULT_MODEL;
    }
  }

  async function loadSettings() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const settings = data[STORAGE_KEYS.SETTINGS] || {};
    els.provider.value = settings.provider || DEFAULTS.provider;
    els.apiKey.value = settings.apiKey || '';
    els.endpoint.value = settings.endpoint || '';
    els.model.value = settings.model || SILICONFLOW_DEFAULT_MODEL;
    els.customModel.value = settings.customModel || '';
    updateUI();
  }

  async function saveSettings(e) {
    e.preventDefault();
    const isCustom = els.provider.value === PROVIDERS.CUSTOM_OPENAI;
    const settings = {
      provider: els.provider.value,
      apiKey: els.apiKey.value.trim(),
      endpoint: isCustom ? els.endpoint.value.trim().replace(/\/$/, '') : SILICONFLOW_ENDPOINT,
      model: isCustom ? '' : (els.model.value.trim() || SILICONFLOW_DEFAULT_MODEL),
      customModel: isCustom ? (els.customModel.value.trim() || '') : ''
    };

    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
    els.saveStatus.textContent = window.MC_T('saved', window.MC_LANG());
    els.saveStatus.classList.add('visible');
    setTimeout(() => els.saveStatus.classList.remove('visible'), 2000);
  }

  applyStaticI18n();
  loadSettings();
  els.provider.addEventListener('change', updateUI);
  els.form.addEventListener('submit', saveSettings);
})();
