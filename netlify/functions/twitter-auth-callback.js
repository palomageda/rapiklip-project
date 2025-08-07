// netlify/functions/twitter-auth-callback.js
const cookie = require('cookie');
const fetch = require('node-fetch'); // Make sure to install: npm install node-fetch
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// Initialize Firebase Admin SDK
// You need to create a service account in Firebase and store the JSON key as a Netlify environment variable
try {
    if (!initializeApp.length) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        initializeApp({
            credential: cert(serviceAccount)
        });
    }
} catch (e) {
    console.error('Firebase Admin initialization error', e.stack);
}


exports.handler = async (event, context) => {
    const { code, state } = event.queryStringParameters;
    const cookies = cookie.parse(event.headers.cookie || '');
    const storedState = cookies.twitter_oauth_state;
    const codeVerifier = cookies.twitter_code_verifier;

    // 1. Verify the state parameter
    if (!state || !storedState || state !== storedState) {
        return {
            statusCode: 400,
            body: 'State mismatch error. Possible CSRF attack.',
        };
    }

    // 2. Exchange authorization code for an access token
    const twitterClientId = process.env.TWITTER_CLIENT_ID;
    const twitterClientSecret = process.env.TWITTER_CLIENT_SECRET;
    const redirectUri = `${new URL(event.rawUrl).origin}/.netlify/functions/twitter-auth-callback`;

    const authHeader = 'Basic ' + Buffer.from(`${twitterClientId}:${twitterClientSecret}`).toString('base64');

    try {
        const response = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': authHeader,
            },
            body: new URLSearchParams({
                'code': code,
                'grant_type': 'authorization_code',
                'client_id': twitterClientId,
                'redirect_uri': redirectUri,
                'code_verifier': codeVerifier,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Twitter API error: ${response.status} ${errorBody}`);
        }

        const tokenData = await response.json();
        const { access_token, refresh_token } = tokenData;

        // 3. Get the Netlify Identity user (or Firebase user)
        // This part depends on how you manage users. Let's assume Firebase Auth on the client-side.
        // We need to get the user's UID. The most secure way is to have the user already logged in.
        // For this example, we'll assume the client-side has authenticated with Firebase,
        // and we need a way to get that user's UID here. A common pattern is to pass a token.
        // For simplicity, we'll redirect and let the client-side handle the final step.
        // A more robust solution involves custom tokens.

        // Let's get the user info from Twitter
        const userResponse = await fetch('https://api.twitter.com/2/users/me', {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });
        const twitterUser = await userResponse.json();
        const twitterUserId = twitterUser.data.id;
        
        // This part is tricky without a logged-in user context.
        // The best approach is to have the user log into your app FIRST.
        // The `context.clientContext.user` would be available if using Netlify Identity.
        // Since we are using Firebase, we'll need the client to provide its UID.
        // For now, let's assume we can get it. A real implementation would need a secure way to get this.
        // A simple (but less secure) way is to store it in a cookie before redirecting.
        //
        // **IMPORTANT**: You must find a secure way to associate this with your Firebase user.
        // For now, we'll just show a success page. A real app would save the tokens.
        
        // --- HOW TO SAVE TO FIRESTORE (Example) ---
        /*
        const firebaseToken = cookies.fb_token; // Assume you set this cookie on the client
        const decodedToken = await getAuth().verifyIdToken(firebaseToken);
        const uid = decodedToken.uid;

        const db = getFirestore();
        await db.collection('users').doc(uid).set({
            twitterConnected: true,
            twitterUserId: twitterUserId,
            // IMPORTANT: Encrypt these tokens before saving!
            twitterAccessToken: access_token, // Should be encrypted
            twitterRefreshToken: refresh_token, // Should be encrypted
        }, { merge: true });
        */
        
        // 4. Redirect back to the app's settings page
        const appUrl = new URL(event.rawUrl).origin;
        return {
            statusCode: 302,
            headers: {
                'Location': `${appUrl}/#settings?twitter_connected=true`, // Redirect to a page that can show a success message
                // Clear cookies
                'Set-Cookie': [
                    'twitter_oauth_state=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
                    'twitter_code_verifier=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
                ].join(', ')
            }
        };

    } catch (error) {
        console.error('Error in Twitter auth callback:', error);
        return {
            statusCode: 500,
            body: 'An internal error occurred during Twitter authentication.',
        };
    }
};
