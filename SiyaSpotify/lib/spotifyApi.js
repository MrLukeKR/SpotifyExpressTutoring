// lib/spotifyApi.js
// Helper for making authenticated calls to the Spotify Web API using the
// token saved by routes/auth.js. Refreshes the access token automatically
// when it has expired.
var querystring = require('querystring');
var tokenStore = require('./tokenStore');

var client_id = process.env.CLIENT_ID || '';
var client_secret = process.env.CLIENT_SECRET || '';

async function refreshAccessToken(refresh_token) {
    var response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')
        },
        body: querystring.stringify({
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        })
    });

    var data = await response.json();
    if (!response.ok) {
        throw new Error('Failed to refresh Spotify token: ' + (data.error_description || data.error));
    }

    var tokens = tokenStore.getTokens();
    var updated = {
        access_token: data.access_token,
        // Spotify only returns a new refresh_token sometimes; keep the old one otherwise.
        refresh_token: data.refresh_token || (tokens && tokens.refresh_token),
        expires_in: data.expires_in,
        expires_at: Date.now() + data.expires_in * 1000
    };
    tokenStore.saveTokens(updated);
    return updated;
}

// Returns a valid (non-expired) access token, refreshing it first if needed.
async function getValidAccessToken() {
    var tokens = tokenStore.getTokens();
    if (!tokens || !tokens.access_token) {
        throw new Error('No Spotify tokens saved yet. Visit /login first.');
    }

    // Refresh a little early (60s buffer) to avoid racing against expiry.
    if (Date.now() > tokens.expires_at - 60000) {
        if (!tokens.refresh_token) {
            throw new Error('Access token expired and no refresh token is available. Visit /login again.');
        }
        tokens = await refreshAccessToken(tokens.refresh_token);
    }

    return tokens.access_token;
}

// Calls a Spotify Web API endpoint (e.g. "/me", "/me/player/currently-playing")
// with the stored access token attached.
async function spotifyFetch(endpoint, options) {
    options = options || {};
    var accessToken = await getValidAccessToken();

    var response = await fetch('https://api.spotify.com/v1' + endpoint, Object.assign({}, options, {
        headers: Object.assign({}, options.headers, {
            'Authorization': 'Bearer ' + accessToken
        })
    }));

    return response;
}

module.exports = {
    getValidAccessToken: getValidAccessToken,
    spotifyFetch: spotifyFetch
};
