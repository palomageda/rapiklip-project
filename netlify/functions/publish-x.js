// netlify/functions/publish-x.js
export async function handler(event) {
  try {
    const { accessToken, text } = JSON.parse(event.body || '{}');
    if (!accessToken || !text) return { statusCode: 400, body: 'missing params' };

    const r = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const j = await r.json();
    const url = j?.data?.id ? `https://x.com/i/web/status/${j.data.id}` : undefined;
    return { statusCode: r.ok ? 200 : r.status, body: JSON.stringify({ ok: r.ok, data: j, url }) };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}
