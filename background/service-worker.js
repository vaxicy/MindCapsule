// Import shared scripts before any logic that depends on them.
importScripts('../shared/storage-keys.js');
importScripts('../shared/constants.js');

// MV3 service worker: keep-alive for long AI tasks and cross-origin fetch proxy.
const KEEP_ALIVE_ALARM = 'mc_keepalive';

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEP_ALIVE_ALARM) {
    // Alarm event itself keeps the service worker alive.
  }
});

function startKeepAlive() {
  chrome.alarms.create(KEEP_ALIVE_ALARM, { periodInMinutes: 0.5 });
}

function stopKeepAlive() {
  chrome.alarms.clear(KEEP_ALIVE_ALARM);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'START_ANALYSIS') {
    startKeepAlive();
    handleAnalysis(request.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }))
      .finally(stopKeepAlive);
    return true; // keep channel open for async
  }
});

async function handleAnalysis(payload) {
  const { transcript, videoTitle } = payload;
  const STORAGE_KEYS = self.MC_STORAGE_KEYS || {};
  const settingsKey = STORAGE_KEYS.SETTINGS || 'mc_settings';
  const res = await chrome.storage.local.get(settingsKey);
  const settings = res[settingsKey] || {};

  const { MC_CONSTANTS } = self;
  const openaiEndpoint = MC_CONSTANTS ? MC_CONSTANTS.OPENAI_ENDPOINT : 'https://api.openai.com/v1';
  const openaiDefaultModel = MC_CONSTANTS ? MC_CONSTANTS.OPENAI_DEFAULT_MODEL : 'gpt-4o-mini';
  const endpoint = settings.provider === 'custom_openai'
    ? settings.endpoint
    : settings.provider === 'openai'
      ? openaiEndpoint
      : (MC_CONSTANTS ? MC_CONSTANTS.SILICONFLOW_ENDPOINT : 'https://api.siliconflow.cn/v1');

  const model = settings.provider === 'custom_openai'
    ? (settings.customModel || settings.model)
    : settings.provider === 'openai'
      ? (settings.model || openaiDefaultModel)
      : (settings.model || (MC_CONSTANTS ? MC_CONSTANTS.SILICONFLOW_DEFAULT_MODEL : 'Qwen/Qwen2.5-72B-Instruct'));

  if (!settings.apiKey) throw new Error('API_KEY_MISSING');
  if (!endpoint) throw new Error('ENDPOINT_MISSING');
  if (!model) throw new Error('MODEL_MISSING');

  // Determine output language instruction based on settings.
  const outputLang = settings.outputLang || 'auto';
  let langInstruction = 'Respond in the same language as the transcript.';
  if (outputLang === 'zh') langInstruction = 'Respond in Chinese (中文).';
  else if (outputLang === 'en') langInstruction = 'Respond in English.';

  const systemPrompt = `You are MindCapsule, a learning assistant that converts YouTube transcripts into structured knowledge notes.
Always respond in JSON format with exactly these keys: tldr (one-sentence summary), summary, keyInsights (array), timeline (array of {time, content}), actionItems (array).
Rules:
- "tldr": a single punchy one-sentence takeaway, max 30 words.
- "summary": 3-5 sentences capturing the core idea.
- "keyInsights": 3-5 distinct insights, opinions, or conclusions. Do NOT repeat timeline stories or examples; keep them conceptual.
- "timeline": 3-6 moments, each with "time" as a short timestamp like "2:30" or "0:00" and "content" as one concrete example, story, or point made at that moment. Do NOT put conceptual insights here.
- "actionItems": 2-5 concrete, doable next steps.
- Avoid overlap: a point should appear in either keyInsights OR timeline, never both.
- Each array entry must be a non-empty string (timeline entries use the {time, content} object).
${langInstruction}`;

  const userPrompt = `Video title: ${videoTitle || 'Untitled'}\n\nTranscript:\n${transcript}\n\nConvert this into structured notes with the four sections above.`;

  const controller = new AbortController();
  const totalTimer = setTimeout(() => controller.abort(), 300000); // 5 min hard timeout

  try {
    const fetchRes = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,
        stream: false
      }),
      signal: controller.signal,
      credentials: 'omit'
    });

    if (!fetchRes.ok) {
      const text = await fetchRes.text().catch(() => '');
      throw new Error(`HTTP_${fetchRes.status}: ${text}`);
    }

    const data = await fetchRes.json();
    const raw = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

    try {
      const json = JSON.parse(raw);
      return {
        tldr: json.tldr || '',
        summary: json.summary || '',
        keyInsights: Array.isArray(json.keyInsights) ? json.keyInsights : [],
        timeline: Array.isArray(json.timeline) ? json.timeline : [],
        actionItems: Array.isArray(json.actionItems) ? json.actionItems : []
      };
    } catch (e) {
      return { tldr: '', summary: raw || '', keyInsights: [], timeline: [], actionItems: [] };
    }
  } finally {
    clearTimeout(totalTimer);
  }
}
