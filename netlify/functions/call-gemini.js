// netlify/functions/call-gemini.js
export async function handler(event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: cors(),
    };
  }

  if (event.httpMethod !== 'POST') {
    return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  try {
    const key =
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY;

    if (!key) {
      return json({ ok: false, error: 'MISSING_API_KEY' }, 500);
    }

    const body = JSON.parse(event.body || '{}');
    const { prompt, base64Data, mimeType } = body;

    if (!prompt || typeof prompt !== 'string') {
      return json({ ok: false, error: 'PROMPT_REQUIRED' }, 400);
    }

    const model = 'gemini-1.5-flash';
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

    const parts = [{ text: prompt }];
    if (base64Data && mimeType) {
      parts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
    }

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.6 },
      }),
    });

    const upstreamJson = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return json(
        { ok: false, error: 'UPSTREAM_ERROR', details: upstreamJson },
        upstream.status
      );
    }

    const text =
      upstreamJson?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        ?.join('') ?? '';

    return json({ ok: true, response: text });
  } catch (err) {
    console.error('call-gemini error:', err);
    return json({ ok: false, error: 'INTERNAL_ERROR' }, 500);
  }
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    // cegah SW/caching iseng
    'Cache-Control': 'no-store',
  };
}

function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: cors(),
    body: JSON.stringify(body),
  };
}
