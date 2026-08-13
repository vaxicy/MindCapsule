// Runs in MAIN WORLD (declared via manifest "world": "MAIN", "run_at": "document_start")
// to read page-specific data (videoId, title, captions) and post back to the
// isolated-world sidebar. Running at document_start gives us a chance to read
// `window.ytInitialPlayerResponse` before YouTube clears it, and lets us react
// to SPA navigation + video playback, where auto-generated (ASR) caption tracks
// often appear only after the user starts watching.
(function () {
  const POLL_DELAYS = [0, 200, 600, 1200, 2000, 3500, 5000, 7000];
  let pollTimer = null;

  function readVideoMeta() {
    const url = new URL(window.location.href);
    const videoId = url.searchParams.get('v') || '';
    const titleEl = document.querySelector('h1.title.style-scope.ytd-video-primary-info-renderer');
    const title = titleEl ? titleEl.textContent.trim() : (document.title || '');
    window.postMessage({ source: 'MindCapsule', type: 'VIDEO_META', payload: { videoId, title } }, '*');
  }

  function extractTracks(list) {
    if (!list || !Array.isArray(list.captionTracks)) return [];
    const translationLanguages = Array.isArray(list.translationLanguages)
      ? list.translationLanguages
      : [];
    return list.captionTracks.map(tr => ({
      baseUrl: tr.baseUrl || '',
      name: (tr.name && tr.name.simpleText) || '',
      languageCode: tr.languageCode || '',
      kind: tr.kind || 'asr', // 'asr' = auto-generated
      translationLanguages
    }));
  }

  // Read available caption tracks from ytInitialPlayerResponse.
  function readCaptionsOnce() {
    let tracks = [];
    try {
      const data = window.ytInitialPlayerResponse;
      const list = data && data.captions && data.captions.playerCaptionsTracklistRenderer;
      tracks = extractTracks(list);
    } catch (e) { /* ignore */ }

    // Fallback 1: legacy ytplayer.config.args.player_response
    if (!tracks.length) {
      try {
        const pr = window.ytplayer && window.ytplayer.config && window.ytplayer.config.args && window.ytplayer.config.args.player_response;
        const data = pr && JSON.parse(pr);
        const list = data && data.captions && data.captions.playerCaptionsTracklistRenderer;
        tracks = extractTracks(list);
      } catch (e) { /* ignore */ }
    }

    // Fallback 2: scan all inline <script> tags for a captionTracks JSON block.
    if (!tracks.length) {
      tracks = extractTracksFromScripts();
    }
    return tracks;
  }

  // Parse captionTracks out of any inline <script> that contains the data.
  function extractTracksFromScripts() {
    const out = [];
    try {
      const scripts = document.querySelectorAll('script');
      for (const sc of scripts) {
        const txt = sc.textContent || '';
        const idx = txt.indexOf('captionTracks');
        if (idx === -1) continue;
        // Find the enclosing "playerCaptionsTracklistRenderer" object.
        const start = txt.lastIndexOf('playerCaptionsTracklistRenderer', idx);
        const from = start === -1 ? idx - 80 : start;
        const slice = txt.slice(from);
        // Brace-matching search for the tracklist object.
        let depth = 0, inStr = false, escaped = false, begin = -1;
        for (let p = 0; p < slice.length; p++) {
          const ch = slice[p];
          if (inStr) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inStr = false;
            continue;
          }
          if (ch === '"') { inStr = true; continue; }
          if (ch === '{') { if (begin === -1) begin = p; depth++; }
          else if (ch === '}') { depth--; if (begin !== -1 && depth === 0) {
            const block = slice.slice(begin, p + 1);
            try {
              const obj = JSON.parse(block);
              const t = extractTracks(obj.playerCaptionsTracklistRenderer || obj);
              if (t.length) return t;
            } catch (_) { begin = -1; }
          } }
        }
      }
    } catch (e) { /* ignore */ }
    return out;
  }

  let lastSentSignature = '';

  function readCaptions() {
    if (pollTimer) clearTimeout(pollTimer);
    let attempt = 0;
    function tryRead() {
      const tracks = readCaptionsOnce();
      const sig = tracks.map(t => t.languageCode + ':' + t.kind + ':' + (t.translateTo || '')).join('|');
      // Only post when the result changes, so we don't spam the sidebar.
      if (sig !== lastSentSignature) {
        lastSentSignature = sig;
        window.postMessage({ source: 'MindCapsule', type: 'VIDEO_CAPTIONS', payload: { tracks } }, '*');
      }
      if (!tracks.length && attempt < POLL_DELAYS.length - 1) {
        attempt++;
        pollTimer = setTimeout(tryRead, POLL_DELAYS[attempt] - POLL_DELAYS[attempt - 1]);
      }
    }
    tryRead();
  }

  // Send initial meta + captions.
  readVideoMeta();
  readCaptions();

  // Re-send on SPA navigation.
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastSentSignature = '';
      setTimeout(() => { readVideoMeta(); readCaptions(); }, 1200);
    }
  }).observe(document, { subtree: true, childList: true });

  // YouTube fires these custom events when a WATCH page finishes loading the
  // player / navigating between videos. ASR tracks may only be populated then.
  function bindYtEvents() {
    document.addEventListener('yt-page-data-updated', () => {
      lastSentSignature = '';
      readCaptions();
    });
    document.addEventListener('yt-navigate-finish', () => {
      lastSentSignature = '';
      readCaptions();
    });
  }

  // Many auto-generated (ASR) caption tracks only appear once the video starts
  // playing. Re-read when playback begins.
  function bindPlayEvents() {
    function onPlay() {
      lastSentSignature = '';
      readCaptions();
    }
    const attach = () => {
      const v = document.querySelector('video');
      if (v) {
        v.addEventListener('play', onPlay, { once: false });
      }
    };
    attach();
    // The <video> element is created dynamically on watch pages.
    new MutationObserver(() => {
      const v = document.querySelector('video');
      if (v && !v.__mcPlayBound) {
        v.__mcPlayBound = true;
        v.addEventListener('play', onPlay);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bindYtEvents(); bindPlayEvents(); });
  } else {
    bindYtEvents();
    bindPlayEvents();
  }

  // Allow isolated-world script to request a fresh caption read.
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'MindCapsule') return;
    if (event.data.type === 'REQUEST_CAPTIONS') {
      lastSentSignature = '';
      readCaptions();
    }
  });
})();
