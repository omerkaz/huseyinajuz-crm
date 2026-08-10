import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeFunnel, FUNNEL_STAGES } from "./funnelMetrics.ts";
import { LEAD_SOURCES } from "../types/database.ts";
import type { Patient, StateTransition, LifecycleState } from "../types/database.ts";

// ── Fixtures ──

function patient(
  overrides: Partial<Patient> & { id: string; lifecycle_state: Patient["lifecycle_state"] },
): Patient {
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

let seqCounter = 0;

function transition(
  patient_id: string,
  from_state: LifecycleState | null,
  to_state: LifecycleState,
  changed_at: string,
  seq?: number,
): StateTransition {
  seqCounter += 1;
  return {
    id: `t-${seqCounter}`,
    seq: seq ?? seqCounter,
    patient_id,
    from_state,
    to_state,
    changed_at,
    created_by: "user-1",
  };
}

// ── Tests ──

describe("computeFunnel — zero data", () => {
  test("returns zeroed metrics for empty inputs", () => {
    const m = computeFunnel([], []);
    assert.equal(m.totalPatients, 0);
    assert.equal(m.totalCold, 0);
    assert.equal(m.reengaged, 0);
    assert.deepEqual(m.cohorts, []);
    assert.equal(m.stages.length, FUNNEL_STAGES.length);
    for (const s of m.stages) {
      assert.equal(s.reached, 0);
      assert.equal(s.pctOfLeads, 0);
      assert.equal(s.pctOfPrevious, 0);
    }
    // Every source keeps a row even with no data at all.
    assert.deepEqual(Object.keys(m.bySource), [...LEAD_SOURCES]);
    for (const source of LEAD_SOURCES) {
      assert.equal(m.bySource[source].total, 0);
      assert.equal(m.bySource[source].reachedTreatment, 0);
      assert.equal(m.bySource[source].conversionPct, 0);
    }
  });
});

describe("computeFunnel — depth inference (backfill gap)", () => {
  test("backfilled patient in active_treatment counts as reaching all prior stages", () => {
    // Seed row only: NULL → active_treatment (pre-migration patient)
    const p = patient({ id: "p1", lifecycle_state: "active_treatment" });
    const m = computeFunnel([p], [transition("p1", null, "active_treatment", "2025-01-01T00:00:00Z")]);

    const byState = Object.fromEntries(m.stages.map((s) => [s.state, s]));
    assert.equal(byState.lead.reached, 1);
    assert.equal(byState.contacted.reached, 1);
    assert.equal(byState.awaiting_blood_test.reached, 1);
    assert.equal(byState.active_treatment.reached, 1);
    assert.equal(byState.week_6_checkin.reached, 0);
    // 100% conversion at every reached step
    assert.equal(byState.contacted.pctOfPrevious, 100);
    assert.equal(byState.active_treatment.pctOfPrevious, 100);
  });

  test("backfilled cold-only patient counts as lead entry, nothing deeper", () => {
    const p = patient({ id: "p1", lifecycle_state: "cold" });
    const m = computeFunnel([p], [transition("p1", null, "cold", "2025-01-01T00:00:00Z")]);

    const byState = Object.fromEntries(m.stages.map((s) => [s.state, s]));
    assert.equal(byState.lead.reached, 1);
    assert.equal(byState.contacted.reached, 0);
    assert.equal(m.totalCold, 1);
  });

  test("currently-cold patient keeps deepest stage from transition history", () => {
    const p = patient({ id: "p1", lifecycle_state: "cold" });
    const m = computeFunnel(
      [p],
      [
        transition("p1", null, "lead", "2025-01-01T00:00:00Z"),
        transition("p1", "lead", "contacted", "2025-01-05T00:00:00Z"),
        transition("p1", "contacted", "awaiting_blood_test", "2025-01-10T00:00:00Z"),
        transition("p1", "awaiting_blood_test", "cold", "2025-02-01T00:00:00Z"),
      ],
    );
    const byState = Object.fromEntries(m.stages.map((s) => [s.state, s]));
    assert.equal(byState.awaiting_blood_test.reached, 1);
    assert.equal(byState.active_treatment.reached, 0);
    assert.deepEqual(m.coldByStage, { awaiting_blood_test: 1 });
  });
});

describe("computeFunnel — end_review ↔ extended_support parallel branch", () => {
  test("oscillation never double-counts and pct stays ≤ 100", () => {
    const p = patient({ id: "p1", lifecycle_state: "extended_support" });
    const m = computeFunnel(
      [p],
      [
        transition("p1", null, "lead", "2025-01-01T00:00:00Z"),
        transition("p1", "week_6_checkin", "end_review", "2025-03-01T00:00:00Z"),
        transition("p1", "end_review", "extended_support", "2025-03-10T00:00:00Z"),
        transition("p1", "extended_support", "end_review", "2025-03-20T00:00:00Z"),
        transition("p1", "end_review", "extended_support", "2025-04-01T00:00:00Z"),
      ],
    );
    const byState = Object.fromEntries(m.stages.map((s) => [s.state, s]));
    assert.equal(byState.end_review.reached, 1);
    assert.equal(byState.completed.reached, 0);
    for (const s of m.stages) {
      assert.ok(s.pctOfPrevious <= 100, `${s.state} pctOfPrevious ${s.pctOfPrevious} > 100`);
      assert.ok(s.pctOfLeads <= 100, `${s.state} pctOfLeads ${s.pctOfLeads} > 100`);
    }
  });
});

describe("computeFunnel — time in stage", () => {
  test("consecutive transitions close stage periods; medians per stage", () => {
    // p1: lead 4 days → contacted 6 days → awaiting_blood_test (open)
    const p1 = patient({ id: "p1", lifecycle_state: "awaiting_blood_test" });
    const m = computeFunnel(
      [p1],
      [
        transition("p1", null, "lead", "2025-01-01T00:00:00Z"),
        transition("p1", "lead", "contacted", "2025-01-05T00:00:00Z"),
        transition("p1", "contacted", "awaiting_blood_test", "2025-01-11T00:00:00Z"),
      ],
    );
    const durations = Object.fromEntries(m.stageDurations.map((d) => [d.state, d]));
    assert.equal(durations.lead.medianDays, 4);
    assert.equal(durations.lead.samples, 1);
    assert.equal(durations.contacted.medianDays, 6);
    // Open (current) stage is censored — no sample
    assert.equal(durations.awaiting_blood_test.samples, 0);
    assert.equal(durations.awaiting_blood_test.medianDays, null);
  });

  test("cyclic states sum disjoint periods into one sample per patient", () => {
    // p1: lead 2d → cold 10d → lead 3d → contacted. Total lead time = 5d, one sample.
    const p1 = patient({ id: "p1", lifecycle_state: "contacted" });
    const m = computeFunnel(
      [p1],
      [
        transition("p1", null, "lead", "2025-01-01T00:00:00Z"),
        transition("p1", "lead", "cold", "2025-01-03T00:00:00Z"),
        transition("p1", "cold", "lead", "2025-01-13T00:00:00Z"),
        transition("p1", "lead", "contacted", "2025-01-16T00:00:00Z"),
      ],
    );
    const durations = Object.fromEntries(m.stageDurations.map((d) => [d.state, d]));
    assert.equal(durations.lead.samples, 1);
    assert.equal(durations.lead.medianDays, 5);
    assert.equal(durations.cold.medianDays, 10);
    assert.equal(m.reengaged, 1);
    assert.deepEqual(m.coldByStage, { lead: 1 });
  });

  test("median across patients", () => {
    const mk = (id: string, days: number) => [
      transition(id, null, "lead", "2025-01-01T00:00:00Z"),
      transition(id, "lead", "contacted", new Date(Date.UTC(2025, 0, 1 + days)).toISOString()),
    ];
    const m = computeFunnel(
      [
        patient({ id: "a", lifecycle_state: "contacted" }),
        patient({ id: "b", lifecycle_state: "contacted" }),
        patient({ id: "c", lifecycle_state: "contacted" }),
      ],
      [...mk("a", 2), ...mk("b", 8), ...mk("c", 30)],
    );
    const lead = m.stageDurations.find((d) => d.state === "lead")!;
    assert.equal(lead.samples, 3);
    assert.equal(lead.medianDays, 8);
  });

  test("equal changed_at rows are ordered by seq (no negative durations)", () => {
    const t1 = transition("p1", null, "lead", "2025-01-01T00:00:00Z", 1);
    const t2 = transition("p1", "lead", "contacted", "2025-01-01T00:00:00Z", 2);
    // Deliberately pass them out of order
    const m = computeFunnel([patient({ id: "p1", lifecycle_state: "contacted" })], [t2, t1]);
    const lead = m.stageDurations.find((d) => d.state === "lead")!;
    assert.equal(lead.samples, 1);
    assert.equal(lead.medianDays, 0);
  });
});

describe("computeFunnel — cohorts", () => {
  test("groups by created_at month with source split and conversion", () => {
    const may = [
      patient({ id: "m1", lifecycle_state: "active_treatment", created_at: "2025-05-10T00:00:00Z", source: "manychat", manychat_id: "mc1" }),
      patient({ id: "m2", lifecycle_state: "cold", created_at: "2025-05-20T00:00:00Z", source: "manychat", manychat_id: "mc2" }),
    ];
    const june = [
      patient({ id: "j1", lifecycle_state: "completed", created_at: "2025-06-01T00:00:00Z" }),
    ];
    const m = computeFunnel([...may, ...june], []);

    assert.equal(m.cohorts.length, 2);
    assert.deepEqual(
      m.cohorts.map((c) => c.month),
      ["2025-05", "2025-06"],
    );

    const [c5, c6] = m.cohorts;
    assert.equal(c5.total, 2);
    assert.equal(c5.fromManychat, 2);
    assert.equal(c5.reachedTreatment, 1);
    assert.equal(c5.wentCold, 1);
    assert.equal(c5.conversionPct, 50);

    assert.equal(c6.total, 1);
    assert.equal(c6.fromManychat, 0);
    assert.equal(c6.reachedTreatment, 1); // completed implies treatment
    assert.equal(c6.conversionPct, 100);
  });
});

describe("computeFunnel — source segmentation", () => {
  test("splits conversion to treatment across all three sources", () => {
    const m = computeFunnel(
      [
        patient({ id: "a", lifecycle_state: "active_treatment", source: "manychat", manychat_id: "mc1" }),
        patient({ id: "b", lifecycle_state: "lead", source: "manychat", manychat_id: "mc2" }),
        patient({ id: "c", lifecycle_state: "completed", source: "manual" }),
        patient({ id: "d", lifecycle_state: "contacted", source: "manual" }),
        patient({ id: "e", lifecycle_state: "week_6_checkin", source: "landing_page" }),
      ],
      [],
    );

    assert.equal(m.bySource.manychat.total, 2);
    assert.equal(m.bySource.manychat.reachedTreatment, 1);
    assert.equal(m.bySource.manychat.conversionPct, 50);

    assert.equal(m.bySource.manual.total, 2);
    assert.equal(m.bySource.manual.reachedTreatment, 1);
    assert.equal(m.bySource.manual.conversionPct, 50);

    assert.equal(m.bySource.landing_page.total, 1);
    assert.equal(m.bySource.landing_page.reachedTreatment, 1);
    assert.equal(m.bySource.landing_page.conversionPct, 100);

    // Segments partition the population — no patient counted twice or dropped.
    const summed = LEAD_SOURCES.reduce((n, s) => n + m.bySource[s].total, 0);
    assert.equal(summed, m.totalPatients);
  });

  test("source, not manychat_id, decides the segment", () => {
    // A landing-page lead that later got a ManyChat id keeps its first touch.
    const m = computeFunnel(
      [patient({ id: "a", lifecycle_state: "lead", source: "landing_page", manychat_id: "mc9" })],
      [],
    );

    assert.equal(m.bySource.landing_page.total, 1);
    assert.equal(m.bySource.manychat.total, 0);
    assert.equal(m.cohorts[0].fromManychat, 0);
  });

  test("a source with no patients reports zero, not a missing row", () => {
    const m = computeFunnel([patient({ id: "a", lifecycle_state: "lead", source: "manual" })], []);

    assert.deepEqual(Object.keys(m.bySource), [...LEAD_SOURCES]);
    assert.equal(m.bySource.landing_page.total, 0);
    assert.equal(m.bySource.landing_page.conversionPct, 0);
  });
});
