// Supabase Edge Function: send-email
// Validates auth, checks practitioner_settings toggle for the feature,
// then sends transactional email via the Resend API using fetch().
//
// v4 (Phase 16 / MAIL-05): this is the single branding chokepoint. Callers send
// a bare content fragment; the branded shell, footer, and plain-text fallback
// are applied here — see ./emailTemplate.ts for the design tokens.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildPlainText, wrapEmailHtml } from "./emailTemplate.ts";

// Feature keys must match the practitioner_settings column names (minus _enabled suffix)
const VALID_FEATURES = [
  "welcome_email",
  "blood_test_reminder",
  "week_6_checkin",
  "end_review",
  "lead_day3",
  "lead_day7",
  "lead_day12",
] as const;

type FeatureKey = (typeof VALID_FEATURES)[number];

// ── CORS headers ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Helpers ──

/** Extract bearer token from Authorization header */
function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/** Build a JSON Response with CORS headers */
function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Basic email format check */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Main handler ──

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Method guard
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  // ── Environment validation ──
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    console.error("[send-email] Missing SUPABASE_URL");
    return jsonResponse({ error: "Server configuration error: SUPABASE_URL not configured" }, 500);
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    console.error("[send-email] Missing SUPABASE_SERVICE_ROLE_KEY");
    return jsonResponse({ error: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY not configured" }, 500);
  }

  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("[send-email] Missing WEBHOOK_SECRET");
    return jsonResponse({ error: "Server configuration error: WEBHOOK_SECRET not configured" }, 500);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("[send-email] Missing RESEND_API_KEY");
    return jsonResponse({ error: "Server configuration error: RESEND_API_KEY not configured" }, 500);
  }

  // Optional: when unset, the single practitioner_settings row is used instead
  // (single-practitioner system, D014).
  const practitionerUserId = Deno.env.get("PRACTITIONER_USER_ID");

  // ── Auth validation ──
  // Accept either:
  //   1. Shared WEBHOOK_SECRET via Authorization: Bearer <secret> or ?secret=<value> (pg_cron / server callers)
  //   2. A valid Supabase session JWT via Authorization: Bearer <jwt> (browser / PatientFormPage callers)
  const authHeader = req.headers.get("authorization");
  const bearerToken = extractBearerToken(authHeader);
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");
  const providedToken = bearerToken || querySecret;

  if (!providedToken) {
    console.warn("[send-email] Auth failed: missing token");
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  if (providedToken !== webhookSecret) {
    // Not the shared secret — try validating as a Supabase session JWT
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(providedToken);
    if (userError || !userData?.user) {
      console.warn("[send-email] Auth failed: invalid JWT");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    // JWT is valid — authenticated as a session user
  }

  // ── Parse body ──
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonResponse({ error: "Request body must be a JSON object" }, 400);
  }

  // ── Validate required fields ──
  const { to, subject, html, text, feature } = body as Record<string, unknown>;

  if (typeof to !== "string" || !to.trim()) {
    return jsonResponse({ error: "Missing required field: to" }, 400);
  }
  if (!isValidEmail(to.trim())) {
    return jsonResponse({ error: "Invalid email address in field: to" }, 400);
  }
  if (typeof subject !== "string" || !subject.trim()) {
    return jsonResponse({ error: "Missing required field: subject" }, 400);
  }
  if (typeof html !== "string" || !html.trim()) {
    return jsonResponse({ error: "Missing required field: html" }, 400);
  }
  if (typeof feature !== "string" || !feature.trim()) {
    return jsonResponse({ error: "Missing required field: feature" }, 400);
  }

  // ── Validate feature key against whitelist ──
  if (!(VALID_FEATURES as readonly string[]).includes(feature)) {
    return jsonResponse(
      { error: `Invalid feature key. Must be one of: ${VALID_FEATURES.join(", ")}` },
      400,
    );
  }

  const featureKey = feature as FeatureKey;
  const settingsColumn = `${featureKey}_enabled` as keyof Record<string, boolean>;

  // ── Check practitioner_settings toggle ──
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    let settingsQuery = supabase.from("practitioner_settings").select("*");
    if (practitionerUserId) {
      settingsQuery = settingsQuery.eq("user_id", practitionerUserId);
    }
    const { data: settings, error: settingsError } = await settingsQuery
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("[send-email] Failed to read practitioner_settings:", settingsError.message);
      return jsonResponse({ error: "Failed to read settings" }, 500);
    }

    // Row missing or feature disabled → skip
    const featureEnabled = settings ? (settings[settingsColumn] as boolean | undefined) : undefined;
    if (!settings || !featureEnabled) {
      console.log(`[send-email] feature=${featureKey} enabled=false skipped`);
      return jsonResponse({ skipped: true, reason: "feature disabled" }, 200);
    }

    // ── Send via Resend API ──
    const resendPayload: Record<string, unknown> = {
      from: "Hüseyin Ajuz <mrhus@huseyinacuz.com>",
      reply_to: "mrhus@huseyinacuz.com",
      to: [to.trim()],
      subject: subject.trim(),
      html: wrapEmailHtml(html, { title: subject.trim() }),
      // Always send a text part: HTML-only mail scores worse with spam filters,
      // and the branded shell adds markup weight.
      text: buildPlainText(text, html),
    };

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    if (!resendRes.ok) {
      let resendError: Record<string, unknown> = {};
      try {
        resendError = await resendRes.json() as Record<string, unknown>;
      } catch {
        // ignore parse failure — use status text
      }
      const errName = resendError.name ?? "ResendError";
      const errMsg = resendError.message ?? resendRes.statusText;
      console.error(`[send-email] Resend rejected: status=${resendRes.status} name=${errName} message=${errMsg}`);
      return jsonResponse(
        { error: `Email provider error: ${errMsg}`, provider_code: resendRes.status },
        502,
      );
    }

    const resendData = await resendRes.json() as Record<string, unknown>;
    const emailId = resendData.id ?? "unknown";
    console.log(`[send-email] Resend accepted id=${emailId}`);

    return jsonResponse({ sent: true, email_id: emailId }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-email] Unexpected error:", message);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
