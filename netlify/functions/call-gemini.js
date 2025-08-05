// This is a serverless function that acts as a secure proxy to the Google Gemini API.

exports.handler = async function (event) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Get the user's prompt from the request body
    const { prompt } = JSON.parse(event.body);
    if (!prompt) {
      return { statusCode: 400, body: 'Prompt is required' };
    }

    // Get the secret API key from Netlify's environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        // This error is for the developer, not the user.
        return { statusCode: 500, body: 'API key is not set on the server.' };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    // Call the Google Gemini API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Google API Error:", errorData);
        return { statusCode: response.status, body: JSON.stringify(errorData) };
    }

    const result = await response.json();

    // Send the result back to the user's browser
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('Internal Server Error:', error);
    return { statusCode: 500, body: 'An internal error occurred.' };
  }
};
