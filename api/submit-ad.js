/* ==========================================================================
   api/submit-ad.js — Vercel Serverless Function for Ad Submissions
   Validates pricing/plans server-side, saves to Supabase, & dispatches emails.
   ========================================================================== */

const PLANS = {
  basic: { id: "basic", name: "Basic Plan", price: 49, days: 1 },
  standard: { id: "standard", name: "Standard Plan", price: 139, days: 3 },
  premium: { id: "premium", name: "Premium Plan", price: 499, days: 6 }
};

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Please use POST." });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: "Invalid JSON body." });
      }
    }
    body = body || {};

    const name = (body.name || "").trim();
    const contact = (body.contact || "").trim();
    const category = (body.category || "").trim();
    const description = (body.description || (category ? `${category} advertisement by ${name}` : "")).trim();
    const planId = (body.plan_id || "").toLowerCase().trim();
    const destinationUrl = (body.destination_url || "").trim();
    const message = (body.message || "").trim();

    // Strict validation (Name, Contact, Category, Plan)
    if (!name || !contact || !category || !planId) {
      return res.status(400).json({
        error: "Missing required fields. Name, contact, category, and plan_id are required."
      });
    }

    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({
        error: "Invalid advertising plan selected. Allowed plans: basic (₹49), standard (₹139), premium (₹499)."
      });
    }

    const adRequest = {
      name: name,
      contact: contact,
      category: category,
      description: description,
      plan_id: plan.id,
      plan_name: plan.name,
      price_inr: plan.price,
      duration_days: plan.days,
      destination_url: destinationUrl,
      message: message,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 1. Save to Supabase
    const supabaseUrl = process.env.SUPABASE_URL || "https://bwruqavaexkciiuydgmg.supabase.co";
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3cnVxYXZhZXhrY2lpdXlkZ21nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NzMzNzQsImV4cCI6MjEwNDI0OTM3NH0.Ussc8Yip93_vZ1RZHJVcDprN8ru8OeRkXhybWYH-YGM";

    let dbSaved = false;
    let savedRecord = null;

    try {
      const dbRes = await fetch(`${supabaseUrl}/rest/v1/ad_requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "return=representation"
        },
        body: JSON.stringify(adRequest)
      });

      if (dbRes.ok) {
        const json = await dbRes.json();
        dbSaved = true;
        savedRecord = Array.isArray(json) ? json[0] : json;
      } else {
        const errText = await dbRes.text();
        console.warn("[api/submit-ad] Supabase save warning:", dbRes.status, errText);
      }
    } catch (dbErr) {
      console.warn("[api/submit-ad] Supabase connection error:", dbErr.message);
    }

    // 2. Dispatch Email Notification
    const adminEmail = (process.env.NOTIFICATION_EMAIL || "").trim();
    const resendKey = (process.env.RESEND_API_KEY || "").trim();
    let emailSent = false;

    const emailSubject = `[Ad Request] ${plan.name} (₹${plan.price}) from ${name}`;
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #0F172A; border-radius: 12px;">
        <h2 style="color: #EF4444; margin-top: 0;">New Advertisement Submission</h2>
        <p style="font-size: 15px;">A new advertiser has submitted an ad request on <b>Sharodiya Pujo Radio</b>:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 14px;">
          <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 10px; font-weight: bold; width: 140px;">Applicant Name</td>
            <td style="padding: 10px;">${escapeHtml(name)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 10px; font-weight: bold;">Contact Info</td>
            <td style="padding: 10px; color: #2563EB;"><b>${escapeHtml(contact)}</b></td>
          </tr>
          <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 10px; font-weight: bold;">Selected Plan</td>
            <td style="padding: 10px;"><b style="color: #EF4444;">${plan.name} (₹${plan.price} for ${plan.days} Day${plan.days > 1 ? "s" : ""})</b></td>
          </tr>
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 10px; font-weight: bold;">Ad Category</td>
            <td style="padding: 10px;"><span style="background: #FEF2F2; color: #DC2626; padding: 3px 8px; border-radius: 4px; font-weight: bold;">${escapeHtml(category)}</span></td>
          </tr>
          <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 10px; font-weight: bold;">Ad Description</td>
            <td style="padding: 10px;">${escapeHtml(description)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 10px; font-weight: bold;">Destination URL</td>
            <td style="padding: 10px;">${destinationUrl ? `<a href="${escapeHtml(destinationUrl)}" target="_blank">${escapeHtml(destinationUrl)}</a>` : "<em>None provided</em>"}</td>
          </tr>
          <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 10px; font-weight: bold;">Additional Note</td>
            <td style="padding: 10px;">${message ? escapeHtml(message) : "<em>None</em>"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Submitted At</td>
            <td style="padding: 10px; color: #64748B;">${new Date().toLocaleString()}</td>
          </tr>
        </table>

        <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #E2E8F0; font-size: 12px; color: #64748B;">
          You can review, approve, and activate this advertisement in your <a href="https://souramay.vercel.app/admin" style="color: #EF4444; font-weight: bold;">Sharodiya Admin Dashboard</a>.
        </div>
      </div>
    `;

    if (resendKey) {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`
          },
          body: JSON.stringify({
            from: "Sharodiya Ads <onboarding@resend.dev>",
            to: [adminEmail],
            subject: emailSubject,
            html: emailHtml
          })
        });

        if (emailRes.ok) {
          emailSent = true;
          console.log("[api/submit-ad] Email delivered via Resend to", adminEmail);
        } else {
          console.warn("[api/submit-ad] Resend returned error:", await emailRes.text());
        }
      } catch (emErr) {
        console.warn("[api/submit-ad] Email sending error:", emErr.message);
      }
    } else {
      console.log(`[api/submit-ad] Notice: ${!resendKey ? "RESEND_API_KEY not set." : ""} ${!adminEmail ? "NOTIFICATION_EMAIL not set." : ""}`);
      console.log(`[api/submit-ad] Lead received:`, JSON.stringify(adRequest));
    }

    return res.status(200).json({
      success: true,
      message: "Thank you! Your advertisement request has been received. We will contact you shortly.",
      data: {
        id: savedRecord ? savedRecord.id : null,
        plan: plan.name,
        price: plan.price,
        days: plan.days,
        emailNotificationSent: emailSent,
        savedToDatabase: dbSaved
      }
    });

  } catch (err) {
    console.error("[api/submit-ad] Server error:", err);
    return res.status(500).json({
      error: "Internal server error processing advertisement request. Please try again."
    });
  }
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
