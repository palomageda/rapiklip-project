// netlify/functions/oauth-x-start.js
import crypto from 'crypto';

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
}

export async function handler() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());

  const stateRaw = `${crypto.randomUUID()}.${Date.now()}`;
  const sig = b64url(crypto.createHmac('sha256', process.env.SESSION_SECRET).update(stateRaw).digest());
  const state = `${stateRaw}.${sig}`;

  const url = new URL('https://x.com/i/oauth2/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', process.env.X_CLIENT_ID);
  url.searchParams.set('redirect_uri', process.env.X_REDIRECT_URI); // https://mediadash.id/.netlify/functions/oauth-x-callback
  url.searchParams.set('scope', 'tweet.read tweet.write users.read offline.access');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  const cookie = `x_pkce_verifier=${verifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
  return { statusCode: 302, headers: { Location: url.toString(), 'Set-Cookie': cookie } };
}
