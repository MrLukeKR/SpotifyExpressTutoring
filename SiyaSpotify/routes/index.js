var express = require('express');
var router = express.Router();
var path = require('path');
var querystring = require('querystring');
var spotifyApi = require('../lib/spotifyApi');

/* GET home page. */
router.get('/', function(req, res, next) {
  // Serve the static index.html from the public folder
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

/* GET /me -> Example of using the saved token for a further API call. */
router.get('/me', async function (req, res) {
  try {
    var response = await spotifyApi.spotifyFetch('/me');
    var data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

var VALID_TERMS = ['short_term', 'medium_term', 'long_term'];
var DEFAULT_COUNT = 20;
var MAX_COUNT = 200;
var PAGE_LIMIT = 50; // Spotify's max "limit" per /me/top/tracks request
var AUDIO_FEATURES_CHUNK = 100; // Spotify's max ids per /audio-features request
// Get Several Artists, Get Several Albums, and Artist's Top Tracks all return
// 403 Forbidden on this app's current access tier (verified directly against
// Spotify's API), even though the singular Get Artist / Get Album endpoints
// work fine. So artists and albums are fetched one at a time below instead —
// not a style choice, the batch endpoints are just blocked for now.
var MAX_ARTISTS = 20;
var MAX_ALBUMS = 20;
var OTHER_TRACKS_PER_ARTIST = 5;

// Pitch class (0-11) to musical key name, per Spotify's audio-features "key" field.
var KEY_NAMES = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];

function formatKey(pitchClass, mode) {
  if (pitchClass === undefined || pitchClass === null || pitchClass < 0) return null;
  return KEY_NAMES[pitchClass] + (mode === 0 ? ' minor' : ' major');
}

function chunk(array, size) {
  var chunks = [];
  for (var i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function parseCount(rawCount) {
  var count = parseInt(rawCount, 10);
  if (isNaN(count) || count < 1) count = DEFAULT_COUNT;
  return Math.min(count, MAX_COUNT);
}

// Pages through Spotify's /me/top/tracks in batches of 50 via offset until
// `count` tracks are collected (or Spotify runs out). Shared by the tracks,
// artists, and albums routes below since they all start from the same list.
async function fetchTopTracksRaw(term, count) {
  var rawTracks = [];
  var offset = 0;
  while (rawTracks.length < count) {
    var pageLimit = Math.min(PAGE_LIMIT, count - rawTracks.length);
    var response = await spotifyApi.spotifyFetch('/me/top/tracks?' + querystring.stringify({ time_range: term, limit: pageLimit, offset: offset }));
    var data = await response.json();
    if (!response.ok) {
      var err = new Error(data.error && data.error.message || 'Failed to fetch top tracks');
      err.status = response.status;
      err.body = data;
      throw err;
    }

    rawTracks = rawTracks.concat(data.items);
    if (data.items.length < pageLimit) break; // Spotify has no more tracks to give
    offset += pageLimit;
  }
  return rawTracks;
}

var cachedMarket = null;

// Search rejects a "limit" param with "Invalid limit" unless "market" is also
// present (observed directly against Spotify's API). Reuse the user's own
// market, cached after the first lookup — same user for the whole session.
async function getUserMarket() {
  if (cachedMarket) return cachedMarket;
  try {
    var response = await spotifyApi.spotifyFetch('/me');
    var data = await response.json();
    cachedMarket = (response.ok && data.country) || 'US';
  } catch (err) {
    cachedMarket = 'US';
  }
  return cachedMarket;
}

// Artist's Top Tracks is 403 on this app's access tier, so "other songs by
// this artist" is sourced from Search instead (confirmed working), filtered
// down to tracks that actually credit the artist ID we searched for.
async function findOtherTracksByArtist(artistId, artistName) {
  var market = await getUserMarket();
  var response = await spotifyApi.spotifyFetch('/search?' + querystring.stringify({
    q: 'artist:"' + artistName + '"',
    type: 'track',
    market: market,
    // Search's documented max is 50, but this app's access tier 400s above 10.
    limit: 10
  }));
  if (!response.ok) return [];

  var data = await response.json();
  var items = (data.tracks && data.tracks.items) || [];
  return items
    .filter(function (t) { return t.artists.some(function (a) { return a.id === artistId; }); })
    .slice(0, OTHER_TRACKS_PER_ARTIST)
    .map(function (t) { return { id: t.id, name: t.name }; });
}

/* GET /me/top/:term -> Top tracks for the given time range, with album art
 * and audio metadata (BPM, key, year) merged in for grid display.
 * Accepts ?count=N (default 20, capped at 200) and pages through Spotify's
 * /me/top/tracks in batches of 50 (its max per-request limit) via offset. */
router.get('/me/top/:term', async function (req, res) {
  var term = req.params.term;
  if (VALID_TERMS.indexOf(term) === -1) {
    return res.status(400).json({ error: 'Invalid term. Use short_term, medium_term, or long_term.' });
  }

  var count = parseCount(req.query.count);

  try {
    var rawTracks = await fetchTopTracksRaw(term, count);

    var tracks = rawTracks.map(function (track) {
      var images = track.album.images || [];
      return {
        id: track.id,
        name: track.name,
        artists: track.artists.map(function (a) { return a.name; }).join(', '),
        albumArt: images.length ? (images[1] || images[0]).url : null,
        year: track.album.release_date ? track.album.release_date.slice(0, 4) : null,
        bpm: null,
        key: null
      };
    });

    // Audio features requires the "user-top-read"-adjacent /audio-features endpoint,
    // which some newer Spotify apps don't have access to. Fail soft: leave bpm/key null.
    var idChunks = chunk(tracks.map(function (t) { return t.id; }).filter(Boolean), AUDIO_FEATURES_CHUNK);
    for (var i = 0; i < idChunks.length; i++) {
      try {
        var featuresResponse = await spotifyApi.spotifyFetch('/audio-features?ids=' + idChunks[i].join(','));
        if (featuresResponse.ok) {
          var featuresData = await featuresResponse.json();
          var featuresById = {};
          (featuresData.audio_features || []).forEach(function (f) {
            if (f) featuresById[f.id] = f;
          });
          tracks.forEach(function (t) {
            var f = featuresById[t.id];
            if (f) {
              t.bpm = Math.round(f.tempo);
              t.key = formatKey(f.key, f.mode);
            }
          });
        }
      } catch (err) {
        // Ignore — tracks still render with album art/year even without audio features.
      }
    }

    var bpms = tracks.map(function (t) { return t.bpm; }).filter(function (bpm) { return typeof bpm === 'number'; });
    var averageBpm = bpms.length ? Math.round(bpms.reduce(function (sum, bpm) { return sum + bpm; }, 0) / bpms.length) : null;

    res.json({ items: tracks, averageBpm: averageBpm });
  } catch (err) {
    res.status(err.status || 401).json({ error: err.message });
  }
});

/* GET /me/top/:term/artists -> Unique artists behind the top tracks, each with
 * their own "other songs" pulled via Search. Get Artist (singular) works, so
 * that's used for name/image/genres; there's no working batch call for this
 * on the current access tier (see note above), so it's one request per artist. */
router.get('/me/top/:term/artists', async function (req, res) {
  var term = req.params.term;
  if (VALID_TERMS.indexOf(term) === -1) {
    return res.status(400).json({ error: 'Invalid term. Use short_term, medium_term, or long_term.' });
  }

  var count = parseCount(req.query.count);

  try {
    var rawTracks = await fetchTopTracksRaw(term, count);

    var artistIds = [];
    rawTracks.forEach(function (track) {
      track.artists.forEach(function (a) {
        if (artistIds.indexOf(a.id) === -1) artistIds.push(a.id);
      });
    });
    artistIds = artistIds.slice(0, MAX_ARTISTS);

    var artists = [];
    for (var i = 0; i < artistIds.length; i++) {
      var id = artistIds[i];
      var info = null;
      try {
        var artistResponse = await spotifyApi.spotifyFetch('/artists/' + id);
        if (artistResponse.ok) info = await artistResponse.json();
      } catch (err) {
        // Ignore — artist card still renders with placeholder info.
      }

      var images = (info && info.images) || [];
      var name = info ? info.name : 'Unknown artist';

      var topTracks = [];
      try {
        topTracks = await findOtherTracksByArtist(id, name);
      } catch (err) {
        // Ignore — artist card still renders without its "other songs" list.
      }

      artists.push({
        id: id,
        name: name,
        image: images.length ? (images[1] || images[0]).url : null,
        genres: info ? info.genres : [],
        topTracks: topTracks
      });
    }

    res.json({ artists: artists });
  } catch (err) {
    res.status(err.status || 401).json({ error: err.message });
  }
});

/* GET /me/top/:term/albums -> Unique albums behind the top tracks, each with
 * its full tracklist. Get Album (singular) returns the tracklist inline, so
 * no separate album-tracks call is needed — just one request per album (see
 * note above on why the batch "Get Several Albums" call can't be used here). */
router.get('/me/top/:term/albums', async function (req, res) {
  var term = req.params.term;
  if (VALID_TERMS.indexOf(term) === -1) {
    return res.status(400).json({ error: 'Invalid term. Use short_term, medium_term, or long_term.' });
  }

  var count = parseCount(req.query.count);

  try {
    var rawTracks = await fetchTopTracksRaw(term, count);

    var albumIds = [];
    rawTracks.forEach(function (track) {
      if (albumIds.indexOf(track.album.id) === -1) albumIds.push(track.album.id);
    });
    albumIds = albumIds.slice(0, MAX_ALBUMS);

    var albums = [];
    for (var i = 0; i < albumIds.length; i++) {
      var albumResponse = await spotifyApi.spotifyFetch('/albums/' + albumIds[i]);
      if (!albumResponse.ok) continue;

      var album = await albumResponse.json();
      var images = album.images || [];
      albums.push({
        id: album.id,
        name: album.name,
        image: images.length ? (images[1] || images[0]).url : null,
        year: album.release_date ? album.release_date.slice(0, 4) : null,
        tracks: ((album.tracks && album.tracks.items) || []).map(function (t) {
          return { id: t.id, name: t.name, trackNumber: t.track_number };
        })
      });
    }

    res.json({ albums: albums });
  } catch (err) {
    res.status(err.status || 401).json({ error: err.message });
  }
});

module.exports = router;
