// public/javascripts/app.js
document.addEventListener('DOMContentLoaded', function () {
  var loginPrompt = document.getElementById('login-prompt');
  var topTracksSection = document.getElementById('top-tracks-section');
  var trackCountInput = document.getElementById('track-count');
  var averageBpmEl = document.getElementById('average-bpm');

  var tracksResults = document.getElementById('top-tracks-results');
  var artistsResults = document.getElementById('artists-results');
  var albumsResults = document.getElementById('albums-results');

  var panels = {
    tracks: document.getElementById('tracks-panel'),
    artists: document.getElementById('artists-panel'),
    albums: document.getElementById('albums-panel')
  };
  var tabButtons = document.querySelectorAll('.tab-button');
  var activeTab = 'tracks';

  function setMessage(container, text) {
    container.innerHTML = '';
    var p = document.createElement('p');
    p.textContent = text;
    container.appendChild(p);
  }

  function renderTrackCard(track) {
    var card = document.createElement('div');
    card.className = 'track-card';

    var img = document.createElement('img');
    img.className = 'track-art';
    img.src = track.albumArt || '';
    img.alt = track.name + ' album art';
    card.appendChild(img);

    var title = document.createElement('p');
    title.className = 'track-title';
    title.textContent = track.name;
    card.appendChild(title);

    var artists = document.createElement('p');
    artists.className = 'track-artists';
    artists.textContent = track.artists;
    card.appendChild(artists);

    var metaParts = [];
    if (track.year) metaParts.push(track.year);
    if (track.bpm) metaParts.push(track.bpm + ' BPM');
    if (track.key) metaParts.push(track.key);

    var meta = document.createElement('p');
    meta.className = 'track-meta';
    meta.textContent = metaParts.length ? metaParts.join(' • ') : 'No audio metadata available';
    card.appendChild(meta);

    return card;
  }

  function renderSongList(tracks, emptyText) {
    var list = document.createElement('ul');
    list.className = 'song-list';
    if (!tracks || tracks.length === 0) {
      var li = document.createElement('li');
      li.textContent = emptyText;
      list.appendChild(li);
      return list;
    }
    tracks.forEach(function (t) {
      var item = document.createElement('li');
      item.textContent = (t.trackNumber ? t.trackNumber + '. ' : '') + t.name;
      list.appendChild(item);
    });
    return list;
  }

  function renderArtistCard(artist) {
    var card = document.createElement('div');
    card.className = 'artist-card';

    var img = document.createElement('img');
    img.className = 'artist-art';
    img.src = artist.image || '';
    img.alt = artist.name + ' photo';
    card.appendChild(img);

    var title = document.createElement('p');
    title.className = 'track-title';
    title.textContent = artist.name;
    card.appendChild(title);

    card.appendChild(renderSongList(artist.topTracks, 'No other tracks found'));

    return card;
  }

  function renderAlbumCard(album) {
    var card = document.createElement('div');
    card.className = 'track-card';

    var img = document.createElement('img');
    img.className = 'track-art';
    img.src = album.image || '';
    img.alt = album.name + ' album art';
    card.appendChild(img);

    var title = document.createElement('p');
    title.className = 'track-title';
    title.textContent = album.name;
    card.appendChild(title);

    var meta = document.createElement('p');
    meta.className = 'track-meta';
    meta.textContent = album.year || '';
    card.appendChild(meta);

    card.appendChild(renderSongList(album.tracks, 'No tracks found'));

    return card;
  }

  function loadTracks(term, count) {
    averageBpmEl.textContent = '';
    setMessage(tracksResults, 'Loading...');

    fetch('/me/top/' + term + '?count=' + count)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.items || data.items.length === 0) {
          setMessage(tracksResults, 'No top tracks found for this time range.');
          return;
        }
        averageBpmEl.textContent = data.averageBpm ? 'Average BPM: ' + data.averageBpm : '';
        tracksResults.innerHTML = '';
        data.items.forEach(function (track) {
          tracksResults.appendChild(renderTrackCard(track));
        });
      })
      .catch(function () {
        setMessage(tracksResults, 'Failed to load top tracks.');
      });
  }

  function loadArtists(term, count) {
    setMessage(artistsResults, 'Loading...');

    fetch('/me/top/' + term + '/artists?count=' + count)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.artists || data.artists.length === 0) {
          setMessage(artistsResults, 'No artists found for this time range.');
          return;
        }
        artistsResults.innerHTML = '';
        data.artists.forEach(function (artist) {
          artistsResults.appendChild(renderArtistCard(artist));
        });
      })
      .catch(function () {
        setMessage(artistsResults, 'Failed to load artists.');
      });
  }

  function loadAlbums(term, count) {
    setMessage(albumsResults, 'Loading...');

    fetch('/me/top/' + term + '/albums?count=' + count)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.albums || data.albums.length === 0) {
          setMessage(albumsResults, 'No albums found for this time range.');
          return;
        }
        albumsResults.innerHTML = '';
        data.albums.forEach(function (album) {
          albumsResults.appendChild(renderAlbumCard(album));
        });
      })
      .catch(function () {
        setMessage(albumsResults, 'Failed to load albums.');
      });
  }

  fetch('/auth/status')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.authenticated) {
        loginPrompt.hidden = true;
        topTracksSection.hidden = false;
      }
    });

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      activeTab = btn.getAttribute('data-tab');
      tabButtons.forEach(function (b) { b.classList.toggle('active', b === btn); });
      Object.keys(panels).forEach(function (key) { panels[key].hidden = key !== activeTab; });
    });
  });

  topTracksSection.addEventListener('click', function (event) {
    var term = event.target.getAttribute('data-term');
    if (!term) return;

    var count = parseInt(trackCountInput.value, 10);
    if (isNaN(count) || count < 1) count = 20;

    if (activeTab === 'tracks') {
      loadTracks(term, count);
    } else if (activeTab === 'artists') {
      loadArtists(term, count);
    } else if (activeTab === 'albums') {
      loadAlbums(term, count);
    }
  });
});
