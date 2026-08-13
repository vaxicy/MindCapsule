(function () {
  const $ = (sel) => document.querySelector(sel);

  async function applyStaticI18n() {
    const lang = await window.MC_LOAD_LANG();
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = window.MC_T(el.getAttribute('data-i18n'), lang);
    });
  }

  applyStaticI18n();

  $('#openSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
})();
