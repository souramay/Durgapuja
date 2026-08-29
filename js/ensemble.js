/* ==========================================================================
   ensemble.js — a live Durga Puja ensemble, synthesised in the browser.

   No audio files, no network, no licensing. It plays forever and never
   repeats exactly, so the site always has music even before you point it
   at a YouTube playlist.

   Voices:
     dhak      barrel drum — bass head + stick slap
     kanshor   the bell/gong struck on the downbeat
     shankha   conch, blown at the top of a cycle
     tanpura   a four-string drone under everything
     bansuri   bamboo flute in Raga Durga (S R M P D — no Ga, no Ni)
   ========================================================================== */
(function (global) {
  "use strict";

  var TAU = Math.PI * 2;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  // Raga Durga, in semitones above the tonic, across three octaves
  var RAGA = [0, 2, 5, 7, 9];
  var TONIC = 146.83;                       // D3

  function deg(n) {                          // scale degree -> Hz
    var o = Math.floor(n / RAGA.length);
    var s = ((n % RAGA.length) + RAGA.length) % RAGA.length;
    return TONIC * Math.pow(2, (RAGA[s] + o * 12) / 12);
  }

  /* Kaharba-flavoured patterns, 16 sixteenths to the bar.
     B = open bass head   b = soft bass   s = stick slap   S = accented slap */
  var PATTERNS = [
    "B..s..B...s.B.s.",
    "B..sB..s..B.s.s.",
    "B.b.s..B..s.B.sS",
    "B..s..bs..B..s.s",
    "B.s.B.s.b.s.B.sS",
    "B..b..s.B..s..sS"
  ];
  var FILLS = [
    "ssssBsssssssBsSS",
    "sSsSsSsSBsBsSsSS",
    "B.ssB.ssBsssSSSS"
  ];

  function Ensemble(opts) {
    opts = opts || {};
    this.bpm = opts.bpm || 96;
    this.onBeat = opts.onBeat || function () {};
    this.playing = false;
    this.ctx = null;
    this.vol = 0.8;
    this.bar = 0;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.pattern = PATTERNS[0];
    this.phrase = [];
    this.phraseAt = 0;
  }

  Ensemble.prototype._build = function () {
    if (this.ctx) return;

    var AC = global.AudioContext || global.webkitAudioContext;
    var ctx = this.ctx = new AC();

    // master chain: bus -> compressor -> out
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;

    var master = this.master = ctx.createGain();
    master.gain.value = this.vol;

    var analyser = this.analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    this.freqData = new Uint8Array(analyser.frequencyBinCount);

    master.connect(comp);
    comp.connect(analyser);
    analyser.connect(ctx.destination);

    // dry bus + a plate-ish convolution reverb
    var dry = this.dry = ctx.createGain(); dry.gain.value = 0.86;
    var wet = this.wet = ctx.createGain(); wet.gain.value = 0.34;
    var verb = ctx.createConvolver();
    verb.buffer = this._impulse(2.9, 2.6);

    dry.connect(master);
    wet.connect(verb);
    verb.connect(master);

    this.bus = ctx.createGain();
    this.bus.connect(dry);
    this.bus.connect(wet);

    this.noise = this._noise(2);
  };

  Ensemble.prototype._noise = function (secs) {
    var ctx = this.ctx;
    var b = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  };

  Ensemble.prototype._impulse = function (secs, decay) {
    var ctx = this.ctx;
    var len = Math.floor(ctx.sampleRate * secs);
    var b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = b.getChannelData(c);
      for (var i = 0; i < len; i++) {
        var k = 1 - i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(k, decay);
      }
    }
    return b;
  };

  Ensemble.prototype._src = function (buf) {
    var s = this.ctx.createBufferSource();
    s.buffer = buf || this.noise;
    return s;
  };

  /* ------------------------------------------------------------- voices */

  // open bass head — a pitch-dropping membrane plus a filtered thump
  Ensemble.prototype.dhakBass = function (t, vel) {
    var ctx = this.ctx;

    var o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(168, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.16);

    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.95 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.42);

    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 0.45);

    var n = this._src();
    var nf = ctx.createBiquadFilter();
    nf.type = "lowpass"; nf.frequency.value = 420; nf.Q.value = 1.1;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.42 * vel, t);
    ng.gain.exponentialRampToValueAtTime(0.0008, t + 0.14);
    n.connect(nf); nf.connect(ng); ng.connect(this.bus);
    n.start(t); n.stop(t + 0.16);
  };

  // stick on the rim — bright, short
  Ensemble.prototype.dhakSlap = function (t, vel) {
    var ctx = this.ctx;

    var n = this._src();
    n.playbackRate.value = rnd(0.9, 1.15);
    var f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = rnd(1500, 2300); f.Q.value = 0.9;
    var hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 700;

    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.36 * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 0.10);

    n.connect(f); f.connect(hp); hp.connect(g); g.connect(this.bus);
    n.start(t); n.stop(t + 0.12);

    var o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(rnd(380, 470), t);
    o.frequency.exponentialRampToValueAtTime(200, t + 0.06);
    var og = ctx.createGain();
    og.gain.setValueAtTime(0.20 * vel, t);
    og.gain.exponentialRampToValueAtTime(0.0006, t + 0.09);
    o.connect(og); og.connect(this.bus);
    o.start(t); o.stop(t + 0.10);
  };

  // kanshor ghonta — inharmonic partials, long tail
  Ensemble.prototype.kanshor = function (t, vel) {
    var ctx = this.ctx;
    var base = rnd(520, 610);
    var ratios = [1, 2.41, 3.16, 4.52, 5.87, 7.13];

    var out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.30 * vel, t + 0.003);
    out.gain.exponentialRampToValueAtTime(0.0004, t + 2.6);
    out.connect(this.bus);

    for (var i = 0; i < ratios.length; i++) {
      var o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = base * ratios[i] * rnd(0.998, 1.002);
      var g = ctx.createGain();
      g.gain.setValueAtTime(1 / (i + 1.4), t);
      g.gain.exponentialRampToValueAtTime(0.0004, t + 2.6 / (1 + i * 0.42));
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + 2.7);
    }
  };

  // shankha — the conch, slow swell with a rough edge
  Ensemble.prototype.shankha = function (t) {
    var ctx = this.ctx;
    var f0 = rnd(300, 350);

    var out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.20, t + 0.35);
    out.gain.linearRampToValueAtTime(0.17, t + 1.5);
    out.gain.exponentialRampToValueAtTime(0.0005, t + 2.4);

    var bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = f0 * 2.2; bp.Q.value = 3.5;
    out.connect(bp); bp.connect(this.bus);

    var o1 = ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = f0;
    var o2 = ctx.createOscillator(); o2.type = "square";   o2.frequency.value = f0 * 1.005;
    var g2 = ctx.createGain(); g2.gain.value = 0.3;

    var lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 5.2;
    var lg = ctx.createGain(); lg.gain.value = 4.5;
    lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);

    var n = this._src();
    var nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = f0 * 3; nf.Q.value = 1.2;
    var ng = ctx.createGain(); ng.gain.value = 0.06;

    o1.connect(out); o2.connect(g2); g2.connect(out);
    n.connect(nf); nf.connect(ng); ng.connect(out);

    [o1, o2, lfo, n].forEach(function (s) { s.start(t); s.stop(t + 2.5); });
  };

  // bansuri — breathy triangle with vibrato that fades in
  Ensemble.prototype.bansuri = function (t, freq, dur, vel) {
    var ctx = this.ctx;

    var out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.16 * vel, t + 0.07);
    out.gain.linearRampToValueAtTime(0.13 * vel, t + dur * 0.7);
    out.gain.exponentialRampToValueAtTime(0.0004, t + dur);

    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 2100; lp.Q.value = 0.7;
    out.connect(lp); lp.connect(this.bus);

    var o = ctx.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(freq * 0.985, t);
    o.frequency.linearRampToValueAtTime(freq, t + 0.06);

    var h = ctx.createOscillator(); h.type = "sine"; h.frequency.value = freq * 2;
    var hg = ctx.createGain(); hg.gain.value = 0.16;

    var vib = ctx.createOscillator(); vib.type = "sine"; vib.frequency.value = 5.4;
    var vg = ctx.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(freq * 0.011, t + dur * 0.55);
    vib.connect(vg); vg.connect(o.frequency);

    var n = this._src();
    var nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = freq * 2.6; nf.Q.value = 0.8;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.05 * vel, t);
    ng.gain.exponentialRampToValueAtTime(0.004, t + dur);

    o.connect(out); h.connect(hg); hg.connect(out);
    n.connect(nf); nf.connect(ng); ng.connect(out);

    [o, h, vib, n].forEach(function (s) { s.start(t); s.stop(t + dur + 0.05); });
  };

  // tanpura — started once, runs until stop()
  Ensemble.prototype._drone = function () {
    var ctx = this.ctx, t = ctx.currentTime;
    var out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.13, t + 3);

    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 900; lp.Q.value = 0.6;

    // slow filter sweep keeps the drone from sitting still
    var swp = ctx.createOscillator(); swp.type = "sine"; swp.frequency.value = 0.045;
    var swg = ctx.createGain(); swg.gain.value = 320;
    swp.connect(swg); swg.connect(lp.frequency);
    swp.start(t);

    out.connect(lp); lp.connect(this.bus);

    var voices = [TONIC / 2, TONIC * Math.pow(2, 7 / 12) / 2, TONIC, TONIC];
    var oscs = [];
    voices.forEach(function (f, i) {
      ["sawtooth", "triangle"].forEach(function (type, j) {
        var o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f * (1 + (i - 1.5) * 0.0012 + j * 0.0007);
        var g = ctx.createGain();
        g.gain.value = (j === 0 ? 0.16 : 0.30) / voices.length;
        o.connect(g); g.connect(out);
        o.start(t);
        oscs.push(o);
      });
    });

    this.droneNodes = { out: out, oscs: oscs, swp: swp };
  };

  /* ------------------------------------------------------- the scheduler */

  Ensemble.prototype._phrase = function () {
    // build a short melodic phrase as [degree, sixteenths] pairs
    var n = 3 + ((Math.random() * 4) | 0);
    var d = 3 + ((Math.random() * 6) | 0);          // start somewhere mid-range
    var dir = Math.random() < 0.5 ? 1 : -1;
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push([d, pick([2, 2, 3, 4, 4, 6])]);
      d += dir * pick([1, 1, 1, 2]);
      if (d > 11) { d = 11; dir = -1; }
      if (d < 0) { d = 0; dir = 1; }
      if (Math.random() < 0.25) dir *= -1;
    }
    return out;
  };

  Ensemble.prototype._tick = function (step, t) {
    var bar = this.bar;

    // pick a pattern every 4 bars, with a fill at the end of each 8
    if (step === 0) {
      if (bar % 8 === 7) this.pattern = pick(FILLS);
      else if (bar % 4 === 0) this.pattern = pick(PATTERNS);

      this.kanshor(t, bar % 4 === 0 ? 1 : 0.6);
      if (bar % 16 === 0) this.shankha(t + 0.02);
    }

    var ch = this.pattern.charAt(step);
    var swing = (step % 2) ? 0.012 : 0;      // a touch of lilt on off-16ths

    if (ch === "B") { this.dhakBass(t, rnd(0.9, 1.0)); this.onBeat(1); }
    else if (ch === "b") { this.dhakBass(t + swing, rnd(0.5, 0.65)); this.onBeat(0.55); }
    else if (ch === "S") { this.dhakSlap(t + swing, 1.0); this.onBeat(0.7); }
    else if (ch === "s") { this.dhakSlap(t + swing, rnd(0.5, 0.75)); this.onBeat(0.4); }

    // melody advances on its own clock, resting between phrases
    if (this.phraseAt <= 0) {
      if (this.phrase.length === 0) {
        if (Math.random() < 0.55) { this.phrase = this._phrase(); }
        else { this.phraseAt = 8 + ((Math.random() * 16) | 0); }
      }
      if (this.phrase.length) {
        var note = this.phrase.shift();
        var sixteenth = 60 / this.bpm / 4;
        this.bansuri(t, deg(note[0]), note[1] * sixteenth * 0.95, rnd(0.75, 1));
        this.phraseAt = note[1];
      }
    }
    this.phraseAt--;
  };

  Ensemble.prototype._schedule = function () {
    var ctx = this.ctx;
    var sixteenth = 60 / this.bpm / 4;

    while (this.nextTime < ctx.currentTime + 0.18) {
      this._tick(this.step, this.nextTime);
      this.nextTime += sixteenth;
      this.step++;
      if (this.step >= 16) { this.step = 0; this.bar++; }
    }
  };

  /* ------------------------------------------------------------ controls */

  Ensemble.prototype.start = function () {
    this._build();
    var self = this;
    if (this.ctx.state === "suspended") this.ctx.resume();
    if (this.playing) return;

    this.playing = true;
    if (!this.droneNodes) this._drone();
    else this.droneNodes.out.gain.linearRampToValueAtTime(0.13, this.ctx.currentTime + 1.5);

    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setValueAtTime(this.master.gain.value, this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(this.vol, this.ctx.currentTime + 0.5);

    this.nextTime = this.ctx.currentTime + 0.12;
    this.timer = setInterval(function () { self._schedule(); }, 25);
  };

  Ensemble.prototype.stop = function () {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    this.timer = null;
    if (this.master) {
      var t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0.0001, t + 0.35);
    }
    if (this.droneNodes) {
      this.droneNodes.out.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.35);
    }
  };

  Ensemble.prototype.setVolume = function (v) {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.master && this.playing) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(this.vol, this.ctx.currentTime + 0.08);
    }
  };

  // 0..1 loudness, for the wallpaper and the visualiser
  Ensemble.prototype.level = function () {
    if (!this.analyser || !this.playing) return 0;
    this.analyser.getByteFrequencyData(this.freqData);
    var sum = 0;
    for (var i = 0; i < this.freqData.length; i++) sum += this.freqData[i];
    return Math.min(1, sum / this.freqData.length / 110);
  };

  Ensemble.prototype.spectrum = function (bins) {
    var out = new Array(bins).fill(0);
    if (!this.analyser || !this.playing) return out;
    this.analyser.getByteFrequencyData(this.freqData);
    var per = Math.floor(this.freqData.length * 0.7 / bins);
    for (var b = 0; b < bins; b++) {
      var s = 0;
      for (var j = 0; j < per; j++) s += this.freqData[b * per + j];
      out[b] = s / per / 255;
    }
    return out;
  };

  void TAU;
  global.Ensemble = Ensemble;
})(window);
