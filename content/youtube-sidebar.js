// Isolated-world content script: floating collapsible panel + auto caption fetch.
(function () {
  const t = window.MC_T;
  let lang = window.MC_LANG();
  const ICON_URL = chrome.runtime.getURL('store-assets/icon48.png');
  let currentVideoId = '';
  let currentTitle = '';
  let panelRoot = null;
  let captionTracks = [];
  let selectedTrack = null;
  let pendingCaptions = false;
  let domCaptionText = '';
  let panelPos = { right: 24, top: 90 };
  let collapsed = false;
  let generatedVideoIds = new Set();   // de-dupe auto-generation per video
  let autoGenerateEnabled = true;
  let fullTranscriptReady = false;     // true once a complete transcript was fetched from a formal track

  const STORAGE_KEYS = window.MC_STORAGE_KEYS;

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
  function getBrowserLangCode() {
    return ((navigator.language || 'en').toLowerCase().split('-')[0]);
  }

  function pickBestTrack(tracks) {
    if (!tracks || !tracks.length) return null;
    const browserCode = getBrowserLangCode();
    // Determine the video's original/primary language: YouTube lists it first,
    // or we can infer from the first non-translation track. Prefer original-language
    // text (not auto-translated) so we analyze the real source content.
    const originalCode = (tracks[0] && tracks[0].languageCode) ? tracks[0].languageCode.toLowerCase() : '';

    // 1. original-language manual caption (best: real source, human-written)
    let hit = tracks.find(tr => !tr.kind && tr.languageCode && tr.languageCode.toLowerCase() === originalCode);
    if (hit) return hit;
    // 2. original-language ASR (auto) caption — still the source language
    hit = tracks.find(tr => tr.kind === 'asr' && tr.languageCode && tr.languageCode.toLowerCase() === originalCode);
    if (hit) return hit;
    // 3. any original-language track (fallback on code match)
    hit = tracks.find(tr => tr.languageCode && tr.languageCode.toLowerCase() === originalCode);
    if (hit) return hit;
    // 4. browser-language manual caption
    hit = tracks.find(tr => !tr.kind && tr.languageCode && tr.languageCode.toLowerCase().startsWith(browserCode));
    if (hit) return hit;
    // 5. browser-language ASR
    hit = tracks.find(tr => tr.kind === 'asr' && tr.languageCode && tr.languageCode.toLowerCase().startsWith(browserCode));
    if (hit) return hit;
    // 6. any manual caption
    hit = tracks.find(tr => !tr.kind);
    if (hit) return hit;
    // 7. first available
    return tracks[0];
  }

  function getAutoTranslateLang() {
    const userLang = (navigator.language || 'en').toLowerCase();
    // YouTube uses zh-Hans / zh-Hant for Chinese auto-translation.
    if (userLang.startsWith('zh-hant') || userLang === 'zh-tw' || userLang === 'zh-hk' || userLang === 'zh-mo') return 'zh-Hant';
    if (userLang.startsWith('zh')) return 'zh-Hans';
    return userLang;
  }

  function canAutoTranslate(track, targetLang) {
    if (!track.translationLanguages || !track.translationLanguages.length) return false;
    return track.translationLanguages.some(l => l.languageCode === targetLang);
  }

  async function fetchTranscript(track) {
    if (!track || !track.baseUrl) return null;
    // Build the full transcript URL from the track baseUrl. Use the URL object
    // so query params are appended correctly regardless of whether baseUrl
    // already ends with '&' or '?'. fmt=json3 returns the COMPLETE transcript
    // (all events with timestamps) in one request — no need to wait for playback.
    const url = new URL(track.baseUrl);
    url.searchParams.set('fmt', 'json3');
    if (track.translateTo) {
      url.searchParams.set('tlang', track.translateTo);
    }
    const res = await fetch(url.toString(), { credentials: 'include' });
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

  // Re-apply translations to a built panel after UI language changes.
  function applyI18nToPanel() {
    const toggle = document.getElementById('mc-toggle');
    if (toggle) {
      toggle.title = collapsed ? t('expandPanel', lang) : t('collapsePanel', lang);
    }
    const genBtn = document.getElementById('mc-generate');
    if (genBtn) genBtn.textContent = t('generate', lang);
    const redetect = document.getElementById('mc-redetect');
    if (redetect) redetect.textContent = t('redetectCaptions', lang);
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

    // Try auto-translation to browser language if no direct match.
    if (selectedTrack) {
      const browserCode = getBrowserLangCode();
      const targetLang = getAutoTranslateLang();
      const alreadyInLang = selectedTrack.languageCode && selectedTrack.languageCode.toLowerCase().startsWith(browserCode);
      if (!alreadyInLang && canAutoTranslate(selectedTrack, targetLang)) {
        selectedTrack = { ...selectedTrack, translateTo: targetLang };
      }
    }

    if (!selectedTrack) {
      // No formal track, but captions may be visible on screen. Use collected
      // DOM text as a fallback transcript.
      if (domCaptionText) {
        const wordCount = domCaptionText.split(/\s+/).filter(Boolean).length;
        setStatusLine(`${t('autoCaption', lang)} · ${domCaptionText.substring(0, 40)}...`);
        if (infoEl) infoEl.textContent = t('autoTranscript', lang).replace('{n}', wordCount.toLocaleString());
        genBtn.disabled = false;
        renderDetectButton(false);
        maybeAutoGenerate();
        return;
      }
      // No caption track available: no full transcript can be produced.
      setStatusLine(t('noCaptions', lang));
      if (infoEl) infoEl.textContent = t('noCaptionsHint', lang);
      genBtn.disabled = true;
      renderDetectButton(true);
      return;
    }

    setStatusLine(t('readingCaptions', lang));
    const data = await fetchTranscript(selectedTrack);
    if (!data || !data.text) {
      setStatusLine(t('noCaptions', lang));
      if (infoEl) infoEl.textContent = t('noCaptionsHint', lang);
      genBtn.disabled = true;
      renderDetectButton(true);
      return;
    }
    // Full transcript obtained from the formal caption track in one request;
    // mark ready so on-screen (DOM) caption accumulation stops overriding it.
    fullTranscriptReady = true;

    const translateLabel = selectedTrack && selectedTrack.translateTo ? ` → ${selectedTrack.translateTo}` : '';
    const trackName = (selectedTrack && (selectedTrack.name || selectedTrack.languageCode)) || t('autoCaption', lang);
    const kindLabel = selectedTrack && selectedTrack.kind === 'asr' ? t('autoCaption', lang) : t('manualCaption', lang);
    const label = `${trackName}${translateLabel} · ${kindLabel}`;
    setStatusLine(label);
    if (infoEl) infoEl.textContent = t('autoTranscript', lang).replace('{n}', data.count.toLocaleString());
    genBtn.disabled = false;
    selectedTrack._text = data.text;
    renderDetectButton(false);
    maybeAutoGenerate();
  }

  function renderDetectButton(show) {
    const body = document.querySelector('.mc-panel-body');
    if (!body) return;
    let btn = document.getElementById('mc-redetect');
    if (!show) {
      if (btn) btn.remove();
      return;
    }
    if (btn) return;
    btn = document.createElement('button');
    btn.id = 'mc-redetect';
    btn.className = 'mc-detect-btn';
    btn.textContent = t('redetectCaptions', lang);
    btn.addEventListener('click', () => {
      captionTracks = [];
      pendingCaptions = true;
      fullTranscriptReady = false;
      setStatusLine(t('redetectCaptions', lang) + '…');
      // Ask inject.js to re-read captions (it keeps polling up to ~7s on its own).
      window.postMessage({ source: 'MindCapsule', type: 'REQUEST_CAPTIONS' }, '*');
      let waited = 0;
      const tick = setInterval(() => {
        waited += 800;
        if (!pendingCaptions) { clearInterval(tick); }
        else if (waited >= 8000) { clearInterval(tick); refreshCaptions(); }
      }, 800);
    });
    body.appendChild(btn);
  }

  async function onGenerate() {
    let transcript = (selectedTrack && selectedTrack._text) || domCaptionText || '';
    if (!transcript) {
      await refreshCaptions();
      transcript = (selectedTrack && selectedTrack._text) || domCaptionText || '';
      if (!transcript) return;
    }
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
      selectedTrack = null;
      captionTracks = [];
      domCaptionText = '';
      fullTranscriptReady = false;
      generatedVideoIds.delete(currentVideoId);
    } else if (event.data.type === 'VIDEO_CAPTIONS') {
      captionTracks = event.data.payload.tracks || [];
      pendingCaptions = false;
      if (panelRoot) refreshCaptions();
      else pendingCaptions = true; // refresh once panel is built
    } else if (event.data.type === 'VIDEO_CAPTION_TEXT') {
      // Once a complete transcript has been fetched from a formal track, ignore
      // the on-screen caption accumulation so it doesn't re-trigger refreshes
      // while the video plays (avoids the "capturing as it plays" feeling).
      if (fullTranscriptReady) return;
      const text = event.data.payload.text || '';
      if (text.length > domCaptionText.length) domCaptionText = text;
      pendingCaptions = false;
      if (panelRoot) refreshCaptions();
      else pendingCaptions = true;
    }
  }

  // After captions are ready, auto-generate if enabled and not already done for this video.
  async function maybeAutoGenerate() {
    if (!autoGenerateEnabled) return;
    if (!currentVideoId || generatedVideoIds.has(currentVideoId)) return;
    const transcript = (selectedTrack && selectedTrack._text) || domCaptionText || '';
    if (!transcript) return;
    generatedVideoIds.add(currentVideoId);
    setStatusLine(t('autoGenerating', lang));
    await onGenerate();
  }

  function init() {
    // Apply stored UI language before building the panel.
    window.MC_LOAD_LANG().then((stored) => {
      lang = stored;
      // Re-apply translations to the already-built panel, if any.
      if (panelRoot) applyI18nToPanel();
    });

    chrome.storage.local.get({ mc_settings: null }, (res) => {
      const s = res.mc_settings || {};
      autoGenerateEnabled = s.autoGenerate !== undefined ? !!s.autoGenerate : true;
    });

    // inject.js is now declared in manifest.json as a MAIN-world content script
    // running at document_start, so it is already loaded and posting messages.
    // We no longer inject it manually from here.

    window.addEventListener('message', onVideoMeta);

    const tryInject = () => {
      if (!document.getElementById('mindcapsule-panel')) {
        loadPanelState().then(() => {
          buildPanel();
          // Captions may have already arrived before panel built; refresh them now.
          if (pendingCaptions || captionTracks.length) refreshCaptions();
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
