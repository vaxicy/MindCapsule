(function () {
  const STORAGE_KEYS = window.MC_STORAGE_KEYS;
  const $ = (sel) => document.querySelector(sel);

  async function applyStaticI18n() {
    const lang = await window.MC_LOAD_LANG();
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = window.MC_T(el.getAttribute('data-i18n'), lang);
    });
    highlightLang(lang);
  }

  function highlightLang(lang) {
    document.querySelectorAll('#mcLangToggle .mc-lang-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
  }

  // Persist the chosen UI language into existing mc_settings (merge, not overwrite),
  // so the Options page and YouTube panel stay in sync.
  function persistLang(lang) {
    chrome.storage.local.get({ [STORAGE_KEYS.SETTINGS]: {} }, (res) => {
      const settings = Object.assign({}, res[STORAGE_KEYS.SETTINGS] || {}, { uiLang: lang });
      chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
    });
  }

  function setLang(lang) {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = window.MC_T(el.getAttribute('data-i18n'), lang);
    });
    highlightLang(lang);
    persistLang(lang);
  }

  applyStaticI18n();

  $('#mcLangToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('.mc-lang-btn');
    if (!btn) return;
    const lang = btn.dataset.lang;
    if (btn.classList.contains('active')) return;
    setLang(lang);
  });

  // React to language changes made elsewhere (Options page / YouTube panel)
  // while the popup stays open.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEYS.SETTINGS]) return;
    const newVal = changes[STORAGE_KEYS.SETTINGS].newValue;
    const lang = newVal && newVal.uiLang;
    if (lang !== 'zh' && lang !== 'en') return;
    const active = document.querySelector('#mcLangToggle .mc-lang-btn.active');
    if (active && active.dataset.lang === lang) return;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = window.MC_T(el.getAttribute('data-i18n'), lang);
    });
    highlightLang(lang);
  });

  $('#openSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
})();
