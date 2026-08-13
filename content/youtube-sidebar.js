// Isolated-world content script: floating collapsible panel + auto caption fetch.
(function () {
  const t = window.MC_T;
  const lang = window.MC_LANG();
  const ICON_URL = chrome.runtime.getURL('store-assets/icon48.png');
  let currentVideoId = '';
  let currentTitle = '';
  let panelRoot = null;
  let captionTracks = [];
  let selectedTrack = null;
  let panelPos = { right: 24, top: 90 };
  let collapsed = false;

  const STORAGE_KEYS = window.MC_STORAGE_KEYS.STORAGE_KEYS;

  // ---- position / collapse persistence ----
  function loadPanelState() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ mc_panel_state: null }, (res) => {
        if (res.mc_panel_state) {
          if (res.mc_panel_state.pos) panelPos = res.mc_panel_state.pos;
          collapsed = !!res.mc_panel_state.collapsed;
        }
        resolve();
      });
    });
  }

  function savePanelState() {
    chrome.storage.local.set({ mc_panel_state: { pos: panelPos, collapsed } });
  }

  // ---- caption selection ----
  function pickBestTrack(tracks) {
    if (!tracks || !tracks.length) return null;
    const userLang = (navigator.language || 'en').toLowerCase();
    const browserCode = userLang.split('-')[0];
    // 1. user/browser preferred manual caption
    let hit = tracks.find(tr => !tr.kind && tr.languageCode && tr.languageCode.toLowerCase().startsWith(browserCode));
    if (hit) return hit;
    // 2. any manual caption
    hit = tracks.find(tr => !tr.kind);
    if (hit) return hit;
    // 3. auto-generated fallback
    hit = tracks.find(tr => tr.kind === 'asr' && tr.languageCode && tr.languageCode.toLowerCase().startsWith(browserCode));
    if (hit) return hit;
    // 4. first available
    return tracks[0];
  }

  async function fetchTranscript(track) {
    if (!track || !track.baseUrl) return null;
    const url = track.baseUrl + '&fmt=json3';
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    const events = data.events || [];
    let text = '';
    let count = 0;
    for (const ev of events) {
      if (!ev.segs) continue;
      for (const seg of ev.segs) {
        if (seg.utf8) {
          text += seg.utf8;
          count++;
        }
      }
      text += ' ';
    }
    return { text: text.trim(), count };
  }

  // ---- panel build ----
  function buildPanel() {
    panelRoot = document.createElement('div');
    panelRoot.id = 'mindcapsule-panel';
    panelRoot.className = 'mindcapsule-panel' + (collapsed ? ' mc-collapsed' : '');
    panelRoot.innerHTML = `
      <div class="mc-panel-header" id="mc-drag">
        <img src="${ICON_URL}" alt="" class="mc-panel-icon">
        <div class="mc-panel-titles">
          <div class="mc-panel-title">MindCapsule</div>
          <div class="mc-panel-subtitle" id="mc-status-line">…</div>
        </div>
        <button class="mc-icon-btn" id="mc-toggle" title="${t('collapsePanel', lang)}">–</button>
      </div>
      <div class="mc-panel-body">
        <div id="mc-caption-info" class="mc-caption-info"></div>
        <button id="mc-generate" class="mc-generate-btn">${t('generate', lang)}</button>
        <div id="mc-status" class="mc-status"></div>
        <div id="mc-result" class="mc-result" hidden></div>
      </div>
    `;
    document.body.appendChild(panelRoot);
    applyPosition();
    bindEvents();
  }

  function applyPosition() {
    if (!panelRoot) return;
    panelRoot.style.right = panelPos.right + 'px';
    panelRoot.style.top = panelPos.top + 'px';
  }

  function bindEvents() {
    const toggle = document.getElementById('mc-toggle');
    toggle.addEventListener('click', () => {
      collapsed = !collapsed;
      panelRoot.classList.toggle('mc-collapsed', collapsed);
      toggle.textContent = collapsed ? '+' : '–';
      toggle.title = collapsed ? t('expandPanel', lang) : t('collapsePanel', lang);
      savePanelState();
    });

    document.getElementById('mc-generate').addEventListener('click', onGenerate);
    enableDrag();
  }

  function enableDrag() {
    const drag = document.getElementById('mc-drag');
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    drag.addEventListener('mousedown', (e) => {
      if (e.target.closest('.mc-icon-btn')) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      ox = panelPos.right; oy = panelPos.top;
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      panelPos.right = Math.max(8, ox - dx);
      panelPos.top = Math.max(8, oy + dy);
      applyPosition();
    });
    window.addEventListener('mouseup', () => {
      if (dragging) { dragging = false; document.body.style.userSelect = ''; savePanelState(); }
    });
  }

  function setStatus(text) {
    const el = document.getElementById('mc-status');
    if (el) el.textContent = text;
  }

  function setStatusLine(text) {
    const el = document.getElementById('mc-status-line');
    if (el) el.textContent = text;
  }

  async function refreshCaptions() {
    selectedTrack = pickBestTrack(captionTracks);
    const infoEl = document.getElementById('mc-caption-info');
    const genBtn = document.getElementById('mc-generate');
    if (!selectedTrack) {
      setStatusLine(t('noCaptions', lang));
      if (infoEl) infoEl.textContent = t('noCaptionsHint', lang);
      genBtn.disabled = true;
      return;
    }
    setStatusLine(t('readingCaptions', lang));
    const data = await fetchTranscript(selectedTrack);
    if (!data || !data.text) {
      setStatusLine(t('noCaptions', lang));
      if (infoEl) infoEl.textContent = t('noCaptionsHint', lang);
      genBtn.disabled = true;
      return;
    }
    const label = `${selectedTrack.name || selectedTrack.languageCode} · ${selectedTrack.kind === 'asr' ? t('autoCaption', lang) : t('manualCaption', lang)}`;
    setStatusLine(label);
    if (infoEl) infoEl.textContent = t('autoTranscript', lang).replace('{n}', data.count.toLocaleString());
    genBtn.disabled = false;
    selectedTrack._text = data.text;
  }

  async function onGenerate() {
    if (!selectedTrack || !selectedTrack._text) {
      await refreshCaptions();
      if (!selectedTrack || !selectedTrack._text) return;
    }
    setStatus(t('analyzing', lang));
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'START_ANALYSIS',
        payload: { transcript: selectedTrack._text, videoTitle: currentTitle }
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

  async function saveHistory(videoId, title, result) {
    const key = STORAGE_KEYS.HISTORY;
    const res = await chrome.storage.local.get(key);
    const history = res[key] || [];
    history.unshift({ videoId, title, result, createdAt: Date.now() });
    await chrome.storage.local.set({ [key]: history.slice(0, 50) });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---- message handlers ----
  function onVideoMeta(event) {
    if (event.source !== window || !event.data || event.data.source !== 'MindCapsule') return;
    if (event.data.type === 'VIDEO_META') {
      currentVideoId = event.data.payload.videoId;
      currentTitle = event.data.payload.title;
    } else if (event.data.type === 'VIDEO_CAPTIONS') {
      captionTracks = event.data.payload.tracks || [];
      if (panelRoot) refreshCaptions();
    }
  }

  function init() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/inject.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);

    window.addEventListener('message', onVideoMeta);

    const tryInject = () => {
      if (!document.getElementById('mindcapsule-panel')) {
        loadPanelState().then(() => {
          buildPanel();
          refreshCaptions();
        });
      }
      if (!document.getElementById('mindcapsule-panel')) {
        setTimeout(tryInject, 1000);
      }
    };
    tryInject();
  }

  init();
})();
