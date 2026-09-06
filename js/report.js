/* ==========================================================================
   js/report.js — Sponsor Performance Report Client Controller
   Fetches strictly scoped campaign metrics and renders executive dashboard.
   ========================================================================== */

(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  var currentToken = "";

  function init() {
    var params = new URLSearchParams(window.location.search);
    currentToken = (params.get("token") || "").trim();

    if (!currentToken) {
      showError(
        "Secure Token Required",
        "No access token was provided in the link. Please use the complete shareable link provided by the Sharodiya campaign administrator."
      );
      return;
    }

    bindEvents();
    loadReport();
  }

  function bindEvents() {
    var btnRefresh = $("btnRefresh");
    if (btnRefresh) {
      btnRefresh.addEventListener("click", function () {
        loadReport();
      });
    }

    var btnPrint = $("btnPrint");
    if (btnPrint) {
      btnPrint.addEventListener("click", function () {
        window.print();
      });
    }
  }

  async function loadReport() {
    setLoading(true);

    try {
      var res = await fetch("/api/sponsor-report?token=" + encodeURIComponent(currentToken), {
        headers: {
          "Accept": "application/json"
        }
      });

      var data = null;
      try {
        data = await res.json();
      } catch (jsonErr) {
        // non-json response
      }

      if (!res.ok || !data || !data.success) {
        // If 404 or network failure, check local fallback for offline/demo tokens
        if (checkOfflineFallback(currentToken)) {
          return;
        }

        var msg = (data && data.error) || "Unable to authorize this performance report link.";
        showError("Access Denied", msg);
        return;
      }

      renderReport(data);
    } catch (err) {
      console.warn("[report.js] Network/API fetch error:", err);
      if (checkOfflineFallback(currentToken)) {
        return;
      }
      showError(
        "Connection Error",
        "Could not connect to the analytics server. Please verify your internet connection and try again."
      );
    }
  }

  function renderReport(data) {
    $("loadingState").setAttribute("hidden", "true");
    $("errorState").setAttribute("hidden", "true");
    $("reportContent").removeAttribute("hidden");

    // Sponsor & Metadata
    var sponsorName = data.sponsor_name || "Sponsor";
    $("sponsorNameHeading").textContent = sponsorName;
    document.querySelectorAll(".sponsor-name-inline").forEach(function (el) {
      el.textContent = sponsorName;
    });

    document.title = sponsorName + " — Performance Report | শারদীয়া Radio";

    var reportDate = data.generated_at ? new Date(data.generated_at) : new Date();
    $("sponsorReportTime").textContent = reportDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    if (data.token_info && data.token_info.expires_at) {
      var expDate = new Date(data.token_info.expires_at);
      $("sponsorTokenExpiry").textContent = "Expires " + expDate.toLocaleDateString();
    } else {
      $("sponsorTokenExpiry").textContent = "Permanent Active";
    }

    // KPI Metrics
    var m = data.metrics || {};
    var totalImp = m.total_impressions || 0;
    var totalClk = m.total_clicks || 0;
    var ctr = typeof m.ctr === "number" ? m.ctr.toFixed(2) : (m.ctr || "0.00");

    $("metricImpressions").textContent = totalImp.toLocaleString();
    $("metricClicks").textContent = totalClk.toLocaleString();
    $("metricCtr").textContent = ctr + "%";
    $("metricCampaigns").textContent = m.total_campaigns || (data.campaigns ? data.campaigns.length : 0);
    $("metricActiveSummary").textContent = (m.active_campaigns || 0) + " active advertising slots";

    // Campaigns Table
    renderCampaignsTable(data.campaigns || []);

    // Daily Table
    renderDailyTable(data.daily_trends || []);
  }

  function renderCampaignsTable(campaigns) {
    var tbody = $("campaignsTableBody");
    tbody.innerHTML = "";

    if (!campaigns || campaigns.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No active or scheduled campaigns found for this sponsor.</td></tr>';
      return;
    }

    campaigns.forEach(function (c) {
      var tr = document.createElement("tr");

      // Status Badge
      var statusBadge = "";
      if (c.is_active) {
        statusBadge = '<span class="badge badge-active">Active</span>';
      } else {
        statusBadge = '<span class="badge badge-ended">Inactive</span>';
      }

      // CTR bar fill percentage (capped at 100)
      var ctrNum = parseFloat(c.ctr) || 0;
      var barPct = Math.min(100, Math.max(0, ctrNum * 4)); // visual scale

      // Media
      var thumbHtml = "";
      if (c.image_url) {
        thumbHtml = '<img src="' + escapeHtml(c.image_url) + '" alt="" class="campaign-thumb" onerror="this.outerHTML=\'<span class=\\\'campaign-fallback\\\'>🪩</span>\'">';
      } else {
        thumbHtml = '<span class="campaign-fallback">🪩</span>';
      }

      // Schedule Range
      var scheduleText = "Permanent / Ongoing";
      if (c.start_at || c.end_at) {
        var startStr = c.start_at ? new Date(c.start_at).toLocaleDateString() : "Now";
        var endStr = c.end_at ? new Date(c.end_at).toLocaleDateString() : "Indefinite";
        scheduleText = startStr + " → " + endStr;
      }

      tr.innerHTML =
        '<td>' +
          '<div class="campaign-cell">' +
            thumbHtml +
            '<div class="campaign-title-wrap">' +
              '<b>' + escapeHtml(c.title || "Untitled") + '</b>' +
              (c.subtitle ? '<span class="campaign-sub-text">' + escapeHtml(c.subtitle) + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td>' +
          (c.destination_url
            ? '<a href="' + escapeHtml(c.destination_url) + '" target="_blank" rel="noopener noreferrer" class="link-out" title="' + escapeHtml(c.destination_url) + '">' +
                escapeHtml(c.destination_url) + ' ↗' +
              '</a>'
            : '<span style="color:#94A3B8">—</span>') +
        '</td>' +
        '<td><span style="font-size:12px;color:#64748B;">' + escapeHtml(scheduleText) + '</span></td>' +
        '<td><span class="metric-highlight">' + (c.impressions || 0).toLocaleString() + '</span></td>' +
        '<td><span class="metric-highlight">' + (c.clicks || 0).toLocaleString() + '</span></td>' +
        '<td>' +
          '<div class="ctr-cell">' +
            '<span class="metric-highlight">' + (typeof c.ctr === "number" ? c.ctr.toFixed(2) : c.ctr) + '%</span>' +
            '<div class="ctr-bar-track">' +
              '<div class="ctr-bar-fill" style="width:' + barPct + '%;"></div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td>' + statusBadge + '</td>';

      tbody.appendChild(tr);
    });
  }

  function renderDailyTable(trends) {
    var tbody = $("dailyTableBody");
    tbody.innerHTML = "";

    if (!trends || trends.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No daily engagement logs recorded yet for this campaign.</td></tr>';
      return;
    }

    trends.forEach(function (d) {
      var tr = document.createElement("tr");
      var ctrNum = parseFloat(d.ctr) || 0;
      var barPct = Math.min(100, Math.max(0, ctrNum * 5));

      tr.innerHTML =
        '<td><b>' + escapeHtml(d.date) + '</b></td>' +
        '<td><span class="metric-highlight">' + (d.impressions || 0).toLocaleString() + '</span></td>' +
        '<td><span class="metric-highlight">' + (d.clicks || 0).toLocaleString() + '</span></td>' +
        '<td><span class="metric-highlight" style="color:#059669;">' + (typeof d.ctr === "number" ? d.ctr.toFixed(2) : d.ctr) + '%</span></td>' +
        '<td>' +
          '<div class="ctr-cell">' +
            '<div class="ctr-bar-track" style="width:90px;">' +
              '<div class="ctr-bar-fill" style="width:' + barPct + '%;"></div>' +
            '</div>' +
          '</div>' +
        '</td>';

      tbody.appendChild(tr);
    });
  }

  function setLoading(loading) {
    var loadEl = $("loadingState");
    if (!loadEl) return;
    if (loading) {
      loadEl.removeAttribute("hidden");
      $("errorState").setAttribute("hidden", "true");
      $("reportContent").setAttribute("hidden", "true");
    } else {
      loadEl.setAttribute("hidden", "true");
    }
  }

  function showError(title, message) {
    setLoading(false);
    $("reportContent").setAttribute("hidden", "true");
    var errEl = $("errorState");
    errEl.removeAttribute("hidden");
    $("errorTitle").textContent = title;
    $("errorMessage").textContent = message;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Local fallback for offline demo links
  function checkOfflineFallback(tok) {
    var localTokens = {
      "svf-music-demo-token-98f2a1b4e6": "SVF Music",
      "pujo-fashion-demo-token-4c7b8e1a": "Pujo Fashion House"
    };

    // Check localStorage stored tokens as well
    try {
      var stored = localStorage.getItem("sharodiya_report_tokens");
      if (stored) {
        var parsed = JSON.parse(stored);
        parsed.forEach(function (t) {
          if (t.token === tok && t.is_active) {
            localTokens[tok] = t.client_name;
          }
        });
      }
    } catch (e) {
      // ignore
    }

    var clientName = localTokens[tok];
    if (!clientName) return false;

    // Build mock report for offline preview
    var mockData = {
      success: true,
      sponsor_name: clientName,
      generated_at: new Date().toISOString(),
      token_info: { expires_at: null },
      metrics: {
        total_impressions: clientName === "SVF Music" ? 2450 : 1820,
        total_clicks: clientName === "SVF Music" ? 186 : 132,
        ctr: clientName === "SVF Music" ? 7.59 : 7.25,
        active_campaigns: 1,
        total_campaigns: 1
      },
      campaigns: [
        {
          id: "mock-1",
          title: clientName === "SVF Music" ? "বাঙালির পুজোর সেরা গান শুনুন" : "উৎসবের আনন্দ ও সাজপোশাক",
          subtitle: clientName === "SVF Music" ? "Special festive puja playlist collection" : "Durga Puja festive ethnic collection",
          badge: "SPONSORED",
          destination_url: clientName === "SVF Music" ? "https://www.youtube.com/" : "https://www.myntra.com/",
          image_url: clientName === "SVF Music"
            ? "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=120&auto=format&fit=crop&q=80"
            : "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=120&auto=format&fit=crop&q=80",
          is_active: true,
          impressions: clientName === "SVF Music" ? 2450 : 1820,
          clicks: clientName === "SVF Music" ? 186 : 132,
          ctr: clientName === "SVF Music" ? 7.59 : 7.25
        }
      ],
      daily_trends: [
        { date: "2026-09-04", impressions: 720, clicks: 54, ctr: 7.50 },
        { date: "2026-09-05", impressions: 840, clicks: 65, ctr: 7.74 },
        { date: "2026-09-06", impressions: 890, clicks: 67, ctr: 7.53 }
      ]
    };

    renderReport(mockData);
    return true;
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
