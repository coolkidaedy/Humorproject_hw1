function safeProviderError(status, body) {
  const message = typeof body === 'object' && body && 'error' in body ? JSON.stringify(body.error).toLowerCase() : '';
  if (message.includes('api_key_invalid') || message.includes('api key not valid') || status === 401) return 'Gemini rejected the API key. Check GEMINI_API_KEY in Vercel and redeploy. (401/invalid key)';
  if (status === 403) return 'Gemini denied access. Check the API key restrictions and Gemini API permissions in Google AI Studio. (403)';
  if (status === 429) return 'Gemini’s quota or rate limit has been reached. Check Google AI Studio quota or try again later. (429)';
  if (status >= 500) return 'Gemini is temporarily unavailable. Please try again later. (Provider server error)';
  return `Gemini could not generate the requested content (HTTP ${status}).`;
}

function extractText(result) {
  const candidateText = result?.candidates?.flatMap(candidate => candidate?.content?.parts || [])
    .filter(part => typeof part?.text === 'string').map(part => part.text).join('');
  if (candidateText) return candidateText;
  if (typeof result?.output_text === 'string') return result.output_text;
  return result?.steps?.filter(step => step.type === 'model_output').flatMap(step => step.content || [])
    .filter(part => part.type === 'text' && typeof part.text === 'string').map(part => part.text).join('') || '';
}

function parseJson(text) {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
}

export async function generateGeminiJson(prompt, { maxOutputTokens = 3072, temperature = 0.9 } = {}) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('AI generation is not configured on this deployment yet.');
  const configured = process.env.GEMINI_MODEL?.trim().replace(/^models\//, '');
  // Avoid a model-list request on every Vercel cold start. Flash-Lite is the
  // fast path for short game copy; regular Flash remains the quality fallback.
  const models = Array.from(new Set([
    configured,
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
  ].filter(Boolean)));
  let lastError = 'The AI writer is unavailable. Please try again.';
  for (const model of models) {
    let response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: {
          maxOutputTokens, temperature, responseMimeType: 'application/json',
          ...(/^gemini-2\.5-/.test(model)
            ? { thinkingConfig: { thinkingBudget: 0 } }
            : (/^gemini-3|latest$/.test(model) ? { thinkingConfig: { thinkingLevel: 'low' } } : {})),
        } }),
        signal: AbortSignal.timeout(45000), cache: 'no-store',
      });
    } catch { lastError = 'Gemini is temporarily unavailable. Please try again later.'; continue; }
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      lastError = safeProviderError(response.status, body);
      if ([400, 403, 404, 429].includes(response.status) || response.status >= 500) continue;
      break;
    }
    const text = extractText(await response.json());
    if (!text) { lastError = 'The AI could not finish the response. Please try again.'; continue; }
    try { return parseJson(text); }
    catch { lastError = 'The AI returned an unreadable response. Please try again.'; }
  }
  throw new Error(lastError);
}

export function resetGeminiModelCache() {}
