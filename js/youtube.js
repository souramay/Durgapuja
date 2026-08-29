/* ==========================================================================
   youtube.js — thin wrapper over the YouTube IFrame Player API.

   The iframe is parked off-screen at 1x1 and used purely as an audio
   source. YouTube does not expose its audio to Web Audio, so nothing here
   can analyse the waveform — the visuals run on a tempo clock instead
   (see player.js).
   ========================================================================== */
(function (global) {
  "use strict";

  var API_SRC = "https://www.youtube.com/iframe_api";
  var apiPromise = null;

  function loadAPI() {
    if (apiPromise) return apiPromise;
    apiPromise = new Promise(function (resolve, reject) {
      if (global.YT && global.YT.Player) return resolve(global.YT);

      var prev = global.onYouTubeIframeAPIReady;
      global.onYouTubeIframeAPIReady = function () {
        if (typeof prev === "function") { try { prev(); } catch (e) { void e; } }
        resolve(global.YT);
      };

      var s = document.createElement("script");
      s.src = API_SRC;
      s.async = true;
      s.onerror = function () { reject(new Error("Could not reach YouTube.")); };
      document.head.appendChild(s);

      setTimeout(function () { reject(new Error("YouTube timed out.")); }, 12000);
    });
    return apiPromise;
  }

  /* ---------------------------------------------------------- URL parsing */

  var RE_VIDEO = /^[A-Za-z0-9_-]{11}$/;
  var RE_LIST = /^(?:PL|UU|LL|FL|RD|OL)[A-Za-z0-9_-]{10,}$/;

  function parseSource(raw) {
    if (!raw) return null;
    var s = String(raw).trim();
    if (!s) return null;

    // bare ids first
    if (RE_LIST.test(s)) return { type: "playlist", id: s };
    if (RE_VIDEO.test(s)) return { type: "video", id: s };

    var url;
    try {
      url = new URL(s.indexOf("http") === 0 ? s : "https://" + s);
    } catch (e) {
      void e;
      return null;
    }

    var list = url.searchParams.get("list");
    if (list && RE_LIST.test(list)) return { type: "playlist", id: list };

    var v = url.searchParams.get("v");
    if (v && RE_VIDEO.test(v)) return { type: "video", id: v };

    // youtu.be/ID, /embed/ID, /shorts/ID, /live/ID
    var m = url.pathname.match(/\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
    if (m) return { type: "video", id: m[1] };
    if (/^\/[A-Za-z0-9_-]{11}$/.test(url.pathname) && /youtu\.be$/.test(url.hostname)) {
      return { type: "video", id: url.pathname.slice(1) };
    }
    return null;
  }

  /* ------------------------------------------------------------- source */

  function YouTubeSource(mountId, handlers) {
    this.mountId = mountId;
    this.h = handlers || {};
    this.player = null;
    this.ready = false;
    this.playing = false;
    this.titles = {};          // videoId -> title, filled in as tracks play
    this.ids = [];
    this.fails = 0;
    this.pendingVolume = 80;
    this.muted = false;
    this.dbg = (handlers && handlers.onDebug) || function () {};
    this._want = null;         // source requested before the player was ready
  }

  YouTubeSource.prototype.init = function () {
    var self = this;
    if (this.player) return Promise.resolve(this);

    if (location.protocol === "file:") {
      this.dbg("youtube: blocked — page is on file://, which has no origin the API accepts");
      return Promise.reject(new Error(
        "YouTube playback needs a real server. Run a local server, or deploy to Vercel."
      ));
    }

    return loadAPI().then(function (YT) {
      return new Promise(function (resolve, reject) {
        self.player = new YT.Player(self.mountId, {
          height: "1",
          width: "1",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            iv_load_policy: 3,
            origin: location.origin
          },
          events: {
            onReady: function () {
              self.dbg("youtube: player ready");
              self.ready = true;
              // grant the frame autoplay permission explicitly — without it
              // some browsers refuse to start audio in an embed
              try {
                var f = document.querySelector(".yt-mount iframe");
                if (f) f.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
              } catch (err) { void err; }
              self.player.setVolume(self.pendingVolume);
              if (self._want) { var w = self._want; self._want = null; self.load(w); }
              resolve(self);
            },
            onStateChange: function (e) { self._state(e); },
            onError: function (e) { self._error(e); }
          }
        });
        setTimeout(function () { if (!self.ready) reject(new Error("YouTube player did not start.")); }, 12000);
      });
    });
  };

  YouTubeSource.prototype._state = function (e) {
    var YT = global.YT;
    var s = e.data;

    if (s === YT.PlayerState.PLAYING) {
      this.dbg("youtube: playing");
      this.fails = 0;
      this.playing = true;
      this._announce();
      this.h.onState && this.h.onState(true);
    } else if (s === YT.PlayerState.PAUSED) {
      this.playing = false;
      this.h.onState && this.h.onState(false);
    } else if (s === YT.PlayerState.ENDED) {
      // keep it non-stop: repeat the track, or wrap around at the end
      this.playing = false;
      if (this.repeatOne) { this.seek(0); this.play(); return; }
      var i = this.index(), n = this.count();
      if (n > 1 && i >= n - 1) this.player.playVideoAt(0);
      else this.next();
    } else if (s === YT.PlayerState.CUED) {
      this._announce();
    }
  };

  var ERRORS = {
    2:   "bad video id",
    5:   "HTML5 player error",
    100: "video removed or private",
    101: "embedding disabled by the owner",
    150: "embedding disabled by the owner"
  };

  YouTubeSource.prototype._error = function (e) {
    var self = this;
    this.fails++;
    var n = this.count();
    // getVideoData() is empty for a video that never loaded, so prefer the id
    // we asked for over the one the player thinks it has
    var id = this.queue ? this.queue[this.qi] : "";
    if (!id) { try { id = (this.player.getVideoData() || {}).video_id || ""; } catch (err) { void err; } }
    if (id) this.dead[id] = ERRORS[e.data] || String(e.data);
    this.dbg("youtube: " + (ERRORS[e.data] || "error " + e.data) + (id ? " [" + id + "]" : ""));
    this.lastError = { code: e.data, id: id, reason: ERRORS[e.data] || String(e.data) };

    var limit = this.queue ? Math.min(this.queue.length, 6) : Math.max(3, n);
    if (this.fails >= limit) {
      var names = Object.keys(this.dead);
      this.dbg("youtube: gave up after " + this.fails + " failures — " +
               names.slice(0, 6).join(", ") + (names.length > 6 ? " …" : ""));
      this.h.onFatal && this.h.onFatal(
        this.lastError.code === 2
          ? "Those video IDs are not real YouTube videos."
          : "None of those videos can be embedded."
      );
      return;
    }
    this.h.onSkip && this.h.onSkip(e.data, id);

    // widen the gap between retries so a run of bad ids does not look like
    // a flood of requests
    var wait = Math.min(400 * this.fails, 2500);
    setTimeout(function () { self.next(); }, wait);
  };

  YouTubeSource.prototype._announce = function () {
    if (!this.ready) return;
    var d = null;
    try { d = this.player.getVideoData(); } catch (err) { void err; }
    try { this.ids = this.player.getPlaylist() || []; } catch (err2) { void err2; }
    if (d && d.video_id) this.titles[d.video_id] = d.title;
    var title = (d && d.title && d.title !== "YouTube") ? d.title : "শারদীয়া";
    var author = (d && d.author && d.author !== "YouTube") ? d.author : "pujo radio";
    this.h.onTrack && this.h.onTrack({
      title: title,
      author: author,
      id: d && d.video_id,
      index: this.index(),
      total: this.count()
    });
  };

  /* -------------------------------------------------------------- source */

  /* src: { type:'playlist', id } | { type:'video', id } | { ids:[...] } */
  YouTubeSource.prototype.load = function (src, opts) {
    opts = opts || {};
    if (!this.ready) { this._want = src; return; }
    this.fails = 0;

    var cue = opts.autoplay === false;
    this.queue = null;
    this.qi = 0;
    this.dead = {};

    if (src.type === "playlist") {
      // a playlist id cannot be enumerated without an API key, so YouTube
      // has to drive this one
      this.player[cue ? "cuePlaylist" : "loadPlaylist"]({
        list: src.id, listType: "playlist", index: 0
      });
      try {
        this.player.setLoop(true);
        this.player.setShuffle(!!opts.shuffle);
      } catch (e) { void e; }
      return;
    }

    var ids = src.ids && src.ids.length ? src.ids.slice()
            : src.type === "video" ? [src.id] : [];
    if (!ids.length) return;

    if (opts.shuffle) {
      var preferred = Math.min(8, ids.length);
      var head = ids.slice(0, preferred);
      var tail = ids.slice(preferred);
      var mixed = [];
      while (head.length || tail.length) {
        if (head.length && (tail.length === 0 || Math.random() < 0.82)) {
          var hi = (Math.random() * head.length) | 0;
          mixed.push(head.splice(hi, 1)[0]);
        } else if (tail.length) {
          var ti = (Math.random() * tail.length) | 0;
          mixed.push(tail.splice(ti, 1)[0]);
        }
      }
      ids = mixed;
    }
    this.queue = ids;
    this.dbg("youtube: queue of " + ids.length + " ids, driving them one at a time");
    this._loadAt(0, !cue);
  };

  YouTubeSource.prototype._loadAt = function (i, play) {
    if (!this.queue || !this.queue.length) return;
    var n = this.queue.length;
    var at = ((i % n) + n) % n;

    // walk past anything already known to be dead; requesting those again is
    // exactly what gets the API to start throttling us
    var skipped = 0;
    while (this.dead[this.queue[at]] && skipped < n) {
      at = (at + 1) % n;
      skipped++;
    }
    if (skipped >= n) {
      this.dbg("youtube: every id in the queue has failed");
      this.h.onFatal && this.h.onFatal("None of those videos can be played.");
      return;
    }
    if (skipped) this.dbg("youtube: skipped " + skipped + " known-dead id(s)");

    this.qi = at;
    var id = this.queue[this.qi];
    this.dbg("youtube: loading [" + (this.qi + 1) + "/" + n + "] " + id);
    this.player[play ? "loadVideoById" : "cueVideoById"](id);
  };

  /* ------------------------------------------------------------ controls */

  YouTubeSource.prototype.play = function () { if (this.ready) this.player.playVideo(); };
  YouTubeSource.prototype.pause = function () { if (this.ready) this.player.pauseVideo(); };
  YouTubeSource.prototype.next = function () {
    if (!this.ready) return;
    if (this.queue) this._loadAt(this.qi + 1, true); else this.player.nextVideo();
  };
  YouTubeSource.prototype.prev = function () {
    if (!this.ready) return;
    if (this.queue) this._loadAt(this.qi - 1, true); else this.player.previousVideo();
  };
  YouTubeSource.prototype.playAt = function (i) {
    if (!this.ready) return;
    if (this.queue) this._loadAt(i, true); else this.player.playVideoAt(i);
  };
  YouTubeSource.prototype.seek = function (sec) { if (this.ready) this.player.seekTo(sec, true); };

  YouTubeSource.prototype.setShuffle = function (on) {
    try { this.player.setShuffle(!!on); } catch (e) { void e; }
  };

  YouTubeSource.prototype.setVolume = function (v0to100) {
    this.pendingVolume = v0to100;
    if (!this.ready) return;
    this.player.setVolume(v0to100);
    if (v0to100 > 0 && this.muted) { this.player.unMute(); this.muted = false; }
  };

  YouTubeSource.prototype.setMuted = function (on) {
    this.muted = !!on;
    if (!this.ready) return;
    if (on) this.player.mute(); else this.player.unMute();
  };

  YouTubeSource.prototype.time = function () {
    try { return this.player.getCurrentTime() || 0; } catch (e) { void e; return 0; }
  };
  YouTubeSource.prototype.duration = function () {
    try { return this.player.getDuration() || 0; } catch (e) { void e; return 0; }
  };
  YouTubeSource.prototype.index = function () {
    if (this.queue) return this.qi;
    try { var i = this.player.getPlaylistIndex(); return i < 0 ? 0 : i; } catch (e) { void e; return 0; }
  };
  YouTubeSource.prototype.count = function () {
    if (this.queue) return this.queue.length;
    try { var l = this.player.getPlaylist(); return l ? l.length : 0; } catch (e) { void e; return 0; }
  };
  YouTubeSource.prototype.list = function () {
    if (this.queue) return this.queue.slice();
    try { return this.player.getPlaylist() || []; } catch (e) { void e; return []; }
  };

  YouTubeSource.prototype.destroy = function () {
    try { this.player && this.player.destroy(); } catch (e) { void e; }
    this.player = null; this.ready = false;
  };

  global.YouTubeSource = YouTubeSource;
  global.parseYouTubeSource = parseSource;
})(window);
