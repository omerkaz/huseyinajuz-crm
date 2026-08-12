// Unit tests for the Phase 21 send-log shaping (MAIL-06).
// Run: node --experimental-strip-types --test (wired into `npm test`)

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  UNKNOWN_PATIENT_LABEL,
  buildLogRows,
  countByFeature,
  featureLabel,
  featuresInLog,
} from "./emailLogView.ts";
import type { EmailSendLogEntry, Patient } from "../types/database.ts";

// ── Fixtures ──

function entry(
  overrides: Partial<EmailSendLogEntry> & { id: string; patient_id: string },
): EmailSendLogEntry {
  return {
    feature: "welcome_email",
    sent_at: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

function patient(
  overrides: Partial<Patient> & { id: string },
): Pick<Patient, "id" | "first_name" | "last_name" | "email"> {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
    ...overrides,
  };
}

const PATIENTS = [
  patient({ id: "p1" }),
  patient({ id: "p2", first_name: "Grace", last_name: "Hopper", email: null }),
];

describe("buildLogRows", () => {
  test("resolves patient name and email from the patients fetch", () => {
    const rows = buildLogRows([entry({ id: "e1", patient_id: "p1" })], PATIENTS);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].patientName, "Ada Lovelace");
    assert.equal(rows[0].patientEmail, "ada@example.com");
    assert.equal(rows[0].featureLabel, "Welcome Email");
  });

  test("a patient without an email still resolves a name", () => {
    const rows = buildLogRows([entry({ id: "e1", patient_id: "p2" })], PATIENTS);
    assert.equal(rows[0].patientName, "Grace Hopper");
    assert.equal(rows[0].patientEmail, null);
  });

  test("an unresolvable patient is labelled, not dropped", () => {
    const rows = buildLogRows([entry({ id: "e1", patient_id: "ghost" })], PATIENTS);
    assert.equal(rows.length, 1, "the row survives");
    assert.equal(rows[0].patientName, UNKNOWN_PATIENT_LABEL);
    assert.equal(rows[0].patientEmail, null);
  });

  test("sorts newest first", () => {
    const rows = buildLogRows(
      [
        entry({ id: "old", patient_id: "p1", sent_at: "2026-07-01T09:00:00.000Z" }),
        entry({ id: "new", patient_id: "p1", sent_at: "2026-08-05T09:00:00.000Z" }),
        entry({ id: "mid", patient_id: "p1", sent_at: "2026-08-01T09:00:00.000Z" }),
      ],
      PATIENTS,
    );

    assert.deepEqual(rows.map((r) => r.id), ["new", "mid", "old"]);
  });

  test("identical timestamps keep a deterministic order", () => {
    const sameInstant = "2026-08-01T09:00:00.000Z";
    const rows = buildLogRows(
      [
        entry({ id: "aaa", patient_id: "p1", sent_at: sameInstant }),
        entry({ id: "bbb", patient_id: "p1", sent_at: sameInstant }),
      ],
      PATIENTS,
    );

    assert.deepEqual(rows.map((r) => r.id), ["bbb", "aaa"]);
  });

  test("an empty log yields no rows", () => {
    assert.deepEqual(buildLogRows([], PATIENTS), []);
  });
});

describe("featureLabel", () => {
  test("known automation and manual keys get their display labels", () => {
    assert.equal(featureLabel("lead_day12"), "Lead Follow-up Day 12");
    assert.equal(featureLabel("manual"), "Manual Send");
  });

  test("an unknown key is humanised rather than hidden", () => {
    // A future drip step logged before the CRM knows about it must still show.
    assert.equal(featureLabel("drip_day20"), "drip day20");
  });
});

describe("summaries", () => {
  const entries = [
    entry({ id: "e1", patient_id: "p1", feature: "manual" }),
    entry({ id: "e2", patient_id: "p2", feature: "manual" }),
    entry({ id: "e3", patient_id: "p1", feature: "welcome_email" }),
  ];

  test("featuresInLog lists distinct keys, sorted", () => {
    assert.deepEqual(featuresInLog(entries), ["manual", "welcome_email"]);
  });

  test("countByFeature counts each key", () => {
    const counts = countByFeature(entries);
    assert.equal(counts.get("manual"), 2);
    assert.equal(counts.get("welcome_email"), 1);
    assert.equal(counts.get("end_review"), undefined);
  });

  test("empty input yields empty summaries", () => {
    assert.deepEqual(featuresInLog([]), []);
    assert.equal(countByFeature([]).size, 0);
  });
});
