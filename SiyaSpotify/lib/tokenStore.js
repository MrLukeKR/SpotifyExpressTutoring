// lib/tokenStore.js
// Persists the Spotify OAuth tokens to disk so they survive server restarts.
// This app is single-user/local, so a JSON file is enough — no database needed.
var fs = require('fs');
var path = require('path');

var TOKENS_FILE = path.join(__dirname, '..', 'data', 'tokens.json');

function saveTokens(tokens) {
    fs.mkdirSync(path.dirname(TOKENS_FILE), { recursive: true });
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

function getTokens() {
    try {
        return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    } catch (err) {
        return null;
    }
}

function clearTokens() {
    try {
        fs.unlinkSync(TOKENS_FILE);
    } catch (err) {
        // nothing to clear
    }
}

module.exports = { saveTokens: saveTokens, getTokens: getTokens, clearTokens: clearTokens };
