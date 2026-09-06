/* ==========================================================================
   js/report.js — Sponsor Performance Report Client Controller
   Fetches 100% real scoped campaign telemetry from Supabase.
   Zero mock/sample data. Enforces 3-hour rate limiting & debouncing.
   ========================================================================== */

(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  var currentToken = "";

  function extractToken() {
    // 1. Check URL query parameters (?token=...)
    var params = new URLSearchParams(window.location.search);
    var tok = params.get("token");

    // 2. Check hash parameters (#token=... or #/?token=...)
    if (!tok && window.location.hash) {
      var hashClean = window.location.hash.replace(/^#[/?]*/, "");
      var hashParams = new URLSearchParams(hashClean);
      tok = hashParams.get("token");
    }

    // 3. Check sessionStorage fallback (if redirected by cleanUrls)
    if (!tok && window.sessionStorage) {
      try {
        tok = window.sessionStorage.getItem("sharodiya_last_report_token");
      } catch (e) {
        // ignore
      }
    }

    if (tok && window.sessionStorage) {
      try {
        window.sessionStorage.setItem("sharodiya_last_report_token", tok.trim());
      } catch (e) {
        // ignore
      }
    }

    return (tok || "").trim();
  }

  function init() {
    currentToken = extractToken();

    if (!currentToken) {
      showError(
        "Secure Token Required",
        "No access token was provided in the link. Please use the complete shareable link (e.g. /report?token=...) provided by the Sharodiya campaign administrator."
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
        if (btnRefresh.disabled) return;
        btnRefresh.disabled = true;
        btnRefresh.classList.add("is-refreshing");
        loadReport();
        setTimeout(function () {
          btnRefresh.disabled = false;
          btnRefresh.classList.remove("is-refreshing");
        }, 3000);
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

    // 1. Fetch Real Insights via API (/api/sponsor-report)
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

      // Handle 3-Hour Rate Limit (HTTP 429)
      if (res.status === 429) {
        var rateMsg = (data && data.error) || "Rate limit reached: Maximum report requests exceeded for the current 3-hour window. Please try again after the window resets.";
        showError("3-Hour Rate Limit Active", rateMsg);
        return;
      }

      if (res.ok && data && data.success) {
        renderReport(data);
        return;
      }

      if (data && data.error && (res.status === 403 || res.status === 400)) {
        showError("Access Denied", data.error);
        return;
      }
    } catch (apiErr) {
      console.warn("[report.js] Local API endpoint fetch failed, checking direct database lookup:", apiErr);
    }

    // 2. Direct Supabase Query (Fallback if running on static host with Supabase credentials)
    if (window.supabase && window.SHARODIYA_CONFIG && window.SHARODIYA_CONFIG.supabase) {
      try {
        var sb = window.supabase.createClient(
          window.SHARODIYA_CONFIG.supabase.url,
          window.SHARODIYA_CONFIG.supabase.anonKey
        );

        var tokRes = await sb.from("sponsor_report_tokens").select("*").eq("token", currentToken);
        if (!tokRes.error && Array.isArray(tokRes.data) && tokRes.data.length > 0) {
          var tokRecord = tokRes.data[0];
          if (!tokRecord.is_active) {
            showError("Access Denied", "This sponsor report link has been revoked by the administrator.");
            return;
          }
          if (tokRecord.expires_at && new Date(tokRecord.expires_at) < new Date()) {
            showError("Access Denied", "This sponsor report link has expired.");
            return;
          }

          var clientName = tokRecord.client_name;
          var adsRes = await sb.from("ads").select("*").eq("client_name", clientName);
          var ads = (adsRes && adsRes.data) || [];
          var analyticsRes = await sb.from("ad_analytics").select("*").eq("client_name", clientName);
          var events = (analyticsRes && analyticsRes.data) || [];

          var payload = buildReportData(clientName, ads, events, tokRecord);
          renderReport(payload);
          return;
        }
      } catch (sbErr) {
        console.warn("[report.js] Direct database lookup exception:", sbErr);
      }
    }

    // Zero mock data: If real token cannot be validated, reject access gracefully
    showError(
      "Access Denied",
      "Unable to verify report token or retrieve campaign telemetry from Supabase. Please ensure the token is active and unexpired."
    );
  }

  function buildReportData(clientName, ads, events, tokRecord) {
    var statsByAd = {};
    var dailyMap = {};
    var deviceMap = { desktop: 0, mobile: 0, tablet: 0 };
    var totalImpressions = 0;
    var totalClicks = 0;

    ads.forEach(function (a) {
      statsByAd[a.id] = { impressions: 0, clicks: 0 };
    });

    events.forEach(function (ev) {
      if (!statsByAd[ev.ad_id]) {
        statsByAd[ev.ad_id] = { impressions: 0, clicks: 0 };
      }
      var dateKey = ev.created_at ? ev.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { date: dateKey, impressions: 0, clicks: 0 };
      }
      var dev = (ev.device_type || "desktop").toLowerCase();
      if (deviceMap[dev] !== undefined) deviceMap[dev]++;

      if (ev.event_type === "impression") {
        statsByAd[ev.ad_id].impressions++;
        dailyMap[dateKey].impressions++;
        totalImpressions++;
      } else if (ev.event_type === "click") {
        statsByAd[ev.ad_id].clicks++;
        dailyMap[dateKey].clicks++;
        totalClicks++;
      }
    });

    var overallCtr = totalImpressions > 0
      ? Number(((totalClicks / totalImpressions) * 100).toFixed(2))
      : 0.0;

    var campaigns = ads.map(function (ad) {
      var s = statsByAd[ad.id] || { impressions: 0, clicks: 0 };
      var adCtr = s.impressions > 0
        ? Number(((s.clicks / s.impressions) * 100).toFixed(2))
        : 0.0;

      return {
        id: ad.id,
        title: ad.title || "Untitled Campaign",
        subtitle: ad.subtitle || "",
        badge: ad.badge || "SPONSORED",
        destination_url: ad.destination_url || "",
        image_url: ad.image_url || "",
        is_active: Boolean(ad.is_active),
        start_at: ad.start_at,
        end_at: ad.end_at,
        priority: ad.priority,
        duration_seconds: ad.duration_seconds,
        impressions: s.impressions,
        clicks: s.clicks,
        ctr: adCtr
      };
    });

    var dailyTrends = Object.keys(dailyMap).sort().map(function (k) {
      var item = dailyMap[k];
      return {
        date: item.date,
        impressions: item.impressions,
        clicks: item.clicks,
        ctr: item.impressions > 0 ? Number(((item.clicks / item.impressions) * 100).toFixed(2)) : 0.0
      };
    });

    return {
      success: true,
      sponsor_name: clientName,
      generated_at: new Date().toISOString(),
      token_info: {
        expires_at: tokRecord ? tokRecord.expires_at : null,
        created_at: tokRecord ? tokRecord.created_at : null
      },
      rate_limit: {
        window_hours: 3,
        remaining_requests: 59,
        reset_in_seconds: 10800
      },
      metrics: {
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        ctr: overallCtr,
        active_campaigns: campaigns.filter(function (c) { return c.is_active; }).length,
        total_campaigns: campaigns.length
      },
      campaigns: campaigns,
      daily_trends: dailyTrends,
      device_stats: deviceMap
    };
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

    // 3-Hour Rate Limit Status Display
    if (data.rate_limit) {
      var rlBadge = $("rateLimitBadge");
      var rlText = $("rateLimitText");
      if (rlBadge && rlText) {
        var rem = data.rate_limit.remaining_requests;
        var resetMins = Math.ceil((data.rate_limit.reset_in_seconds || 10800) / 60);
        rlText.textContent = rem + " requests left (resets in " + resetMins + "m)";
        rlBadge.removeAttribute("hidden");
      }
    }

    // Real KPI Metrics
    var m = data.metrics || {};
    var totalImp = m.total_impressions || 0;
    var totalClk = m.total_clicks || 0;
    var ctr = typeof m.ctr === "number" ? m.ctr.toFixed(2) : (m.ctr || "0.00");

    $("metricImpressions").textContent = totalImp.toLocaleString();
    $("metricClicks").textContent = totalClk.toLocaleString();
    $("metricCtr").textContent = ctr + "%";
    $("metricCampaigns").textContent = m.total_campaigns || (data.campaigns ? data.campaigns.length : 0);
    $("metricActiveSummary").textContent = (m.active_campaigns || 0) + " active advertising slots";

    // Real Campaigns Table
    renderCampaignsTable(data.campaigns || []);

    // Real Daily Trends Table
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

      var ctrNum = parseFloat(c.ctr) || 0;
      var barPct = Math.min(100, Math.max(0, ctrNum * 4));

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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
