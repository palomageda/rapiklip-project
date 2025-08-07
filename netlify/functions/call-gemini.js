// File: netlify/functions/call-gemini.js

// Menggunakan node-fetch untuk melakukan panggilan API di lingkungan Node.js
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // 1. Keamanan: Hanya izinkan metode POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 2. Ambil kunci API rahasia dari environment variables Netlify
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Kunci API Gemini tidak diatur di server.' }) };
    }

    try {
        // 3. Ambil data (prompt dan gambar) yang dikirim dari frontend
        const { prompt, base64Data, mimeType } = JSON.parse(event.body);

        if (!prompt || !base64Data || !mimeType) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Data yang dikirim tidak lengkap.' }) };
        }

        // 4. Siapkan payload untuk dikirim ke API Gemini
        const payload = {
            contents: [{
                role: "user",
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType, data: base64Data } }
                ]
            }],
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

        // 5. Lakukan panggilan ke API Gemini yang sesungguhnya
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            console.error("Gemini API Error:", error);
            return { statusCode: 500, body: JSON.stringify({ error: 'Gagal mendapatkan respons dari AI.' }) };
        }

        const result = await response.json();

        // 6. Ekstrak dan kirim kembali teks jawaban ke frontend
        const textResponse = result.candidates[0].content.parts[0].text;
        return {
            statusCode: 200,
            body: JSON.stringify({ response: textResponse }),
        };

    } catch (error) {
        console.error('Error in Netlify function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Terjadi kesalahan internal pada server.' }),
        };
    }
};
