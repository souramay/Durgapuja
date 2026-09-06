/* ==========================================================================
   admin.js — Admin Controller & Client Analytics Portal Engine
   Handles authentication, ad CRUD, priority controls, and sponsor metrics.
   ========================================================================== */

(function () {
  "use strict";

  var SESS_KEY = "sharodiya_admin_logged_in";
  var PIN_KEY = "sharodiya_custom_admin_pin";
  var DEFAULT_PIN = "admin123";

  function $(id) { return document.getElementById(id); }

  function AdminController() {
    this.ads = [];
    this.currentEditId = null;
    this.activeTab = "ads";
    this.previewTimer = null;
    this.previewIndex = 0;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", this.init.bind(this));
    } else {
      this.init();
    }
  }

  AdminController.prototype.init = function () {
    this.bindAuthEvents();
    this.bindNavigation();
    this.bindAdEvents();
    this.bindAnalyticsEvents();
    this.bindDatabaseEvents();

    // Check for client portal query param ?client=xyz
    var urlParams = new URLSearchParams(window.location.search);
    var clientParam = urlParams.get("client");

    if (this.isAuthenticated() || clientParam) {
      this.unlockDashboard(clientParam);
    } else {
      this.showAuthGate();
    }
  };

  /* ------------------------------------------------------------- Authentication */

  AdminController.prototype.isAuthenticated = function () {
    return sessionStorage.getItem(SESS_KEY) === "1";
  };

  AdminController.prototype.showAuthGate = function () {
    $("authGate").removeAttribute("hidden");
    $("adminApp").setAttribute("hidden", "true");
  };

  AdminController.prototype.unlockDashboard = function (clientParam) {
    $("authGate").setAttribute("hidden", "true");
    $("adminApp").removeAttribute("hidden");

    this.updateSupabaseStatusBadge();

    if (clientParam) {
      // Direct sponsor / client mode
      this.switchTab("analytics");
      var filterSelect = $("clientAnalyticsFilter");
      if (filterSelect) {
        // Will be populated and selected after analytics load
        this.clientOnlyMode = clientParam;
      }
    }

    this.loadAds();
    this.loadAnalytics();
  };

  AdminController.prototype.bindAuthEvents = function () {
    var self = this;

    // Switch between Admin PIN & Supabase Auth tabs
    $("tabAdminPin").addEventListener("click", function () {
      this.classList.add("is-active");
      $("tabSupabaseAuth").classList.remove("is-active");
      $("panelAdminPin").removeAttribute("hidden");
      $("panelSupabaseAuth").setAttribute("hidden", "true");
    });

    $("tabSupabaseAuth").addEventListener("click", function () {
      this.classList.add("is-active");
      $("tabAdminPin").classList.remove("is-active");
      $("panelSupabaseAuth").removeAttribute("hidden");
      $("panelAdminPin").setAttribute("hidden", "true");
    });

    // Form submission
    $("authForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var errEl = $("authError");
      errEl.setAttribute("hidden", "true");

      var isPinTab = $("tabAdminPin").classList.contains("is-active");

      if (isPinTab) {
        var pin = ($("adminPinInput").value || "").trim();
        var validPin = localStorage.getItem(PIN_KEY) || DEFAULT_PIN;

        if (pin === validPin) {
          sessionStorage.setItem(SESS_KEY, "1");
          self.unlockDashboard();
        } else {
          errEl.textContent = "Invalid Admin Passkey. Please try again.";
          errEl.removeAttribute("hidden");
        }
      } else {
        // Supabase Email / Password login
        var email = ($("sbEmailInput").value || "").trim();
        var pass = ($("sbPassInput").value || "").trim();

        if (!email || !pass) {
          errEl.textContent = "Please enter both email and password.";
          errEl.removeAttribute("hidden");
          return;
        }

        if (window.AdsService && window.AdsService.supabase) {
          try {
            var res = await window.AdsService.supabase.auth.signInWithPassword({
              email: email,
              password: pass
            });
            if (res.error) {
              errEl.textContent = res.error.message;
              errEl.removeAttribute("hidden");
              return;
            }
            sessionStorage.setItem(SESS_KEY, "1");
            self.unlockDashboard();
          } catch (err) {
            errEl.textContent = "Authentication failed: " + err.message;
            errEl.removeAttribute("hidden");
          }
        } else {
          errEl.textContent = "Supabase is not connected yet. Please login with the Admin Passkey.";
          errEl.removeAttribute("hidden");
        }
      }
    });

    // Logout
    $("btnLogout").addEventListener("click", function () {
      sessionStorage.removeItem(SESS_KEY);
      if (window.AdsService && window.AdsService.supabase) {
        window.AdsService.supabase.auth.signOut().catch(function () {});
      }
      location.href = "/admin";
    });
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
        }
        self.closeAdModal();
        self.loadAds();
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
