// Runtime UI i18n for popup/options/sidebar. _locales handles store metadata.
const I18N = Object.freeze({
  en: {
    settingsTitle: 'MindCapsule Settings',
    provider: 'AI Provider',
    siliconFlow: 'SiliconFlow',
    openAI: 'OpenAI',
    openAIModel: 'OpenAI Default Model',
    customOpenAI: 'OpenAI Compatible',
    apiKey: 'API Key',
    endpoint: 'Endpoint URL',
    model: 'Model',
    siliconFlowModel: 'SiliconFlow Default Model',
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
    copyMarkdown: 'Copy Markdown',
    downloadMarkdown: 'Download Markdown',
    exportFailed: 'Export failed',
    langSettings: 'Language settings',
    captionTip: 'Prefer English (auto-generated) captions for best results.',
    captionToggleHint: 'No captions? Turn YouTube subtitles (CC) off, then on again.'
  },
  zh: {
    settingsTitle: 'MindCapsule 设置',
    provider: 'AI 服务商',
    siliconFlow: '硅基流动',
    openAI: 'OpenAI',
    openAIModel: 'OpenAI 默认模型',
    customOpenAI: 'OpenAI 兼容接口',
    apiKey: 'API Key',
    endpoint: '接口地址',
    model: '模型',
    siliconFlowModel: '硅基流动默认模型',
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
    copyMarkdown: '复制 Markdown',
    downloadMarkdown: '下载 Markdown',
    exportFailed: '导出失败',
    langSettings: '语言设置',
    captionTip: '建议使用英语（自动生成）字幕，识别效果最佳。',
    captionToggleHint: '未检测到字幕？请关闭后再打开 YouTube 字幕（CC）。'
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

if (typeof window !== 'undefined') {
  window.MC_I18N = I18N;
  window.MC_T = t;
  window.MC_LANG = getLang;
  window.MC_LOAD_LANG = loadStoredLang;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { I18N, t, getLang, loadStoredLang };
}
