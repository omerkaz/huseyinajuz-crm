// Unit tests for the Phase 19 survey answer whitelist (SURV-02).
// Run: node --experimental-strip-types --test (wired into `npm test`)
//
// Deliberately OUTSIDE supabase/functions/survey-submit/ — the deploy helper
// globs every *.ts in the function directory, so a test file living there
// would be uploaded with the function.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ANSWER_KEYS,
  MAX_TEXT_LENGTH,
  MAX_TREATMENTS,
  Q_AGE_RANGE_VALUES,
  Q_AREA_VALUES,
  Q_BLOOD_TEST_VALUES,
  Q_DURATION_VALUES,
  Q_GENDER_VALUES,
  Q_READINESS_VALUES,
  Q_TREATMENT_VALUES,
  SURVEY_VERSION,
  validateSurveyAnswers,
} from "../functions/survey-submit/surveySchema.ts";

import {
  SURVEY_ANSWER_KEYS,
  SURVEY_OPTION_VALUES,
  SURVEY_QUESTION_LABELS,
  SURVEY_OPTION_LABELS,
} from "../../src/types/database.ts";

const FULL_ANSWERS = {
  q_name: "Ada Lovelace",
  q_duration: "1_3_years",
  q_area: "crown",
  q_blood_test: "no",
  q_age_range: "35_44",
  q_gender: "female",
  q_treatments: ["minoxidil", "supplements"],
  q_readiness: "ready_now",
};

// ── Happy path ──

test("a complete valid answer set passes through unchanged", () => {
  const result = validateSurveyAnswers(FULL_ANSWERS);
  assert.ok(result.ok, "validation succeeds");
  assert.deepEqual(result.answers, FULL_ANSWERS);
});

test("partial answer sets are allowed — only q_name is expected", () => {
  const result = validateSurveyAnswers({ q_name: "Ada" });
  assert.ok(result.ok);
  assert.deepEqual(result.answers, { q_name: "Ada" });
});

test("an empty object is valid and yields no answers", () => {
  const result = validateSurveyAnswers({});
  assert.ok(result.ok);
  assert.deepEqual(result.answers, {});
});

// ── Whitelist enforcement ──

test("unknown answer keys are rejected", () => {
  const result = validateSurveyAnswers({ ...FULL_ANSWERS, q_injection: "drop table" });
  assert.equal(result.ok, false);
  assert.match((result as { error: string }).error, /unknown answer key: q_injection/);
});

test("out-of-range single-choice values are rejected", () => {
  for (const key of ["q_duration", "q_area", "q_blood_test", "q_age_range", "q_gender", "q_readiness"]) {
    const result = validateSurveyAnswers({ [key]: "maybe" });
    assert.equal(result.ok, false, `${key} accepted a bogus value`);
    assert.match((result as { error: string }).error, new RegExp(`invalid ${key} value`));
  }
});

test("non-string single-choice values are rejected", () => {
  const result = validateSurveyAnswers({ q_gender: 42 });
  assert.equal(result.ok, false);
  assert.match((result as { error: string }).error, /q_gender must be a string/);
});

test("a non-object payload is rejected", () => {
  for (const bad of [null, "answers", 7, ["q_name"]]) {
    const result = validateSurveyAnswers(bad);
    assert.equal(result.ok, false, `${JSON.stringify(bad)} was accepted`);
  }
});

// ── Multi-select (q_treatments) ──

test("q_treatments must be an array of allowed values", () => {
  assert.equal(validateSurveyAnswers({ q_treatments: "minoxidil" }).ok, false);
  assert.equal(validateSurveyAnswers({ q_treatments: [7] }).ok, false);
  assert.equal(validateSurveyAnswers({ q_treatments: ["laser_helmet"] }).ok, false);
  assert.equal(validateSurveyAnswers({ q_treatments: [...Q_TREATMENT_VALUES] }).ok, true);
});

test("q_treatments duplicates are normalised away", () => {
  const result = validateSurveyAnswers({ q_treatments: ["prp_or_transplant", "prp_or_transplant"] });
  assert.ok(result.ok);
  assert.deepEqual(result.answers.q_treatments, ["prp_or_transplant"]);
});

test("q_treatments arrays longer than the option list are rejected", () => {
  const flood = Array.from({ length: MAX_TREATMENTS + 1 }, () => "minoxidil");
  const result = validateSurveyAnswers({ q_treatments: flood });
  assert.equal(result.ok, false);
  assert.match((result as { error: string }).error, /at most 5 values/);
});

// ── Size and blank handling ──

test("q_name is trimmed and capped", () => {
  const ok = validateSurveyAnswers({ q_name: "   Ada Lovelace   " });
  assert.ok(ok.ok);
  assert.equal(ok.answers.q_name, "Ada Lovelace");

  const tooLong = validateSurveyAnswers({ q_name: "x".repeat(MAX_TEXT_LENGTH + 1) });
  assert.equal(tooLong.ok, false);
  assert.match((tooLong as { error: string }).error, /exceeds 120 characters/);
});

test("blank, null and undefined answers are dropped rather than stored", () => {
  const result = validateSurveyAnswers({
    q_name: "   ",
    q_gender: "",
    q_area: null,
    q_treatments: [],
    q_readiness: undefined,
  });
  assert.ok(result.ok);
  assert.deepEqual(result.answers, {});
});

// ── CRM ↔ Edge Function drift guard ──

test("CRM mirrors the Edge Function answer keys exactly", () => {
  assert.deepEqual([...SURVEY_ANSWER_KEYS], [...ANSWER_KEYS]);
});

test("CRM mirrors every option list exactly", () => {
  const expected: Record<string, readonly string[]> = {
    q_duration: Q_DURATION_VALUES,
    q_area: Q_AREA_VALUES,
    q_blood_test: Q_BLOOD_TEST_VALUES,
    q_age_range: Q_AGE_RANGE_VALUES,
    q_gender: Q_GENDER_VALUES,
    q_treatments: Q_TREATMENT_VALUES,
    q_readiness: Q_READINESS_VALUES,
  };

  for (const [key, values] of Object.entries(expected)) {
    assert.deepEqual(
      [...SURVEY_OPTION_VALUES[key as keyof typeof SURVEY_OPTION_VALUES]],
      [...values],
      `option list drifted for ${key}`,
    );
  }
});

test("every answer key and option value has a display label", () => {
  for (const key of ANSWER_KEYS) {
    assert.ok(SURVEY_QUESTION_LABELS[key], `missing question label for ${key}`);
  }
  for (const values of Object.values(SURVEY_OPTION_VALUES)) {
    for (const value of values) {
      assert.ok(SURVEY_OPTION_LABELS[value], `missing option label for ${value}`);
    }
  }
});

test("the survey version is pinned at 1", () => {
  assert.equal(SURVEY_VERSION, 1);
});
