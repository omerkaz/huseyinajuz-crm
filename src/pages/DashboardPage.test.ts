import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeMetrics, formatUSD } from "../lib/dashboardMetrics.ts";
import type { Patient, Payment } from "../types/database.ts";

// ── Fixtures ──

const FIXED_NOW = new Date("2025-06-15T12:00:00Z");

function patient(overrides: Partial<Patient> & { id: string; lifecycle_state: Patient["lifecycle_state"] }): Patient {
  return {
    first_name: "Test",
    last_name: "User",
    email: null,
    phone_country_code: "+1",
    phone_number: "5550001111",
    date_of_birth: null,
    gender: null,
    language: "en",
    country: null,
    package_type: null,
    agreed_price: null,
    notes_text: null,
    source: "manual",
    manychat_id: null,
    instagram_username: null,
    created_by: "user-1",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    state_changed_at: null,
    ...overrides,
  };
}

function payment(overrides: Partial<Payment> & { patient_id: string; amount: number; payment_date: string }): Payment {
  return {
    id: `pay-${overrides.patient_id}-${overrides.payment_date}`,
    currency: "USD",
    payment_method: "bank_transfer",
    reference: null,
    created_by: "user-1",
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── Tests ──

describe("computeMetrics — zero data", () => {
  test("returns zeroed metrics for empty arrays", () => {
    const m = computeMetrics([], [], FIXED_NOW);
    assert.equal(m.totalClients, 0);
    assert.equal(m.activeClients, 0);
    assert.equal(m.revenueTotal, 0);
    assert.equal(m.revenueThisMonth, 0);
    assert.equal(m.revenueByPackage.standard, 0);
    assert.equal(m.revenueByPackage.premium, 0);
    assert.equal(m.revenueByPackage.vip, 0);
    // All stage counts are 0
    for (const count of Object.values(m.stageCounts)) {
      assert.equal(count, 0);
    }
  });
});

describe("computeMetrics — active client counting", () => {
  test("counts only treatment-in-progress states as active", () => {
    const patients = [
      patient({ id: "p1", lifecycle_state: "active_treatment" }),
      patient({ id: "p2", lifecycle_state: "week_6_checkin" }),
      patient({ id: "p3", lifecycle_state: "end_review" }),
      patient({ id: "p4", lifecycle_state: "extended_support" }),
      patient({ id: "p5", lifecycle_state: "lead" }),
      patient({ id: "p6", lifecycle_state: "contacted" }),
      patient({ id: "p7", lifecycle_state: "completed" }),
      patient({ id: "p8", lifecycle_state: "cold" }),
    ];
    const m = computeMetrics(patients, [], FIXED_NOW);
    assert.equal(m.totalClients, 8);
    assert.equal(m.activeClients, 4, "only the 4 treatment-in-progress states count as active");
  });

  test("lead, contacted, awaiting_blood_test, completed, cold are not active", () => {
    const patients = [
      patient({ id: "p1", lifecycle_state: "lead" }),
      patient({ id: "p2", lifecycle_state: "contacted" }),
      patient({ id: "p3", lifecycle_state: "awaiting_blood_test" }),
      patient({ id: "p4", lifecycle_state: "completed" }),
      patient({ id: "p5", lifecycle_state: "cold" }),
    ];
    const m = computeMetrics(patients, [], FIXED_NOW);
    assert.equal(m.activeClients, 0);
  });
});

describe("computeMetrics — stage counts", () => {
  test("each patient increments the correct stage bucket", () => {
    const patients = [
      patient({ id: "p1", lifecycle_state: "lead" }),
      patient({ id: "p2", lifecycle_state: "lead" }),
      patient({ id: "p3", lifecycle_state: "active_treatment" }),
    ];
    const m = computeMetrics(patients, [], FIXED_NOW);
    assert.equal(m.stageCounts.lead, 2);
    assert.equal(m.stageCounts.active_treatment, 1);
    assert.equal(m.stageCounts.contacted, 0);
  });
});

describe("computeMetrics — revenue totals", () => {
  test("sums all payments into revenueTotal", () => {
    const p = patient({ id: "p1", lifecycle_state: "active_treatment", package_type: "standard" });
    const pays = [
      payment({ patient_id: "p1", amount: 100, payment_date: "2024-03-01" }),
      payment({ patient_id: "p1", amount: 250, payment_date: "2024-12-15" }),
    ];
    const m = computeMetrics([p], pays, FIXED_NOW);
    assert.equal(m.revenueTotal, 350);
  });

  test("revenueThisMonth only includes payments in the reference month", () => {
    const p = patient({ id: "p1", lifecycle_state: "active_treatment", package_type: "premium" });
    const pays = [
      payment({ patient_id: "p1", amount: 200, payment_date: "2025-06-01" }),
      payment({ patient_id: "p1", amount: 100, payment_date: "2025-05-30" }),
      payment({ patient_id: "p1", amount: 50, payment_date: "2025-07-01" }),
    ];
    // FIXED_NOW is 2025-06-15; only the June payment counts
    const m = computeMetrics([p], pays, FIXED_NOW);
    assert.equal(m.revenueThisMonth, 200);
    assert.equal(m.revenueTotal, 350);
  });
});

describe("computeMetrics — revenue by package", () => {
  test("groups payment amounts by the patient's package type", () => {
    const patients = [
      patient({ id: "p1", lifecycle_state: "active_treatment", package_type: "standard" }),
      patient({ id: "p2", lifecycle_state: "active_treatment", package_type: "premium" }),
      patient({ id: "p3", lifecycle_state: "active_treatment", package_type: "vip" }),
    ];
    const pays = [
      payment({ patient_id: "p1", amount: 197, payment_date: "2025-01-01" }),
      payment({ patient_id: "p2", amount: 297, payment_date: "2025-01-01" }),
      payment({ patient_id: "p3", amount: 497, payment_date: "2025-01-01" }),
    ];
    const m = computeMetrics(patients, pays, FIXED_NOW);
    assert.equal(m.revenueByPackage.standard, 197);
    assert.equal(m.revenueByPackage.premium, 297);
    assert.equal(m.revenueByPackage.vip, 497);
  });

  test("payments for patients with no package type are excluded from by-package totals", () => {
    const p = patient({ id: "p1", lifecycle_state: "lead", package_type: null });
    const pays = [payment({ patient_id: "p1", amount: 100, payment_date: "2025-01-01" })];
    const m = computeMetrics([p], pays, FIXED_NOW);
    assert.equal(m.revenueByPackage.standard, 0);
    assert.equal(m.revenueByPackage.premium, 0);
    assert.equal(m.revenueByPackage.vip, 0);
    assert.equal(m.revenueTotal, 100, "payment still counts toward total");
  });

  test("mixed-package dataset accumulates correctly per type", () => {
    const patients = [
      patient({ id: "p1", lifecycle_state: "active_treatment", package_type: "standard" }),
      patient({ id: "p2", lifecycle_state: "active_treatment", package_type: "standard" }),
      patient({ id: "p3", lifecycle_state: "active_treatment", package_type: "vip" }),
    ];
    const pays = [
      payment({ patient_id: "p1", amount: 100, payment_date: "2025-02-01" }),
      payment({ patient_id: "p2", amount: 97, payment_date: "2025-02-01" }),
      payment({ patient_id: "p3", amount: 497, payment_date: "2025-02-01" }),
    ];
    const m = computeMetrics(patients, pays, FIXED_NOW);
    assert.equal(m.revenueByPackage.standard, 197);
    assert.equal(m.revenueByPackage.vip, 497);
    assert.equal(m.revenueByPackage.premium, 0);
  });
});

describe("computeMetrics — payment fetch failure (empty payments)", () => {
  test("stage counts and active clients still computed when payments is empty", () => {
    const patients = [
      patient({ id: "p1", lifecycle_state: "active_treatment", package_type: "premium" }),
      patient({ id: "p2", lifecycle_state: "lead", package_type: null }),
    ];
    const m = computeMetrics(patients, [], FIXED_NOW);
    assert.equal(m.totalClients, 2);
    assert.equal(m.activeClients, 1);
    assert.equal(m.revenueTotal, 0);
    assert.equal(m.stageCounts.active_treatment, 1);
    assert.equal(m.stageCounts.lead, 1);
  });
});

describe("formatUSD", () => {
  test("formats whole numbers without decimal places", () => {
    assert.equal(formatUSD(0), "$0");
    assert.equal(formatUSD(197), "$197");
    assert.equal(formatUSD(1000), "$1,000");
    assert.equal(formatUSD(12500), "$12,500");
  });

  test("rounds fractional amounts", () => {
    // maximumFractionDigits: 0 means rounding, not truncation
    const result = formatUSD(99.5);
    assert.match(result, /^\$\d+$/);
  });
});
