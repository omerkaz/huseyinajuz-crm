// Supabase Edge Function: landing-lead (Phase 19 / SURV-01)
//
// Public endpoint for the huseyinajuz.com booking form. Creates (or finds) the
// patient record and returns that patient's survey_token so the browser can
// redirect straight to https://huseyinajuz.com/survey?t=<token>.
//
// Deployed with --no-verify-jwt: the caller is an anonymous visitor, not a
// logged-in user. The CORS allowlist is a browser convenience, NOT auth — the
// only real protections are the strict input validation, the payload cap and
// the best-effort rate limiter below. Nothing sensitive is ever returned: the
// response carries a token for a patient the caller just identified by email.
//
// Dedup: an existing patient with the same normalised email is returned
// untouched — lifecycle_state, names and source are never overwritten by a
// repeat form submit (same rule the manychat-webhook follows).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS ──
const ALLOWED_ORIGINS = [
  "https://huseyinajuz.com",
  "https://www.huseyinajuz.com",
  "http://localhost:8888",
  "http://localhost:5173",
  "http://127.0.0.1:8888",
  "http://127.0.0.1:5500",
];

/** Netlify deploy previews: <hash>--<site>.netlify.app */
const NETLIFY_PREVIEW = /^https:\/\/[a-z0-9-]+\.netlify\.app$/;

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin && (ALLOWED_ORIGINS.includes(origin) || NETLIFY_PREVIEW.test(origin))
      ? origin
      : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "3600",
    Vary: "Origin",
  };
}

// ── Limits ──
const MAX_BODY_BYTES = 4 * 1024;
const MAX_FIELD_LENGTH = 120;

// Best-effort abuse brake. Edge Function isolates are ephemeral and not shared,
// so this stops a naive flood from one client, not a distributed one. At tens
// of leads per month that trade-off is deliberate — the alternative (captcha)
// costs conversions on the practice's only acquisition form.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const recentHits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (recentHits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  recentHits.set(key, hits);
  if (recentHits.size > 1000) recentHits.clear(); // crude memory guard
  return hits.length > RATE_LIMIT_MAX;
}

// ── Helpers ──

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Escape LIKE wildcards so an email containing `_` or `%` (both legal in the
 * local part) is matched literally. Postgres LIKE/ILIKE uses `\` as the
 * default escape character, so no ESCAPE clause is needed.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Trimmed string within the field cap, or null. */
function cleanField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_FIELD_LENGTH) return null;
  return trimmed;
}

// ── Main handler ──

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405, origin);
  }

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (rateLimited(clientIp)) {
    return jsonResponse({ error: "Too many requests. Please try again shortly." }, 429, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[landing-lead] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return jsonResponse({ error: "Server configuration error" }, 500, origin);
  }

  // ── Payload size guard ──
  // Content-Length is absent on chunked requests, so cap the read body too.
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Payload too large" }, 413, origin);
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return jsonResponse({ error: "Could not read request body" }, 400, origin);
  }
  if (rawBody.length > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Payload too large" }, 413, origin);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, origin);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return jsonResponse({ error: "Request body must be a JSON object" }, 400, origin);
  }
  const payload = body as Record<string, unknown>;

  // ── Validate input ──
  const email = cleanField(payload.email)?.toLowerCase() ?? null;
  if (!email || !isValidEmail(email)) {
    return jsonResponse({ error: "A valid email address is required" }, 400, origin);
  }

  const firstName = cleanField(payload.first_name) ?? "Landing";
  const lastName = cleanField(payload.last_name) ?? "Lead";
  const phone = cleanField(payload.phone);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // ── Dedup by normalised email ──
    // Matches idx_patients_email_normalised. ILIKE gives the case-insensitive
    // half; the JS re-check below enforces exact normalised equality, so a
    // broadened pattern can never attach a lead to the wrong patient. The DB
    // index is what actually guarantees uniqueness — this lookup only keeps
    // the common case off the error path.
    const findExisting = async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, survey_token, email")
        .ilike("email", escapeLikePattern(email))
        .limit(5);
      if (error) throw new Error(`lookup failed: ${error.message}`);
      const rows = (data ?? []) as { id: string; survey_token: string; email: string | null }[];
      return rows.find((r) => (r.email ?? "").trim().toLowerCase() === email) ?? null;
    };

    const existing = await findExisting();
    if (existing) {
      console.log(`[landing-lead] Existing patient matched: id=${existing.id}`);
      return jsonResponse({ survey_token: existing.survey_token, status: "existing" }, 200, origin);
    }

    // ── Resolve practitioner (D015) ──
    let practitionerId = Deno.env.get("PRACTITIONER_USER_ID") ?? null;
    if (!practitionerId) {
      const { data: settingsRow } = await supabase
        .from("practitioner_settings")
        .select("user_id")
        .limit(1)
        .maybeSingle();
      practitionerId = settingsRow?.user_id ?? null;
    }
    if (!practitionerId) {
      console.error("[landing-lead] No PRACTITIONER_USER_ID and no practitioner_settings row");
      return jsonResponse({ error: "Server configuration error" }, 500, origin);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("patients")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        // Same convention as manychat-webhook: unknown dial code, raw number.
        phone_country_code: "+00",
        phone_number: phone ?? "unknown",
        language: "en",
        lifecycle_state: "lead",
        source: "landing_page",
        created_by: practitionerId,
      })
      .select("id, survey_token")
      .single();

    if (insertError) {
      // 23505: a concurrent submit for the same email won the race — recover by
      // returning that patient's token instead of a 500.
      if (insertError.code === "23505") {
        const raced = await findExisting();
        if (raced) {
          console.log(`[landing-lead] Lost insert race, returning existing id=${raced.id}`);
          return jsonResponse({ survey_token: raced.survey_token, status: "existing" }, 200, origin);
        }
      }
      console.error("[landing-lead] Insert failed:", insertError.message, insertError.details);
      return jsonResponse({ error: "Could not create lead" }, 500, origin);
    }

    console.log(`[landing-lead] Patient created: id=${inserted.id}`);
    return jsonResponse({ survey_token: inserted.survey_token, status: "created" }, 201, origin);
  } catch (err: unknown) {
    // Internal detail stays in the logs — the public response never echoes it.
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[landing-lead] Unexpected error:", message);
    return jsonResponse({ error: "Internal server error" }, 500, origin);
  }
});
