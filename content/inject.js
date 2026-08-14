// Runs in MAIN WORLD (declared via manifest "world": "MAIN", "run_at": "document_start")
// to read page-specific data (videoId, title, captions) and post back to the
// isolated-world sidebar. Running at document_start gives us a chance to read
// `window.ytInitialPlayerResponse` before YouTube clears it, and lets us react
// to SPA navigation + video playback, where auto-generated (ASR) caption tracks
// often appear only after the user starts watching.
(function () {
  const POLL_DELAYS = [0, 200, 600, 1200, 2000, 3500, 5000, 7000];
  let pollTimer = null;
  // Latest tracks we know about, kept across the polling reader and the
  // network interceptor (player endpoint + timedtext) so manual + ASR +
  // translated tracks merge without overwriting each other.
  let captionTracksSnapshot = [];
  let lastSentSignature = '';
  let networkInterceptInstalled = false;

  function currentVideoId() {
    try {
      return new URL(window.location.href).searchParams.get('v') || '';
    } catch (e) { return ''; }
  }

  function readVideoMeta() {
    const url = new URL(window.location.href);
    const videoId = url.searchParams.get('v') || '';

    // Preferred: ytInitialPlayerResponse.videoDetails.title is the most
    // reliable title and is available very early (document_start).
    let title = '';
    try {
      const vd = window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.videoDetails;
      if (vd && vd.title) title = String(vd.title).trim();
    } catch (e) { /* ignore */ }

    // Fallback 1: primary info renderer title (old layout).
    if (!title) {
      const el = document.querySelector('h1.title.style-scope.ytd-video-primary-info-renderer');
      if (el) title = el.textContent.trim();
    }
    // Fallback 2: watch-metadata title (current layout).
    if (!title) {
      const el = document.querySelector('h1.style-scope.ytd-watch-metadata, h1.ytd-watch-metadata');
      if (el) title = el.textContent.trim();
    }
    // Fallback 3: og:title meta.
    if (!title) {
      const el = document.querySelector('meta[property="og:title"]');
      if (el && el.content) title = el.content.trim();
    }
    // Fallback 4: document.title minus the " - YouTube" suffix.
    if (!title) title = document.title || '';
    title = title.replace(/\s*-\s*YouTube\s*$/i, '').trim();

    // Verify this title actually belongs to the current video: compare the
    // page's canonical link (or current URL) against the detected videoId.
    let verified = false;
    try {
      const canon = document.querySelector('link[rel="canonical"]');
      const checkUrl = canon ? canon.href : window.location.href;
      verified = checkUrl.indexOf('v=' + videoId) !== -1;
    } catch (e) { verified = false; }
    window.postMessage({ source: 'MindCapsule', type: 'VIDEO_META', payload: { videoId, title, verified } }, '*');
  }

  // YouTube is an SPA: at document_start the title/og:title are often still
  // empty or stale ("YouTube"). Poll with increasing delays until we get a
  // non-empty title, then stop. The <title> MutationObserver below also
  // re-sends when the page title updates after navigation.
  let metaPollTimer = null;
  function readVideoMetaWithPoll() {
    if (metaPollTimer) clearTimeout(metaPollTimer);
    let attempt = 0;
    function tryRead() {
      let title = '';
      try {
        const vd = window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.videoDetails;
        if (vd && vd.title) title = String(vd.title).trim();
      } catch (e) { /* ignore */ }
      if (!title) {
        const el = document.querySelector('h1.title.style-scope.ytd-video-primary-info-renderer');
        if (el) title = el.textContent.trim();
      }
      if (!title) {
        const el = document.querySelector('h1.style-scope.ytd-watch-metadata, h1.ytd-watch-metadata');
        if (el) title = el.textContent.trim();
      }
      if (!title) {
        const el = document.querySelector('meta[property="og:title"]');
        if (el && el.content) title = el.content.trim();
      }
      if (!title) title = (document.title || '').replace(/\s*-\s*YouTube\s*$/i, '').trim();
      // Only send when we actually have a title; keep polling otherwise.
      if (title) {
        readVideoMeta();
        return;
      }
      if (attempt < POLL_DELAYS.length - 1) {
        attempt++;
        metaPollTimer = setTimeout(tryRead, POLL_DELAYS[attempt] - POLL_DELAYS[attempt - 1]);
      }
    }
    tryRead();
  }

  // Re-send the title whenever <title> changes (covers late SPA updates).
  function observeTitleChanges() {
    try {
      const titleEl = document.querySelector('title') || document.head;
      const mo = new MutationObserver(() => {
        const title = (document.title || '').replace(/\s*-\s*YouTube\s*$/i, '').trim();
        if (title && title !== 'YouTube') readVideoMeta();
      });
      mo.observe(titleEl, { subtree: true, childList: true, characterData: true });
    } catch (e) { /* ignore */ }
  }

  function extractTracks(list) {
    if (!list || !Array.isArray(list.captionTracks)) return [];
    const translationLanguages = Array.isArray(list.translationLanguages)
      ? list.translationLanguages
      : [];
    return list.captionTracks.map(tr => ({
      baseUrl: tr.baseUrl || '',
      // Some older payloads use simpleText, newer ones use runs; keep it simple.
      name: (tr.name && (tr.name.simpleText || tr.name.runs && tr.name.runs.map(r => r.text).join(''))) || '',
      languageCode: tr.languageCode || '',
      // YouTube: manual captions have no `kind`; only ASR has kind === 'asr'.
      // Do NOT default to 'asr', or manual and auto become indistinguishable.
      kind: tr.kind || '',
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

  function mergeTracks(preferred, fallback) {
    const map = new Map();
    for (const tr of (preferred || [])) {
      if (!tr.languageCode) continue;
      map.set(tr.languageCode + ':' + tr.kind, tr);
    }
    for (const tr of (fallback || [])) {
      if (!tr.languageCode) continue;
      const key = tr.languageCode + ':' + tr.kind;
      // Prefer the preferred list; only fill in missing languages/kinds.
      if (!map.has(key)) map.set(key, tr);
    }
    return Array.from(map.values());
  }

  function postTracks(tracks) {
    const sig = tracks.map(t => t.languageCode + ':' + t.kind + ':' + (t.translateTo || '')).join('|');
    if (sig !== lastSentSignature || tracks.length !== captionTracksSnapshot.length) {
      captionTracksSnapshot = tracks;
      lastSentSignature = sig;
      window.postMessage({ source: 'MindCapsule', type: 'VIDEO_CAPTIONS', payload: { tracks } }, '*');
    }
  }

  function readCaptions() {
    if (pollTimer) clearTimeout(pollTimer);
    let attempt = 0;
    function tryRead() {
      const tracks = readCaptionsOnce();
      // Merge with any tracks already captured from the network interceptor
      // (timedtext / player endpoint) so those are not lost.
      const merged = mergeTracks(tracks, captionTracksSnapshot);
      postTracks(merged);
      if (!tracks.length && attempt < POLL_DELAYS.length - 1) {
        attempt++;
        pollTimer = setTimeout(tryRead, POLL_DELAYS[attempt] - POLL_DELAYS[attempt - 1]);
      }
    }
    tryRead();
  }

  // ---- network interception: player endpoint + timedtext ----
  function isPlayerUrl(url) {
    return typeof url === 'string' && url.indexOf('/youtubei/v1/player') !== -1;
  }

  function isTimedTextUrl(url) {
    return typeof url === 'string' && url.indexOf('/api/timedtext') !== -1;
  }

  function tracksFromPlayerResponse(data) {
    if (!data) return [];
    const list = data.captions && data.captions.playerCaptionsTracklistRenderer;
    if (list && list.captionTracks) return extractTracks(list);
    // Some response wrappers nest it under playerResponse.
    const nested = data.playerResponse && data.playerResponse.captions && data.playerResponse.captions.playerCaptionsTracklistRenderer;
    return extractTracks(nested);
  }

  // When YouTube renders auto-translated captions (e.g. English video shown
  // with Chinese subtitles), there is often NO separate track in the player
  // response. Instead YouTube fetches /api/timedtext?lang=en&tlang=zh-Hans...
  // We parse that URL into a usable track so the sidebar can fetch the same
  // transcript the player is showing.
  function trackFromTimedTextUrl(fullUrl) {
    try {
      const url = new URL(fullUrl, window.location.href);
      if (!isTimedTextUrl(url.href)) return null;
      const params = url.searchParams;
      const v = params.get('v') || '';
      if (v && v !== currentVideoId()) return null;
      const lang = params.get('lang') || '';
      const tlang = params.get('tlang') || '';
      const caps = params.get('caps') || '';
      const nameParam = params.get('name') || '';
      if (!lang && !tlang) return null;
      // Strip fmt/tlang so fetchTranscript can append its own fmt and translateTo.
      const clean = new URL(url.href);
      clean.searchParams.delete('fmt');
      clean.searchParams.delete('tlang');
      return {
        baseUrl: clean.toString(),
        name: nameParam || (tlang ? `${lang} → ${tlang}` : lang),
        languageCode: tlang || lang,
        kind: caps === 'asr' ? 'asr' : '',
        translateTo: tlang,
        translationLanguages: []
      };
    } catch (e) { return null; }
  }

  function handlePotentialTrackUrl(url) {
    if (!url) return;
    const tr = trackFromTimedTextUrl(url);
    if (tr) {
      captionTracksSnapshot = mergeTracks([tr], captionTracksSnapshot);
      postTracks(captionTracksSnapshot);
    }
  }

  function installNetworkIntercept() {
    if (networkInterceptInstalled) return;
    networkInterceptInstalled = true;

    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      let url = '';
      if (typeof input === 'string') url = input;
      else if (input && (input.url || input.href)) url = input.url || input.href;
      const isPlayer = isPlayerUrl(url);
      const isTimedText = isTimedTextUrl(url);
      if (isTimedText) handlePotentialTrackUrl(url);
      return nativeFetch(input, init).then((response) => {
        if (isPlayer && response && typeof response.clone === 'function') {
          try {
            response.clone().json().then((data) => {
              const tracks = tracksFromPlayerResponse(data);
              if (tracks && tracks.length) {
                captionTracksSnapshot = mergeTracks(tracks, captionTracksSnapshot);
                postTracks(captionTracksSnapshot);
              }
            }).catch(() => {});
          } catch (e) { /* ignore */ }
        }
        return response;
      }).catch((err) => { throw err; });
    };

    const RealXHR = window.XMLHttpRequest;
    if (RealXHR) {
      const realOpen = RealXHR.prototype.open;
      const realSend = RealXHR.prototype.send;
      RealXHR.prototype.open = function (method, url) {
        this.__mcUrl = url || '';
        return realOpen.apply(this, arguments);
      };
      RealXHR.prototype.send = function (body) {
        const url = this.__mcUrl || '';
        const isPlayer = isPlayerUrl(url);
        const isTimedText = isTimedTextUrl(url);
        if (isTimedText) handlePotentialTrackUrl(url);
        if (isPlayer || isTimedText) {
          this.addEventListener('load', () => {
            try {
              if (isPlayer) {
                const data = JSON.parse(this.responseText);
                const tracks = tracksFromPlayerResponse(data);
                if (tracks && tracks.length) {
                  captionTracksSnapshot = mergeTracks(tracks, captionTracksSnapshot);
                  postTracks(captionTracksSnapshot);
                }
              }
            } catch (e) { /* ignore */ }
          });
        }
        return realSend.apply(this, arguments);
      };
    }
  }

  // ---- DOM caption text fallback ----
  // If YouTube refuses to expose track metadata, but captions are actually
  // rendered on screen, collect the visible segments. The sidebar can use
  // this text directly when no formal track is available.
  function startCaptionTextObserver() {
    const seen = new Set();
    function readCaptionText() {
      const segments = document.querySelectorAll('.ytp-caption-segment');
      if (!segments.length) return;
      let changed = false;
      for (const seg of segments) {
        const txt = (seg.textContent || '').trim();
        if (txt && !seen.has(txt)) {
          seen.add(txt);
          changed = true;
        }
      }
      if (changed) {
        const text = Array.from(seen).join(' ');
        window.postMessage({ source: 'MindCapsule', type: 'VIDEO_CAPTION_TEXT', payload: { text, ts: Date.now() } }, '*');
      }
    }
    // Poll periodically (captions are sparse, cheap enough).
    setInterval(readCaptionText, 500);
    try {
      const mo = new MutationObserver(readCaptionText);
      mo.observe(document.body || document.documentElement, { subtree: true, childList: true, characterData: true });
    } catch (e) { /* ignore */ }
  }

  function resetState() {
    lastSentSignature = '';
    captionTracksSnapshot = [];
  }

  // Send initial meta + captions.
  installNetworkIntercept();
  readVideoMetaWithPoll();
  observeTitleChanges();
  readCaptions();
  startCaptionTextObserver();

  // Re-send on SPA navigation.
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      resetState();
      setTimeout(() => { readVideoMeta(); readCaptions(); }, 1200);
    }
  }).observe(document, { subtree: true, childList: true });

  // YouTube fires these custom events when a WATCH page finishes loading the
  // player / navigating between videos. ASR tracks may only be populated then.
  function bindYtEvents() {
    document.addEventListener('yt-page-data-updated', () => {
      resetState();
      readVideoMeta();
      readCaptions();
    });
    document.addEventListener('yt-navigate-finish', () => {
      resetState();
      readVideoMeta();
      readCaptions();
    });
  }

  // Many auto-generated (ASR) caption tracks only appear once the video starts
  // playing. Re-read when playback begins.
  function bindPlayEvents() {
    function onPlay() {
      resetState();
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
      resetState();
      readCaptions();
    } else if (event.data.type === 'REQUEST_VIDEO_META') {
      readVideoMetaWithPoll();
    }
  });
})();
