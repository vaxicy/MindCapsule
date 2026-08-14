// Unified AI service for SiliconFlow OpenAI-compatible and custom OpenAI endpoints.
// API key is read from chrome.storage.local; never hard-coded.
(function () {
  // Strip markdown code fences and any stray prose from a model response so we
  // can reliably JSON.parse it even when the model wraps the payload in ```json.
  function cleanJson(raw) {
    if (raw == null) return '';
    let s = String(raw).trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      s = s.slice(first, last + 1);
    }
    return s.trim();
  }
  const { PROVIDERS, SILICONFLOW_ENDPOINT, SILICONFLOW_DEFAULT_MODEL, OPENAI_ENDPOINT, OPENAI_DEFAULT_MODEL } = window.MC_CONSTANTS;

  async function getSettings() {
    const keys = window.MC_STORAGE_KEYS;
    const res = await chrome.storage.local.get(keys.SETTINGS);
    return res[keys.SETTINGS] || {};
  }

  function buildEndpoint(settings) {
    if (settings.provider === PROVIDERS.CUSTOM_OPENAI) {
      return (settings.endpoint || '').replace(/\/$/, '');
    }
    if (settings.provider === PROVIDERS.OPENAI) {
      return OPENAI_ENDPOINT;
    }
    return SILICONFLOW_ENDPOINT;
  }

  function buildModel(settings) {
    if (settings.provider === PROVIDERS.CUSTOM_OPENAI) {
      return settings.customModel || settings.model || '';
    }
    if (settings.provider === PROVIDERS.OPENAI) {
      return settings.model || OPENAI_DEFAULT_MODEL;
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
    const settings = await getSettings();
    const outputLang = settings.outputLang || 'auto';
    let langInstruction = 'Respond in the same language as the transcript.';
    if (outputLang === 'zh') langInstruction = 'Respond in Chinese (中文).';
    else if (outputLang === 'en') langInstruction = 'Respond in English.';

    const systemPrompt = `You are MindCapsule, a learning assistant that converts YouTube transcripts into structured knowledge notes.
Always respond in JSON format with exactly these keys: tldr (one-sentence summary), summary, keyInsights (array), timeline (array of {time, content}), actionItems (array).
CRITICAL: Respond with ONLY raw JSON and nothing else. No markdown code blocks, no explanations, no commentary before or after the JSON.
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

    const raw = await chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], signal);

    try {
      const json = JSON.parse(cleanJson(raw));
      return {
        tldr: json.tldr || '',
        summary: json.summary || '',
        keyInsights: Array.isArray(json.keyInsights) ? json.keyInsights : [],
        timeline: Array.isArray(json.timeline) ? json.timeline : [],
        actionItems: Array.isArray(json.actionItems) ? json.actionItems : []
      };
    } catch (e) {
      // Fallback: return the raw text as summary if JSON parsing fails.
      try {
        const json = JSON.parse(cleanJson(raw));
        return {
          tldr: json.tldr || '',
          summary: json.summary || '',
          keyInsights: Array.isArray(json.keyInsights) ? json.keyInsights : [],
          timeline: Array.isArray(json.timeline) ? json.timeline : [],
          actionItems: Array.isArray(json.actionItems) ? json.actionItems : []
        };
      } catch (_) {
        return {
          summary: raw || '',
          keyInsights: [],
          timeline: [],
          actionItems: []
        };
      }
    }
  }

  window.MC_AI = { chatCompletion, generateNotes };
})();
