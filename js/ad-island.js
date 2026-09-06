/* ==========================================================================
   ad-island.js — Interactive Top-Center Advertisement / Notification Island
   Handles rotation, scheduling, progress countdown, and analytics events.
   ========================================================================== */

(function () {
  "use strict";

  function AdIsland() {
    this.mount = null;
    this.ads = [];
    this.currentIndex = 0;
    this.timer = null;
    this.progressInterval = null;
    this.remainingMs = 0;
    this.currentTotalMs = 7000;
    this.isPaused = false;
    this.isDismissed = false;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", this.init.bind(this));
    } else {
      this.init();
    }
  }

  AdIsland.prototype.init = async function () {
    this.mount = document.getElementById("adIslandMount");
    if (!this.mount) {
      this.mount = document.createElement("div");
      this.mount.id = "adIslandMount";
      this.mount.className = "ad-island-mount";
      this.mount.setAttribute("data-hidden", "true");
      document.body.prepend(this.mount);
    }

    await this.refreshAds();

    // Check for schedule updates every 60 seconds
    setInterval(this.refreshAds.bind(this), 60000);
  };

  AdIsland.prototype.refreshAds = async function () {
    if (!window.AdsService) return;

    try {
      var activeAds = await window.AdsService.fetchActiveAds();
      this.ads = Array.isArray(activeAds) ? activeAds : [];

      if (this.isDismissed || this.ads.length === 0) {
        this.hide();
        return;
      }

      // If current index is out of bounds, reset
      if (this.currentIndex >= this.ads.length) {
        this.currentIndex = 0;
      }

      this.render();
      this.show();
    } catch (err) {
      console.warn("[AdIsland] Failed to refresh active ads:", err);
      this.hide();
    }
  };

  AdIsland.prototype.show = function () {
    if (this.mount) this.mount.removeAttribute("data-hidden");
  };

  AdIsland.prototype.hide = function () {
    this.clearTimers();
    if (this.mount) {
      this.mount.setAttribute("data-hidden", "true");
      this.mount.innerHTML = "";
    }
  };

  AdIsland.prototype.getCurrentAd = function () {
    if (!this.ads || this.ads.length === 0) return null;
    return this.ads[this.currentIndex] || this.ads[0];
  };

  AdIsland.prototype.render = function () {
    var self = this;
    var ad = this.getCurrentAd();
    if (!ad) {
      this.hide();
      return;
    }

    this.clearTimers();

    var hasMultiple = this.ads.length > 1;
    var durationSec = Math.max(3, parseInt(ad.duration_seconds, 10) || 7);
    this.currentTotalMs = durationSec * 1000;
    this.remainingMs = this.currentTotalMs;

    // Build DOM structure
    var island = document.createElement("div");
    island.className = "ad-island anim-in";
    island.setAttribute("role", "banner");
    island.setAttribute("aria-label", "Advertisement: " + (ad.title || "Special Offer"));

    // Media Thumbnail
    var mediaEl = document.createElement("div");
    mediaEl.className = "ad-island-media";
    if (ad.image_url) {
      var img = document.createElement("img");
      img.className = "ad-island-thumb";
      img.alt = ad.title || "Ad";
      img.decoding = "async";
      img.src = ad.image_url;
      img.onerror = function () {
        mediaEl.innerHTML = '<span class="ad-island-fallback-icon">🪩</span>';
      };
      mediaEl.appendChild(img);
    } else {
      mediaEl.innerHTML = '<span class="ad-island-fallback-icon">🪩</span>';
    }
    island.appendChild(mediaEl);

    // Text Body
    var bodyEl = document.createElement("div");
    bodyEl.className = "ad-island-body";

    var metaEl = document.createElement("div");
    metaEl.className = "ad-island-meta";

    var badge = document.createElement("span");
    badge.className = "ad-island-badge";
    badge.textContent = ad.badge || "SPONSORED";
    metaEl.appendChild(badge);

    if (ad.client_name) {
      var sponsor = document.createElement("span");
      sponsor.className = "ad-island-sponsor";
      sponsor.textContent = ad.client_name;
      metaEl.appendChild(sponsor);
    }
    bodyEl.appendChild(metaEl);

    var titleEl = document.createElement("div");
    titleEl.className = "ad-island-title";
    titleEl.textContent = ad.title || "";
    bodyEl.appendChild(titleEl);

    if (ad.subtitle) {
      var subEl = document.createElement("div");
      subEl.className = "ad-island-sub";
      subEl.textContent = ad.subtitle;
      bodyEl.appendChild(subEl);
    }
    island.appendChild(bodyEl);

    // Actions & Dots
    var actionsEl = document.createElement("div");
    actionsEl.className = "ad-island-actions";

    if (hasMultiple) {
      var dotsEl = document.createElement("div");
      dotsEl.className = "ad-island-dots";
      for (var i = 0; i < this.ads.length; i++) {
        var dot = document.createElement("span");
        dot.className = "ad-island-dot" + (i === this.currentIndex ? " is-active" : "");
        dotsEl.appendChild(dot);
      }
      actionsEl.appendChild(dotsEl);
    }

    var ctaEl = document.createElement("div");
    ctaEl.className = "ad-island-cta";
    ctaEl.innerHTML = "↗";
    ctaEl.title = "Open link";
    actionsEl.appendChild(ctaEl);

    var closeBtn = document.createElement("button");
    closeBtn.className = "ad-island-close";
    closeBtn.type = "button";
    closeBtn.innerHTML = "×";
    closeBtn.title = "Dismiss";
    closeBtn.setAttribute("aria-label", "Dismiss advertisement");
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      self.isDismissed = true;
      self.hide();
    });
    actionsEl.appendChild(closeBtn);

    island.appendChild(actionsEl);

    // Progress Bar (if multiple ads)
    var progressBar = null;
    if (hasMultiple) {
      var progressTrack = document.createElement("div");
      progressTrack.className = "ad-island-progress-track";
      progressBar = document.createElement("div");
      progressBar.className = "ad-island-progress-bar";
      progressTrack.appendChild(progressBar);
      island.appendChild(progressTrack);
    }

    // Click handler for destination URL
    island.addEventListener("click", function (e) {
      if (e.target === closeBtn || closeBtn.contains(e.target)) return;
      if (window.AdsService) {
        window.AdsService.recordClick(ad);
      }
      if (ad.destination_url) {
        window.open(ad.destination_url, "_blank", "noopener,noreferrer");
      }
    });

    // Pause rotation on hover
    island.addEventListener("mouseenter", function () {
      self.isPaused = true;
      island.classList.add("is-paused");
    });
    island.addEventListener("mouseleave", function () {
      self.isPaused = false;
      island.classList.remove("is-paused");
    });

    // Mount to DOM
    this.mount.innerHTML = "";
    this.mount.appendChild(island);

    // Record Impression in Analytics
    if (window.AdsService) {
      window.AdsService.recordImpression(ad);
    }

    // Start countdown if multiple ads
    if (hasMultiple) {
      this.startCountdown(progressBar, island);
    }
  };

  AdIsland.prototype.startCountdown = function (progressBar, islandEl) {
    var self = this;
    var stepMs = 50;

    this.progressInterval = setInterval(function () {
      if (self.isPaused) return;

      self.remainingMs -= stepMs;
      if (progressBar) {
        var pct = ((self.currentTotalMs - self.remainingMs) / self.currentTotalMs) * 100;
        progressBar.style.width = Math.min(100, Math.max(0, pct)) + "%";
      }

      if (self.remainingMs <= 0) {
        self.clearTimers();
        self.rotateNext(islandEl);
      }
    }, stepMs);
  };

  AdIsland.prototype.rotateNext = function (islandEl) {
    var self = this;
    if (islandEl) {
      islandEl.classList.remove("anim-in");
      islandEl.classList.add("anim-out");
    }

    setTimeout(function () {
      self.currentIndex = (self.currentIndex + 1) % self.ads.length;
      self.render();
    }, 280);
  };

  AdIsland.prototype.clearTimers = function () {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  };

  window.AdIsland = new AdIsland();
})();
