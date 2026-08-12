// Unit tests for the Phase 21 email template registry (MAIL-06).
// Run: node --experimental-strip-types --test (wired into `npm test`)

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  EMAIL_TEMPLATES,
  FALLBACK_GREETING_NAME,
  getEmailTemplate,
  greetingName,
  renderTemplate,
} from "./emailTemplates.ts";
import { EMAIL_FEATURES, EMAIL_FEATURE_LABELS } from "../types/database.ts";

describe("template registry coverage", () => {
  test("every automation feature has exactly one template", () => {
    assert.equal(EMAIL_TEMPLATES.length, EMAIL_FEATURES.length);
    assert.deepEqual(
      EMAIL_TEMPLATES.map((t) => t.key),
      [...EMAIL_FEATURES],
      "templates are registered in lifecycle order, one per feature",
    );
  });

  test("labels come from the shared feature label map", () => {
    for (const template of EMAIL_TEMPLATES) {
      assert.equal(template.label, EMAIL_FEATURE_LABELS[template.key]);
    }
  });

  test("every template has a non-empty subject, context and body", () => {
    for (const template of EMAIL_TEMPLATES) {
      assert.ok(template.subject.trim().length > 0, `${template.key} subject`);
      assert.ok(template.context.trim().length > 0, `${template.key} context`);
      assert.ok(template.buildHtml("Ada").trim().length > 0, `${template.key} body`);
    }
  });

  test("getEmailTemplate returns the matching entry", () => {
    assert.equal(getEmailTemplate("lead_day7").key, "lead_day7");
    assert.equal(getEmailTemplate("welcome_email").subject.includes("Welcome"), true);
  });
});

describe("rendering", () => {
  test("the patient's first name is interpolated into the greeting", () => {
    for (const feature of EMAIL_FEATURES) {
      const { html } = renderTemplate(feature, "Ada");
      assert.ok(html.includes("Ada"), `${feature} greets the patient by name`);
    }
  });

  test("templates emit a bare fragment, never a full document", () => {
    // send-email applies the branded shell (MAIL-05); a document here would
    // produce nested <html> in the delivered mail.
    for (const feature of EMAIL_FEATURES) {
      const { html } = renderTemplate(feature, "Ada");
      assert.ok(html.startsWith("<p>"), `${feature} starts with a paragraph`);
      assert.ok(!/<html|<!DOCTYPE/i.test(html), `${feature} is not a document`);
    }
  });

  test("subject matches the registry entry", () => {
    const { subject } = renderTemplate("blood_test_reminder", "Ada");
    assert.equal(subject, getEmailTemplate("blood_test_reminder").subject);
  });
});

describe("greetingName", () => {
  test("trims a usable name", () => {
    assert.equal(greetingName("  Ada  "), "Ada");
  });

  test("falls back when the name is missing, blank or null", () => {
    for (const value of [null, undefined, "", "   "]) {
      assert.equal(greetingName(value), FALLBACK_GREETING_NAME);
    }
  });

  test("the fallback reaches the rendered body", () => {
    const { html } = renderTemplate("welcome_email", "   ");
    assert.ok(html.includes(FALLBACK_GREETING_NAME));
  });
});
