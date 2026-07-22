// routes/auth.js
var express = require('express');
var router = express.Router();
var querystring = require('querystring');
var tokenStore = require('../lib/tokenStore');

// Read client configuration from environment variables
var client_id = process.env.CLIENT_ID || '';
var client_secret = process.env.CLIENT_SECRET || '';
var redirect_uri = process.env.REDIRECT_URI || 'https://localhost:3000/callback';

// Helper function to generate state
function generateRandomString(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// GET /login -> Initiates the OAuth flow
router.get('/login', function (req, res) {
    // Ensure credentials are present
    if (!client_id || !client_secret) {
        return res.status(500).json({ error: 'Missing Spotify client configuration. Check .env.' });
    }
    var state = generateRandomString(16);
    var scope = 'user-read-private user-read-email user-top-read';

    res.cookie('spotify_auth_state', state);

    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        }));
});

// GET /callback -> Receives the auth code and requests the token
router.get('/callback', async function (req, res) {
    var code = req.query.code || null; // Fixed from 'room'
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies['spotify_auth_state'] : null;

    if (state === null || state !== storedState) {
        res.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            }));
    } else {
        res.clearCookie('spotify_auth_state');

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
                },
                body: querystring.stringify({
                    code: code,
                    redirect_uri: redirect_uri,
                    grant_type: 'authorization_code'
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Persist tokens so later API calls (e.g. /me) don't need to
                // re-run the OAuth flow every time.
                tokenStore.saveTokens({
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                    expires_in: data.expires_in,
                    expires_at: Date.now() + data.expires_in * 1000
                });
                res.redirect('/');
            } else {
                res.redirect('/#' + querystring.stringify({ error: 'invalid_token' }));
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to authenticate', details: error.message });
        }
    }
});

// GET /auth/status -> Lets the frontend know whether we have a saved token
router.get('/auth/status', function (req, res) {
    res.json({ authenticated: !!tokenStore.getTokens() });
});

module.exports = router;