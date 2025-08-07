// netlify/functions/twitter-auth-start.js
const crypto = require('crypto');
const cookie = require('cookie');

// Helper function to create a base64 encoded string
const base64URLEncode = (str) => {
    return str.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

// Helper function to create a sha256 hash
const sha256 = (buffer) => {
    return crypto.createHash('sha256').update(buffer).digest();
};

exports.handler = async (event, context) => {
    // Generate a random state and code verifier
    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = base64URLEncode(crypto.randomBytes(32));
    
    // Create a code challenge from the verifier
    const codeChallenge = base64URLEncode(sha256(codeVerifier));

    // Get your Client ID from environment variables
    const twitterClientId = process.env.TWITTER_CLIENT_ID;

    // Define the redirect URI, must match your Twitter app settings
    const redirectUri = `${new URL(event.rawUrl).origin}/.netlify/functions/twitter-auth-callback`;

    // Define the scopes your app needs
    const scopes = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'].join(' ');

    // Construct the authorization URL
    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', twitterClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // Store the state and code_verifier in a secure, httpOnly cookie
    const cookies = [
        cookie.serialize('twitter_oauth_state', state, {
            secure: true,
            httpOnly: true,
            path: '/',
            maxAge: 60 * 15 // 15 minutes
        }),
        cookie.serialize('twitter_code_verifier', codeVerifier, {
            secure: true,
            httpOnly: true,
            path: '/',
            maxAge: 60 * 15 // 15 minutes
        })
    ];

    // Redirect the user to the authorization URL
    return {
        statusCode: 302,
        headers: {
            'Location': authUrl.toString(),
            'Set-Cookie': cookies,
        },
    };
};
