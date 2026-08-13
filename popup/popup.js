(function () {
  const $ = (sel) => document.querySelector(sel);

  function applyStaticI18n() {
    const lang = window.MC_LANG();
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = window.MC_T(el.getAttribute('data-i18n'), lang);
    });
  }

  function updateVersionLabel() {
    const el = $('#versionLabel');
    if (!el) return;
    const version = chrome.runtime?.getManifest()?.version || '0.0.0';
    el.textContent = `MindCapsule v${version}`;
  }

  applyStaticI18n();
  updateVersionLabel();

  $('#openSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
})();
