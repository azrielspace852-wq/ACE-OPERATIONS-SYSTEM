// providers/ai.provider.js
/**
 * AI Provider abstraction layer
 * Supports: Groq, DeepSeek, OpenAI, Anthropic
 */

function throwError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

export async function chat(config) {
  const { provider, model, apiKey, messages, systemPrompt, temperature, maxTokens } = config;

  // Validate required fields
  if (!provider) throwError('Provider is required', 400);
  if (!apiKey) throwError('API key is required', 400);
  if (!messages || !Array.isArray(messages)) {
    throwError('Messages array is required', 400);
  }

  const fullMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  const urls = {
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
    openai: 'https://api.openai.com/v1/chat/completions',
    anthropic: 'https://api.anthropic.com/v1/messages',
  };

  const url = urls[provider] || urls.groq;
  let body;
  const headers = { 'Content-Type': 'application/json' };

  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    const filteredMessages = fullMessages.filter(m => m.role !== 'system');
    body = JSON.stringify({
      model: model || 'claude-3-sonnet-20240229',
      messages: filteredMessages,
      system: systemPrompt || '',
      max_tokens: maxTokens || 4096,
      temperature: temperature || 0.7,
    });
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
    const modelMap = {
      groq: model || 'mixtral-8x7b-32768',
      deepseek: model || 'deepseek-chat',
      openai: model || 'gpt-4o-mini',
    };
    const selectedModel = modelMap[provider] || model || 'mixtral-8x7b-32768';
    body = JSON.stringify({
      model: selectedModel,
      messages: fullMessages,
      temperature: temperature || 0.7,
      max_tokens: maxTokens || 4096,
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 detik

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `AI Provider error: ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        errorMsg = errJson.error?.message || errJson.message || errorMsg;
      } catch (_) {
        errorMsg = errText || errorMsg;
      }
      // Jika error dari provider (400-an) vs server error (500-an)
      const status = response.status >= 500 ? 502 : 400;
      throwError(errorMsg, status);
    }

    const data = await response.json();
    let reply;
    if (provider === 'anthropic') {
      reply = data.content?.[0]?.text || 'Tidak ada respons dari Claude.';
    } else {
      reply = data.choices?.[0]?.message?.content || 'Tidak ada respons dari AI.';
    }
    return reply.trim();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throwError('Request timeout: Provider AI tidak merespon dalam 60 detik.', 504);
    }
    if (err.message.includes('fetch') || err.message.includes('network')) {
      throwError('Network error: Tidak dapat terhubung ke provider AI.', 502);
    }
    // Jika sudah throwError, teruskan
    if (err.statusCode) throw err;
    throwError('AI service error: ' + err.message, 500);
  }
}