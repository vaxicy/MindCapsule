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
    noCaptionsHint: 'This video has no available subtitles. Enable subtitles or try another video.',
    readingCaptions: 'Reading subtitles...',
    autoCaption: 'Auto',
    manualCaption: 'Manual',
    redetectCaptions: 'Re-detect captions',
    domOnlyTitle: 'Live captions only',
    domOnlyHint: 'Only captured {n} visible characters from currently displayed subtitles. Turn on the video\'s original-language captions for a full transcript.',
    collectingDom: 'Collecting captions as the video plays · {n} chars · {pct}% watched',
    collapsePanel: 'Collapse panel',
    expandPanel: 'Expand panel',
    generate: 'Generate Notes',
    copied: 'Copied',
    errorApiKey: 'Please set your API Key in extension settings first.',
    errorGenerate: 'Failed to generate notes. Please check your API Key and network.',
    about: 'About',
    version: 'Version',
    openSettings: 'Open Settings',
    ext_description: 'Turn YouTube videos into structured knowledge capsules with AI.'
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
    noCaptionsHint: '该视频暂无可用字幕。请开启字幕或更换视频。',
    readingCaptions: '正在读取字幕...',
    autoCaption: '自动',
    manualCaption: '人工',
    redetectCaptions: '重新检测字幕',
    domOnlyTitle: '仅实时字幕',
    domOnlyHint: '仅捕获到当前显示的 {n} 字实时字幕。请开启视频的原始语言字幕以获取完整文稿。',
    collectingDom: '正在边播放边收集字幕 · {n} 字 · 已观看 {pct}%',
    collapsePanel: '收起面板',
    expandPanel: '展开面板',
    generate: '生成笔记',
    copied: '已复制',
    errorApiKey: '请先在扩展设置中填写 API Key。',
    errorGenerate: '生成笔记失败，请检查 API Key 和网络。',
    about: '关于',
    version: '版本',
    openSettings: '打开设置',
    ext_description: '用 AI 把 YouTube 长视频变成结构化知识胶囊。'
  }
});

function getLang() {
  const url = new URL(window.location.href);
  const urlLang = url.searchParams.get('lang');
  if (urlLang === 'zh' || urlLang === 'en') return urlLang;
  const stored = typeof chrome !== 'undefined' && chrome.storage
    ? null // will be loaded asynchronously
    : null;
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
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { I18N, t, getLang };
}
