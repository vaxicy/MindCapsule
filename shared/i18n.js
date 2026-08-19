// Runtime UI i18n for popup/options/sidebar. _locales handles store metadata.
// Wrapped in an IIFE to avoid classic-script global-scope conflicts with other
// scripts loaded in the same context (popup/options/content script).
const MC_I18N_MODULE = (function () {
  const I18N = Object.freeze({
    en: {
      settingsTitle: 'MindCapsule Settings',
      provider: 'AI Provider',
      siliconFlow: 'SiliconFlow',
      openAI: 'OpenAI',
      openAIModel: 'OpenAI Default Model',
      customOpenAI: 'OpenAI Compatible',
      apiKey: 'API Key',
      apiKeyHint: 'Your key is stored locally and is never uploaded or shared.',
      endpoint: 'Endpoint URL',
      model: 'Model',
      customModel: 'Custom Model',
      save: 'Save Settings',
      saved: 'Settings saved',
      analyzing: 'Analyzing video...',
      summary: 'Summary',
      keyInsights: 'Key Insights',
      timeline: 'Timeline',
      actionItems: 'Action Items',
      noTranscript: 'No transcript found. Please paste captions below or enable transcripts on the video.',
      pasteTranscript: 'Paste transcript / captions',
      autoTranscript: 'Auto-captured {n} words from video subtitles.',
      noCaptions: 'No captions',
      noCaptionsHint: 'No captions? Turn YouTube subtitles (CC) off, then on again.',
      readingCaptions: 'Reading subtitles...',
      autoCaption: 'Auto',
      manualCaption: 'Manual',
      redetectCaptions: 'Re-detect captions',
      collapsePanel: 'Collapse panel',
      expandPanel: 'Expand panel',
      generate: 'Generate Notes',
      copied: 'Copied',
      errorApiKey: 'Please set your API Key in extension settings first.',
      errorGenerate: 'Failed to generate notes. Please check your API Key and network.',
      about: 'About',
      version: 'Version',
      openSettings: 'Open Settings',
      ext_description: 'Turn YouTube videos into structured knowledge capsules with AI.',
      uiLang: 'Interface language',
      uiLangZh: 'Chinese',
      uiLangEn: 'English',
      outputLang: 'Generated language',
      outputLangAuto: 'Follow video',
      outputLangZh: 'Chinese',
      outputLangEn: 'English',
      exportNotes: 'Export Notes',
      copyAs: 'Copy as',
      exportAs: 'Export as',
      copyMarkdown: 'Markdown',
      copyPlainText: 'Plain text',
      exportMarkdown: 'Markdown',
      exportTxt: 'TXT',
      exportPdf: 'PDF',
      copy: 'Copy',
      export: 'Export',
      exportFailed: 'Export failed',
      langSettings: 'Language settings',
      captionTip: 'Prefer English (auto-generated) captions for best results.',
      captionToggleHint: 'No captions? Turn YouTube subtitles (CC) off, then on again.',
      videoTitle: 'Video title',
      videoTitleUnverified: 'Cannot confirm this is the current video title',
      videoTitleMissing: 'Title not captured',
      videoLink: 'Video link',
      generatedAt: 'Generated',
      source: 'Source',
      openOnYoutube: 'Open on YouTube',
      tldr: 'Key Takeaway',
      supportAuthor: 'Support Author',
      supportAuthorTitle: 'Support Author',
      supportAuthorSub: 'Your support keeps development going. Thank you!',
      wechatTip: 'WeChat Tip',
      wechatTipDesc: 'Scan the WeChat tip QR code',
      paypalTip: 'PayPal',
      paypalTipDesc: 'Open PayPal to pay',
      scanToTip: 'Scan to Tip',
      scanHint: 'Scan with WeChat to support the author',
      showKey: 'Show',
      hideKey: 'Hide',
      testConnection: 'Test Connection',
      testConnectionChecking: 'Testing connection...',
      testConnectionSuccess: 'Connection successful',
      testConnectionNoKey: 'Please enter an API Key first',
      testConnectionBadKey: 'Invalid API Key',
      testConnectionBadUrl: 'Invalid endpoint URL',
      testConnectionFail: 'Connection failed',
      testConnectionNetError: 'Network error, please check your connection',
      testConnectionModelMissing: 'Connected, but the model is not in the endpoint list'
    },
    zh: {
      settingsTitle: 'MindCapsule 设置',
      provider: 'AI 服务商',
      siliconFlow: '硅基流动',
      openAI: 'OpenAI',
      openAIModel: 'OpenAI 默认模型',
      customOpenAI: 'OpenAI 兼容接口',
      apiKey: 'API Key',
      apiKeyHint: '密钥仅保存在本地，不会上传或共享。',
      endpoint: '接口地址',
      model: '模型',
      customModel: '自定义模型',
      save: '保存设置',
      saved: '设置已保存',
      analyzing: '正在分析视频...',
      summary: '内容摘要',
      keyInsights: '关键洞察',
      timeline: '时间线',
      actionItems: '行动项',
      noTranscript: '未找到字幕。请在下方粘贴字幕，或确认视频已开启字幕。',
      pasteTranscript: '粘贴字幕 / 文稿',
      autoTranscript: '已从视频字幕自动识别 {n} 字。',
      noCaptions: '无字幕',
      noCaptionsHint: '未检测到字幕？请关闭后再打开 YouTube 字幕（CC）。',
      readingCaptions: '正在读取字幕...',
      autoCaption: '自动',
      manualCaption: '人工',
      redetectCaptions: '重新检测字幕',
      collapsePanel: '收起面板',
      expandPanel: '展开面板',
      generate: '生成笔记',
      copied: '已复制',
      errorApiKey: '请先在扩展设置中填写 API Key。',
      errorGenerate: '生成笔记失败，请检查 API Key 和网络。',
      about: '关于',
      version: '版本',
      openSettings: '打开设置',
      ext_description: '用 AI 把 YouTube 长视频变成结构化知识胶囊。',
      uiLang: '界面语言',
      uiLangZh: '中文',
      uiLangEn: 'English',
      outputLang: '生成语言',
      outputLangAuto: '跟随视频',
      outputLangZh: '中文',
      outputLangEn: 'English',
      exportNotes: '导出笔记',
      copyAs: '复制为',
      exportAs: '导出为',
      copyMarkdown: 'Markdown',
      copyPlainText: '纯文本',
      exportMarkdown: 'Markdown',
      exportTxt: 'TXT',
      exportPdf: 'PDF',
      copy: '复制',
      export: '导出',
      exportFailed: '导出失败',
      langSettings: '语言设置',
      captionTip: '建议使用英语（自动生成）字幕，识别效果最佳。',
      captionToggleHint: '未检测到字幕？请关闭后再打开 YouTube 字幕（CC）。',
      videoTitle: '视频标题',
      videoTitleUnverified: '无法确认是否为当前视频标题',
      videoTitleMissing: '未获取到标题',
      videoLink: '视频链接',
      generatedAt: '生成时间',
      source: '来源',
      openOnYoutube: '在 YouTube 打开',
      tldr: '一句话总结',
      supportAuthor: '支持作者',
      supportAuthorTitle: '支持作者',
      supportAuthorSub: '你的支持是持续开发的动力，谢谢！',
      wechatTip: '微信赞赏',
      wechatTipDesc: '扫码使用微信赞赏码',
      paypalTip: 'PayPal 支持',
      paypalTipDesc: '前往 PayPal 付款',
      scanToTip: '扫码赞赏',
      scanHint: '使用微信扫一扫，赞赏作者',
      showKey: '显示',
      hideKey: '隐藏',
      testConnection: '测试连接',
      testConnectionChecking: '正在测试连接...',
      testConnectionSuccess: '连接成功',
      testConnectionNoKey: '请先填写 API Key',
      testConnectionBadKey: 'API Key 无效',
      testConnectionBadUrl: '接口地址无效',
      testConnectionFail: '连接失败',
      testConnectionNetError: '网络错误，请检查网络连接',
      testConnectionModelMissing: '已连接，但所选模型不在该端点列表中'
    }
  });

  // Asynchronously read the stored UI language from settings.
  // Resolves to 'zh' | 'en'. Falls back to browser language if not set.
  function loadStoredLang() {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        resolve(getLang());
        return;
      }
      const keys = window.MC_STORAGE_KEYS || { SETTINGS: 'mc_settings' };
      chrome.storage.local.get(keys.SETTINGS, (res) => {
        const settings = (res && res[keys.SETTINGS]) || {};
        if (settings.uiLang === 'zh' || settings.uiLang === 'en') {
          resolve(settings.uiLang);
        } else {
          const browser = (navigator.language || 'en').toLowerCase();
          resolve(browser.startsWith('zh') ? 'zh' : 'en');
        }
      });
    });
  }

  function getLang() {
    const url = new URL(window.location.href);
    const urlLang = url.searchParams.get('lang');
    if (urlLang === 'zh' || urlLang === 'en') return urlLang;
    const browser = (navigator.language || 'en').toLowerCase();
    return browser.startsWith('zh') ? 'zh' : 'en';
  }

  function t(key, lang) {
    const l = lang || getLang();
    return (I18N[l] && I18N[l][key]) || I18N.en[key] || key;
  }

  // Shared helper: apply translations to [data-i18n] / [data-i18n-placeholder]
  // elements under `root`, and set the document/html lang attribute when root is
  // the document element. This guarantees all contexts (popup/options/panel)
  // translate their UI in exactly the same way.
  function applyI18nToRoot(root, lang) {
    if (!root || !lang) return;
    if (root === document.documentElement) {
      root.lang = lang === 'zh' ? 'zh-CN' : 'en';
    }
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key, lang);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = t(key, lang);
    });
  }

  // Shared helper: persist the chosen UI language into mc_settings so popup,
  // options page, and YouTube panel stay in sync.
  function persistUILanguage(lang) {
    if (lang !== 'zh' && lang !== 'en') return;
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const keys = window.MC_STORAGE_KEYS || { SETTINGS: 'mc_settings' };
    chrome.storage.local.get({ [keys.SETTINGS]: {} }, (res) => {
      const settings = Object.assign({}, res[keys.SETTINGS] || {}, { uiLang: lang });
      chrome.storage.local.set({ [keys.SETTINGS]: settings });
    });
  }

  if (typeof window !== 'undefined') {
    window.MC_I18N = I18N;
    window.MC_T = t;
    window.MC_LANG = getLang;
    window.MC_LOAD_LANG = loadStoredLang;
    window.MC_APPLY_I18N = applyI18nToRoot;
    window.MC_PERSIST_LANG = persistUILanguage;
  }

  return { I18N, t, getLang, loadStoredLang, applyI18nToRoot, persistUILanguage };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MC_I18N_MODULE;
}
