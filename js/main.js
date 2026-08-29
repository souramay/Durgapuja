/* ==========================================================================
   main.js — wiring.

   The player deliberately shows no track metadata: no title, no artist,
   no queue. The YouTube still is the only now-playing cue.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.SHARODIYA_CONFIG || {};
  var LS = { vol: "sharodiya.vol", shuffle: "sharodiya.shuffle" };

  var $ = function (id) { return document.getElementById(id); };

  /* Every interesting event lands here. Always in the console; on screen
     too when the page is opened with ?debug=1 */
  var DEBUG = /[?&]debug=1/.test(location.search);
  var logLines = [];
  function log(msg) {
    var line = ((performance.now() / 1000).toFixed(1) + "s  " + msg);
    logLines.push(line);
    if (logLines.length > 40) logLines.shift();
    console.log("[sharodiya] " + msg);
    if (DEBUG) paintDebug();          // on screen only with ?debug=1
  }
  function paintDebug() {
    var el = $("debug");
    if (!el) return;
    el.hidden = false;
    el.textContent = logLines.join("\n");
    el.scrollTop = el.scrollHeight;
  }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { void e; } }
  function recall(k) { try { return localStorage.getItem(k); } catch (e) { void e; return null; } }

  /* --------------------------------------------------------------- toast */

  var toastT = null;
  function toast(msg, ms) {
    if (!msg) return;
    var el = $("toast");
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.classList.remove("is-on"); }, ms || 4000);
  }

  /* ------------------------------------------------------- music source */

  function resolveSource() {
    // local files beat everything — nothing about them can be blocked
    var local = (CFG.local || [])
      .filter(function (t) { return t && t.file; })
      .map(function (t) {
        return { src: "music/" + t.file, title: t.title || t.file, artist: t.artist || "" };
      });
    if (local.length) return { local: local };

    // ?list=… / ?v=… on the URL wins, so a link can carry its own playlist
    var q = new URLSearchParams(location.search);
    var fromUrl = q.get("list") || q.get("v");
    if (fromUrl) {
      var p = window.parseYouTubeSource(fromUrl);
      if (p) return p;
    }
    if (CFG.playlist) {
      var pc = window.parseYouTubeSource(CFG.playlist);
      if (pc) return pc;
    }
    var ids = (CFG.tracks || [])
      .map(function (t) { return t && t.id; })
      .filter(function (id) { return id && /^[A-Za-z0-9_-]{11}$/.test(id); });
    if (ids.length) return { type: "ids", ids: ids };
    return null;
  }

  var SOURCE = resolveSource();

  log("protocol " + location.protocol + " · origin " + location.origin);
  log("source: " + (
    !SOURCE ? "none — live ensemble" :
    SOURCE.local ? SOURCE.local.length + " local file(s)" :
    SOURCE.type === "playlist" ? "youtube playlist " + SOURCE.id :
    SOURCE.ids ? "youtube, " + SOURCE.ids.length + " video ids" :
    "youtube video " + SOURCE.id
  ));

  /* ------------------------------------------------------------- posters */

  var stage = new window.Scenes.Stage($("stage"), {
    sceneSeconds: CFG.sceneSeconds || 18,
    fadeSeconds: CFG.fadeSeconds || 1.1,
    // the posters are a silent fallback now, so there is no chrome to update
    onScene: function () {}
  });
  stage.show(Math.floor(Math.random() * window.Scenes.list.length), true);

  /* -------------------------------------------------------------- player */

  var savedVol = parseInt(recall(LS.vol), 10);
  if (isNaN(savedVol)) savedVol = CFG.volume == null ? 80 : CFG.volume;
  var savedShuffle = recall(LS.shuffle);

  var player = new window.SharodiyaPlayer({
    bpm: CFG.ensembleTempo || 96,
    volume: savedVol,
    shuffle: savedShuffle === null ? CFG.shuffle !== false : savedShuffle === "1",
    viz: $("viz"),
    onEnergy: function (level, beat) { stage.beat(Math.max(beat, level * 0.35)); },
    onState: setPlayState,
    onTrack: setTrack,
    onNotice: toast,
    onDebug: log
  });

  /* YouTube serves a still for every video at a predictable URL, so the
     player can show the real thumbnail without an API key. */
  function setThumb(id) {
    var img = $("artImg"), art = $("art");
    if (!id) {
      img.hidden = true;
      img.removeAttribute("src");
      art.classList.remove("has-thumb");
      return;
    }
    img.onload = function () { art.classList.add("has-thumb"); img.hidden = false; };
    img.onerror = function () { img.hidden = true; art.classList.remove("has-thumb"); };
    img.src = "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg";
  }

  function setTrack(t) {
    setThumb(t.id);

    // the OS widget gets the station, not the song — same as the player
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: "শারদীয়া",
          artist: "pujo radio",
          album: "non-stop",
          artwork: t.id ? [{
            src: "https://i.ytimg.com/vi/" + t.id + "/hqdefault.jpg",
            sizes: "480x360", type: "image/jpeg"
          }] : []
        });
      } catch (e) { void e; }
    }
  }

  function setPlayState(on) {
    player.playing = on;
    $("playIcon").textContent = on ? "❚❚" : "▶";
    $("btnPlay").classList.toggle("is-playing", on);
    document.body.classList.toggle("is-paused", !on);
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = on ? "playing" : "paused";
  }

  /* ------------------------------------------------------------ progress */

  var seeking = false;
  function fmt(s) {
    if (!isFinite(s) || s < 0) return "--:--";
    var m = Math.floor(s / 60), x = Math.floor(s % 60);
    return m + ":" + (x < 10 ? "0" : "") + x;
  }

  setInterval(function () {
    var p = player.progress();
    if (p.live) {
      $("time").textContent = "∞ live";
      if (!seeking) { $("seekFill").style.width = "100%"; $("seek").value = 1000; }
      return;
    }
    $("time").textContent = fmt(p.t) + " / " + fmt(p.d);
    if (!seeking) {
      $("seekFill").style.width = (p.f * 100).toFixed(2) + "%";
      $("seek").value = Math.round(p.f * 1000);
    }
  }, 250);

  $("seek").addEventListener("input", function () {
    seeking = true;
    $("seekFill").style.width = (this.value / 10) + "%";
  });
  $("seek").addEventListener("change", function () {
    player.seekFraction(this.value / 1000);
    seeking = false;
  });

  /* ------------------------------------------------------------ controls */

  // the click that turned sound on should not also pause what just started
  function fromArmingGesture() { return Date.now() - armedAt < 400; }

  $("btnPlay").addEventListener("click", function () {
    if (fromArmingGesture()) return;
    player.toggle();
  });

  $("btnShuffle").classList.toggle("is-on", player.shuffle);
  $("btnShuffle").addEventListener("click", function () {
    player.setShuffle(!player.shuffle);
    this.classList.toggle("is-on", player.shuffle);
    store(LS.shuffle, player.shuffle ? "1" : "0");
    toast(player.shuffle ? "Shuffle on" : "Shuffle off", 1500);
  });

  $("btnRepeat").addEventListener("click", function () {
    player.setRepeatOne(!player.repeatOne);
    this.textContent = player.repeatOne ? "🔂" : "⟲";
    toast(player.repeatOne ? "Repeating this track" : "Repeat all — non-stop", 1500);
  });

  var vol = $("vol");
  vol.value = savedVol;
  player.setVolume(savedVol / 100);
  vol.addEventListener("input", function () {
    player.setVolume(this.value / 100);
    if (player.muted && this.value > 0) { player.setMuted(false); $("btnMute").textContent = "🔊"; }
    store(LS.vol, this.value);
  });

  $("btnMute").addEventListener("click", function () {
    player.setMuted(!player.muted);
    this.textContent = player.muted ? "🔇" : "🔊";
  });

  /* =====================================================================
     Background — the video, always. There is no poster mode to return to;
     the drawn scenes only exist now as a silent last resort.
     ===================================================================== */

  var bgWanted = new URLSearchParams(location.search).get("bg") || CFG.background || "";

  function applyBg(mode) {
    var box = $("bgMedia");
    document.body.classList.remove("bg-youtube");
    box.innerHTML = "";
    box.hidden = true;

    // posters stay hidden whatever happens below
    document.body.classList.add("has-bg");
    stage.setAuto(false);

    if (!mode) { log("background: nothing configured"); return; }

    if (mode === "youtube") {
      if (player.mode !== "youtube" || !player.yt || !player.yt.ready) {
        log("background: youtube requested but no video is playing yet");
        return;
      }
      document.body.classList.add("bg-youtube");
      log("background: youtube video, full-bleed");
      return;
    }

    var isImg = /\.(gif|webp|png|jpe?g)$/i.test(mode);
    var el = document.createElement(isImg ? "img" : "video");
    if (isImg) {
      el.alt = "";
      el.decoding = "async";
    } else {
      el.autoplay = true;
      el.loop = true;
      el.playsInline = true;
      el.muted = true;                    // required, or the browser blocks it
      el.setAttribute("muted", "");
      el.setAttribute("playsinline", "");
      el.addEventListener("loadeddata", function () { log("background: video playing"); });
    }
    el.onerror = function () {
      log("background: FAILED to load " + mode);
      toast("Background video could not load — check " + mode, 6000);
    };
    el.src = mode;
    box.appendChild(el);
    box.hidden = false;
    log("background: " + mode);
  }

  applyBg(bgWanted);

  $("btnFull").addEventListener("click", function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(function (e) { void e; });
  });

  /* --------------------------------------------------------- idle chrome */

  var idleT = null;
  function wake() {
    document.body.classList.remove("is-idle");
    clearTimeout(idleT);
    idleT = setTimeout(function () { document.body.classList.add("is-idle"); }, 4000);
  }
  ["pointermove", "pointerdown", "keydown", "wheel"].forEach(function (ev) {
    window.addEventListener(ev, wake, { passive: true });
  });
  wake();

  /* ------------------------------------------------------------ shortcuts */

  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    var k = e.key.toLowerCase();


    if (e.code === "Space") { e.preventDefault(); if (!fromArmingGesture()) player.toggle(); return; }
    if (k === "arrowup") { e.preventDefault(); bumpVol(5); return; }
    if (k === "arrowdown") { e.preventDefault(); bumpVol(-5); return; }
    if (k === "f") { $("btnFull").click(); return; }
    if (k === "m") { $("btnMute").click(); return; }
  });

  function bumpVol(d) {
    var v = Math.max(0, Math.min(100, parseInt(vol.value, 10) + d));
    vol.value = v;
    player.setVolume(v / 100);
    store(LS.vol, v);
    toast("Volume " + v + "%", 900);
  }

  /* ----------------------------------------------------------- media keys */

  if ("mediaSession" in navigator) {
    var acts = {
      play: function () { player.play(); },
      pause: function () { player.pause(); }
    };
    Object.keys(acts).forEach(function (a) {
      try { navigator.mediaSession.setActionHandler(a, acts[a]); } catch (e) { void e; }
    });
  }

  /* =====================================================================
     Boot. No start screen, no prompt: playback begins on load with sound.
     Where a browser refuses unmuted autoplay it keeps playing muted, and
     sound switches on by itself at the visitor's first touch of anything.
     ===================================================================== */

  var armed = false, armedAt = 0;

  function turnSoundOn() {
    if (armed) return;
    armed = true;
    armedAt = Date.now();

    player.setMuted(false);
    $("btnMute").textContent = "🔊";

    // the ensemble runs on an AudioContext, which also needs the gesture
    if (player.mode === "ensemble") player.play();
    else if (player.yt) player.yt.play();

    log("sound on");
    ["pointerdown", "keydown", "touchstart", "wheel"].forEach(function (ev) {
      document.removeEventListener(ev, turnSoundOn);
    });
  }

  // a real activation gesture — pointer, key or touch. Mouse movement alone
  // does not count as one, so it cannot be used here.
  ["pointerdown", "keydown", "touchstart", "wheel"].forEach(function (ev) {
    document.addEventListener(ev, turnSoundOn, { passive: true });
  });

  function boot() {
    // opened by double-clicking the file? YouTube cannot load from file://
    if (location.protocol === "file:") {
      log("blocked: opened from file:// — YouTube cannot load");

      // a local video file still plays fine from file://, so show it anyway
      if (bgWanted && bgWanted !== "youtube") applyBg(bgWanted);

      $("blocker").hidden = false;
      $("blockerGo").addEventListener("click", function () { $("blocker").hidden = true; });
      $("blockerStay").addEventListener("click", function () {
        $("blocker").hidden = true;
        player.autostart(null, false);
      });
      return;
    }

    if (!SOURCE) toast("No playlist in config.js — playing the live ensemble.", 6000);

    // start with sound. Browsers may refuse, so verify rather than assume.
    player.autostart(SOURCE, false).catch(function (e) { void e; });
    $("btnMute").textContent = "🔊";

    setTimeout(function () {
      if (player.audible()) {
        log("autoplay with sound: allowed");
        armed = true;                       // nothing left to arm
        return;
      }
      // refused. Keep the music running muted rather than stopping, and let
      // the first interaction bring the sound up. Nothing to click.
      log("autoplay with sound: refused — playing muted until first interaction");
      player.setMuted(true);
      armed = false;
      player.play();
    }, 2200);

    // the YouTube background needs a ready player, so apply it once settled
    if (bgWanted === "youtube") setTimeout(function () { applyBg(bgWanted); }, 2500);
  }

  setPlayState(false);
  boot();
})();
