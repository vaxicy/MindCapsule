(function () {
  const STORAGE_KEYS = window.MC_STORAGE_KEYS;
  const { DEFAULTS, PROVIDERS, PROVIDER_CONFIGS, SILICONFLOW_ENDPOINT, SILICONFLOW_DEFAULT_MODEL, OPENAI_ENDPOINT, OPENAI_DEFAULT_MODEL } = window.MC_CONSTANTS;
  const $ = (sel) => document.querySelector(sel);

  const els = {
    form: $('#settingsForm'),
    uiLang: $('#uiLang'),
    outputLang: $('#outputLang'),
    provider: $('#provider'),
    apiKey: $('#apiKey'),
    toggleApiKey: $('#toggleApiKey'),
    endpoint: $('#endpoint'),
    endpointField: $('#endpointField'),
    model: $('#model'),
    modelField: $('#modelField'),
    customModel: $('#customModel'),
    customModelField: $('#customModelField'),
    testConnection: $('#testConnection'),
    testStatus: $('#testStatus'),
    saveStatus: $('#saveStatus')
  };

  // The currently-active provider. Restored from storage on load.
  let currentProvider = DEFAULTS.provider;

  function applyStaticI18n(lang) {
    const l = lang || window.MC_LANG();
    window.MC_APPLY_I18N(document.documentElement, l);
    // Keep the toggle button label in sync with visibility + language.
    const showing = els.apiKey.type === 'text';
    els.toggleApiKey.textContent = window.MC_T(showing ? 'hideKey' : 'showKey', l);
  }

  const supportModal = document.getElementById('supportModal');
  const qrModal = document.getElementById('qrModal');

  function openModal(modal) {
    modal.hidden = false;
  }
  function closeModal(modal) {
    modal.hidden = true;
  }

  function setupSupportModal() {
    const openBlock = document.getElementById('supportAuthorBlock');
    const wechatBtn = document.getElementById('wechatTipBtn');
    if (openBlock) {
      openBlock.addEventListener('click', () => openModal(supportModal));
      openBlock.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openModal(supportModal);
        }
      });
    }
    if (wechatBtn) {
      wechatBtn.addEventListener('click', () => {
        openModal(qrModal);
      });
    }
    document.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', () => {
        const target = el.getAttribute('data-close');
        if (target === '1') closeModal(supportModal);
        else if (target === '2') closeModal(qrModal);
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal(supportModal);
        closeModal(qrModal);
      }
    });
  }

  function defaultModelFor(provider) {
    if (provider === PROVIDERS.OPENAI) return OPENAI_DEFAULT_MODEL;
    if (provider === PROVIDERS.SILICONFLOW) return SILICONFLOW_DEFAULT_MODEL;
    return '';
  }

  // Read the active slot for a provider from the loaded settings.
  function readSlot(settings, provider) {
    const base = (PROVIDER_CONFIGS && PROVIDER_CONFIGS[provider]) || {};
    const saved = (settings.providerConfigs && settings.providerConfigs[provider]) || {};
    return {
      apiKey: saved.apiKey != null ? saved.apiKey : (base.apiKey || ''),
      baseUrl: saved.baseUrl != null ? saved.baseUrl : (base.baseUrl || ''),
      model: saved.model != null ? saved.model : (base.model || '')
    };
  }

  // One-time migration: copy legacy flat fields into the active provider slot.
  function migrateLegacy(settings) {
    if (settings.providerConfigs && Object.keys(settings.providerConfigs).length) return settings;
    const configs = {};
    for (const p of [PROVIDERS.SILICONFLOW, PROVIDERS.OPENAI, PROVIDERS.CUSTOM_OPENAI]) {
      configs[p] = Object.assign({}, PROVIDER_CONFIGS[p]);
    }
    const active = settings.provider || DEFAULTS.provider;
    if (configs[active]) {
      configs[active].apiKey = settings.apiKey || configs[active].apiKey;
      configs[active].baseUrl = settings.endpoint || configs[active].baseUrl;
      configs[active].model = settings.model || configs[active].model;
    }
    settings.providerConfigs = configs;
    return settings;
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
      if (prevProvider && provider !== prevProvider) {
        const prevDefault = defaultModelFor(prevProvider);
        const current = els.model.value.trim();
        if (!current || current === prevDefault) {
          els.model.value = defaultModel;
        }
      }
    }
  }

  // Persist the current input values into a SPECIFIC provider's slot (without
  // touching other providers), then write the whole settings object back.
  // The caller decides which provider the inputs belong to — this avoids the
  // bug where switching providers overwrote the target slot with the source
  // provider's key.
  async function persistSlotForProvider(provider, showTip, extra) {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const settings = migrateLegacy(data[STORAGE_KEYS.SETTINGS] || {});
    const isCustom = provider === PROVIDERS.CUSTOM_OPENAI;
    const slot = settings.providerConfigs[provider] || {};
    slot.apiKey = els.apiKey.value.trim();
    slot.baseUrl = isCustom ? els.endpoint.value.trim().replace(/\/+$/, '') : (provider === PROVIDERS.OPENAI ? OPENAI_ENDPOINT : SILICONFLOW_ENDPOINT);
    slot.model = isCustom ? (els.customModel.value.trim() || '') : (els.model.value.trim() || defaultModelFor(provider));
    settings.providerConfigs[provider] = slot;

    settings.provider = provider;
    settings.uiLang = els.uiLang.value;
    settings.outputLang = els.outputLang.value;
    // Keep legacy flat fields roughly in sync for the active provider only.
    settings.apiKey = slot.apiKey;
    settings.endpoint = slot.baseUrl;
    settings.model = slot.model;
    settings.customModel = isCustom ? slot.model : '';
    if (extra) Object.assign(settings, extra);

    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
    if (showTip) {
      els.saveStatus.textContent = window.MC_T('saved', els.uiLang.value);
      els.saveStatus.classList.add('visible');
      setTimeout(() => els.saveStatus.classList.remove('visible'), 2000);
    }
  }

  // Persist into the currently-selected provider's slot.
  async function persistSlotThenSave(showTip, extra) {
    await persistSlotForProvider(els.provider.value, showTip, extra);
  }

  // Fill inputs from the active provider's slot.
  function applySlotToInputs(settings) {
    const provider = els.provider.value;
    const slot = readSlot(settings, provider);
    els.apiKey.value = slot.apiKey;
    if (provider === PROVIDERS.CUSTOM_OPENAI) {
      els.endpoint.value = slot.baseUrl || '';
      els.customModel.value = slot.model || '';
    } else {
      els.model.value = slot.model || defaultModelFor(provider);
      els.model.placeholder = defaultModelFor(provider);
    }
  }

  async function loadSettings() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const settings = migrateLegacy(data[STORAGE_KEYS.SETTINGS] || {});
    currentProvider = settings.provider || DEFAULTS.provider;
    els.uiLang.value = settings.uiLang || DEFAULTS.uiLang;
    els.outputLang.value = settings.outputLang || DEFAULTS.outputLang;
    els.provider.value = currentProvider;
    applySlotToInputs(settings);
    updateUI();
  }

  function collectSettings() {
    const provider = els.provider.value;
    const isCustom = provider === PROVIDERS.CUSTOM_OPENAI;
    let endpoint = SILICONFLOW_ENDPOINT;
    if (provider === PROVIDERS.OPENAI) endpoint = OPENAI_ENDPOINT;
    else if (isCustom) endpoint = els.endpoint.value.trim().replace(/\/+$/, '');
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
    await persistSlotThenSave(showTip);
  }

  async function saveSettings(e) {
    e.preventDefault();
    await persistSettings(true);
  }

  function toggleApiKeyVisibility() {
    const showing = els.apiKey.type === 'text';
    els.apiKey.type = showing ? 'password' : 'text';
    els.toggleApiKey.textContent = window.MC_T(showing ? 'showKey' : 'hideKey', els.uiLang.value);
  }

  // Normalize a user-supplied base URL by stripping trailing slashes and any
  // mistakenly-pasted sub-path (chat/completions, /v1/messages, etc.).
  function normalizeBase(input) {
    let b = (input || '').trim().replace(/\/+$/, '');
    if (!b) return 'https://api.openai.com/v1';
    b = b.replace(/\/(chat|images|embeddings|audio)\/(completions|messages)$/i, '');
    b = b.replace(/\/v1\/messages$/i, '');
    return b;
  }

  async function testConnection() {
    const provider = els.provider.value;
    const isCustom = provider === PROVIDERS.CUSTOM_OPENAI;
    const apiKey = els.apiKey.value.trim();
    const baseUrl = isCustom
      ? normalizeBase(els.endpoint.value)
      : (provider === PROVIDERS.OPENAI ? OPENAI_ENDPOINT : SILICONFLOW_ENDPOINT);
    const lang = els.uiLang.value;

    if (!apiKey) {
      els.testStatus.textContent = window.MC_T('testConnectionNoKey', lang);
      els.testStatus.className = 'mc-status warn visible';
      return;
    }
    els.testStatus.textContent = window.MC_T('testConnectionChecking', lang);
    els.testStatus.className = 'mc-status visible';

    try {
      const res = await fetch(normalizeBase(baseUrl) + '/models', {
        headers: { Authorization: 'Bearer ' + apiKey }
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        if (res.status === 401 || res.status === 403) {
          els.testStatus.textContent = window.MC_T('testConnectionBadKey', lang) + ' (' + res.status + ')';
          els.testStatus.className = 'mc-status warn visible';
        } else if (res.status === 404) {
          els.testStatus.textContent = window.MC_T('testConnectionBadUrl', lang) + ' (' + res.status + ')';
          els.testStatus.className = 'mc-status warn visible';
        } else {
          els.testStatus.textContent = window.MC_T('testConnectionFail', lang) + ' (' + res.status + ')';
          els.testStatus.className = 'mc-status warn visible';
        }
        return;
      }
      const data = await res.json().catch(() => ({}));
      const list = data.models || data.data || data.list || (Array.isArray(data) ? data : []);
      const models = list.map((m) => (m && (m.id || m.name || m.model)) || '').filter(Boolean);
      const model = isCustom ? els.customModel.value.trim() : els.model.value.trim();
      if (model && !models.some((id) => id.toLowerCase() === model.toLowerCase())) {
        els.testStatus.textContent = window.MC_T('testConnectionModelMissing', lang);
        els.testStatus.className = 'mc-status warn visible';
      } else {
        els.testStatus.textContent = window.MC_T('testConnectionSuccess', lang);
        els.testStatus.className = 'mc-status ok visible';
      }
    } catch (e) {
      els.testStatus.textContent = window.MC_T('testConnectionNetError', lang);
      els.testStatus.className = 'mc-status warn visible';
    }
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  const autoSave = debounce(() => persistSlotThenSave(true), 500);

  function attachAutoSave() {
    els.uiLang.addEventListener('change', async () => {
      await persistSlotThenSave(true);
      applyStaticI18n(els.uiLang.value);
    });
    els.outputLang.addEventListener('change', () => persistSlotThenSave(true));
    els.provider.addEventListener('change', async () => {
      // Capture the source provider BEFORE the select value changes, then
      // save the current inputs into that provider's own slot. This is the
      // fix: previously the inputs were saved into the NEW provider's slot,
      // overwriting its stored key with the old provider's key.
      const prevProvider = currentProvider;
      await persistSlotForProvider(prevProvider, false);
      currentProvider = els.provider.value;
      const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      applySlotToInputs(migrateLegacy(data[STORAGE_KEYS.SETTINGS] || {}));
      updateUI(prevProvider);
      await persistSlotThenSave(true);
    });
    els.toggleApiKey.addEventListener('click', toggleApiKeyVisibility);
    els.testConnection.addEventListener('click', testConnection);
    [els.apiKey, els.endpoint, els.model, els.customModel].forEach((el) => {
      el.addEventListener('input', autoSave);
    });
  }

  applyStaticI18n();
  updateUI();           // avoid flash of old UI before settings load
  setupSupportModal();
  loadSettings().then(() => {
    applyStaticI18n(els.uiLang.value);
    attachAutoSave();
  });
  els.form.addEventListener('submit', saveSettings);

  // Keep the UI-language select in sync when changed elsewhere (e.g. the
  // YouTube panel's in-panel language toggle writes mc_settings.uiLang).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEYS.SETTINGS]) return;
    const newVal = changes[STORAGE_KEYS.SETTINGS].newValue;
    if (newVal && newVal.uiLang) {
      if (newVal.uiLang !== els.uiLang.value) {
        els.uiLang.value = newVal.uiLang;
      }
      // Re-translate the whole Options page when the UI language changes
      // elsewhere (e.g. the popup or YouTube panel toggled it).
      applyStaticI18n(newVal.uiLang);
    }
  });
})();
