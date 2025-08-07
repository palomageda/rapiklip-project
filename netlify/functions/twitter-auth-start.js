// netlify/functions/twitter-auth-start.js
const crypto = require('crypto');

exports.handler = async function (event) {
  // Generate a secure, random state and code verifier
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('hex');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    return { statusCode: 500, body: 'Twitter Client ID not set on server.' };
  }

  // The URL the user will be redirected to on your site after authorizing
  const redirectUri = `${process.env.URL}/.netlify/functions/twitter-auth-callback`;

  // Scopes determine what your app can do on the user's behalf
  const scopes = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'].join(' ');

  // Construct the Twitter authorization URL
  const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  // Store state and code_verifier in a secure, httpOnly cookie
  // This is crucial for security
  const stateCookie = `twitter_oauth_state=${state}; Path=/; HttpOnly; Secure; Max-Age=300`;
  const verifierCookie = `twitter_code_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; Max-Age=300`;

  return {
    statusCode: 302, // Redirect status code
    headers: {
      'Location': authUrl.toString(),
      'Cache-Control': 'no-cache'
    },
    multiValueHeaders: {
        'Set-Cookie': [stateCookie, verifierCookie]
    }
  };
};

