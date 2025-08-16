// FILE: netlify/functions/call-gemini.js
// Node 18+ (Netlify default). Tidak butuh paket tambahan.

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const BASE = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok:false, error:'METHOD_NOT_ALLOWED' }) };
  }

  if (!API_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok:false, error:'MISSING_API_KEY' }) };
  }

  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok:false, error:'INVALID_JSON' }) }; }

  const { action } = payload || {};
  try {
    const { promptText, error } = buildPrompt(action, payload);
    if (error) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok:false, error }) };
    }

    const body = {
      contents: [{ role: 'user', parts: [{ text: promptText }]}],
      generationConfig: {
        temperature: 0.25,
        topP: 0.95,
        maxOutputTokens: 2048
      }
    };

    const res = await fetch(`${BASE}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const j = await res.json();
    if (!res.ok) {
      const errMsg = j?.error?.message || res.statusText || 'GEN_AI_ERROR';
      return { statusCode: res.status, headers: CORS, body: JSON.stringify({ ok:false, error: errMsg }) };
    }

    const text =
      j?.candidates?.[0]?.content?.parts?.map(p=>p?.text).filter(Boolean).join('\n').trim() ||
      j?.candidates?.[0]?.output_text ||
      '';

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok:true, text }) };

  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok:false, error: e.message || 'SERVER_ERROR' }) };
  }
};

// ===== Helpers =====

function buildPrompt(action, data) {
  const t = (s)=> (s||'').toString().trim();

  if (action === 'mimic') {
    const example = t(data.exampleText);
    const fresh   = t(data.newText);
    if (!example || !fresh) return { error:'PROMPT_REQUIRED' };

    const promptText = `
Anda adalah asisten pemformatan laporan berbahasa Indonesia.
Terapkan GAYA/STRUKTUR dari "CONTOH" ke "TEKS BARU". Ikuti heading, list, penomoran, penekanan, dan jarak paragrafnya.
JANGAN mengarang isi baru—hanya ubah penyajian/format.
Kembalikan PLAIN TEXT saja, tanpa penjelasan tambahan.

=== CONTOH (dengan format) ===
${example}

=== TEKS BARU (tanpa format) ===
${fresh}

=== KELUARAN YANG DIMINTA ===
Teks baru dalam format yang meniru CONTOH (bahasa Indonesia, rapi, profesional).
    `.trim();

    return { promptText };
  }

  if (action === 'format') {
    const input = t(data.editorText);
    if (!input) return { error:'PROMPT_REQUIRED' };

    const promptText = `
Rapikan teks berikut menjadi laporan singkat profesional berbahasa Indonesia.
Gunakan heading sewajarnya, daftar berpoin/bernomor jika cocok, dan perjelas angka/tanggal/nama.
Jangan menambah fakta baru.

TEKS:
${input}
    `.trim();

    return { promptText };
  }

  if (action === 'summarize') {
    const input = t(data.editorText);
    if (!input) return { error:'PROMPT_REQUIRED' };

    const promptText = `
Ringkas isi berikut dalam bahasa Indonesia secara padat dan jelas (200–300 kata).
Jika sesuai, susun menjadi beberapa bagian: Fakta Utama, Analisis, Rekomendasi.
Gunakan bullet list untuk poin penting.

TEKS:
${input}
    `.trim();

    return { promptText };
  }

  return { error:'UNKNOWN_ACTION' };
}
