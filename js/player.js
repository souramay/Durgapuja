/* ==========================================================================
   player.js — one controller over three sources.

     "local"     audio files served from this site. Same-origin, so the
                 visualiser runs off a real AnalyserNode. Always works.
     "youtube"   the IFrame player. No audio access at all, so the spectrum
                 is modelled from a tempo clock.
     "ensemble"  the synthesised fallback, also a real AnalyserNode.

   Local wins when files are configured, because nothing about it can fail:
   no embedding permissions, no API, no network beyond your own server.
   ========================================================================== */
(function (global) {
  "use strict";

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  var BINS = 64;

  function Player(opts) {
    opts = opts || {};
    this.mode = "ensemble";
    this.bpm = opts.bpm || 96;

    this.ensemble = new global.Ensemble({
      bpm: this.bpm,
      onBeat: this._hit.bind(this)
    });
    this.yt = null;

    // local audio
    this.audio = null;
    this.lctx = null;
    this.lAnalyser = null;
    this.lData = null;
    this.list = [];
    this.idx = 0;

    this.volume = clamp((opts.volume == null ? 80 : opts.volume) / 100, 0, 1);
    this.muted = false;
    this.shuffle = opts.shuffle !== false;
    this.repeatOne = false;
    this.playing = false;

    this.energy = { level: 0, beat: 0 };
    this.onEnergy = opts.onEnergy || function () {};
    this.onState = opts.onState || function () {};
    this.onTrack = opts.onTrack || function () {};
    this.onNotice = opts.onNotice || function () {};
    this.onDebug = opts.onDebug || function () {};

    this._bands = new Array(BINS);
    this._fake = new Array(BINS);
    for (var i = 0; i < BINS; i++) {
      this._bands[i] = 0;
      this._fake[i] = { rate: 0.6 + Math.random() * 2.6, ph: Math.random() * 6.28 };
    }
    this._clock = 0;
    this._lastBeat = -1;

    this.viz = opts.viz || null;
    this.vg = this.viz ? this.viz.getContext("2d") : null;
    this._sizeViz();
    window.addEventListener("resize", this._sizeViz.bind(this));

    this._raf();
  }

  Player.prototype._hit = function (s) { this.energy.beat = Math.max(this.energy.beat, s); };
  Player.prototype._log = function (m) { this.onDebug(m); };

  /* ==================================================== local audio files */

  Player.prototype._buildLocal = function () {
    if (this.audio) return;
    var self = this;

    var a = this.audio = document.getElementById("localAudio") || new Audio();
    a.preload = "auto";
    a.crossOrigin = "anonymous";

    a.addEventListener("ended", function () {
      if (self.repeatOne) { a.currentTime = 0; a.play(); return; }
      self.next();
    });
    a.addEventListener("playing", function () {
      if (self.mode !== "local") return;
      self.playing = true; self.onState(true);
    });
    a.addEventListener("pause", function () {
      if (self.mode !== "local") return;
      self.playing = false; self.onState(false);
    });
    a.addEventListener("error", function () {
      if (self.mode !== "local") return;
      var t = self.list[self.idx];
      self._log("local: FAILED " + (t && t.src));
      self.onNotice("Could not play " + (t ? t.title || t.src : "that file") + " — skipping.");
      self.badLocal = (self.badLocal || 0) + 1;
      if (self.badLocal >= self.list.length) {
        self.onNotice("None of the local files could be played. Using the live ensemble.");
        self.useEnsemble(true);
        return;
      }
      setTimeout(function () { self.next(); }, 300);
    });

    // same-origin audio, so a real analyser works here
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      this.lctx = new AC();
      var srcNode = this.lctx.createMediaElementSource(a);
      this.lAnalyser = this.lctx.createAnalyser();
      this.lAnalyser.fftSize = 512;
      this.lAnalyser.smoothingTimeConstant = 0.75;
      this.lData = new Uint8Array(this.lAnalyser.frequencyBinCount);
      srcNode.connect(this.lAnalyser);
      this.lAnalyser.connect(this.lctx.destination);
      this._log("local: analyser attached");
    } catch (e) {
      this._log("local: analyser unavailable (" + e.message + ") — audio still plays");
      this.lAnalyser = null;
    }
  };

  /* list: [{ src, title, artist }] */
  Player.prototype.useLocal = function (list, autoplay) {
    this._buildLocal();
    if (this.yt) this.yt.pause();
    this.ensemble.stop();

    this.mode = "local";
    this.badLocal = 0;
    this.list = list.slice();
    if (this.shuffle) {
      for (var i = this.list.length - 1; i > 0; i--) {
        var j = (Math.random() * (i + 1)) | 0;
        var t = this.list[i]; this.list[i] = this.list[j]; this.list[j] = t;
      }
    }
    this.idx = 0;
    this._log("local: " + this.list.length + " file(s) queued");
    this._loadLocal(autoplay !== false);
  };

  Player.prototype._loadLocal = function (play) {
    var t = this.list[this.idx];
    if (!t) return;
    this.audio.src = t.src;
    this.audio.volume = this.muted ? 0 : this.volume;
    this.audio.load();
    this.onTrack({ title: t.title || t.src, sub: t.artist || "", index: this.idx, total: this.list.length });
    if (play) {
      var p = this.audio.play();
      if (p && p.catch) {
        var self = this;
        p.catch(function (e) { self._log("local: play() blocked — " + e.name); });
      }
    }
  };

  /* ---------------------------------------------------------- source swap */

  Player.prototype.useEnsemble = function (autoplay) {
    if (this.yt) this.yt.pause();
    if (this.audio) this.audio.pause();
    this.mode = "ensemble";
    this.playing = false;
    this.onTrack({ title: "Dhak Ensemble — live", sub: "রাগ দুর্গা", index: 0, total: 1, live: true });
    if (autoplay !== false) this.play(); else this.onState(false);
  };

  Player.prototype.useYouTube = function (src, autoplay) {
    var self = this;
    if (!this.yt) {
      this.yt = new global.YouTubeSource("ytmount", {
        onState: function (p) {
          if (self.mode !== "youtube") return;
          self.playing = p; self.onState(p);
        },
        onTrack: function (t) {
          if (self.mode !== "youtube") return;
          self.onTrack({ title: t.title, sub: t.author || "YouTube",
                         index: t.index, total: t.total, id: t.id, live: false });
        },
        onSkip: function (code, id) {
          self._log("youtube: error " + code + " on " + id);
          self.onNotice(code === 101 || code === 150
            ? "That video can’t be embedded — skipping."
            : "Track unavailable (" + code + ") — skipping.");
        },
        onFatal: function (msg) {
          self._log("youtube: FATAL — " + msg);
          self.onNotice(msg + " Falling back to the live ensemble.");
          self.useEnsemble(true);
        },
        onDebug: function (m) { self._log(m); }
      });
    }

    this.ensemble.stop();
    if (this.audio) this.audio.pause();
    this.mode = "youtube";
    this.onTrack({ title: "Loading from YouTube…", sub: "", index: 0, total: 0, live: false });

    return this.yt.init().then(function () {
      self.yt.repeatOne = self.repeatOne;
      self.yt.setVolume(Math.round(self.volume * 100));
      self.yt.setMuted(self.muted);
      self.yt.load(src, { shuffle: self.shuffle, autoplay: autoplay !== false });
      if (autoplay !== false) setTimeout(function () { self.yt.play(); }, 260);
    }).catch(function (err) {
      self._log("youtube: init failed — " + err.message);
      self.onNotice(err.message + " Using the live ensemble instead.");
      self.useEnsemble(autoplay);
      throw err;
    });
  };

  /* ------------------------------------------------------------ transport */

  Player.prototype.play = function () {
    if (this.mode === "youtube" && this.yt) this.yt.play();
    else if (this.mode === "local" && this.audio) {
      if (this.lctx && this.lctx.state === "suspended") this.lctx.resume();
      var p = this.audio.play();
      if (p && p.catch) p.catch(function () {});
    } else { this.ensemble.start(); this.playing = true; this.onState(true); }
  };

  Player.prototype.pause = function () {
    if (this.mode === "youtube" && this.yt) this.yt.pause();
    else if (this.mode === "local" && this.audio) this.audio.pause();
    else { this.ensemble.stop(); this.playing = false; this.onState(false); }
  };

  Player.prototype.toggle = function () { this.playing ? this.pause() : this.play(); };

  Player.prototype.next = function () {
    if (this.mode === "youtube" && this.yt) this.yt.next();
    else if (this.mode === "local" && this.list.length) {
      this.idx = (this.idx + 1) % this.list.length;   // wraps: non-stop
      this._loadLocal(true);
    }
  };

  Player.prototype.prev = function () {
    if (this.mode === "youtube" && this.yt) {
      if (this.yt.time() > 4) this.yt.seek(0); else this.yt.prev();
    } else if (this.mode === "local" && this.list.length) {
      if (this.audio.currentTime > 4) { this.audio.currentTime = 0; return; }
      this.idx = (this.idx - 1 + this.list.length) % this.list.length;
      this._loadLocal(true);
    }
  };

  Player.prototype.playAt = function (i) {
    if (this.mode === "youtube" && this.yt) this.yt.playAt(i);
    else if (this.mode === "local") { this.idx = i; this._loadLocal(true); }
  };

  Player.prototype.seekFraction = function (f) {
    if (this.mode === "youtube" && this.yt) {
      var d = this.yt.duration();
      if (d > 0) this.yt.seek(d * clamp(f, 0, 1));
    } else if (this.mode === "local" && this.audio && isFinite(this.audio.duration)) {
      this.audio.currentTime = this.audio.duration * clamp(f, 0, 1);
    }
  };

  Player.prototype.setVolume = function (v) {
    this.volume = clamp(v, 0, 1);
    this.ensemble.setVolume(this.muted ? 0 : this.volume);
    if (this.yt) this.yt.setVolume(Math.round(this.volume * 100));
    if (this.audio) this.audio.volume = this.muted ? 0 : this.volume;
  };

  Player.prototype.setMuted = function (on) {
    this.muted = !!on;
    this.ensemble.setVolume(this.muted ? 0 : this.volume);
    if (this.yt) this.yt.setMuted(this.muted);
    if (this.audio) { this.audio.muted = this.muted; this.audio.volume = this.muted ? 0 : this.volume; }
  };

  Player.prototype.setShuffle = function (on) {
    this.shuffle = !!on;
    if (this.yt) this.yt.setShuffle(this.shuffle);
  };

  Player.prototype.setRepeatOne = function (on) {
    this.repeatOne = !!on;
    if (this.yt) this.yt.repeatOne = this.repeatOne;
  };

  /* Muted autoplay is the only kind browsers allow without a gesture, so the
     site starts muted and unmutes on the first interaction. */
  Player.prototype.audible = function () {
    if (this.muted) return false;
    if (this.mode === "ensemble") {
      var c = this.ensemble.ctx;
      return !!(this.ensemble.playing && c && c.state === "running");
    }
    return this.playing;
  };

  /* Try with sound first — some browsers permit it, and where they do the
     visitor should never have to click. main.js checks a moment later and
     falls back to muted if it was refused. */
  Player.prototype.autostart = function (src, muted) {
    this.setMuted(muted !== false);
    if (src && src.local) { this.useLocal(src.local, true); return Promise.resolve(); }
    if (src) return this.useYouTube(src, true);
    this.useEnsemble(true);
    return Promise.resolve();
  };

  Player.prototype.progress = function () {
    if (this.mode === "youtube" && this.yt) {
      var d = this.yt.duration(), t = this.yt.time();
      return { t: t, d: d, f: d > 0 ? t / d : 0, live: false };
    }
    if (this.mode === "local" && this.audio) {
      var ld = this.audio.duration, lt = this.audio.currentTime;
      if (!isFinite(ld)) ld = 0;
      return { t: lt, d: ld, f: ld > 0 ? lt / ld : 0, live: false };
    }
    return { t: 0, d: 0, f: 0, live: true };
  };

  /* -------------------------------------------------------------- visuals */

  Player.prototype._sizeViz = function () {
    if (!this.viz) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = this.viz.getBoundingClientRect();
    this.vw = r.width; this.vh = r.height;
    this.viz.width = Math.max(1, Math.round(r.width * dpr));
    this.viz.height = Math.max(1, Math.round(r.height * dpr));
    this.vg.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  Player.prototype._localSpectrum = function () {
    var out = new Array(BINS).fill(0);
    if (!this.lAnalyser) return null;
    this.lAnalyser.getByteFrequencyData(this.lData);
    var per = Math.floor(this.lData.length * 0.7 / BINS);
    for (var b = 0; b < BINS; b++) {
      var s = 0;
      for (var j = 0; j < per; j++) s += this.lData[b * per + j];
      out[b] = s / per / 255;
    }
    return out;
  };

  // YouTube gives us no waveform, so build a plausible one from the clock
  Player.prototype._modelled = function (dt, T) {
    var beatLen = 60 / this.bpm;
    this._clock += dt;
    var b = Math.floor(this._clock / beatLen);
    if (b !== this._lastBeat) {
      this._lastBeat = b;
      this._hit(b % 4 === 0 ? 1 : (b % 2 === 0 ? 0.7 : 0.45));
    }
    var env = 0.45 + this.energy.beat * 0.55;
    for (var i = 0; i < BINS; i++) {
      var f = this._fake[i];
      var tilt = Math.pow(1 - i / BINS, 1.5);
      var v = tilt * env * (0.55 + 0.45 * Math.sin(T * f.rate + f.ph));
      this._bands[i] += (v - this._bands[i]) * 0.24;
    }
    return this._bands;
  };

  Player.prototype._raf = function () {
    var self = this;
    var last = performance.now();

    function frame(now) {
      requestAnimationFrame(frame);
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      var T = now / 1000;

      self.energy.beat = Math.max(0, self.energy.beat - dt * 3.0);

      var bands = null, lvl = 0, i;

      if (self.mode === "ensemble" && self.ensemble.playing) {
        bands = self.ensemble.spectrum(BINS);
        for (i = 0; i < BINS; i++) self._bands[i] += (bands[i] - self._bands[i]) * 0.35;
        bands = self._bands;
        lvl = self.ensemble.level();
      } else if (self.mode === "local" && self.playing) {
        var real = self._localSpectrum();
        if (real) {
          for (i = 0; i < BINS; i++) self._bands[i] += (real[i] - self._bands[i]) * 0.35;
          bands = self._bands;
          for (i = 0; i < BINS; i++) lvl += bands[i];
          lvl = clamp(lvl / BINS * 2.4, 0, 1);
          // beat from a jump in the low end
          var low = (bands[0] + bands[1] + bands[2]) / 3;
          if (low > (self._lastLow || 0) + 0.10) self._hit(clamp(low * 1.4, 0, 1));
          self._lastLow = low;
        } else {
          bands = self._modelled(dt, T);
          lvl = 0.5;
        }
      } else if (self.playing) {
        bands = self._modelled(dt, T);
        for (i = 0; i < BINS; i++) lvl += bands[i];
        lvl = clamp(lvl / BINS * 2.2, 0, 1);
      } else {
        for (i = 0; i < BINS; i++) self._bands[i] *= 0.90;
        bands = self._bands;
      }

      self.energy.level += (lvl - self.energy.level) * 0.15;
      self.onEnergy(self.energy.level, self.energy.beat);
      self._drawViz(bands);
    }
    requestAnimationFrame(frame);
  };

  Player.prototype._drawViz = function (bands) {
    if (!this.vg || !this.vw) return;
    var g = this.vg, w = this.vw, h = this.vh;
    g.clearRect(0, 0, w, h);

    var n = bands.length, half = w / 2, bw = half / n;
    var grd = g.createLinearGradient(0, h, 0, 0);
    grd.addColorStop(0, "rgba(217,43,63,.75)");
    grd.addColorStop(1, "rgba(245,166,35,.95)");
    g.fillStyle = grd;

    for (var i = 0; i < n; i++) {
      var v = clamp(bands[i], 0, 1);
      var bh = Math.max(1.5, v * h * 0.82);
      var ww = Math.max(1, bw - 1.6);
      g.fillRect(half + i * bw, h - bh, ww, bh);
      g.fillRect(half - (i + 1) * bw, h - bh, ww, bh);
    }
  };

  global.SharodiyaPlayer = Player;
})(window);
