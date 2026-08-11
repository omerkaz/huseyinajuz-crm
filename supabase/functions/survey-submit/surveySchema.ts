// ─────────────────────────────────────────────────────────────────────────────
// Qualification survey schema (Phase 19 / SURV-02)
//
// The single source of truth for the question set: stable `q_*` jsonb keys,
// the allowed values for each, and the server-side validator.
//
// Runtime: plain TypeScript, no Deno or Node APIs, no dependencies. It is
// imported by the survey-submit Edge Function (Deno) and unit-tested by
// node:test — same arrangement as send-email/emailTemplate.ts.
//
// The CRM mirrors these arrays in src/types/database.ts for display labels;
// supabase/tests/surveySchema.test.ts fails if the two ever drift.
//
// Question set LOCKED — approved by Hüseyin 2026-08-11. Changing a value here
// invalidates stored answers; bump SURVEY_VERSION instead.
// ─────────────────────────────────────────────────────────────────────────────

/** Written onto survey_responses.survey_version for new rows. */
export const SURVEY_VERSION = 1;

/** Free-text answers are capped so a jsonb bomb cannot reach the database. */
export const MAX_TEXT_LENGTH = 120;

/** q_treatments is multi-select over 5 options — anything longer is abuse. */
export const MAX_TREATMENTS = 5;

export const Q_DURATION_VALUES = [
  "under_6_months",
  "6_12_months",
  "1_3_years",
  "3_plus_years",
] as const;

export const Q_AREA_VALUES = [
  "hairline_temples",
  "crown",
  "overall_thinning",
  "patches",
  "heavy_shedding",
] as const;

export const Q_BLOOD_TEST_VALUES = ["yes", "no"] as const;

export const Q_AGE_RANGE_VALUES = [
  "18_24",
  "25_34",
  "35_44",
  "45_54",
  "55_plus",
] as const;

export const Q_GENDER_VALUES = ["male", "female", "prefer_not_to_say"] as const;

export const Q_TREATMENT_VALUES = [
  "minoxidil",
  "dht_blockers",
  "supplements",
  "prp_or_transplant",
  "nothing_yet",
] as const;

export const Q_READINESS_VALUES = [
  "ready_now",
  "within_a_month",
  "just_researching",
] as const;

/**
 * Every accepted answer key, in the approved question order.
 *
 * `q_name` is stored alongside the other answers so a response row is
 * self-contained; the submit payload's separate `name` field is what backfills
 * patients.first_name / last_name. Email and WhatsApp are never stored in
 * answers — they only backfill patient contact fields.
 */
export const SINGLE_CHOICE_QUESTIONS = {
  q_duration: Q_DURATION_VALUES,
  q_area: Q_AREA_VALUES,
  q_blood_test: Q_BLOOD_TEST_VALUES,
  q_age_range: Q_AGE_RANGE_VALUES,
  q_gender: Q_GENDER_VALUES,
  q_readiness: Q_READINESS_VALUES,
} as const;

export const ANSWER_KEYS = [
  "q_name",
  "q_duration",
  "q_area",
  "q_blood_test",
  "q_age_range",
  "q_gender",
  "q_treatments",
  "q_readiness",
] as const;

export type AnswerKey = (typeof ANSWER_KEYS)[number];

/** A validated answer set. Only q_name is required — the rest may be skipped. */
export type SurveyAnswers = {
  q_name?: string;
  q_duration?: (typeof Q_DURATION_VALUES)[number];
  q_area?: (typeof Q_AREA_VALUES)[number];
  q_blood_test?: (typeof Q_BLOOD_TEST_VALUES)[number];
  q_age_range?: (typeof Q_AGE_RANGE_VALUES)[number];
  q_gender?: (typeof Q_GENDER_VALUES)[number];
  q_treatments?: (typeof Q_TREATMENT_VALUES)[number][];
  q_readiness?: (typeof Q_READINESS_VALUES)[number];
};

export type ValidationResult =
  | { ok: true; answers: SurveyAnswers }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Whitelist-validate a raw answers payload from the public survey page.
 *
 * Rejects unknown keys, wrong types, out-of-range values, oversized text and
 * oversized arrays. Empty strings and empty arrays are dropped rather than
 * stored, so "skipped" and "answered blank" collapse into one representation.
 */
export function validateSurveyAnswers(raw: unknown): ValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, error: "answers must be a JSON object" };
  }

  const answers: SurveyAnswers = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!(ANSWER_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `unknown answer key: ${key}` };
    }

    // Explicit "skipped" — treat null/undefined as absent.
    if (value === null || value === undefined) continue;

    if (key === "q_name") {
      if (typeof value !== "string") {
        return { ok: false, error: "q_name must be a string" };
      }
      const trimmed = value.trim();
      if (trimmed.length === 0) continue;
      if (trimmed.length > MAX_TEXT_LENGTH) {
        return { ok: false, error: `q_name exceeds ${MAX_TEXT_LENGTH} characters` };
      }
      answers.q_name = trimmed;
      continue;
    }

    if (key === "q_treatments") {
      if (!Array.isArray(value)) {
        return { ok: false, error: "q_treatments must be an array" };
      }
      if (value.length > MAX_TREATMENTS) {
        return { ok: false, error: `q_treatments accepts at most ${MAX_TREATMENTS} values` };
      }
      const selected: (typeof Q_TREATMENT_VALUES)[number][] = [];
      for (const item of value) {
        if (typeof item !== "string") {
          return { ok: false, error: "q_treatments values must be strings" };
        }
        if (!(Q_TREATMENT_VALUES as readonly string[]).includes(item)) {
          return { ok: false, error: `invalid q_treatments value: ${item}` };
        }
        const known = item as (typeof Q_TREATMENT_VALUES)[number];
        // Duplicates are normalised away rather than rejected — a double-tap
        // in the UI is a user slip, not an attack.
        if (!selected.includes(known)) selected.push(known);
      }
      if (selected.length === 0) continue;
      answers.q_treatments = selected;
      continue;
    }

    // Remaining keys are single-choice enums.
    const allowed = SINGLE_CHOICE_QUESTIONS[key as keyof typeof SINGLE_CHOICE_QUESTIONS];
    if (typeof value !== "string") {
      return { ok: false, error: `${key} must be a string` };
    }
    if (value.trim().length === 0) continue;
    if (!(allowed as readonly string[]).includes(value)) {
      return { ok: false, error: `invalid ${key} value: ${value}` };
    }
    // Index signature assignment is safe: `key` was whitelist-checked above and
    // `value` was range-checked against that key's allowed list.
    (answers as Record<string, unknown>)[key] = value;
  }

  return { ok: true, answers };
}
