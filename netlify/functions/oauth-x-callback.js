// netlify/functions/oauth-x-callback.js
import crypto from 'crypto';
import { initAdmin, getFirestore, getAuth } from './_shared/firebaseAdmin.js';

function b64url(buf){ return buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function getCookie(event, name) {
  const raw = event.headers.cookie || event.headers.Cookie || '';
  const m = raw.match(new RegExp(`${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : '';
}
function verifyState(state) {
  try {
    const [id, ts, sig] = state.split('.');
    const data = `${id}.${ts}`;
    const expect = b64url(crypto.createHmac('sha256', process.env.SESSION_SECRET).update(data).digest());
    return sig === expect;
  } catch { return false; }
}

export async function handler(event) {
  const qp = event.queryStringParameters || {};
  const { code, state } = qp;
  if (!code || !state) return { statusCode: 400, body: 'missing code/state' };
  if (!verifyState(state)) return { statusCode: 400, body: 'bad state' };

  const verifier = getCookie(event, 'x_pkce_verifier');
  if (!verifier) return { statusCode: 400, body: 'missing verifier' };

  const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.X_CLIENT_ID,
      redirect_uri: process.env.X_REDIRECT_URI,
      code_verifier: verifier,
      code,
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok) return { statusCode: tokenRes.status, body: JSON.stringify(tokens) };

  let uid = 'unknown';
  try {
    initAdmin();
    const authz = event.headers.authorization || event.headers.Authorization || '';
    const m = authz.match(/^Bearer\s+(.+)/);
    if (m) {
      const idToken = m[1];
      const auth = getAuth();
      const decoded = await auth.verifyIdToken(idToken);
      uid = decoded.uid;
    }
  } catch {}

  initAdmin();
  const db = getFirestore();
  await db.doc(`connections/${uid}_x`).set({
    uid,
    provider: 'x',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenType: tokens.token_type,
    expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
    updatedAt: Date.now(),
  }, { merge: true });

  return { statusCode: 302, headers: { Location: '/' } };
}
