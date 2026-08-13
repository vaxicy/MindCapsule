// Runs in MAIN WORLD to read page-specific data (videoId, title) and post back.
(function () {
  function readVideoMeta() {
    const url = new URL(window.location.href);
    const videoId = url.searchParams.get('v') || '';
    const titleEl = document.querySelector('h1.title.style-scope.ytd-video-primary-info-renderer');
    const title = titleEl ? titleEl.textContent.trim() : (document.title || '');
    window.postMessage({ source: 'MindCapsule', type: 'VIDEO_META', payload: { videoId, title } }, '*');
  }

  // Send initial meta.
  readVideoMeta();

  // Re-send on SPA navigation.
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(readVideoMeta, 800);
    }
  }).observe(document, { subtree: true, childList: true });
})();
