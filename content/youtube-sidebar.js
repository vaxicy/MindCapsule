// Isolated-world content script: floating collapsible panel + auto caption fetch.
(function () {
  const t = window.MC_T;
  let lang = window.MC_LANG();
  const ICON_URL = chrome.runtime.getURL('store-assets/icon48.png');
  let currentVideoId = '';
  let currentTitle = '';
  let titleVerified = false;
  let panelRoot = null;
  let captionTracks = [];
  let selectedTrack = null;
  let pendingCaptions = false;
  let domCaptionText = '';
  let panelPos = { right: 24, top: 90 };
  let collapsed = false;
  let fullTranscriptReady = false;     // true once a complete transcript was fetched from a formal track
  let lastResult = null;               // last generated result, kept for language re-render

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
    // Some tracks come back with protocol-relative URLs (//www.youtube.com/...).
    // Resolve against the current page so fetch works.
    const url = new URL(track.baseUrl, window.location.href);
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
        <button class="mc-icon-btn" id="mc-lang" title="${t('uiLang', lang)}">${lang === 'zh' ? '中' : 'EN'}</button>
        <button class="mc-icon-btn" id="mc-toggle" title="${t('collapsePanel', lang)}">–</button>
      </div>
      <div class="mc-panel-body">
        <div id="mc-caption-info" class="mc-caption-info"></div>
        <div id="mc-caption-tip" class="mc-caption-tip">${t('captionTip', lang)}</div>
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

    const langBtn = document.getElementById('mc-lang');
    langBtn.addEventListener('click', switchLang);

    document.getElementById('mc-generate').addEventListener('click', onGenerate);

    // The copy/export dropdowns are injected dynamically when a result is
    // rendered, so bind via delegation on the (always-present) #mc-result
    // container. This guarantees click handling works regardless of when the
    // dropdowns are created or re-created on language switch.
    const resultEl = document.getElementById('mc-result');
    if (resultEl) {
      // Custom dropdown: clicking an option only updates the selected value,
      // it does NOT execute the copy/export. Execution happens only when the
      // user clicks the explicit action button (Copied / Export). This prevents
      // accidental clipboard writes / file downloads when merely choosing a format.
      resultEl.addEventListener('click', (e) => {
        const option = e.target.closest('.mc-dropdown-option');
        if (option) {
          const dropdown = option.closest('.mc-dropdown');
          selectDropdownOption(dropdown, option.dataset.value);
          closeDropdown(dropdown);
          return;
        }
        const trigger = e.target.closest('.mc-dropdown-trigger');
        if (trigger) {
          toggleDropdown(trigger.closest('.mc-dropdown'));
          return;
        }
        const action = e.target.closest('.mc-export-action');
        if (action) {
          executeExportAction(action.dataset.group, action.dataset.value);
        }
      });
      // Close any open dropdown when clicking outside the result area.
      resultEl.addEventListener('click', (e) => {
        if (!e.target.closest('.mc-dropdown')) closeAllDropdowns(resultEl);
      });
    }

    enableDrag();
  }

  // Toggle UI language, persist to mc_settings so the Options page stays in sync.
  function switchLang() {
    lang = (lang === 'zh') ? 'en' : 'zh';
    const langBtn = document.getElementById('mc-lang');
    if (langBtn) {
      langBtn.textContent = lang === 'zh' ? '中' : 'EN';
      langBtn.title = t('uiLang', lang);
    }
    applyI18nToPanel();
    // Persist into existing mc_settings (merge, not overwrite).
    chrome.storage.local.get({ mc_settings: {} }, (res) => {
      const settings = Object.assign({}, res.mc_settings || {}, { uiLang: lang });
      chrome.storage.local.set({ mc_settings: settings });
    });
    // Re-render an already-generated result in the new language.
    const resultEl = document.getElementById('mc-result');
    if (resultEl && !resultEl.hidden && lastResult) {
      renderResult(lastResult);
    }
    // Re-apply status-line captions text in the new language.
    if (selectedTrack) {
      const translateLabel = selectedTrack.translateTo ? ` → ${selectedTrack.translateTo}` : '';
      const trackName = (selectedTrack.name || selectedTrack.languageCode) || t('autoCaption', lang);
      const kindLabel = selectedTrack.kind === 'asr' ? t('autoCaption', lang) : t('manualCaption', lang);
      setStatusLine(`${trackName}${translateLabel} · ${kindLabel}`);
    }
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
    const langBtn = document.getElementById('mc-lang');
    if (langBtn) {
      langBtn.textContent = lang === 'zh' ? '中' : 'EN';
      langBtn.title = t('uiLang', lang);
    }
    const genBtn = document.getElementById('mc-generate');
    if (genBtn) genBtn.textContent = t('generate', lang);
    const copyDropdown = document.querySelector('#mc-result .mc-dropdown.mc-dropdown-copy');
    if (copyDropdown) {
      copyDropdown.querySelector('.mc-dropdown-trigger').title = t('copyAs', lang);
      const triggerLabel = copyDropdown.querySelector('.mc-dropdown-label');
      if (triggerLabel) triggerLabel.textContent = t('copyMarkdown', lang);
      const opts = copyDropdown.querySelectorAll('.mc-dropdown-option');
      if (opts[0]) opts[0].textContent = t('copyMarkdown', lang);
      if (opts[1]) opts[1].textContent = t('copyPlainText', lang);
      const action = copyDropdown.querySelector('.mc-export-action');
      if (action) action.textContent = t('copyAs', lang);
    }
    const expDropdown = document.querySelector('#mc-result .mc-dropdown.mc-dropdown-export');
    if (expDropdown) {
      expDropdown.querySelector('.mc-dropdown-trigger').title = t('exportAs', lang);
      const triggerLabel = expDropdown.querySelector('.mc-dropdown-label');
      if (triggerLabel) triggerLabel.textContent = t('exportMarkdown', lang);
      const opts = expDropdown.querySelectorAll('.mc-dropdown-option');
      if (opts[0]) opts[0].textContent = t('exportMarkdown', lang);
      if (opts[1]) opts[1].textContent = t('exportTxt', lang);
      if (opts[2]) opts[2].textContent = t('exportPdf', lang);
      const action = expDropdown.querySelector('.mc-export-action');
      if (action) action.textContent = t('exportAs', lang);
    }
    const redetect = document.getElementById('mc-redetect');
    if (redetect) redetect.textContent = t('redetectCaptions', lang);
    const tip = document.getElementById('mc-caption-tip');
    if (tip) {
      // The tip is a static hint. When no caption is detected, show the
      // "re-toggle subtitles" guidance instead.
      const noCap = !selectedTrack && !domCaptionText;
      tip.textContent = noCap ? t('captionToggleHint', lang) : t('captionTip', lang);
    }
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
    const tipEl = document.getElementById('mc-caption-tip');
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
        return;
      }
      // No caption track available: no full transcript can be produced.
      setStatusLine(t('noCaptions', lang));
      if (infoEl) infoEl.textContent = t('noCaptionsHint', lang);
      if (tipEl) tipEl.textContent = t('captionToggleHint', lang);
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
  }

  function renderDetectButton(show) {    const body = document.querySelector('.mc-panel-body');
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
        lastResult = result.result;
        renderResult(result.result);
        await saveHistory(currentVideoId, currentTitle, result.result);
      } else {
        setStatus(result.error === 'API_KEY_MISSING' ? t('errorApiKey', lang) : t('errorGenerate', lang));
      }
    } catch (err) {
      setStatus(t('errorGenerate', lang));
    }
  }

  function timeToSeconds(time) {
    if (!time) return null;
    const parts = String(time).split(':').map(p => parseInt(p, 10));
    if (parts.some(isNaN)) return null;
    return parts.reduce((acc, v) => acc * 60 + v, 0);
  }

  function youtubeLink(time) {
    const secs = timeToSeconds(time);
    if (secs === null || !currentVideoId) return null;
    return `https://www.youtube.com/watch?v=${currentVideoId}&t=${secs}s`;
  }

  function renderResult(data) {
    const resultEl = document.getElementById('mc-result');
    if (!resultEl) return;
    // Result is ready: clear the "analyzing" status text so it doesn't linger.
    setStatus('');
    resultEl.hidden = false;
    const sections = [];

    // TL;DR highlight, if present.
    if (data.tldr) {
      sections.push(`<section class="mc-section mc-tldr"><h3>${t('tldr', lang)}</h3><p>${escapeHtml(data.tldr)}</p></section>`);
    }

    // Summary.
    if (data.summary) {
      sections.push(`<section class="mc-section"><h3>${t('summary', lang)}</h3><p>${escapeHtml(data.summary)}</p></section>`);
    }

    // Key insights.
    if (data.keyInsights && data.keyInsights.length) {
      sections.push(`<section class="mc-section"><h3>${t('keyInsights', lang)}</h3><ul>${data.keyInsights.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul></section>`);
    }

    // Timeline with plain-text timestamps (no navigation link).
    if (data.timeline && data.timeline.length) {
      const items = data.timeline.map(i => {
        const timeHtml = i.time ? `<strong>${escapeHtml(i.time)}</strong>` : '';
        return `<li>${timeHtml} ${escapeHtml(i.content || '')}</li>`;
      }).join('');
      sections.push(`<section class="mc-section"><h3>${t('timeline', lang)}</h3><ul>${items}</ul></section>`);
    }

    // Action items as a simple list (no checkbox).
    if (data.actionItems && data.actionItems.length) {
      const items = data.actionItems.map(i => `<li>${escapeHtml(i)}</li>`).join('');
      sections.push(`<section class="mc-section"><h3>${t('actionItems', lang)}</h3><ul>${items}</ul></section>`);
    }

    // Export bar: two custom dropdowns (format picker) + an explicit action
    // button each. Selecting a format does NOT trigger the action; only the
    // action button does. This avoids accidental copy/download on selection.
    resultEl.innerHTML = `
      <div class="mc-export-bar">
        <div class="mc-dropdown mc-dropdown-copy" data-group="copy">
          <button class="mc-dropdown-trigger" type="button" title="${t('copyAs', lang)}">
            <span class="mc-dropdown-label">${t('copyMarkdown', lang)}</span>
            <span class="mc-dropdown-caret">▾</span>
          </button>
          <div class="mc-dropdown-menu" hidden>
            <div class="mc-dropdown-option" data-value="md">${t('copyMarkdown', lang)}</div>
            <div class="mc-dropdown-option" data-value="txt">${t('copyPlainText', lang)}</div>
          </div>
          <button class="mc-export-action" type="button" data-group="copy" data-value="md">${t('copyAs', lang)}</button>
        </div>
        <div class="mc-dropdown mc-dropdown-export" data-group="export">
          <button class="mc-dropdown-trigger" type="button" title="${t('exportAs', lang)}">
            <span class="mc-dropdown-label">${t('exportMarkdown', lang)}</span>
            <span class="mc-dropdown-caret">▾</span>
          </button>
          <div class="mc-dropdown-menu" hidden>
            <div class="mc-dropdown-option" data-value="md">${t('exportMarkdown', lang)}</div>
            <div class="mc-dropdown-option" data-value="txt">${t('exportTxt', lang)}</div>
            <div class="mc-dropdown-option" data-value="pdf">${t('exportPdf', lang)}</div>
          </div>
          <button class="mc-export-action" type="button" data-group="export" data-value="md">${t('exportAs', lang)}</button>
        </div>
      </div>
      ${sections.join('\n')}
    `;
  }

  // ---- custom dropdown helpers ----
  function selectDropdownOption(dropdown, value) {
    if (!dropdown) return;
    dropdown.dataset.value = value;
    // Keep the action button in sync so its click uses the chosen format.
    const action = dropdown.querySelector('.mc-export-action');
    if (action) action.dataset.value = value;
    const label = dropdown.querySelector('.mc-dropdown-label');
    const opt = dropdown.querySelector(`.mc-dropdown-option[data-value="${value}"]`);
    if (label && opt) label.textContent = opt.textContent;
  }

  function openDropdown(dropdown) {
    if (!dropdown) return;
    const menu = dropdown.querySelector('.mc-dropdown-menu');
    if (menu) menu.hidden = false;
    dropdown.classList.add('mc-open');
  }

  function closeDropdown(dropdown) {
    if (!dropdown) return;
    const menu = dropdown.querySelector('.mc-dropdown-menu');
    if (menu) menu.hidden = true;
    dropdown.classList.remove('mc-open');
  }

  function toggleDropdown(dropdown) {
    if (!dropdown) return;
    if (dropdown.classList.contains('mc-open')) closeDropdown(dropdown);
    else openDropdown(dropdown);
  }

  function closeAllDropdowns(scope) {
    (scope || document).querySelectorAll('.mc-dropdown.mc-open').forEach((d) => closeDropdown(d));
  }

  // Read the chosen format from the dropdown and execute the actual operation.
  function executeExportAction(group, value) {
    if (!lastResult) return;
    if (group === 'copy') {
      if (value === 'txt') {
        copyToClipboard(formatPlainText(lastResult, currentTitle));
      } else {
        copyToClipboard(formatMarkdown(lastResult, currentTitle));
      }
    } else {
      const base = (currentTitle || 'mindcapsule-notes').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
      if (value === 'txt') {
        downloadText(base + '.txt', formatPlainText(lastResult, currentTitle));
      } else if (value === 'pdf') {
        exportPdf(lastResult, currentTitle);
      } else {
        downloadMarkdown(base + '.md', formatMarkdown(lastResult, currentTitle));
      }
    }
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

  // Build a Markdown string from the generated result.
  function formatMarkdown(data, title) {
    const lines = [];
    lines.push(`# MindCapsule Notes — ${title || ''}`);
    lines.push('');
    if (currentVideoId) {
      lines.push(`> Source: https://www.youtube.com/watch?v=${currentVideoId}`);
      lines.push('');
    }
    if (data.tldr) {
      lines.push(`**TL;DR:** ${data.tldr}`);
      lines.push('');
    }
    if (data.summary) {
      lines.push(`## ${t('summary', lang)}`);
      lines.push(data.summary.trim());
      lines.push('');
    }
    if (data.keyInsights && data.keyInsights.length) {
      lines.push(`## ${t('keyInsights', lang)}`);
      data.keyInsights.forEach((i) => { if (i) lines.push(`- ${i}`); });
      lines.push('');
    }
    if (data.timeline && data.timeline.length) {
      lines.push(`## ${t('timeline', lang)}`);
      data.timeline.forEach((i) => {
        if (!i) return;
        const timePart = i.time || '';
        lines.push(`- **${timePart}** ${i.content || ''}`.trim());
      });
      lines.push('');
    }
    if (data.actionItems && data.actionItems.length) {
      lines.push(`## ${t('actionItems', lang)}`);
      data.actionItems.forEach((i) => { if (i) lines.push(`- ${i}`); });
      lines.push('');
    }
    return lines.join('\n');
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text)
        .then(() => { setStatus(t('copied', lang)); })
        .catch(() => { setStatus(t('exportFailed', lang)); });
    }
    setStatus(t('exportFailed', lang));
    return Promise.resolve();
  }

  function downloadMarkdown(filename, text) {
    try {
      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'mindcapsule-notes.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(t('copied', lang));
    } catch (e) {
      setStatus(t('exportFailed', lang));
    }
  }

  // Plain-text variant of the result: strip Markdown syntax, keep readable
  // structure (headings become plain lines, lists keep their bullets).
  function formatPlainText(data, title) {
    const lines = [];
    lines.push(`MindCapsule Notes — ${title || ''}`);
    lines.push('');
    if (currentVideoId) {
      lines.push(`Source: https://www.youtube.com/watch?v=${currentVideoId}`);
      lines.push('');
    }
    const pushBlock = (heading, items, list) => {
      if (items && items.length) {
        lines.push(heading);
        items.forEach((i) => { if (i) lines.push(list ? `- ${i}` : i); });
        lines.push('');
      }
    };
    if (data.tldr) {
      lines.push(`TL;DR: ${data.tldr}`);
      lines.push('');
    }
    if (data.summary) {
      lines.push(t('summary', lang));
      lines.push(data.summary.trim());
      lines.push('');
    }
    pushBlock(t('keyInsights', lang), data.keyInsights, true);
    if (data.timeline && data.timeline.length) {
      lines.push(t('timeline', lang));
      data.timeline.forEach((i) => {
        if (!i) return;
        const timePart = i.time || '';
        lines.push(`- ${timePart} ${i.content || ''}`.trim());
      });
      lines.push('');
    }
    pushBlock(t('actionItems', lang), data.actionItems, true);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function downloadText(filename, text) {
    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'mindcapsule-notes.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(t('copied', lang));
    } catch (e) {
      setStatus(t('exportFailed', lang));
    }
  }

  // PDF via a hidden iframe that contains ONLY the note text (no logo, no
  // buttons, no panel chrome). The iframe is removed right after the print
  // dialog is shown. Zero dependencies, and the panel UI never gets printed.
  function exportPdf(data, title) {
    try {
      const doc = formatPlainText(data, title);
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
      document.body.appendChild(iframe);
      const idoc = iframe.contentWindow.document;
      idoc.open();
      idoc.write(
        '<!doctype html><html><head><meta charset="utf-8">' +
        '<title>' + escapeHtml(title || 'MindCapsule Notes') + '</title>' +
        '<style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;' +
        'font-size:13px;line-height:1.7;color:#1a1a1a;max-width:780px;margin:24px auto;padding:0 24px;' +
        'white-space:pre-wrap;word-break:break-word;}@media print{body{margin:0;}}</style>' +
        '</head><body>' + escapeHtml(doc) + '</body></html>'
      );
      idoc.close();
      const removeIframe = () => {
        if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      };
      iframe.contentWindow.focus();
      setTimeout(() => {
        iframe.contentWindow.print();
        // Give the print dialog a moment, then clean up.
        setTimeout(removeIframe, 1000);
      }, 250);
      setStatus(t('copied', lang));
    } catch (e) {
      setStatus(t('exportFailed', lang));
    }
  }

  // ---- message handlers ----
  function onVideoMeta(event) {
    if (event.source !== window || !event.data || event.data.source !== 'MindCapsule') return;
    if (event.data.type === 'VIDEO_META') {
      currentVideoId = event.data.payload.videoId;
      currentTitle = event.data.payload.title;
      titleVerified = !!event.data.payload.verified;
      selectedTrack = null;
      captionTracks = [];
      domCaptionText = '';
      fullTranscriptReady = false;
      // If a result is already rendered (e.g. generated before title arrived),
      // refresh the title section in place so it no longer shows "missing".
      const resultEl = document.getElementById('mc-result');
      if (resultEl && !resultEl.hidden && lastResult) {
        renderResult(lastResult);
      }
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

  function init() {
    // Apply stored UI language before building the panel.
    window.MC_LOAD_LANG().then((stored) => {
      lang = stored;
      // Re-apply translations to the already-built panel, if any.
      if (panelRoot) applyI18nToPanel();
    });

    // Keep the panel in sync when the UI language changes elsewhere
    // (popup or Options page wrote mc_settings.uiLang).
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[STORAGE_KEYS.SETTINGS]) return;
      const newVal = changes[STORAGE_KEYS.SETTINGS].newValue;
      const newLang = newVal && newVal.uiLang;
      if (newLang !== 'zh' && newLang !== 'en') return;
      if (newLang === lang) return;
      lang = newLang;
      applyI18nToPanel();
      const resultEl = document.getElementById('mc-result');
      if (resultEl && !resultEl.hidden && lastResult) {
        renderResult(lastResult);
      }
      if (selectedTrack) {
        const translateLabel = selectedTrack.translateTo ? ` → ${selectedTrack.translateTo}` : '';
        const trackName = (selectedTrack.name || selectedTrack.languageCode) || t('autoCaption', lang);
        const kindLabel = selectedTrack.kind === 'asr' ? t('autoCaption', lang) : t('manualCaption', lang);
        setStatusLine(`${trackName}${translateLabel} · ${kindLabel}`);
      }
    });

    // inject.js is now declared in manifest.json as a MAIN-world content script
    // running at document_start, so it is already loaded and posting messages.
    // We no longer inject it manually from here.

    window.addEventListener('message', onVideoMeta);

    // If the panel is built but no VIDEO_META arrives within 4s (e.g. the
    // isolated-world listener wasn't ready when inject.js first posted), ask
    // main world to re-read the title. This avoids a permanent "未获取到标题".
    setTimeout(() => {
      if (!currentTitle) {
        window.postMessage({ source: 'MindCapsule', type: 'REQUEST_VIDEO_META' }, '*');
      }
    }, 4000);

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
