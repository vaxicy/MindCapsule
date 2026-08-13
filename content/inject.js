// Runs in MAIN WORLD to read page-specific data (videoId, title, captions) and post back.
(function () {
  function readVideoMeta() {
    const url = new URL(window.location.href);
    const videoId = url.searchParams.get('v') || '';
    const titleEl = document.querySelector('h1.title.style-scope.ytd-video-primary-info-renderer');
    const title = titleEl ? titleEl.textContent.trim() : (document.title || '');
    window.postMessage({ source: 'MindCapsule', type: 'VIDEO_META', payload: { videoId, title } }, '*');
  }

  // Read available caption tracks from ytInitialPlayerResponse.
  function readCaptions() {
    let tracks = [];
    try {
      const data = window.ytInitialPlayerResponse;
      const list = data && data.captions && data.captions.playerCaptionsTracklistRenderer;
      if (list && Array.isArray(list.captionTracks)) {
        tracks = list.captionTracks.map(tr => ({
          baseUrl: tr.baseUrl || '',
          name: (tr.name && tr.name.simpleText) || '',
          languageCode: tr.languageCode || '',
          kind: tr.kind || 'asr' // 'asr' = auto-generated
        }));
      }
    } catch (e) { /* ignore */ }
    window.postMessage({ source: 'MindCapsule', type: 'VIDEO_CAPTIONS', payload: { tracks } }, '*');
  }

  // Send initial meta + captions.
  readVideoMeta();
  readCaptions();

  // Re-send on SPA navigation.
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => { readVideoMeta(); readCaptions(); }, 1200);
    }
  }).observe(document, { subtree: true, childList: true });
})();
