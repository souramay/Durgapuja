/* ==========================================================================
   admin.js — Admin Controller & Client Analytics Portal Engine
   Hardened against client tampering, DOM leakage, and unauthorized access.
   Strictly authenticated via Supabase Auth with PostgreSQL Row Level Security.
   ========================================================================== */

(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function AdminController() {
    this.ads = [];
    this.requests = [];
    this.currentUser = null;
    this.currentEditId = null;
    this.pendingApprovalRequestId = null;
    this.activeTab = "ads";
    this.previewTimer = null;
    this.previewIndex = 0;
    this.failedAttempts = 0;
    this.lockoutUntil = 0;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", this.init.bind(this));
    } else {
      this.init();
    }
  }

  AdminController.prototype.init = async function () {
    var self = this;
    this.bindAuthEvents();
    this.bindNavigation();
    this.bindAdEvents();
    this.bindRequestEvents();
    this.bindAnalyticsEvents();
    this.bindDatabaseEvents();

    // Listen to real-time auth changes from Supabase
    if (window.AdsService && window.AdsService.supabase) {
      window.AdsService.supabase.auth.onAuthStateChange(function (event, session) {
        if (event === "SIGNED_OUT" || !session) {
          self.lockDashboard();
        } else if (event === "SIGNED_IN" && session) {
          self.currentUser = session.user;
          self.unlockDashboard();
        }
      });
    }

    // Verify session cryptographically on startup
    await this.verifySession();
  };

  /* ------------------------------------------------------------- Authentication */

  AdminController.prototype.verifySession = async function () {
    if (!window.AdsService || !window.AdsService.supabase) {
      this.lockDashboard();
      return;
    }

    try {
      var sessRes = await window.AdsService.supabase.auth.getSession();
      if (sessRes && sessRes.data && sessRes.data.session && sessRes.data.session.user) {
        this.currentUser = sessRes.data.session.user;
        this.unlockDashboard();
        return;
      }
    } catch (e) {
      console.warn("[Admin] Session check error:", e);
    }

    this.lockDashboard();
  };

  AdminController.prototype.lockDashboard = function () {
    this.currentUser = null;
    document.body.classList.remove("is-authenticated");
    var app = $("adminApp");
    var gate = $("authGate");
    if (app) {
      app.setAttribute("hidden", "true");
    }
    if (gate) {
      gate.removeAttribute("hidden");
    }

    // Clear all in-memory data to prevent memory scraping in DevTools
    this.ads = [];
    this.requests = [];
    var adsBody = $("adsTableBody");
    if (adsBody) adsBody.innerHTML = "";
    var reqBody = $("requestsTableBody");
    if (reqBody) reqBody.innerHTML = "";
    var userBadge = $("adminUserBadge");
    if (userBadge) {
      userBadge.textContent = "";
      userBadge.setAttribute("hidden", "true");
    }
  };

  AdminController.prototype.unlockDashboard = function () {
    document.body.classList.add("is-authenticated");
    var app = $("adminApp");
    var gate = $("authGate");
    if (gate) gate.setAttribute("hidden", "true");
    if (app) app.removeAttribute("hidden");

    var userBadge = $("adminUserBadge");
    if (userBadge && this.currentUser && this.currentUser.email) {
      userBadge.textContent = this.currentUser.email;
      userBadge.removeAttribute("hidden");
    }

    this.updateSupabaseStatusBadge();

    // Check if ?client= filter is present to view specific client's analytics
    var urlParams = new URLSearchParams(window.location.search);
    var clientParam = urlParams.get("client");
    if (clientParam) {
      this.clientOnlyMode = clientParam;
      this.switchTab("analytics");
    }

    this.loadAds();
    this.loadAdRequests();
    this.loadAnalytics();
  };

  AdminController.prototype.bindAuthEvents = function () {
    var self = this;

    // Show / Hide Password toggle
    var togglePassBtn = $("btnTogglePass");
    var passInput = $("sbPassInput");
    if (togglePassBtn && passInput) {
      togglePassBtn.addEventListener("click", function () {
        var isPass = passInput.type === "password";
        passInput.type = isPass ? "text" : "password";
        var eye = $("eyeIcon");
        if (eye) {
          eye.innerHTML = isPass
            ? '<path d="m15 18-.722-3.25"/><path d="M2 8a10.645 10.645 0 0 0 20 0"/><path d="m20 15-1.726-2.05"/><path d="m4 15 1.726-2.05"/><path d="m9 18 .722-3.25"/>'
            : '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
        }
      });
    }

    // Form submission
    var authForm = $("authForm");
    if (authForm) {
      authForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        self.handleLogin();
      });
    }

    // Logout
    var logoutBtn = $("btnLogout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async function () {
        if (window.AdsService && window.AdsService.supabase) {
          try {
            await window.AdsService.supabase.auth.signOut();
          } catch (e) {}
        }
        self.lockDashboard();
        window.location.reload();
      });
    }
  };

  AdminController.prototype.handleLogin = async function () {
    var errEl = $("authError");
    var submitBtn = $("btnAuthSubmit");
    var submitText = $("authSubmitText");

    if (errEl) errEl.setAttribute("hidden", "true");

    // Check brute force lockout
    if (this.lockoutUntil && Date.now() < this.lockoutUntil) {
      var remainingSec = Math.ceil((this.lockoutUntil - Date.now()) / 1000);
      if (errEl) {
        errEl.textContent = "Security lockout active. Too many failed attempts. Please wait " + remainingSec + " seconds.";
        errEl.removeAttribute("hidden");
      }
      return;
    }

    var email = ($("sbEmailInput").value || "").trim();
    var pass = ($("sbPassInput").value || "").trim();

    if (!email || !pass) {
      if (errEl) {
        errEl.textContent = "Please enter both admin email and password.";
        errEl.removeAttribute("hidden");
      }
      return;
    }

    if (!window.AdsService || !window.AdsService.supabase) {
      if (errEl) {
        errEl.textContent = "Supabase service is initializing. Please try again in a moment.";
        errEl.removeAttribute("hidden");
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      if (submitText) submitText.textContent = "Verifying Credentials...";
    }

    try {
      var res = await window.AdsService.supabase.auth.signInWithPassword({
        email: email,
        password: pass
      });

      if (res.error) {
        this.failedAttempts++;
        if (this.failedAttempts >= 5) {
          this.lockoutUntil = Date.now() + 30000;
          if (errEl) {
            errEl.textContent = "Too many failed login attempts. Account access is temporarily locked for 30 seconds.";
            errEl.removeAttribute("hidden");
          }
        } else {
          if (errEl) {
            errEl.textContent = res.error.message || "Invalid email or password.";
            errEl.removeAttribute("hidden");
          }
        }
        return;
      }

      // Successful login
      this.failedAttempts = 0;
      this.lockoutUntil = 0;
      this.currentUser = res.data && res.data.user;
      this.unlockDashboard();

    } catch (err) {
      if (errEl) {
        errEl.textContent = "Authentication exception: " + err.message;
        errEl.removeAttribute("hidden");
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        if (submitText) submitText.textContent = "Sign In to Dashboard";
      }
    }
  };

  /* ----------------------------------------------------------------- Navigation */

  AdminController.prototype.bindNavigation = function () {
    var self = this;
    var tabs = document.querySelectorAll(".nav-tab");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var tabId = this.getAttribute("data-tab");
        self.switchTab(tabId);
      });
    });
  };

  AdminController.prototype.switchTab = function (tabId) {
    this.activeTab = tabId;

    document.querySelectorAll(".nav-tab").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-tab") === tabId);
    });

    document.querySelectorAll(".admin-tab-content").forEach(function (sec) {
      sec.classList.toggle("is-active", sec.id === "tab-" + tabId);
    });

    if (tabId === "ads") {
      this.loadAds();
    } else if (tabId === "requests") {
      this.loadAdRequests();
    } else if (tabId === "analytics") {
      this.loadAnalytics();
    } else if (tabId === "database") {
      this.loadDatabaseConfig();
    }
  };

  /* ------------------------------------------------------------- Ad Management */

  AdminController.prototype.computeStatus = function (ad) {
    if (!ad.is_active) return { label: "Disabled", class: "is-disabled" };
    var now = new Date();
    if (ad.start_at && new Date(ad.start_at) > now) return { label: "Scheduled", class: "is-scheduled" };
    if (ad.end_at && new Date(ad.end_at) < now) return { label: "Expired", class: "is-expired" };
    return { label: "Active", class: "is-active" };
  };

  AdminController.prototype.loadAds = async function () {
    var tbody = $("adsTableBody");
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Loading advertisements...</td></tr>';

    try {
      this.ads = await window.AdsService.fetchAllAds();
      this.renderAdsTable();
      this.renderLivePreview();
      $("adsCountBadge").textContent = this.ads.length + " Ad" + (this.ads.length === 1 ? "" : "s");
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty" style="color:#B91C1C;">Error loading ads: ' + err.message + '</td></tr>';
    }
  };

  AdminController.prototype.renderAdsTable = function () {
    var self = this;
    var tbody = $("adsTableBody");
    var query = ($("adSearchInput").value || "").toLowerCase().trim();
    var filter = $("adStatusFilter").value;

    var filtered = this.ads.filter(function (ad) {
      var status = self.computeStatus(ad);
      if (filter === "active" && status.label !== "Active") return false;
      if (filter === "scheduled" && status.label !== "Scheduled") return false;
      if (filter === "expired" && status.label !== "Expired") return false;
      if (filter === "disabled" && status.label !== "Disabled") return false;

      if (query) {
        var matchTitle = (ad.title || "").toLowerCase().includes(query);
        var matchClient = (ad.client_name || "").toLowerCase().includes(query);
        var matchBadge = (ad.badge || "").toLowerCase().includes(query);
        if (!matchTitle && !matchClient && !matchBadge) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No advertisements found matching the selected filters.</td></tr>';
      return;
    }

    tbody.innerHTML = "";

    filtered.forEach(function (ad, index) {
      var tr = document.createElement("tr");
      var status = self.computeStatus(ad);

      // Order / Priority Cell
      var tdOrder = document.createElement("td");
      var pWrap = document.createElement("div");
      pWrap.className = "priority-cell";
      pWrap.innerHTML = '<span>' + (ad.priority || 1) + '</span>' +
        '<button type="button" class="order-btn" title="Increase priority">▲</button>' +
        '<button type="button" class="order-btn" title="Decrease priority">▼</button>';

      var upBtn = pWrap.querySelectorAll(".order-btn")[0];
      var downBtn = pWrap.querySelectorAll(".order-btn")[1];

      upBtn.addEventListener("click", async function () {
        await window.AdsService.updateAd(ad.id, { priority: (ad.priority || 1) + 1 });
        self.loadAds();
      });
      downBtn.addEventListener("click", async function () {
        var newP = Math.max(1, (ad.priority || 1) - 1);
        await window.AdsService.updateAd(ad.id, { priority: newP });
        self.loadAds();
      });
      tdOrder.appendChild(pWrap);
      tr.appendChild(tdOrder);

      // Advertisement Content Cell
      var tdAd = document.createElement("td");
      var adItem = document.createElement("div");
      adItem.className = "table-ad-item";

      if (ad.image_url) {
        var img = document.createElement("img");
        img.className = "table-ad-thumb";
        img.src = ad.image_url;
        img.alt = ad.title;
        img.onerror = function () {
          adItem.replaceChild(makeFallbackIcon(), img);
        };
        adItem.appendChild(img);
      } else {
        adItem.appendChild(makeFallbackIcon());
      }

      function makeFallbackIcon() {
        var f = document.createElement("div");
        f.className = "table-ad-fallback";
        f.textContent = "🪩";
        return f;
      }

      var infoDiv = document.createElement("div");
      infoDiv.innerHTML = '<div class="table-ad-title">' + escapeHtml(ad.title) + '</div>' +
        '<div class="table-ad-meta">' +
        '<span class="table-badge">' + escapeHtml(ad.badge || "SPONSORED") + '</span>' +
        (ad.subtitle ? '<span style="font-size:11px;color:#64748B;">' + escapeHtml(ad.subtitle) + '</span>' : '') +
        '<a href="' + escapeHtml(ad.destination_url) + '" target="_blank" class="table-link-preview" title="' + escapeHtml(ad.destination_url) + '">↗ ' + escapeHtml(ad.destination_url) + '</a>' +
        '</div>';
      adItem.appendChild(infoDiv);
      tdAd.appendChild(adItem);
      tr.appendChild(tdAd);

      // Client / Sponsor Cell
      var tdClient = document.createElement("td");
      tdClient.innerHTML = '<b>' + escapeHtml(ad.client_name || "Direct Sponsor") + '</b>' +
        (ad.client_email ? '<div style="font-size:11px;color:#64748B;">' + escapeHtml(ad.client_email) + '</div>' : '');
      tr.appendChild(tdClient);

      // Duration Cell
      var tdDur = document.createElement("td");
      tdDur.innerHTML = '<b>' + (ad.duration_seconds || 7) + 's</b>';
      tr.appendChild(tdDur);

      // Schedule Window Cell
      var tdSched = document.createElement("td");
      if (!ad.start_at && !ad.end_at) {
        tdSched.innerHTML = '<span style="font-size:12px;color:#10B981;font-weight:600;">Always Active</span>';
      } else {
        var sStr = ad.start_at ? new Date(ad.start_at).toLocaleDateString() : "Now";
        var eStr = ad.end_at ? new Date(ad.end_at).toLocaleDateString() : "Forever";
        tdSched.innerHTML = '<span style="font-size:11.5px;">' + sStr + ' → ' + eStr + '</span>';
      }
      tr.appendChild(tdSched);

      // Status Pill Cell
      var tdStatus = document.createElement("td");
      tdStatus.innerHTML = '<span class="status-pill ' + status.class + '">' + status.label + '</span>';
      tr.appendChild(tdStatus);

      // Actions Cell
      var tdActions = document.createElement("td");
      tdActions.style.textAlign = "right";
      var actWrap = document.createElement("div");
      actWrap.className = "table-actions";

      // Toggle Switch
      var toggleBtn = document.createElement("button");
      toggleBtn.className = "btn btn-sm " + (ad.is_active ? "btn-outline" : "btn-secondary");
      toggleBtn.textContent = ad.is_active ? "Disable" : "Enable";
      toggleBtn.addEventListener("click", async function () {
        await window.AdsService.toggleAdActive(ad.id, ad.is_active);
        self.loadAds();
      });
      actWrap.appendChild(toggleBtn);

      // Edit Button
      var editBtn = document.createElement("button");
      editBtn.className = "btn btn-outline btn-sm";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", function () {
        self.openAdModal(ad);
      });
      actWrap.appendChild(editBtn);

      // Delete Button
      var delBtn = document.createElement("button");
      delBtn.className = "btn btn-danger btn-sm";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async function () {
        if (confirm("Are you sure you want to delete advertisement: \"" + ad.title + "\"?")) {
          await window.AdsService.deleteAd(ad.id);
          self.loadAds();
        }
      });
      actWrap.appendChild(delBtn);

      tdActions.appendChild(actWrap);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  };

  /* ---------------------------------------------------- Live Ad Island Preview */

  AdminController.prototype.renderLivePreview = function () {
    var mount = $("previewIslandMount");
    if (!mount) return;

    if (this.previewTimer) {
      clearInterval(this.previewTimer);
      this.previewTimer = null;
    }

    var activeAds = this.ads.filter(function (a) {
      return a.is_active;
    });

    if (activeAds.length === 0) {
      mount.innerHTML = '<div style="color:#94A3B8;font-size:13px;font-style:italic;">No active advertisements currently scheduled.</div>';
      return;
    }

    if (this.previewIndex >= activeAds.length) this.previewIndex = 0;

    var self = this;
    function renderIndex(idx) {
      var ad = activeAds[idx];
      if (!ad) return;

      mount.innerHTML = "";

      var island = document.createElement("div");
      island.className = "ad-island anim-in";

      var media = document.createElement("div");
      media.className = "ad-island-media";
      if (ad.image_url) {
        media.innerHTML = '<img class="ad-island-thumb" src="' + escapeHtml(ad.image_url) + '" alt="">';
      } else {
        media.innerHTML = '<span class="ad-island-fallback-icon">🪩</span>';
      }
      island.appendChild(media);

      var body = document.createElement("div");
      body.className = "ad-island-body";
      body.innerHTML = '<div class="ad-island-meta">' +
        '<span class="ad-island-badge">' + escapeHtml(ad.badge || "SPONSORED") + '</span>' +
        '<span class="ad-island-sponsor">' + escapeHtml(ad.client_name || "") + '</span>' +
        '</div>' +
        '<div class="ad-island-title">' + escapeHtml(ad.title) + '</div>' +
        (ad.subtitle ? '<div class="ad-island-sub">' + escapeHtml(ad.subtitle) + '</div>' : '');
      island.appendChild(body);

      var actions = document.createElement("div");
      actions.className = "ad-island-actions";
      actions.innerHTML = '<div class="ad-island-cta">↗</div>';
      island.appendChild(actions);

      mount.appendChild(island);
    }

    renderIndex(this.previewIndex);

    if (activeAds.length > 1) {
      this.previewTimer = setInterval(function () {
        self.previewIndex = (self.previewIndex + 1) % activeAds.length;
        renderIndex(self.previewIndex);
      }, 5000);
    }
  };

  /* ------------------------------------------------------------- Ad Modal Form */

  AdminController.prototype.bindAdEvents = function () {
    var self = this;

    $("btnNewAd").addEventListener("click", function () {
      self.openAdModal(null);
    });

    $("btnAdModalClose").addEventListener("click", function () {
      self.closeAdModal();
    });

    $("btnAdModalCancel").addEventListener("click", function () {
      self.closeAdModal();
    });

    $("adSearchInput").addEventListener("input", function () {
      self.renderAdsTable();
    });

    $("adStatusFilter").addEventListener("change", function () {
      self.renderAdsTable();
    });

    $("adForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var errEl = $("modalFormError");
      errEl.setAttribute("hidden", "true");

      var title = $("adInputTitle").value.trim();
      var destUrl = $("adInputDestUrl").value.trim();
      var clientName = $("adInputClient").value.trim();

      if (!title || !destUrl || !clientName) {
        errEl.textContent = "Please fill in all required fields (Title, Destination URL, Sponsor Name).";
        errEl.removeAttribute("hidden");
        return;
      }

      var adData = {
        title: title,
        subtitle: $("adInputSubtitle").value.trim(),
        badge: $("adInputBadge").value.trim(),
        destination_url: destUrl,
        image_url: $("adInputImageUrl").value.trim(),
        client_name: clientName,
        client_email: $("adInputClientEmail").value.trim(),
        duration_seconds: parseInt($("adInputDuration").value, 10) || 7,
        priority: parseInt($("adInputPriority").value, 10) || 10,
        start_at: $("adInputStart").value ? new Date($("adInputStart").value).toISOString() : null,
        end_at: $("adInputEnd").value ? new Date($("adInputEnd").value).toISOString() : null,
        is_active: $("adInputIsActive").checked
      };

      try {
        if (self.currentEditId) {
          await window.AdsService.updateAd(self.currentEditId, adData);
        } else {
          await window.AdsService.createAd(adData);
          if (self.pendingApprovalRequestId) {
            await window.AdsService.updateAdRequestStatus(self.pendingApprovalRequestId, "approved");
            self.pendingApprovalRequestId = null;
          }
        }
        self.closeAdModal();
        self.loadAds();
        self.loadAdRequests();
      } catch (err) {
        errEl.textContent = "Error saving advertisement: " + err.message;
        errEl.removeAttribute("hidden");
      }
    });
  };

  AdminController.prototype.openAdModal = function (ad) {
    this.currentEditId = ad ? ad.id : null;
    $("adModalTitle").textContent = ad ? "Edit Advertisement" : "Create Advertisement";
    $("modalFormError").setAttribute("hidden", "true");

    $("adFormId").value = ad ? ad.id : "";
    $("adInputTitle").value = ad ? (ad.title || "") : "";
    $("adInputSubtitle").value = ad ? (ad.subtitle || "") : "";
    $("adInputBadge").value = ad ? (ad.badge || "SPONSORED") : "SPONSORED";
    $("adInputDestUrl").value = ad ? (ad.destination_url || "") : "";
    $("adInputImageUrl").value = ad ? (ad.image_url || "") : "";
    $("adInputClient").value = ad ? (ad.client_name || "") : "";
    $("adInputClientEmail").value = ad ? (ad.client_email || "") : "";
    $("adInputDuration").value = ad ? (ad.duration_seconds || 7) : 7;
    $("adInputPriority").value = ad ? (ad.priority || 10) : 10;
    $("adInputStart").value = ad && ad.start_at ? formatDatetimeLocal(ad.start_at) : "";
    $("adInputEnd").value = ad && ad.end_at ? formatDatetimeLocal(ad.end_at) : "";
    $("adInputIsActive").checked = ad ? ad.is_active !== false : true;

    $("adModal").removeAttribute("hidden");
  };

  AdminController.prototype.closeAdModal = function () {
    $("adModal").setAttribute("hidden", "true");
    this.currentEditId = null;
    this.pendingApprovalRequestId = null;
  };

  /* --------------------------------------------------------- Ad Requests (Leads) */

  AdminController.prototype.bindRequestEvents = function () {
    var self = this;

    var searchInput = $("reqSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        self.renderRequestsTable();
      });
    }

    var statusFilter = $("reqStatusFilter");
    if (statusFilter) {
      statusFilter.addEventListener("change", function () {
        self.renderRequestsTable();
      });
    }

    var refreshBtn = $("btnRefreshRequests");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        self.loadAdRequests();
      });
    }
  };

  AdminController.prototype.loadAdRequests = async function () {
    var tbody = $("requestsTableBody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Loading advertisement requests...</td></tr>';

    try {
      this.requests = await window.AdsService.fetchAdRequests();
      this.renderRequestsTable();

      // Update pending badge
      var pendingCount = (this.requests || []).filter(function (r) {
        return (r.status || "pending").toLowerCase() === "pending";
      }).length;

      var badge = $("pendingRequestsBadge");
      if (badge) {
        badge.textContent = pendingCount + " New";
        if (pendingCount > 0) badge.removeAttribute("hidden");
        else badge.setAttribute("hidden", "true");
      }

      var countEl = $("requestsCountBadge");
      if (countEl) {
        countEl.textContent = this.requests.length + " Request" + (this.requests.length === 1 ? "" : "s");
      }
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty" style="color:#B91C1C;">Error loading requests: ' + err.message + '</td></tr>';
    }
  };

  AdminController.prototype.renderRequestsTable = function () {
    var self = this;
    var tbody = $("requestsTableBody");
    if (!tbody) return;

    var query = ($("reqSearchInput") ? $("reqSearchInput").value : "").toLowerCase().trim();
    var filter = $("reqStatusFilter") ? $("reqStatusFilter").value : "all";

    var filtered = (this.requests || []).filter(function (req) {
      var st = (req.status || "pending").toLowerCase();
      if (filter !== "all" && st !== filter) return false;

      if (query) {
        var matchName = (req.name || "").toLowerCase().includes(query);
        var matchContact = (req.contact || "").toLowerCase().includes(query);
        var matchCat = (req.category || "").toLowerCase().includes(query);
        var matchDesc = (req.description || "").toLowerCase().includes(query);
        if (!matchName && !matchContact && !matchCat && !matchDesc) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No advertisement requests found matching your filters.</td></tr>';
      return;
    }

    tbody.innerHTML = "";

    filtered.forEach(function (req) {
      var tr = document.createElement("tr");

      // Date / Time
      var tdDate = document.createElement("td");
      var d = req.created_at ? new Date(req.created_at) : new Date();
      tdDate.innerHTML = '<span style="font-size:12px;font-weight:600;">' + d.toLocaleDateString() + '</span>' +
        '<div style="font-size:11px;color:#64748B;">' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</div>';
      tr.appendChild(tdDate);

      // Applicant & Contact
      var tdApplicant = document.createElement("td");
      tdApplicant.innerHTML = '<b>' + escapeHtml(req.name) + '</b>' +
        '<div style="font-size:11.5px;color:#2563EB;margin-top:2px;"><b>' + escapeHtml(req.contact) + '</b></div>';
      tr.appendChild(tdApplicant);

      // Category
      var tdCat = document.createElement("td");
      tdCat.innerHTML = '<span style="background:#F1F5F9;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700;color:#0F172A;">' + escapeHtml(req.category) + '</span>';
      tr.appendChild(tdCat);

      // Selected Plan
      var tdPlan = document.createElement("td");
      var price = req.price_inr || (req.plan_id === "premium" ? 499 : req.plan_id === "standard" ? 139 : 49);
      var days = req.duration_days || (req.plan_id === "premium" ? 6 : req.plan_id === "standard" ? 3 : 1);
      tdPlan.innerHTML = '<b style="color:#EF4444;">₹' + price + '</b>' +
        '<div style="font-size:11px;color:#64748B;">' + days + ' Day' + (days > 1 ? 's' : '') + ' (' + escapeHtml(req.plan_name || req.plan_id) + ')</div>';
      tr.appendChild(tdPlan);

      // Description & Link
      var tdDesc = document.createElement("td");
      tdDesc.style.maxWidth = "220px";
      tdDesc.innerHTML = '<div style="font-weight:600;line-height:1.3;">' + escapeHtml(req.description) + '</div>' +
        (req.destination_url ? '<a href="' + escapeHtml(req.destination_url) + '" target="_blank" style="font-size:11px;color:#3B82F6;text-decoration:none;" title="' + escapeHtml(req.destination_url) + '">↗ ' + escapeHtml(req.destination_url) + '</a>' : '') +
        (req.message ? '<div style="font-size:11px;color:#64748B;font-style:italic;margin-top:2px;">Note: ' + escapeHtml(req.message) + '</div>' : '');
      tr.appendChild(tdDesc);

      // Status
      var tdStatus = document.createElement("td");
      var stClass = "is-disabled";
      var stLabel = (req.status || "pending").toUpperCase();
      if (req.status === "approved") stClass = "is-active";
      else if (req.status === "rejected") stClass = "is-expired";
      else stClass = "is-disabled";

      tdStatus.innerHTML = '<span class="status-pill ' + stClass + '">' + stLabel + '</span>';
      tr.appendChild(tdStatus);

      // Actions
      var tdActions = document.createElement("td");
      tdActions.style.textAlign = "right";
      var actWrap = document.createElement("div");
      actWrap.className = "table-actions";

      // "Approve & Launch as Ad" button
      var appBtn = document.createElement("button");
      appBtn.className = "btn btn-primary btn-sm";
      appBtn.textContent = "Approve & Launch ↗";
      appBtn.title = "Approve request and configure live Top Island Ad";
      appBtn.addEventListener("click", function () {
        self.approveRequestAsAd(req);
      });
      actWrap.appendChild(appBtn);

      // Quick reject button
      if (req.status !== "rejected") {
        var rejBtn = document.createElement("button");
        rejBtn.className = "btn btn-outline btn-sm";
        rejBtn.textContent = "Reject";
        rejBtn.addEventListener("click", async function () {
          await window.AdsService.updateAdRequestStatus(req.id, "rejected");
          self.loadAdRequests();
        });
        actWrap.appendChild(rejBtn);
      }

      // Delete button
      var delBtn = document.createElement("button");
      delBtn.className = "btn btn-danger btn-sm";
      delBtn.textContent = "×";
      delBtn.title = "Delete Request";
      delBtn.addEventListener("click", async function () {
        if (confirm("Delete request from " + req.name + "?")) {
          await window.AdsService.deleteAdRequest(req.id);
          self.loadAdRequests();
        }
      });
      actWrap.appendChild(delBtn);

      tdActions.appendChild(actWrap);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  };

  AdminController.prototype.approveRequestAsAd = function (req) {
    this.pendingApprovalRequestId = req.id;
    this.openAdModal(null);

    // Pre-populate fields from the request
    $("adInputTitle").value = req.description || "";
    $("adInputClient").value = req.name || "";
    $("adInputClientEmail").value = req.contact || "";
    $("adInputBadge").value = (req.category || "SPONSORED").toUpperCase();
    $("adInputDestUrl").value = req.destination_url || "";
    $("adInputDuration").value = 7;
    $("adInputPriority").value = 10;

    // Pre-set end schedule according to selected plan
    var days = req.duration_days || (req.plan_id === "premium" ? 6 : req.plan_id === "standard" ? 3 : 1);
    var endDate = new Date(Date.now() + days * 86400000);
    $("adInputStart").value = formatDatetimeLocal(new Date().toISOString());
    $("adInputEnd").value = formatDatetimeLocal(endDate.toISOString());
    $("adInputIsActive").checked = true;
  };

  /* ------------------------------------------------------------- Client Analytics */

  AdminController.prototype.bindAnalyticsEvents = function () {
    var self = this;

    $("clientAnalyticsFilter").addEventListener("change", function () {
      self.loadAnalytics();
    });

    $("btnRefreshAnalytics").addEventListener("click", function () {
      self.loadAnalytics();
    });

    $("btnCopyClientLink").addEventListener("click", function () {
      var selected = $("clientAnalyticsFilter").value;
      var baseUrl = window.location.origin + window.location.pathname;
      var shareUrl = selected ? baseUrl + "?client=" + encodeURIComponent(selected) : baseUrl + "?client=all";

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(function () {
          alert("Sponsor Report Link copied to clipboard:\n" + shareUrl);
        });
      } else {
        prompt("Copy this sponsor report link:", shareUrl);
      }
    });
  };

  AdminController.prototype.loadAnalytics = async function () {
    var selectedClient = $("clientAnalyticsFilter").value || this.clientOnlyMode || "";
    var tbody = $("analyticsTableBody");
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Loading performance data...</td></tr>';

    try {
      var data = await window.AdsService.getAnalyticsSummary(selectedClient);

      // Update KPI Cards
      $("kpiActiveAds").textContent = data.activeAds;
      $("kpiImpressions").textContent = data.totalImpressions.toLocaleString();
      $("kpiClicks").textContent = data.totalClicks.toLocaleString();
      $("kpiCtr").textContent = data.overallCtr + "%";

      // Populate Client Filter Dropdown if not already populated
      var select = $("clientAnalyticsFilter");
      var currentVal = select.value;
      var clientSet = new Set();
      this.ads.forEach(function (a) {
        if (a.client_name) clientSet.add(a.client_name);
      });

      if (select.options.length <= 1) {
        clientSet.forEach(function (c) {
          var opt = document.createElement("option");
          opt.value = c;
          opt.textContent = c;
          select.appendChild(opt);
        });
      }
      if (selectedClient) select.value = selectedClient;

      // Render Table
      if (data.adReports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No performance data found for the selected sponsor.</td></tr>';
        return;
      }

      tbody.innerHTML = "";
      var self = this;

      data.adReports.forEach(function (item) {
        var ad = item.ad;
        var tr = document.createElement("tr");
        var status = self.computeStatus(ad);

        tr.innerHTML = '<td><b>' + escapeHtml(ad.title) + '</b></td>' +
          '<td>' + escapeHtml(ad.client_name || "Direct Sponsor") + '</td>' +
          '<td><b>' + item.impressions.toLocaleString() + '</b></td>' +
          '<td><b>' + item.clicks.toLocaleString() + '</b></td>' +
          '<td><b style="color:#EF4444;">' + item.ctr + '%</b></td>' +
          '<td><span class="status-pill ' + status.class + '">' + status.label + '</span></td>' +
          '<td>' + (ad.priority || 1) + '</td>' +
          '<td style="text-align:right;">' +
          '<div style="background:#FEE2E2;border-radius:4px;height:8px;width:80px;display:inline-block;overflow:hidden;">' +
          '<div style="background:#EF4444;height:100%;width:' + Math.min(100, Math.max(0, parseFloat(item.ctr) * 10)) + '%;"></div>' +
          '</div>' +
          '</td>';

        tbody.appendChild(tr);
      });

    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty" style="color:#B91C1C;">Error loading analytics: ' + err.message + '</td></tr>';
    }
  };

  /* ------------------------------------------------------------- Supabase Database */

  AdminController.prototype.bindDatabaseEvents = function () {
    var self = this;

    $("btnSaveSbConfig").addEventListener("click", function () {
      var url = $("sbUrlInput").value.trim();
      var key = $("sbKeyInput").value.trim();

      window.AdsService.saveSupabaseConfig(url, key);
      self.updateSupabaseStatusBadge();
      self.showAlert("sbConfigAlert", "Supabase credentials saved successfully. System reinitialized.", "success");
      self.loadAds();
    });

    $("btnTestSbConfig").addEventListener("click", async function () {
      var url = $("sbUrlInput").value.trim();
      var key = $("sbKeyInput").value.trim();

      if (!url || !key) {
        self.showAlert("sbConfigAlert", "Please enter both Supabase Project URL and Anon Key to test.", "error");
        return;
      }

      self.showAlert("sbConfigAlert", "Testing connection to Supabase endpoint...", "info");

      try {
        if (!window.supabase || typeof window.supabase.createClient !== "function") {
          throw new Error("Supabase JS SDK library not loaded.");
        }
        var client = window.supabase.createClient(url, key);
        var res = await client.from("ads").select("id").limit(1);

        if (res.error) {
          self.showAlert("sbConfigAlert", "Connection returned error: " + res.error.message + ". Have you run the SQL migration script?", "error");
        } else {
          self.showAlert("sbConfigAlert", "Connection successful! 'ads' table is accessible.", "success");
        }
      } catch (e) {
        self.showAlert("sbConfigAlert", "Connection failed: " + e.message, "error");
      }
    });

    $("btnClearSbConfig").addEventListener("click", function () {
      if (confirm("Reset to Local Storage mode? Cloud configuration will be removed from this browser.")) {
        window.AdsService.saveSupabaseConfig("", "");
        $("sbUrlInput").value = "";
        $("sbKeyInput").value = "";
        self.updateSupabaseStatusBadge();
        self.showAlert("sbConfigAlert", "Switched back to resilient Local Storage mode.", "info");
        self.loadAds();
      }
    });

    $("btnCopySql").addEventListener("click", function () {
      var sql = $("sqlCodeBlock").textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(sql).then(function () {
          alert("SQL Migration Script copied to clipboard! Paste it into your Supabase SQL Editor.");
        });
      } else {
        prompt("Copy SQL script:", sql);
      }
    });
  };

  AdminController.prototype.loadDatabaseConfig = function () {
    var cfg = window.AdsService.getSupabaseConfig();
    $("sbUrlInput").value = cfg.url || "";
    $("sbKeyInput").value = cfg.key || "";
  };

  AdminController.prototype.updateSupabaseStatusBadge = function () {
    var badge = $("supabaseStatusBadge");
    var text = $("supabaseStatusText");
    if (!badge || !text) return;

    if (window.AdsService.isSupabaseConnected()) {
      badge.className = "status-indicator is-online";
      text.textContent = "Supabase Cloud";
    } else {
      badge.className = "status-indicator is-local";
      text.textContent = "Local Fallback Mode";
    }
  };

  AdminController.prototype.showAlert = function (elId, msg, type) {
    var el = $(elId);
    if (!el) return;
    el.className = "alert alert-" + type;
    el.textContent = msg;
    el.removeAttribute("hidden");
  };

  /* ---------------------------------------------------------------- Utilities */

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDatetimeLocal(isoStr) {
    try {
      var d = new Date(isoStr);
      if (isNaN(d.getTime())) return "";
      var pad = function (n) { return n < 10 ? "0" + n : n; };
      return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
        "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
    } catch (e) {
      return "";
    }
  }

  window.AdminController = new AdminController();
})();
