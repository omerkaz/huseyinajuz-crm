// Supabase Edge Function: send-email
// Validates auth, checks practitioner_settings toggle for the feature,
// then sends transactional email via the Resend API using fetch().
//
// v4 (Phase 16 / MAIL-05): this is the single branding chokepoint. Callers send
// a bare content fragment; the branded shell, footer, and plain-text fallback
// are applied here — see ./emailTemplate.ts for the design tokens.
//
// v5 (Phase 21 / MAIL-06) — two changes, both scoped to the browser (JWT) path:
//   1. Recipient authorization: `to` must be the email of a patient owned by
//      the JWT user. Previously any authenticated session could mail any
//      address through the practice's verified sending domain.
//   2. The `manual` feature key: a human pressing Send in /email is the
//      consent, so it bypasses the practitioner_settings toggle gate (those
//      toggles govern automation) and is recorded in email_send_log.
// The WEBHOOK_SECRET path (pg_cron, manychat-webhook) is unchanged, and it may
// NOT use `manual` — automation must always stay behind its toggle.

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

/** Practitioner-initiated send. JWT path only, no toggle, always logged. */
const MANUAL_FEATURE = "manual";

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

/** Normalise exactly as the DB's unique index does: lower(btrim(email)). */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Escape LIKE wildcards so an address containing `_` or `%` (both legal in the
 * local part) is matched literally. Postgres LIKE/ILIKE uses `\` as its default
 * escape character, so no ESCAPE clause is needed.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
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

  // Which caller are we serving? The two paths diverge on feature keys,
  // recipient authorization and logging, so the mode is carried explicitly
  // rather than re-derived later.
  let authMode: "secret" | "jwt";
  let jwtUserId: string | null = null;

  if (providedToken === webhookSecret) {
    authMode = "secret";
  } else {
    // Not the shared secret — try validating as a Supabase session JWT
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(providedToken);
    if (userError || !userData?.user) {
      // 401 = we do not know who you are. Distinct from the 403 below, which
      // means we know you and you may not mail this person.
      console.warn("[send-email] Auth failed: invalid JWT");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    authMode = "jwt";
    jwtUserId = userData.user.id;
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
  // `manual` is a browser-only key: a pg_cron or webhook caller must never be
  // able to route around the automation toggles by claiming a human sent it.
  const isManual = feature === MANUAL_FEATURE;

  if (isManual && authMode !== "jwt") {
    console.warn("[send-email] Rejected: manual feature requested on the shared-secret path");
    return jsonResponse(
      { error: `Feature "${MANUAL_FEATURE}" requires an authenticated session.` },
      400,
    );
  }

  if (!isManual && !(VALID_FEATURES as readonly string[]).includes(feature)) {
    return jsonResponse(
      { error: `Invalid feature key. Must be one of: ${VALID_FEATURES.join(", ")}` },
      400,
    );
  }

  const recipient = to.trim();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Recipient authorization (JWT path only) ──
  // The browser may only mail people it owns records for. Ownership is checked
  // in SQL against the JWT's user id — never inferred from the request body,
  // which is why the client sends no patient id at all.
  let recipientPatientId: string | null = null;

  if (authMode === "jwt") {
    const normalised = normaliseEmail(recipient);
    const { data: owned, error: ownedError } = await supabase
      .from("patients")
      .select("id, email")
      .eq("created_by", jwtUserId)
      .ilike("email", escapeLikePattern(normalised))
      .limit(5);

    if (ownedError) {
      console.error("[send-email] Recipient lookup failed:", ownedError.message);
      return jsonResponse({ error: "Failed to verify recipient" }, 500);
    }

    // ILIKE handles case; this re-check handles stray whitespace and the
    // wildcard-broadening that an escaped pattern cannot fully rule out.
    const match = (owned ?? []).find(
      (row: { email: string | null }) => normaliseEmail(row.email ?? "") === normalised,
    ) as { id: string } | undefined;

    if (!match) {
      console.warn(`[send-email] Rejected: recipient is not a patient of user ${jwtUserId}`);
      return jsonResponse(
        { error: "Recipient is not one of your patients." },
        403,
      );
    }

    recipientPatientId = match.id;
  }

  const settingsColumn = isManual
    ? null
    : (`${feature as FeatureKey}_enabled` as keyof Record<string, boolean>);

  try {
    // ── Check practitioner_settings toggle ──
    // Skipped entirely for manual sends: the toggles gate automation, and a
    // practitioner pressing Send has already given consent. This also keeps
    // manual sends working when the settings row is missing.
    if (settingsColumn) {
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
        console.log(`[send-email] feature=${feature} enabled=false skipped`);
        return jsonResponse({ skipped: true, reason: "feature disabled" }, 200);
      }
    }

    // ── Send via Resend API ──
    const resendPayload: Record<string, unknown> = {
      from: "Hüseyin Ajuz <mrhus@huseyinacuz.com>",
      reply_to: "mrhus@huseyinacuz.com",
      to: [recipient],
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

    let resendData: Record<string, unknown> = {};
    try {
      resendData = await resendRes.json() as Record<string, unknown>;
    } catch {
      // A 2xx with a non-JSON body still means Resend accepted the message;
      // only the id is lost.
    }
    const emailId = resendData.id ?? "unknown";
    console.log(`[send-email] Resend accepted id=${emailId}`);

    // ── Record manual sends ──
    // The message is already gone by this point, so a failed insert must not
    // turn into a "failed" response — that would invite a duplicate resend.
    // It is reported as sent-but-unlogged instead.
    let logged: boolean | undefined;
    if (isManual && recipientPatientId) {
      const { error: logError } = await supabase
        .from("email_send_log")
        .insert({ patient_id: recipientPatientId, feature: MANUAL_FEATURE });

      logged = !logError;
      if (logError) {
        console.error(
          `[send-email] Manual send logged=false patient=${recipientPatientId}: ${logError.message}`,
        );
      }
    }

    return jsonResponse(
      logged === undefined
        ? { sent: true, email_id: emailId }
        : { sent: true, email_id: emailId, logged },
      200,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-email] Unexpected error:", message);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
