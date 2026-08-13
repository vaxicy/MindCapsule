// Unified AI service for SiliconFlow OpenAI-compatible and custom OpenAI endpoints.
// API key is read from chrome.storage.local; never hard-coded.
(function () {
  const { PROVIDERS, SILICONFLOW_ENDPOINT, SILICONFLOW_DEFAULT_MODEL } = window.MC_CONSTANTS;

  async function getSettings() {
    const keys = window.MC_STORAGE_KEYS;
    const res = await chrome.storage.local.get(keys.SETTINGS);
    return res[keys.SETTINGS] || {};
  }

  function buildEndpoint(settings) {
    if (settings.provider === PROVIDERS.CUSTOM_OPENAI) {
      return (settings.endpoint || '').replace(/\/$/, '');
    }
    return SILICONFLOW_ENDPOINT;
  }

  function buildModel(settings) {
    if (settings.provider === PROVIDERS.CUSTOM_OPENAI) {
      return settings.customModel || settings.model || '';
    }
    return settings.model || SILICONFLOW_DEFAULT_MODEL;
  }

  async function chatCompletion(messages, signal) {
    const settings = await getSettings();
    const apiKey = settings.apiKey || '';
    if (!apiKey) throw new Error('API_KEY_MISSING');

    const endpoint = buildEndpoint(settings);
    if (!endpoint) throw new Error('ENDPOINT_MISSING');

    const model = buildModel(settings);
    if (!model) throw new Error('MODEL_MISSING');

    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        stream: false
      }),
      signal,
      credentials: 'omit'
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP_${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  }

  async function generateNotes(transcript, videoTitle, signal) {
    const systemPrompt = `You are MindCapsule, a learning assistant that converts YouTube transcripts into structured knowledge notes.
Always respond in JSON format with exactly these keys: summary, keyInsights (array), timeline (array of {time, content}), actionItems (array).
Respond in the same language as the transcript.`;

    const userPrompt = `Video title: ${videoTitle || 'Untitled'}\n\nTranscript:\n${transcript}\n\nConvert this into structured notes with the four sections above.`;

    const raw = await chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], signal);

    try {
      const json = JSON.parse(raw);
      return {
        summary: json.summary || '',
        keyInsights: Array.isArray(json.keyInsights) ? json.keyInsights : [],
        timeline: Array.isArray(json.timeline) ? json.timeline : [],
        actionItems: Array.isArray(json.actionItems) ? json.actionItems : []
      };
    } catch (e) {
      // Fallback: return the raw text as summary if JSON parsing fails.
      return {
        summary: raw || '',
        keyInsights: [],
        timeline: [],
        actionItems: []
      };
    }
  }

  window.MC_AI = { chatCompletion, generateNotes };
})();
