// Supabase Edge Function: ManyChat Webhook Receiver
// Receives ManyChat External Request POSTs, validates shared-secret auth,
// maps subscriber data to patient fields, and upserts a Lead patient.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS headers ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Helpers ──

/** Map ManyChat gender string to schema enum or null */
function mapGender(raw: string | null | undefined): "male" | "female" | "other" | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (lower === "male") return "male";
  if (lower === "female") return "female";
  if (lower.length > 0) return "other";
  return null;
}

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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  const practitionerUserId = Deno.env.get("PRACTITIONER_USER_ID");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[manychat-webhook] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  if (!webhookSecret) {
    console.error("[manychat-webhook] Missing WEBHOOK_SECRET env var");
    return jsonResponse({ error: "Server configuration error: webhook secret not configured" }, 500);
  }

  // ── Secret validation ──
  // Accept secret via Authorization: Bearer <secret> header or ?secret=<value> query param
  const authHeader = req.headers.get("authorization");
  const bearerToken = extractBearerToken(authHeader);
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");

  const providedSecret = bearerToken || querySecret;

  if (!providedSecret || providedSecret !== webhookSecret) {
    console.warn("[manychat-webhook] Auth failed: invalid or missing secret");
    return jsonResponse({ error: "Unauthorized" }, 401);
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

  // ── Validate required field ──
  const manychatId = body.id;
  if (manychatId === undefined || manychatId === null || String(manychatId).trim() === "") {
    return jsonResponse({ error: "Missing required field: id (ManyChat subscriber ID)" }, 400);
  }

  // ── Map ManyChat fields to patient columns ──
  const firstName = typeof body.first_name === "string" && body.first_name.trim()
    ? body.first_name.trim()
    : "ManyChat";

  const lastName = typeof body.last_name === "string" && body.last_name.trim()
    ? body.last_name.trim()
    : "Lead";

  const email = typeof body.email === "string" && body.email.trim()
    ? body.email.trim()
    : null;

  const phoneNumber = typeof body.phone === "string" && body.phone.trim()
    ? body.phone.trim()
    : "unknown";

  const instagramUsername = typeof body.ig_username === "string" && body.ig_username.trim()
    ? body.ig_username.trim()
    : null;

  const gender = mapGender(typeof body.gender === "string" ? body.gender : null);

  const language = typeof body.language === "string" && body.language.trim()
    ? body.language.trim().substring(0, 5).toLowerCase()
    : "tr";

  const patientData = {
    first_name: firstName,
    last_name: lastName,
    email,
    phone_country_code: "+00",
    phone_number: phoneNumber,
    gender,
    language,
    lifecycle_state: "lead",
    // First-touch source (SRC-01). Only ever written on INSERT — the update
    // path below must never touch it, so a patient's origin stays immutable.
    source: "manychat",
    manychat_id: String(manychatId),
    instagram_username: instagramUsername,
  };

  // ── Supabase admin client (bypasses RLS) ──
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Resolve practitioner ──
  // PRACTITIONER_USER_ID env var wins when set; otherwise fall back to the
  // single practitioner_settings row (single-practitioner system, D014).
  let resolvedPractitionerId: string | null = practitionerUserId ?? null;
  if (!resolvedPractitionerId) {
    const { data: settingsRow } = await supabase
      .from("practitioner_settings")
      .select("user_id")
      .limit(1)
      .maybeSingle();
    resolvedPractitionerId = settingsRow?.user_id ?? null;
  }
  if (!resolvedPractitionerId) {
    console.error("[manychat-webhook] No PRACTITIONER_USER_ID env var and no practitioner_settings row");
    return jsonResponse({ error: "Server configuration error: practitioner user not configured" }, 500);
  }

  const patientRecord = { ...patientData, created_by: resolvedPractitionerId };

  const manychatIdStr = String(manychatId);

  try {
    // Look up the existing patient first. A blind upsert would overwrite
    // lifecycle_state (resetting progressed patients back to 'lead') and
    // clobber practitioner-entered data with ManyChat placeholders — and
    // since v1.2 it would also pollute the patient_state_transitions log.
    const { data: existing, error: lookupError } = await supabase
      .from("patients")
      .select("id, survey_token")
      .eq("manychat_id", manychatIdStr)
      .maybeSingle();

    if (lookupError) {
      console.error("[manychat-webhook] Lookup failed:", lookupError.message);
      return jsonResponse({ error: "Failed to create patient" }, 500);
    }

    let patientId = existing?.id ?? null;
    // Returned to ManyChat so the flow can response-map it into a custom
    // field and DM a tokenized survey link (Phase 20 / SURV-04).
    let surveyToken: string | null = existing?.survey_token ?? null;
    let isNew = false;

    if (!patientId) {
      const { data: inserted, error: insertError } = await supabase
        .from("patients")
        .insert(patientRecord)
        .select("id, survey_token")
        .single();

      if (insertError) {
        // 23505: a concurrent re-trigger inserted between our lookup and
        // this insert — recover by falling through to the update path.
        if (insertError.code === "23505") {
          const { data: raced } = await supabase
            .from("patients")
            .select("id, survey_token")
            .eq("manychat_id", manychatIdStr)
            .maybeSingle();
          patientId = raced?.id ?? null;
          surveyToken = raced?.survey_token ?? null;
        }
        if (!patientId) {
          console.error("[manychat-webhook] DB insert failed:", insertError.message, insertError.details);
          return jsonResponse({ error: "Failed to create patient" }, 500);
        }
      } else {
        patientId = inserted.id;
        surveyToken = inserted.survey_token;
        isNew = true;
      }
    }

    if (!isNew) {
      // Update only fields ManyChat sent real data for. Never touch
      // lifecycle_state, names, or created_by on existing patients —
      // the practitioner's records and pipeline progress win.
      const updates: Record<string, unknown> = {};
      if (email) updates.email = email;
      if (phoneNumber !== "unknown") updates.phone_number = phoneNumber;
      if (instagramUsername) updates.instagram_username = instagramUsername;
      if (gender) updates.gender = gender;

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("patients")
          .update(updates)
          .eq("id", patientId);

        if (updateError) {
          console.error("[manychat-webhook] DB update failed:", updateError.message, updateError.details);
          return jsonResponse({ error: "Failed to update patient" }, 500);
        }
      }
    }

    const status = isNew ? "created" : "updated";
    const httpStatus = isNew ? 201 : 200;

    console.log(`[manychat-webhook] Patient ${status}: id=${patientId}, manychat_id=${manychatIdStr}`);

    // Send welcome email for new patients who have an email address
    if (isNew && email) {
      try {
        const welcomeRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${webhookSecret}`,
          },
          body: JSON.stringify({
            feature: "welcome_email",
            to: email,
            subject: "Welcome — Hüseyin Ajuz Hair Loss Consultation",
            html: `<p>Dear ${firstName},</p><p>Thank you for registering with Hüseyin Ajuz. We will be in touch shortly to guide you through your personalised hair loss treatment journey.</p><p>Warm regards,<br>Hüseyin Ajuz</p>`,
            text: `Dear ${firstName}, Thank you for registering with Hüseyin Ajuz. We will be in touch shortly. Warm regards, Hüseyin Ajuz`,
          }),
        });
        if (!welcomeRes.ok) {
          const errText = await welcomeRes.text();
          console.error(`[manychat-webhook] send-email failed: status=${welcomeRes.status} body=${errText}`);
        } else {
          console.log(`[manychat-webhook] Welcome email dispatched for patient id=${patientId}`);
        }
      } catch (emailErr: unknown) {
        const emailMsg = emailErr instanceof Error ? emailErr.message : "Unknown error";
        console.error(`[manychat-webhook] send-email failed: ${emailMsg}`);
      }
    }

    return jsonResponse(
      { status, patient_id: patientId, manychat_id: manychatIdStr, survey_token: surveyToken },
      httpStatus,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[manychat-webhook] Unexpected error:", message);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
