/* ==========================================================================
   ads-service.js — Data layer and analytics engine for advertisements.
   Supports Supabase backend with seamless, resilient local storage fallback.
   ========================================================================== */

(function () {
  "use strict";

  var LS_KEYS = {
    ADS: "sharodiya_ads_v1",
    ANALYTICS: "sharodiya_analytics_v1",
    AD_REQUESTS: "sharodiya_ad_requests_v1",
    SB_URL: "sharodiya_sb_url",
    SB_KEY: "sharodiya_sb_key",
    ADMIN_AUTH: "sharodiya_admin_auth"
  };

  // Festive default sample ads
  var DEFAULT_ADS = [
    {
      id: "ad-svf-music-festive-2026",
      title: "বাঙালির পুজোর সেরা গান শুনুন",
      subtitle: "Exclusive Durga Puja playlist & festive specials by SVF Music",
      badge: "SPONSORED",
      destination_url: "https://www.youtube.com/results?search_query=svf+durga+puja+songs",
      image_url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=120&auto=format&fit=crop&q=80",
      client_name: "SVF Music",
      client_email: "sponsor@svf.in",
      duration_seconds: 7,
      priority: 10,
      is_active: true,
      start_at: null,
      end_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: "ad-ethnic-fashion-2026",
      title: "উৎসবের আনন্দ ও সাজপোশাক",
      subtitle: "Durga Puja Festive Handloom & Sarees — Up to 40% Off",
      badge: "PUJO OFFER",
      destination_url: "https://www.myntra.com/festive-ethnic-wear",
      image_url: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=120&auto=format&fit=crop&q=80",
      client_name: "Pujo Bazaar Kolkata",
      client_email: "promotions@pujobazaar.com",
      duration_seconds: 8,
      priority: 8,
      is_active: true,
      start_at: null,
      end_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  function AdsService() {
    this.supabase = null;
    this.initSupabase();
  }

  /* ------------------------------------------------ Supabase initialization */

  AdsService.prototype.initSupabase = function () {
    var cfg = (window.SHARODIYA_CONFIG && window.SHARODIYA_CONFIG.supabase) || {};
    var url = localStorage.getItem(LS_KEYS.SB_URL) || cfg.url || "";
    var key = localStorage.getItem(LS_KEYS.SB_KEY) || cfg.anonKey || "";

    if (url && key && window.supabase && typeof window.supabase.createClient === "function") {
      try {
        this.supabase = window.supabase.createClient(url, key);
        console.log("[AdsService] Supabase client initialized with endpoint:", url);
      } catch (err) {
        console.warn("[AdsService] Failed to initialize Supabase client:", err);
        this.supabase = null;
      }
    } else {
      this.supabase = null;
    }
  };

  AdsService.prototype.isSupabaseConnected = function () {
    return !!this.supabase;
  };

  AdsService.prototype.getSupabaseConfig = function () {
    var cfg = (window.SHARODIYA_CONFIG && window.SHARODIYA_CONFIG.supabase) || {};
    return {
      url: localStorage.getItem(LS_KEYS.SB_URL) || cfg.url || "",
      key: localStorage.getItem(LS_KEYS.SB_KEY) || cfg.anonKey || ""
    };
  };

  AdsService.prototype.saveSupabaseConfig = function (url, key) {
    if (url) localStorage.setItem(LS_KEYS.SB_URL, url.trim());
    else localStorage.removeItem(LS_KEYS.SB_URL);

    if (key) localStorage.setItem(LS_KEYS.SB_KEY, key.trim());
    else localStorage.removeItem(LS_KEYS.SB_KEY);

    this.initSupabase();
  };

  /* ---------------------------------------------------- Local Storage Layer */

  AdsService.prototype._getLocalAds = function () {
    try {
      var raw = localStorage.getItem(LS_KEYS.ADS);
      if (!raw) {
        localStorage.setItem(LS_KEYS.ADS, JSON.stringify(DEFAULT_ADS));
        return DEFAULT_ADS.slice();
      }
      return JSON.parse(raw);
    } catch (e) {
      console.warn("[AdsService] Error reading local ads:", e);
      return DEFAULT_ADS.slice();
    }
  };

  AdsService.prototype._saveLocalAds = function (ads) {
    try {
      localStorage.setItem(LS_KEYS.ADS, JSON.stringify(ads));
    } catch (e) {
      console.error("[AdsService] Error saving local ads:", e);
    }
  };

  AdsService.prototype._getLocalAnalytics = function () {
    try {
      var raw = localStorage.getItem(LS_KEYS.ANALYTICS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  AdsService.prototype._saveLocalAnalytics = function (events) {
    try {
      // Keep last 10,000 events locally to prevent storage exhaustion
      if (events.length > 10000) events = events.slice(events.length - 10000);
      localStorage.setItem(LS_KEYS.ANALYTICS, JSON.stringify(events));
    } catch (e) {
      console.warn("[AdsService] Analytics local storage full:", e);
    }
  };

  /* --------------------------------------------------- Fetching Active Ads */

  AdsService.prototype.fetchActiveAds = async function () {
    var now = new Date();

    // 1. Try Supabase first if connected
    if (this.supabase) {
      try {
        var res = await this.supabase
          .from("ads")
          .select("*")
          .eq("is_active", true)
          .order("priority", { ascending: false })
          .order("created_at", { ascending: false });

        if (!res.error && Array.isArray(res.data)) {
          // Filter start_at and end_at in JavaScript for timezone precision
          return res.data.filter(function (ad) {
            if (ad.start_at && new Date(ad.start_at) > now) return false;
            if (ad.end_at && new Date(ad.end_at) < now) return false;
            return true;
          });
        }
        console.warn("[AdsService] Supabase fetch error, using local fallback:", res.error);
      } catch (err) {
        console.warn("[AdsService] Supabase exception, using local fallback:", err);
      }
    }

    // 2. Fallback to Local Storage
    var localAds = this._getLocalAds();
    return localAds.filter(function (ad) {
      if (!ad.is_active) return false;
      if (ad.start_at && new Date(ad.start_at) > now) return false;
      if (ad.end_at && new Date(ad.end_at) < now) return false;
      return true;
    }).sort(function (a, b) {
      var pA = Number(a.priority) || 0;
      var pB = Number(b.priority) || 0;
      if (pB !== pA) return pB - pA;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  };

  /* ---------------------------------------------------- Full Admin Ad CRUD */

  AdsService.prototype.fetchAllAds = async function () {
    if (this.supabase) {
      try {
        var res = await this.supabase
          .from("ads")
          .select("*")
          .order("priority", { ascending: false })
          .order("created_at", { ascending: false });
        if (!res.error && Array.isArray(res.data)) return res.data;
      } catch (err) {
        console.warn("[AdsService] fetchAllAds Supabase error:", err);
      }
    }
    return this._getLocalAds().sort(function (a, b) {
      return (Number(b.priority) || 0) - (Number(a.priority) || 0);
    });
  };

  AdsService.prototype.createAd = async function (adData) {
    var nowIso = new Date().toISOString();
    var ad = {
      title: (adData.title || "").trim(),
      subtitle: (adData.subtitle || "").trim(),
      badge: (adData.badge || "SPONSORED").trim().toUpperCase(),
      destination_url: (adData.destination_url || "").trim(),
      image_url: (adData.image_url || "").trim(),
      client_name: (adData.client_name || "Direct Sponsor").trim(),
      client_email: (adData.client_email || "").trim(),
      duration_seconds: Math.max(2, parseInt(adData.duration_seconds, 10) || 7),
      priority: parseInt(adData.priority, 10) || 1,
      is_active: adData.is_active !== false,
      start_at: adData.start_at ? new Date(adData.start_at).toISOString() : null,
      end_at: adData.end_at ? new Date(adData.end_at).toISOString() : null,
      created_at: nowIso,
      updated_at: nowIso
    };

    if (this.supabase) {
      try {
        var res = await this.supabase.from("ads").insert([ad]).select();
        if (!res.error && res.data && res.data[0]) return res.data[0];
        console.warn("[AdsService] createAd Supabase error:", res.error);
      } catch (err) {
        console.warn("[AdsService] createAd Supabase exception:", err);
      }
    }

    // Local fallback
    ad.id = "ad-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    var list = this._getLocalAds();
    list.unshift(ad);
    this._saveLocalAds(list);
    return ad;
  };

  AdsService.prototype.updateAd = async function (id, updates) {
    updates.updated_at = new Date().toISOString();

    if (this.supabase) {
      try {
        var res = await this.supabase.from("ads").update(updates).eq("id", id).select();
        if (!res.error && res.data && res.data[0]) return res.data[0];
        console.warn("[AdsService] updateAd Supabase error:", res.error);
      } catch (err) {
        console.warn("[AdsService] updateAd Supabase exception:", err);
      }
    }

    // Local fallback
    var list = this._getLocalAds();
    var idx = list.findIndex(function (item) { return item.id === id; });
    if (idx !== -1) {
      list[idx] = Object.assign({}, list[idx], updates);
      this._saveLocalAds(list);
      return list[idx];
    }
    return null;
  };

  AdsService.prototype.deleteAd = async function (id) {
    if (this.supabase) {
      try {
        var res = await this.supabase.from("ads").delete().eq("id", id);
        if (!res.error) return true;
        console.warn("[AdsService] deleteAd Supabase error:", res.error);
      } catch (err) {
        console.warn("[AdsService] deleteAd Supabase exception:", err);
      }
    }

    var list = this._getLocalAds().filter(function (item) { return item.id !== id; });
    this._saveLocalAds(list);
    return true;
  };

  AdsService.prototype.toggleAdActive = async function (id, currentStatus) {
    return this.updateAd(id, { is_active: !currentStatus });
  };

  /* ---------------------------------------------------- Analytics Tracking */

  function getDeviceType() {
    var w = window.innerWidth;
    if (w < 640) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  }

  AdsService.prototype.recordImpression = async function (ad) {
    if (!ad || !ad.id) return;

    // Session-based debouncing: don't log the same ad impression multiple times in 10 seconds
    var sessKey = "imp_" + ad.id;
    var last = sessionStorage.getItem(sessKey);
    var nowTs = Date.now();
    if (last && nowTs - parseInt(last, 10) < 10000) {
      return;
    }
    sessionStorage.setItem(sessKey, nowTs.toString());

    var event = {
      ad_id: ad.id,
      client_name: ad.client_name || "",
      event_type: "impression",
      device_type: getDeviceType(),
      referrer: document.referrer || window.location.hostname,
      created_at: new Date().toISOString()
    };

    if (this.supabase) {
      try {
        await this.supabase.from("ad_analytics").insert([event]);
        return;
      } catch (e) {
        console.warn("[AdsService] Supabase impression logging failed:", e);
      }
    }

    var events = this._getLocalAnalytics();
    events.push(event);
    this._saveLocalAnalytics(events);
  };

  AdsService.prototype.recordClick = async function (ad) {
    if (!ad || !ad.id) return;

    var event = {
      ad_id: ad.id,
      client_name: ad.client_name || "",
      event_type: "click",
      device_type: getDeviceType(),
      referrer: document.referrer || window.location.hostname,
      created_at: new Date().toISOString()
    };

    if (this.supabase) {
      try {
        await this.supabase.from("ad_analytics").insert([event]);
        return;
      } catch (e) {
        console.warn("[AdsService] Supabase click logging failed:", e);
      }
    }

    var events = this._getLocalAnalytics();
    events.push(event);
    this._saveLocalAnalytics(events);
  };

  /* ------------------------------------------------ Analytics Aggregation */

  AdsService.prototype.getAnalyticsSummary = async function (clientFilter) {
    var allAds = await this.fetchAllAds();
    var filter = clientFilter ? clientFilter.toLowerCase().trim() : null;

    if (filter) {
      allAds = allAds.filter(function (a) {
        return (a.client_name || "").toLowerCase().includes(filter);
      });
    }

    var analyticsEvents = [];

    if (this.supabase) {
      try {
        var query = this.supabase.from("ad_analytics").select("*");
        if (filter) query = query.ilike("client_name", "%" + filter + "%");
        var res = await query;
        if (!res.error && Array.isArray(res.data)) {
          analyticsEvents = res.data;
        }
      } catch (e) {
        console.warn("[AdsService] getAnalyticsSummary Supabase error:", e);
        analyticsEvents = this._getLocalAnalytics();
      }
    } else {
      analyticsEvents = this._getLocalAnalytics();
      if (filter) {
        analyticsEvents = analyticsEvents.filter(function (ev) {
          return (ev.client_name || "").toLowerCase().includes(filter);
        });
      }
    }

    // Aggregate counts by ad_id
    var statsByAd = {};
    var totalImpressions = 0;
    var totalClicks = 0;

    analyticsEvents.forEach(function (ev) {
      if (!statsByAd[ev.ad_id]) {
        statsByAd[ev.ad_id] = { impressions: 0, clicks: 0 };
      }
      if (ev.event_type === "impression") {
        statsByAd[ev.ad_id].impressions++;
        totalImpressions++;
      } else if (ev.event_type === "click") {
        statsByAd[ev.ad_id].clicks++;
        totalClicks++;
      }
    });

    var adReports = allAds.map(function (ad) {
      var s = statsByAd[ad.id] || { impressions: 0, clicks: 0 };
      var ctr = s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(2) : "0.00";
      return {
        ad: ad,
        impressions: s.impressions,
        clicks: s.clicks,
        ctr: ctr
      };
    });

    var overallCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";

    return {
      totalAds: allAds.length,
      activeAds: allAds.filter(function (a) { return a.is_active; }).length,
      totalImpressions: totalImpressions,
      totalClicks: totalClicks,
      overallCtr: overallCtr,
      adReports: adReports
    };
  };

  /* ---------------------------------------------------- Ad Submission Leads */

  var PLANS_CONFIG = {
    basic: { id: "basic", name: "Basic Plan", price: 49, days: 1 },
    standard: { id: "standard", name: "Standard Plan", price: 139, days: 3 },
    premium: { id: "premium", name: "Premium Plan", price: 499, days: 6 }
  };

  AdsService.prototype.getPlans = function () {
    return PLANS_CONFIG;
  };

  AdsService.prototype._getLocalAdRequests = function () {
    try {
      var raw = localStorage.getItem(LS_KEYS.AD_REQUESTS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  AdsService.prototype._saveLocalAdRequests = function (list) {
    try {
      localStorage.setItem(LS_KEYS.AD_REQUESTS, JSON.stringify(list));
    } catch (e) {
      console.warn("[AdsService] Error saving local ad requests:", e);
    }
  };

  AdsService.prototype.submitAdRequest = async function (formData) {
    var plan = PLANS_CONFIG[formData.plan_id] || PLANS_CONFIG.basic;
    var payload = {
      name: (formData.name || "").trim(),
      contact: (formData.contact || "").trim(),
      category: (formData.category || "").trim(),
      description: (formData.description || (formData.category ? formData.category + " advertisement by " + formData.name : "")).trim(),
      plan_id: plan.id,
      plan_name: plan.name,
      price_inr: plan.price,
      duration_days: plan.days,
      destination_url: (formData.destination_url || "").trim(),
      message: (formData.message || "").trim(),
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 1. Try serverless endpoint first
    try {
      var endpoint = (typeof window !== "undefined" && window.location && window.location.origin)
        ? window.location.origin + "/api/submit-ad"
        : "/api/submit-ad";
      var res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        var json = await res.json();
        return { success: true, message: json.message || "Request submitted successfully!" };
      }
    } catch (apiErr) {
      console.warn("[AdsService] /api/submit-ad unreachable, using direct Supabase/local fallback:", apiErr);
    }

    // 2. Direct Supabase insert fallback (protected by RLS "Public can submit ad requests")
    if (this.supabase) {
      try {
        var sbRes = await this.supabase.from("ad_requests").insert([payload]);
        if (!sbRes.error) {
          return { success: true, message: "Thank you! Your advertisement request has been received. We will contact you shortly." };
        }
        console.warn("[AdsService] Supabase ad_requests insert error:", sbRes.error);
      } catch (sbErr) {
        console.warn("[AdsService] Supabase ad_requests exception:", sbErr);
      }
    }

    // 3. Local storage fallback
    payload.id = "req-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    var list = this._getLocalAdRequests();
    list.unshift(payload);
    this._saveLocalAdRequests(list);
    return { success: true, message: "Thank you! Your advertisement request has been received. We will contact you shortly." };
  };

  AdsService.prototype.fetchAdRequests = async function () {
    if (this.supabase) {
      try {
        var res = await this.supabase
          .from("ad_requests")
          .select("*")
          .order("created_at", { ascending: false });
        if (!res.error && Array.isArray(res.data)) {
          return res.data;
        }
        console.warn("[AdsService] fetchAdRequests error:", res.error);
      } catch (err) {
        console.warn("[AdsService] fetchAdRequests exception:", err);
      }
    }
    return this._getLocalAdRequests();
  };

  AdsService.prototype.updateAdRequestStatus = async function (id, status) {
    var nowIso = new Date().toISOString();
    if (this.supabase) {
      try {
        var res = await this.supabase
          .from("ad_requests")
          .update({ status: status, updated_at: nowIso })
          .eq("id", id)
          .select();
        if (!res.error && res.data && res.data[0]) return res.data[0];
      } catch (err) {
        console.warn("[AdsService] updateAdRequestStatus error:", err);
      }
    }
    var list = this._getLocalAdRequests();
    var idx = list.findIndex(function (r) { return r.id === id; });
    if (idx !== -1) {
      list[idx].status = status;
      list[idx].updated_at = nowIso;
      this._saveLocalAdRequests(list);
      return list[idx];
    }
    return null;
  };

  AdsService.prototype.deleteAdRequest = async function (id) {
    if (this.supabase) {
      try {
        var res = await this.supabase.from("ad_requests").delete().eq("id", id);
        if (!res.error) return true;
      } catch (err) {
        console.warn("[AdsService] deleteAdRequest error:", err);
      }
    }
    var list = this._getLocalAdRequests().filter(function (r) { return r.id !== id; });
    this._saveLocalAdRequests(list);
    return true;
  };

  window.AdsService = new AdsService();
})();
