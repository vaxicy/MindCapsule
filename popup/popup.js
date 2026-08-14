(function () {
  const $ = (sel) => document.querySelector(sel);

  function highlightLang(lang) {
    document.querySelectorAll('#mcLangToggle .mc-lang-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
  }

  async function applyStaticI18n() {
    const lang = await window.MC_LOAD_LANG();
    window.MC_APPLY_I18N(document.documentElement, lang);
    highlightLang(lang);
  }

  function setLang(lang) {
    window.MC_APPLY_I18N(document.documentElement, lang);
    highlightLang(lang);
    window.MC_PERSIST_LANG(lang);
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
  const STORAGE_KEYS = window.MC_STORAGE_KEYS;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEYS.SETTINGS]) return;
    const newVal = changes[STORAGE_KEYS.SETTINGS].newValue;
    const lang = newVal && newVal.uiLang;
    if (lang !== 'zh' && lang !== 'en') return;
    const active = document.querySelector('#mcLangToggle .mc-lang-btn.active');
    if (active && active.dataset.lang === lang) return;
    window.MC_APPLY_I18N(document.documentElement, lang);
    highlightLang(lang);
  });

  $('#openSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
})();
