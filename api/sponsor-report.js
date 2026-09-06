/* ==========================================================================
   api/sponsor-report.js — Multi-Tenant Sponsor Performance Report Endpoint
   Enforces strict token-based authorization, client-scoped data isolation,
   and a 3-hour rate limit on analytics queries.
   Fetches 100% real insights directly from Supabase (Zero mock data).
   ========================================================================== */

// In-memory rate limiter for 3-hour rolling window
const RATE_LIMIT_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 Hours
const MAX_REQUESTS_PER_WINDOW = 60; // Max 60 requests per 3-hour window
const tokenRateLimitStore = new Map();

function checkRateLimit(key) {
  const now = Date.now();
  const entry = tokenRateLimitStore.get(key);

  if (!entry) {
    tokenRateLimitStore.set(key, { count: 1, windowStart: now });
    return {
      limited: false,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetInMs: RATE_LIMIT_WINDOW_MS
    };
  }

  const elapsed = now - entry.windowStart;
  if (elapsed > RATE_LIMIT_WINDOW_MS) {
    // 3-hour window expired, reset
    tokenRateLimitStore.set(key, { count: 1, windowStart: now });
    return {
      limited: false,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetInMs: RATE_LIMIT_WINDOW_MS
    };
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - elapsed;
    return {
      limited: true,
      remaining: 0,
      resetInMs: retryAfterMs
    };
  }

  entry.count++;
  return {
    limited: false,
    remaining: MAX_REQUESTS_PER_WINDOW - entry.count,
    resetInMs: RATE_LIMIT_WINDOW_MS - elapsed
  };
}

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );
  // Never cache sensitive authenticated analytics
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed. Please use GET." });
  }

  try {
    // 1. Extract Token
    let token = "";
    if (req.query && req.query.token) {
      token = req.query.token;
    } else if (req.url) {
      try {
        const parsed = new URL(req.url, "http://localhost");
        token = parsed.searchParams.get("token") || "";
      } catch (e) {
        // ignore url parsing error
      }
    }

    token = (token || "").trim();

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Missing required query parameter: token."
      });
    }

    // 2. Enforce 3-Hour Rate Limiting
    const headers = req.headers || {};
    const clientIp = headers["x-forwarded-for"] || req.connection?.remoteAddress || req.socket?.remoteAddress || "local";
    const rateLimitKey = `${token}_${clientIp}`;
    const rateCheck = checkRateLimit(rateLimitKey);

    res.setHeader("X-RateLimit-Limit", MAX_REQUESTS_PER_WINDOW);
    res.setHeader("X-RateLimit-Remaining", rateCheck.remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil((Date.now() + rateCheck.resetInMs) / 1000));

    if (rateCheck.limited) {
      const resetMinutes = Math.ceil(rateCheck.resetInMs / (60 * 1000));
      res.setHeader("Retry-After", Math.ceil(rateCheck.resetInMs / 1000));
      return res.status(429).json({
        success: false,
        error: `Rate limit reached: Maximum report requests exceeded for the current 3-hour window. Please try again in ${resetMinutes} minutes.`,
        rate_limit: {
          window_hours: 3,
          max_requests: MAX_REQUESTS_PER_WINDOW,
          remaining: 0,
          retry_after_seconds: Math.ceil(rateCheck.resetInMs / 1000)
        }
      });
    }

    // 3. Connect to Supabase via Service Role Key (Enforces Multi-Tenant Token Isolation)
    const supabaseUrl = process.env.SUPABASE_URL || "https://bwruqavaexkciiuydgmg.supabase.co";
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3cnVxYXZhZXhrY2lpdXlkZ21nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODY3MzM3NCwiZXhwIjoyMTA0MjQ5Mzc0fQ.Fl6RfAfQvMVhV_eQ8TuG3mbS1PbRG1Hm404-U_OqK8Y";

    let tokenRecord = null;

    try {
      const tokenRes = await fetch(
        `${supabaseUrl}/rest/v1/sponsor_report_tokens?token=eq.${encodeURIComponent(token)}&select=*`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`
          }
        }
      );

      if (tokenRes.ok) {
        const rows = await tokenRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          tokenRecord = rows[0];
        }
      }
    } catch (dbErr) {
      console.warn("[sponsor-report] Database token lookup error:", dbErr.message);
    }

    // Token Authorization Check
    if (!tokenRecord) {
      return res.status(403).json({
        success: false,
        error: "Access Denied: Invalid, expired, or revoked report link."
      });
    }

    if (tokenRecord.is_active === false) {
      return res.status(403).json({
        success: false,
        error: "Access Denied: This sponsor report link has been revoked by the administrator."
      });
    }

    if (tokenRecord.expires_at) {
      const expiryTime = new Date(tokenRecord.expires_at).getTime();
      if (!isNaN(expiryTime) && expiryTime < Date.now()) {
        return res.status(403).json({
          success: false,
          error: "Access Denied: This sponsor report link has expired."
        });
      }
    }

    // 4. Strictly Scoped Real Data Retrieval (Identity derived ONLY from verified token)
    const authorizedClient = tokenRecord.client_name;

    let clientAds = [];
    let clientEvents = [];

    try {
      // Query Real Ads for this sponsor only
      const adsRes = await fetch(
        `${supabaseUrl}/rest/v1/ads?client_name=eq.${encodeURIComponent(authorizedClient)}&select=*&order=created_at.desc`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`
          }
        }
      );

      if (adsRes.ok) {
        clientAds = await adsRes.json();
      }

      // Query Real Analytics events for this sponsor's ads
      const analyticsRes = await fetch(
        `${supabaseUrl}/rest/v1/ad_analytics?client_name=eq.${encodeURIComponent(authorizedClient)}&select=*&order=created_at.desc`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`
          }
        }
      );

      if (analyticsRes.ok) {
        clientEvents = await analyticsRes.json();
      }
    } catch (fetchErr) {
      console.warn("[sponsor-report] Error fetching real records from Supabase:", fetchErr.message);
    }

    clientAds = Array.isArray(clientAds) ? clientAds : [];
    clientEvents = Array.isArray(clientEvents) ? clientEvents : [];

    // 5. Aggregate Real Insights & Metrics
    const statsByAd = {};
    const dailyMap = {};
    const deviceMap = { desktop: 0, mobile: 0, tablet: 0 };
    let totalImpressions = 0;
    let totalClicks = 0;

    // Initialize stats for each real ad
    clientAds.forEach((ad) => {
      statsByAd[ad.id] = { impressions: 0, clicks: 0 };
    });

    // Process real analytics events
    clientEvents.forEach((ev) => {
      if (!statsByAd[ev.ad_id]) {
        statsByAd[ev.ad_id] = { impressions: 0, clicks: 0 };
      }

      const dateKey = ev.created_at ? ev.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { date: dateKey, impressions: 0, clicks: 0 };
      }

      const dev = (ev.device_type || "desktop").toLowerCase();
      if (deviceMap[dev] !== undefined) {
        deviceMap[dev]++;
      } else {
        deviceMap.desktop++;
      }

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

    // Calculate Real CTR
    const overallCtr = totalImpressions > 0
      ? Number(((totalClicks / totalImpressions) * 100).toFixed(2))
      : 0.0;

    // Build Real Campaigns Report
    const campaigns = clientAds.map((ad) => {
      const s = statsByAd[ad.id] || { impressions: 0, clicks: 0 };
      const adCtr = s.impressions > 0
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

    // Format Real Daily Trends (sorted chronologically)
    const dailyTrends = Object.keys(dailyMap)
      .sort()
      .map((dateKey) => {
        const item = dailyMap[dateKey];
        const dayCtr = item.impressions > 0
          ? Number(((item.clicks / item.impressions) * 100).toFixed(2))
          : 0.0;
        return {
          date: item.date,
          impressions: item.impressions,
          clicks: item.clicks,
          ctr: dayCtr
        };
      });

    // 6. Return 100% Real Scoped Analytics
    return res.status(200).json({
      success: true,
      sponsor_name: authorizedClient,
      generated_at: new Date().toISOString(),
      token_info: {
        expires_at: tokenRecord.expires_at || null,
        created_at: tokenRecord.created_at || null
      },
      rate_limit: {
        window_hours: 3,
        remaining_requests: rateCheck.remaining,
        reset_in_seconds: Math.ceil(rateCheck.resetInMs / 1000)
      },
      metrics: {
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        ctr: overallCtr,
        active_campaigns: campaigns.filter((c) => c.is_active).length,
        total_campaigns: campaigns.length
      },
      campaigns: campaigns,
      daily_trends: dailyTrends,
      device_stats: deviceMap
    });
  } catch (error) {
    console.error("[sponsor-report] Internal error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error generating sponsor performance report."
    });
  }
};
