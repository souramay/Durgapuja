/* ==========================================================================
   advertise.js — In-Player "Advertise With Us" Bar & Simplified Modal
   Integrated within the player control card at the top.
   Zero emojis: Clean SVG icons.
   Simplified Form: Name, Contact Information, Ad Category.
   Plans: ₹49 (1 Day), ₹139 (3 Days), ₹499 (6 Days).
   ========================================================================== */

(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  var SVG_MEGAPHONE = `<svg class="ad-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 18-5v12L3 14v-3z"></path><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"></path></svg>`;
  var SVG_ARROW = `<svg class="ad-arrow-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;

  function AdvertiseController() {
    this.selectedPlan = "basic";
    this.isSubmitting = false;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", this.init.bind(this));
    } else {
      this.init();
    }
  }

  AdvertiseController.prototype.init = function () {
    this.mountElements();
    this.bindBannerEvents();
    this.bindModalEvents();
  };

  /* -------------------------------------------------------- Mount HTML Markup */

  AdvertiseController.prototype.mountElements = function () {
    // 1. In-Player Top Banner Markup
    var mount = $("playerAdMount");
    if (!mount) {
      var playerEl = $("player");
      if (playerEl) {
        mount = document.createElement("div");
        mount.id = "playerAdMount";
        mount.className = "player-ad-mount";
        playerEl.insertBefore(mount, playerEl.firstChild);
      }
    }

    if (mount && !$("playerAdBar")) {
      mount.innerHTML = `
        <div class="player-ad-bar" id="playerAdBar" role="region" aria-label="Advertise with us">
          <div class="player-ad-info">
            <div class="player-ad-brand">
              ${SVG_MEGAPHONE}
              <span class="player-ad-label">Advertise With Us</span>
            </div>

            <div class="player-ad-plans">
              <button type="button" class="player-plan-chip" data-plan="basic" title="Select Basic Plan: 1 Day for ₹49">
                <span class="plan-chip-price">₹49</span>
                <span class="plan-chip-dur">1D</span>
              </button>

              <button type="button" class="player-plan-chip is-popular" data-plan="standard" title="Select Standard Plan: 3 Days for ₹139">
                <span class="plan-chip-price">₹139</span>
                <span class="plan-chip-dur">3D</span>
                <span class="plan-chip-tag">Popular</span>
              </button>

              <button type="button" class="player-plan-chip" data-plan="premium" title="Select Premium Plan: 6 Days for ₹499">
                <span class="plan-chip-price">₹499</span>
                <span class="plan-chip-dur">6D</span>
              </button>
            </div>
          </div>

          <div class="player-ad-action">
            <button type="button" id="btnPlayerAd" class="player-ad-btn" title="Place your advertisement">
              <span>Place Your Ad</span>
              ${SVG_ARROW}
            </button>
          </div>
        </div>
      `;
    }

    // 2. Simplified Submission Modal Dialog Markup
    if (!$("adSubmissionModal")) {
      var modalMount = document.createElement("div");
      modalMount.id = "adSubmissionModal";
      modalMount.className = "ad-modal-backdrop";
      modalMount.setAttribute("hidden", "true");
      modalMount.innerHTML = `
        <div class="ad-modal-box" role="dialog" aria-modal="true" aria-labelledby="modalAdTitle">
          <div class="ad-modal-header">
            <div class="ad-modal-title-wrap">
              ${SVG_MEGAPHONE}
              <div>
                <h2 id="modalAdTitle" class="ad-modal-title">Place Your Advertisement</h2>
                <p class="ad-modal-sub">Select a plan and enter your contact info. We will get in touch shortly.</p>
              </div>
            </div>
            <button type="button" id="btnCloseAdModal" class="ad-modal-close" aria-label="Close dialog">&times;</button>
          </div>

          <form id="adSubmissionForm" onsubmit="return false;">
            <!-- Plan Selector Chips -->
            <label class="ad-form-label">Advertising Plan</label>
            <div class="ad-plan-chips">
              <div class="ad-plan-chip is-selected" data-chip-plan="basic">
                <span class="chip-price">₹49</span>
                <span class="chip-dur">1 Day</span>
                <span class="chip-tag">Basic</span>
              </div>
              <div class="ad-plan-chip" data-chip-plan="standard">
                <span class="chip-price">₹139</span>
                <span class="chip-dur">3 Days</span>
                <span class="chip-tag">Standard</span>
              </div>
              <div class="ad-plan-chip" data-chip-plan="premium">
                <span class="chip-price">₹499</span>
                <span class="chip-dur">6 Days</span>
                <span class="chip-tag">Premium</span>
              </div>
            </div>

            <!-- Field 1: Name -->
            <div class="ad-form-group">
              <label class="ad-form-label" for="subNameInput">Your Name / Brand Name *</label>
              <input type="text" id="subNameInput" class="ad-form-input" placeholder="e.g. Joydeep Sen / Sweet Bengal" required autocomplete="name">
            </div>

            <!-- Field 2: Contact Information -->
            <div class="ad-form-group">
              <label class="ad-form-label" for="subContactInput">Contact Information (Phone / Email / WhatsApp) *</label>
              <input type="text" id="subContactInput" class="ad-form-input" placeholder="e.g. 9876543210 or name@mail.com" required autocomplete="email tel">
              <span class="ad-form-hint">We will reach out to you directly on this contact.</span>
            </div>

            <!-- Field 3: Ad Category -->
            <div class="ad-form-group">
              <label class="ad-form-label" for="subCategorySelect">Ad Category *</label>
              <select id="subCategorySelect" class="ad-form-select" required>
                <option value="" disabled selected>Select category...</option>
                <option value="Business">Business / Company</option>
                <option value="Event">Event / Puja Pandal</option>
                <option value="Restaurant/Food">Restaurant & Festive Food</option>
                <option value="Shopping">Shopping & Fashion</option>
                <option value="Education">Education / Coaching</option>
                <option value="Services">Professional Services</option>
                <option value="Jobs/Careers">Jobs & Careers</option>
                <option value="Community">Community / NGO</option>
                <option value="Other">Other / Personal Wishes</option>
              </select>
            </div>

            <div id="adSubmissionStatus" class="ad-status-msg" hidden></div>

            <div class="ad-modal-footer">
              <button type="button" id="btnCancelSubModal" class="ad-cancel-btn">Cancel</button>
              <button type="submit" id="btnSubmitAdForm" class="ad-submit-btn">
                <span>Submit Ad Request</span>
              </button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modalMount);
    }
  };

  /* ------------------------------------------------------------- Banner Logic */

  AdvertiseController.prototype.bindBannerEvents = function () {
    var self = this;
    var ctaBtn = $("btnPlayerAd");

    if (ctaBtn) {
      ctaBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        self.openModal(self.selectedPlan);
      });
    }

    // Direct plan chip click on the banner opens modal with that plan selected
    var planChips = document.querySelectorAll(".player-plan-chip");
    planChips.forEach(function (chip) {
      chip.addEventListener("click", function (e) {
        e.stopPropagation();
        var plan = this.getAttribute("data-plan") || "basic";
        self.openModal(plan);
      });
    });

    // Tap on banner label area opens modal
    var brandWrap = document.querySelector(".player-ad-brand");
    if (brandWrap) {
      brandWrap.addEventListener("click", function () {
        self.openModal(self.selectedPlan);
      });
    }
  };

  /* --------------------------------------------------------------- Modal Logic */

  AdvertiseController.prototype.bindModalEvents = function () {
    var self = this;
    var modal = $("adSubmissionModal");
    var closeBtn = $("btnCloseAdModal");
    var cancelBtn = $("btnCancelSubModal");
    var form = $("adSubmissionForm");

    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        self.closeModal();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        self.closeModal();
      });
    }

    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) self.closeModal();
      });
    }

    // Plan selection chips
    var chips = document.querySelectorAll(".ad-plan-chip");
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var plan = this.getAttribute("data-chip-plan") || "basic";
        self.selectPlanChip(plan);
      });
    });

    // Form submit handler
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        self.handleSubmit();
      });
    }
  };

  AdvertiseController.prototype.selectPlanChip = function (planId) {
    this.selectedPlan = planId;
    var chips = document.querySelectorAll(".ad-plan-chip");
    chips.forEach(function (chip) {
      chip.classList.toggle("is-selected", chip.getAttribute("data-chip-plan") === planId);
    });
  };

  AdvertiseController.prototype.openModal = function (planId) {
    this.selectPlanChip(planId || "basic");
    this.hideStatus();
    var modal = $("adSubmissionModal");
    if (modal) {
      modal.removeAttribute("hidden");
      // Focus first input
      setTimeout(function () {
        var firstInput = $("subNameInput");
        if (firstInput) firstInput.focus();
      }, 100);
    }
  };

  AdvertiseController.prototype.closeModal = function () {
    var modal = $("adSubmissionModal");
    if (modal) modal.setAttribute("hidden", "true");
    this.hideStatus();
  };

  AdvertiseController.prototype.hideStatus = function () {
    var el = $("adSubmissionStatus");
    if (el) {
      el.setAttribute("hidden", "true");
      el.className = "ad-status-msg";
      el.textContent = "";
    }
  };

  AdvertiseController.prototype.showStatus = function (msg, isSuccess) {
    var el = $("adSubmissionStatus");
    if (!el) return;
    el.className = "ad-status-msg " + (isSuccess ? "is-success" : "is-error");
    el.textContent = msg;
    el.removeAttribute("hidden");
  };

  /* ------------------------------------------------------------- Submit Handler */

  AdvertiseController.prototype.handleSubmit = async function () {
    if (this.isSubmitting) return;

    var name = ($("subNameInput").value || "").trim();
    var contact = ($("subContactInput").value || "").trim();
    var category = ($("subCategorySelect").value || "").trim();

    if (!name || !contact || !category) {
      this.showStatus("Please complete all fields (Name, Contact, Category).", false);
      return;
    }

    var submitBtn = $("btnSubmitAdForm");
    this.isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = "<span>Submitting...</span>";
    }

    var payload = {
      name: name,
      contact: contact,
      category: category,
      plan_id: this.selectedPlan
    };

    var self = this;
    try {
      var result = await window.AdsService.submitAdRequest(payload);

      this.showStatus(result.message || "Thank you! Your advertisement request has been received. We will contact you shortly.", true);

      // Clear form
      $("subNameInput").value = "";
      $("subContactInput").value = "";
      $("subCategorySelect").value = "";

      // Close modal after 2.4s
      setTimeout(function () {
        self.closeModal();
      }, 2400);

    } catch (err) {
      this.showStatus("Submission error: " + err.message + ". Please try again.", false);
    } finally {
      this.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "<span>Submit Ad Request</span>";
      }
    }
  };

  window.AdvertiseController = new AdvertiseController();
})();
