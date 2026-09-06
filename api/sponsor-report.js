/* ==========================================================================
   api/sponsor-report.js — Multi-Tenant Sponsor Performance Report Endpoint
   Enforces strict token-based authorization and client-scoped data isolation.
   ========================================================================== */

const DEMO_TOKENS = {
  "svf-music-demo-token-98f2a1b4e6": {
    client_name: "SVF Music",
    is_active: true,
    expires_at: null
  },
  "pujo-fashion-demo-token-4c7b8e1a": {
    client_name: "Pujo Fashion House",
    is_active: true,
    expires_at: null
  }
};

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );
  // Cache-Control: Private, never cache sensitive reports
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed. Please use GET." });
  }

  try {
    // 1. Extract Token
    // Support req.query.token or parsed URL query params
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

    // 2. Validate Token Against Supabase or Demo Store
    const supabaseUrl = process.env.SUPABASE_URL || "https://bwruqavaexkciiuydgmg.supabase.co";
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3cnVxYXZhZXhrY2lpdXlkZ21nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NzMzNzQsImV4cCI6MjEwNDI0OTM3NH0.Ussc8Yip93_vZ1RZHJVcDprN8ru8OeRkXhybWYH-YGM";

    let tokenRecord = null;

    // Check Supabase table: sponsor_report_tokens
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

    // Check Fallback / Demo Token Store if not found in database
    if (!tokenRecord && DEMO_TOKENS[token]) {
      tokenRecord = {
        token: token,
        client_name: DEMO_TOKENS[token].client_name,
        is_active: DEMO_TOKENS[token].is_active,
        expires_at: DEMO_TOKENS[token].expires_at,
        created_at: new Date().toISOString()
      };
    }

    // Multi-tenant Authorization Gate:
    // If token not found, marked inactive/revoked, or expired -> Deny access
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

    // 3. Strictly Scoped Data Retrieval:
    // Identity is derived ONLY from the validated token record.
    // Any other client name passed in query params is ignored completely.
    const authorizedClient = tokenRecord.client_name;

    let clientAds = [];
    let clientEvents = [];

    try {
      // Query Ads for this sponsor only
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

      // Query Analytics for this sponsor only
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
      console.warn("[sponsor-report] Error fetching sponsor records:", fetchErr.message);
    }

    // If database returned no ads, fallback to known sample data if matching demo sponsor
    if ((!clientAds || clientAds.length === 0) && authorizedClient === "SVF Music") {
      clientAds = [
        {
          id: "00000000-0000-0000-0000-000000000001",
          title: "বাঙালির পুজোর সেরা গান শুনুন",
          subtitle: "Special festive puja playlist collection by SVF Music",
          badge: "SPONSORED",
          destination_url: "https://www.youtube.com/",
          image_url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=120&auto=format&fit=crop&q=80",
          client_name: "SVF Music",
          duration_seconds: 8,
          priority: 10,
          is_active: true,
          start_at: null,
          end_at: null,
          created_at: new Date(Date.now() - 86400000 * 3).toISOString()
        }
      ];
    } else if ((!clientAds || clientAds.length === 0) && authorizedClient === "Pujo Fashion House") {
      clientAds = [
        {
          id: "00000000-0000-0000-0000-000000000002",
          title: "উৎসবের আনন্দ ও সাজপোশাক",
          subtitle: "Durga Puja festive ethnic collection — Up to 40% Off",
          badge: "OFFER",
          destination_url: "https://www.myntra.com/",
          image_url: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=120&auto=format&fit=crop&q=80",
          client_name: "Pujo Fashion House",
          duration_seconds: 7,
          priority: 5,
          is_active: true,
          start_at: null,
          end_at: null,
          created_at: new Date(Date.now() - 86400000 * 5).toISOString()
        }
      ];
    }

    // 4. Metric Calculations & Aggregation
    const statsByAd = {};
    const dailyMap = {};
    const deviceMap = { desktop: 0, mobile: 0, tablet: 0 };
    let totalImpressions = 0;
    let totalClicks = 0;

    // Initialize stats for each campaign
    clientAds.forEach((ad) => {
      statsByAd[ad.id] = { impressions: 0, clicks: 0 };
    });

    // Process analytics events
    clientEvents.forEach((ev) => {
      // Event belongs to this sponsor
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

    // Calculate Overall CTR
    const overallCtr = totalImpressions > 0
      ? Number(((totalClicks / totalImpressions) * 100).toFixed(2))
      : 0.0;

    // Build Campaigns Report
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

    // Format Daily Trends (sorted chronologically)
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

    // 5. Return Isolated Sponsor Report Payload
    return res.status(200).json({
      success: true,
      sponsor_name: authorizedClient,
      generated_at: new Date().toISOString(),
      token_info: {
        expires_at: tokenRecord.expires_at || null,
        created_at: tokenRecord.created_at || null
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
