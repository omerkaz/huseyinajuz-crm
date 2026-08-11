// Supabase Edge Function: survey-submit (Phase 19 / SURV-02)
//
// Public endpoint for the hosted qualification survey (huseyinajuz.com/survey).
// The page carries a per-patient token (?t=<uuid>); this function validates it,
// whitelists every answer server-side, and stores one response row per patient.
//
// Deployed with --no-verify-jwt — respondents are anonymous. The token is the
// only credential: it is a uuid v4 (122 bits), never a ManyChat subscriber id.
// An invalid token gets a flat 404 with no hint about what exists.
//
// Contact backfills are additive only: a survey may fill a blank email, phone
// or name, but never overwrites data the practitioner already has.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SURVEY_VERSION, validateSurveyAnswers } from "./surveySchema.ts";

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
const MAX_BODY_BYTES = 8 * 1024;
const MAX_FIELD_LENGTH = 120;

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const recentHits = new Map<string, number[]>();

/** Best-effort, isolate-local flood brake — see landing-lead for the rationale. */
function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (recentHits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  recentHits.set(key, hits);
  if (recentHits.size > 1000) recentHits.clear();
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Trimmed string within the field cap, or null. Empty strings become null so
 *  they never masquerade as "filled in" for the IS NULL backfill guards. */
function cleanField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_FIELD_LENGTH) return null;
  return trimmed;
}

/** Keep digits, spaces and a leading +; anything else is not a phone number. */
function cleanPhone(value: unknown): string | null {
  const raw = cleanField(value);
  if (!raw) return null;
  const stripped = raw.replace(/[^\d+\s()-]/g, "").trim();
  const digits = stripped.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 15) return null;
  return stripped;
}

/** "Ada Lovelace King" → { first: "Ada", last: "Lovelace King" } */
function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === "";
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
    console.error("[survey-submit] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return jsonResponse({ error: "Server configuration error" }, 500, origin);
  }

  // ── Payload size guard (Content-Length may be absent on chunked bodies) ──
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

  // ── Token ──
  const token = cleanField(payload.token);
  if (!token || !UUID_RE.test(token)) {
    return jsonResponse({ error: "This survey link is not valid." }, 404, origin);
  }

  // ── Contact fields ──
  const email = cleanField(payload.email)?.toLowerCase() ?? null;
  if (!email || !isValidEmail(email)) {
    return jsonResponse({ error: "A valid email address is required" }, 400, origin);
  }
  const whatsapp = cleanPhone(payload.whatsapp);
  const name = cleanField(payload.name);

  // ── Answers ──
  const validation = validateSurveyAnswers(payload.answers ?? {});
  if (!validation.ok) {
    return jsonResponse({ error: `Invalid answers: ${validation.error}` }, 400, origin);
  }
  const answers = validation.answers;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: patient, error: lookupError } = await supabase
      .from("patients")
      .select("id, source, email, phone_number, first_name, last_name")
      .eq("survey_token", token)
      .maybeSingle();

    if (lookupError) {
      console.error("[survey-submit] Lookup failed:", lookupError.message);
      return jsonResponse({ error: "Internal server error" }, 500, origin);
    }
    if (!patient) {
      return jsonResponse({ error: "This survey link is not valid." }, 404, origin);
    }

    // ── Store the response ──
    // ON CONFLICT (patient_id): a re-submit replaces the answers and stamps a
    // new submitted_at. survey_version is omitted from the update payload so an
    // existing row keeps the version its answers were authored against.
    const { error: upsertError } = await supabase
      .from("survey_responses")
      .upsert(
        {
          patient_id: patient.id,
          source: patient.source ?? "unknown",
          answers,
          survey_version: SURVEY_VERSION,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "patient_id" },
      );

    if (upsertError) {
      console.error("[survey-submit] Upsert failed:", upsertError.message, upsertError.details);
      return jsonResponse({ error: "Could not save your answers" }, 500, origin);
    }

    // ── Additive contact backfills ──
    // Each guard is expressed in the WHERE clause so it is evaluated by
    // Postgres, not from the row we read a moment ago.
    if (isBlank(patient.email)) {
      const { error: emailError } = await supabase
        .from("patients")
        .update({ email })
        .eq("id", patient.id)
        .is("email", null);
      if (emailError) {
        // 23505 = another patient already owns this email. The answers are
        // saved either way; the practitioner resolves the duplicate by hand.
        console.warn(`[survey-submit] Email backfill skipped for ${patient.id}: ${emailError.message}`);
      }
    }

    if (whatsapp && (isBlank(patient.phone_number) || patient.phone_number === "unknown")) {
      const { error: phoneError } = await supabase
        .from("patients")
        .update({ phone_country_code: "+00", phone_number: whatsapp })
        .eq("id", patient.id)
        .or("phone_number.is.null,phone_number.eq.unknown");
      if (phoneError) {
        console.warn(`[survey-submit] Phone backfill skipped for ${patient.id}: ${phoneError.message}`);
      }
    }

    if (name) {
      const { first, last } = splitName(name);
      const nameUpdates: Record<string, string> = {};
      // Placeholder names come from the webhook ("ManyChat Lead") and from
      // landing-lead ("Landing Lead") — the survey is the first time the
      // person tells us their actual name, so those may be replaced.
      const firstIsPlaceholder =
        isBlank(patient.first_name) ||
        ["ManyChat", "Landing"].includes(patient.first_name.trim());
      const lastIsPlaceholder =
        isBlank(patient.last_name) || patient.last_name.trim() === "Lead";

      if (firstIsPlaceholder && first) nameUpdates.first_name = first;
      if (lastIsPlaceholder && last) nameUpdates.last_name = last;

      if (Object.keys(nameUpdates).length > 0) {
        const { error: nameError } = await supabase
          .from("patients")
          .update(nameUpdates)
          .eq("id", patient.id);
        if (nameError) {
          console.warn(`[survey-submit] Name backfill skipped for ${patient.id}: ${nameError.message}`);
        }
      }
    }

    console.log(`[survey-submit] Response stored for patient id=${patient.id}`);
    return jsonResponse({ status: "ok" }, 200, origin);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[survey-submit] Unexpected error:", message);
    return jsonResponse({ error: "Internal server error" }, 500, origin);
  }
});
