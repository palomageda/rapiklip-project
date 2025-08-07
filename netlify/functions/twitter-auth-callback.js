// netlify/functions/twitter-auth-callback.js
exports.handler = async function (event) {
  const { code, state } = event.queryStringParameters;
  
  const cookies = event.headers.cookie || '';
  const storedState = cookies.split('; ').find(c => c.startsWith('twitter_oauth_state='))?.split('=')[1];
  const codeVerifier = cookies.split('; ').find(c => c.startsWith('twitter_code_verifier='))?.split('=')[1];

  if (!state || !storedState || state !== storedState) {
    return { statusCode: 400, body: 'State mismatch. Possible CSRF attack.' };
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  const redirectUri = `${process.env.URL}/.netlify/functions/twitter-auth-callback`;

  const tokenUrl = 'https://api.twitter.com/2/oauth2/token';
  const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const params = new URLSearchParams();
  params.append('code', code);
  params.append('grant_type', 'authorization_code');
  params.append('redirect_uri', redirectUri);
  params.append('code_verifier', codeVerifier);

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader,
      },
      body: params,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Twitter API Error:', errorBody);
      return { statusCode: response.status, body: `Failed to get access token: ${errorBody}` };
    }

    const tokenData = await response.json();
    // TODO: Securely store these tokens in Firestore, associated with the user.
    
    return {
      statusCode: 302,
      headers: {
        'Location': '/', // Redirect to the homepage
        'Cache-Control': 'no-cache'
      },
       multiValueHeaders: {
        'Set-Cookie': [
            'twitter_oauth_state=; Path=/; Max-Age=0',
            'twitter_code_verifier=; Path=/; Max-Age=0'
        ]
      }
    };
  } catch (error) {
    console.error('Error during token exchange:', error);
    return { statusCode: 500, body: 'An internal error occurred.' };
  }
};
