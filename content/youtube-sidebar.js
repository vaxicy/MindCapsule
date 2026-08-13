// Isolated-world content script: inject sidebar UI and coordinate with background.
(function () {
  const t = window.MC_T;
  const lang = window.MC_LANG();
  let currentVideoId = '';
  let currentTitle = '';
  let panelRoot = null;

  function injectPanel() {
    if (document.getElementById('mindcapsule-panel')) return;

    const sidebar = document.querySelector('#secondary');
    if (!sidebar) return;

    panelRoot = document.createElement('div');
    panelRoot.id = 'mindcapsule-panel';
    panelRoot.className = 'mindcapsule-panel';
    panelRoot.innerHTML = `
      <div class="mc-panel-header">
        <img src="${chrome.runtime.getURL('store-assets/icon48.png')}" alt="" class="mc-panel-icon">
        <div class="mc-panel-titles">
          <div class="mc-panel-title">MindCapsule</div>
          <div class="mc-panel-subtitle">${t('ext_description', lang)}</div>
        </div>
      </div>
      <div class="mc-panel-body">
        <div class="mc-field">
          <label>${t('pasteTranscript', lang)}</label>
          <textarea id="mc-transcript" rows="6" placeholder="${t('noTranscript', lang)}"></textarea>
        </div>
        <button id="mc-generate" class="mc-generate-btn">${t('generate', lang)}</button>
        <div id="mc-status" class="mc-status"></div>
        <div id="mc-result" class="mc-result" hidden></div>
      </div>
    `;

    sidebar.insertBefore(panelRoot, sidebar.firstChild);
    bindEvents();
  }

  function bindEvents() {
    const btn = document.getElementById('mc-generate');
    if (!btn) return;
    btn.addEventListener('click', onGenerate);
  }

  async function onGenerate() {
    const transcript = document.getElementById('mc-transcript').value.trim();
    if (!transcript) return;
    setStatus(t('analyzing', lang));
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'START_ANALYSIS',
        payload: { transcript, videoTitle: currentTitle }
      });
      if (result.ok) {
        renderResult(result.result);
        await saveHistory(currentVideoId, currentTitle, result.result);
      } else {
        setStatus(result.error === 'API_KEY_MISSING' ? t('errorApiKey', lang) : t('errorGenerate', lang));
      }
    } catch (err) {
      setStatus(t('errorGenerate', lang));
    }
  }

  function renderResult(data) {
    const resultEl = document.getElementById('mc-result');
    if (!resultEl) return;
    resultEl.hidden = false;
    resultEl.innerHTML = `
      <section class="mc-section">
        <h3>${t('summary', lang)}</h3>
        <p>${escapeHtml(data.summary || '')}</p>
      </section>
      <section class="mc-section">
        <h3>${t('keyInsights', lang)}</h3>
        <ul>${(data.keyInsights || []).map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
      </section>
      <section class="mc-section">
        <h3>${t('timeline', lang)}</h3>
        <ul>${(data.timeline || []).map(i => `<li><strong>${escapeHtml(i.time || '')}</strong> ${escapeHtml(i.content || '')}</li>`).join('')}</ul>
      </section>
      <section class="mc-section">
        <h3>${t('actionItems', lang)}</h3>
        <ul>${(data.actionItems || []).map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
      </section>
    `;
  }

  function setStatus(text) {
    const el = document.getElementById('mc-status');
    if (el) el.textContent = text;
  }

  async function saveHistory(videoId, title, result) {
    const key = window.MC_STORAGE_KEYS.STORAGE_KEYS.HISTORY;
    const res = await chrome.storage.local.get(key);
    const history = res[key] || [];
    history.unshift({ videoId, title, result, createdAt: Date.now() });
    await chrome.storage.local.set({ [key]: history.slice(0, 50) });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function onVideoMeta(event) {
    if (event.source !== window || !event.data || event.data.source !== 'MindCapsule') return;
    if (event.data.type === 'VIDEO_META') {
      currentVideoId = event.data.payload.videoId;
      currentTitle = event.data.payload.title;
    }
  }

  function init() {
    // Inject main-world script to read page globals.
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/inject.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);

    window.addEventListener('message', onVideoMeta);

    // Try injecting panel repeatedly until YouTube layout is ready.
    const tryInject = () => {
      injectPanel();
      if (!document.getElementById('mindcapsule-panel')) {
        setTimeout(tryInject, 1000);
      }
    };
    tryInject();
  }

  init();
})();
