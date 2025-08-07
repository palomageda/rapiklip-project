// This function handles the user's return from Twitter after authorization.
// It exchanges the temporary code for a permanent access token.

const fetch = require('node-fetch'); // You might need to install this dependency if not available in Netlify's environment

exports.handler = async function (event) {
  const { code, state } = event.queryStringParameters;
  
  // Retrieve the state and code_verifier from the cookies
  const cookies = event.headers.cookie || '';
  const storedState = cookies.split('; ').find(c => c.startsWith('twitter_oauth_state='))?.split('=')[1];
  const codeVerifier = cookies.split('; ').find(c => c.startsWith('twitter_code_verifier='))?.split('=')[1];

  // Security check: ensure the state matches
  if (!state || !storedState || state !== storedState) {
    return {
      statusCode: 400,
      body: 'State mismatch. Possible CSRF attack.',
    };
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  const redirectUri = `${process.env.URL}/.netlify/functions/twitter-auth-callback`;

  // Prepare the request to exchange the code for an access token
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
      return {
        statusCode: response.status,
        body: `Failed to get access token from Twitter: ${errorBody}`,
      };
    }

    const tokenData = await response.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // TODO: Securely store the accessToken and refreshToken in your database (e.g., Firestore)
    // associated with the logged-in user's ID. This is a critical next step.
    
    // For now, redirect the user back to the main page with a success message
    // In a real app, you'd likely store the token and then redirect.
    return {
      statusCode: 302,
      headers: {
        'Location': '/', // Redirect to the homepage
        // Clear the state and verifier cookies
        'Set-Cookie': 'twitter_oauth_state=; Path=/; Max-Age=0',
        'Cache-Control': 'no-cache'
      },
       multiValueHeaders: {
        'Set-Cookie': [
            'twitter_oauth_state=; Path=/; Max-Age=0',
            'twitter_code_verifier=; Path=/; Max-Age=0'
        ]
      },
      body: 'Authentication successful! Redirecting...',
    };

  } catch (error) {
    console.error('Error during token exchange:', error);
    return {
      statusCode: 500,
      body: 'An internal error occurred during authentication.',
    };
  }
};
