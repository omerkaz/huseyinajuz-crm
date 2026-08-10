import {
  LEAD_SOURCES,
  LIFECYCLE_STATES,
  type LeadSource,
  type LifecycleState,
  type Patient,
  type StateTransition,
} from "../types/database.ts";

// ── Funnel shape ──

/**
 * Forward-funnel depth per lifecycle state.
 *
 * extended_support shares end_review's depth — they are a parallel
 * branch (end_review ↔ extended_support), so oscillating between them
 * never double-counts a stage. cold is off-funnel (-1).
 *
 * Reaching depth N implies having passed depths 0..N-1: every path in
 * VALID_TRANSITIONS is strictly forward, and backfilled patients only
 * carry a seed row for their current state, so depth inference is the
 * only correct way to count "ever reached stage X".
 */
export const FUNNEL_DEPTH: Record<LifecycleState, number> = {
  lead: 0,
  contacted: 1,
  awaiting_blood_test: 2,
  active_treatment: 3,
  week_6_checkin: 4,
  end_review: 5,
  extended_support: 5,
  completed: 6,
  cold: -1,
};

/** The ordered main funnel path (extended_support folds into end_review). */
export const FUNNEL_STAGES = [
  "lead",
  "contacted",
  "awaiting_blood_test",
  "active_treatment",
  "week_6_checkin",
  "end_review",
  "completed",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

// ── Result types ──

export interface FunnelStageMetric {
  state: FunnelStage;
  /** Patients whose journey ever reached this stage (or deeper). */
  reached: number;
  /** 0–100, share of all patients. */
  pctOfLeads: number;
  /** 0–100, share of patients who reached the previous stage. */
  pctOfPrevious: number;
}

export interface StageDuration {
  state: LifecycleState;
  /** Median days patients spent in this stage; null with no closed periods. */
  medianDays: number | null;
  /** Number of patients with at least one closed period in this stage. */
  samples: number;
}

export interface CohortMetric {
  /** "YYYY-MM" of patient creation. */
  month: string;
  total: number;
  /** Cohort members whose first-touch source is ManyChat. */
  fromManychat: number;
  reachedTreatment: number;
  /** Currently cold. */
  wentCold: number;
  /** 0–100, reachedTreatment / total. */
  conversionPct: number;
}

export interface SourceMetric {
  total: number;
  reachedTreatment: number;
  /** 0–100. */
  conversionPct: number;
}

export interface FunnelMetrics {
  totalPatients: number;
  stages: FunnelStageMetric[];
  /** One entry per lifecycle state, in LIFECYCLE_STATES order. */
  stageDurations: StageDuration[];
  /** Count of X → cold transitions, keyed by X. */
  coldByStage: Partial<Record<LifecycleState, number>>;
  /** Patients currently in cold. */
  totalCold: number;
  /** cold → lead re-engagement transitions. */
  reengaged: number;
  /** Ascending by month. */
  cohorts: CohortMetric[];
  /** One entry per lead source, in LEAD_SOURCES order — zero-count sources included. */
  bySource: Record<LeadSource, SourceMetric>;
}

// ── Helpers ──

const MS_PER_DAY = 86_400_000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Sort a patient's transitions chronologically; seq breaks changed_at ties. */
function chronological(a: StateTransition, b: StateTransition): number {
  const diff = new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime();
  return diff !== 0 ? diff : a.seq - b.seq;
}

// ── Main computation ──

export function computeFunnel(
  patients: Patient[],
  transitions: StateTransition[],
): FunnelMetrics {
  // Group and order transitions per patient.
  const byPatient = new Map<string, StateTransition[]>();
  for (const t of transitions) {
    const list = byPatient.get(t.patient_id);
    if (list) list.push(t);
    else byPatient.set(t.patient_id, [t]);
  }
  for (const list of byPatient.values()) list.sort(chronological);

  // Max funnel depth ever reached per patient. Floor at 0: every patient
  // entered the funnel, even if their only trace is a backfilled cold row.
  const maxDepth = (p: Patient): number => {
    let depth = FUNNEL_DEPTH[p.lifecycle_state];
    for (const t of byPatient.get(p.id) ?? []) {
      if (t.from_state) depth = Math.max(depth, FUNNEL_DEPTH[t.from_state]);
      depth = Math.max(depth, FUNNEL_DEPTH[t.to_state]);
    }
    return Math.max(depth, 0);
  };

  const journeys = patients.map((p) => ({ patient: p, depth: maxDepth(p) }));
  const total = patients.length;

  // Funnel stage counts + conversion percentages.
  const stages: FunnelStageMetric[] = FUNNEL_STAGES.map((state) => ({
    state,
    reached: journeys.filter((j) => j.depth >= FUNNEL_DEPTH[state]).length,
    pctOfLeads: 0,
    pctOfPrevious: 0,
  }));
  for (let i = 0; i < stages.length; i++) {
    stages[i].pctOfLeads = total > 0 ? (stages[i].reached / total) * 100 : 0;
    const prev = i === 0 ? total : stages[i - 1].reached;
    stages[i].pctOfPrevious = prev > 0 ? (stages[i].reached / prev) * 100 : 0;
  }

  // Time-in-stage: each consecutive transition pair closes a period in
  // t[i].to_state. Disjoint periods (e.g. lead → cold → lead) are summed
  // per patient first, so cycles contribute one sample, not several.
  // Open periods (the current stage) are censored data — excluded.
  const stageDaysAcrossPatients = new Map<LifecycleState, number[]>();
  for (const list of byPatient.values()) {
    const perStage = new Map<LifecycleState, number>();
    for (let i = 0; i + 1 < list.length; i++) {
      const stage = list[i].to_state;
      const days =
        (new Date(list[i + 1].changed_at).getTime() -
          new Date(list[i].changed_at).getTime()) /
        MS_PER_DAY;
      if (days >= 0) perStage.set(stage, (perStage.get(stage) ?? 0) + days);
    }
    for (const [stage, days] of perStage) {
      const arr = stageDaysAcrossPatients.get(stage);
      if (arr) arr.push(days);
      else stageDaysAcrossPatients.set(stage, [days]);
    }
  }
  const stageDurations: StageDuration[] = LIFECYCLE_STATES.map((state) => {
    const samples = stageDaysAcrossPatients.get(state) ?? [];
    return { state, medianDays: median(samples), samples: samples.length };
  });

  // Cold drop-off and re-engagement. Backfill seeds (from_state null)
  // carry no origin information and are excluded from coldByStage.
  const coldByStage: Partial<Record<LifecycleState, number>> = {};
  let reengaged = 0;
  for (const t of transitions) {
    if (t.to_state === "cold" && t.from_state) {
      coldByStage[t.from_state] = (coldByStage[t.from_state] ?? 0) + 1;
    }
    if (t.from_state === "cold" && t.to_state === "lead") reengaged += 1;
  }
  const totalCold = patients.filter((p) => p.lifecycle_state === "cold").length;

  // Monthly cohorts keyed on patient creation date (always accurate,
  // unlike backfilled transition timestamps).
  const cohortMap = new Map<string, CohortMetric>();
  for (const { patient: p, depth } of journeys) {
    const month = p.created_at.slice(0, 7);
    let cohort = cohortMap.get(month);
    if (!cohort) {
      cohort = { month, total: 0, fromManychat: 0, reachedTreatment: 0, wentCold: 0, conversionPct: 0 };
      cohortMap.set(month, cohort);
    }
    cohort.total += 1;
    if (p.source === "manychat") cohort.fromManychat += 1;
    if (depth >= FUNNEL_DEPTH.active_treatment) cohort.reachedTreatment += 1;
    if (p.lifecycle_state === "cold") cohort.wentCold += 1;
  }
  const cohorts = [...cohortMap.values()].sort((a, b) => a.month.localeCompare(b.month));
  for (const c of cohorts) {
    c.conversionPct = c.total > 0 ? (c.reachedTreatment / c.total) * 100 : 0;
  }

  // Segmentation by first-touch source (SRC-01). Every source in LEAD_SOURCES
  // gets a row, including ones with no patients yet — a zero tells the reader
  // the channel exists and is not converting, which an absent row does not.
  const sourceMetric = (subset: typeof journeys): SourceMetric => {
    const reachedTreatment = subset.filter(
      (j) => j.depth >= FUNNEL_DEPTH.active_treatment,
    ).length;
    return {
      total: subset.length,
      reachedTreatment,
      conversionPct: subset.length > 0 ? (reachedTreatment / subset.length) * 100 : 0,
    };
  };
  const bySource = Object.fromEntries(
    LEAD_SOURCES.map((source) => [
      source,
      sourceMetric(journeys.filter((j) => j.patient.source === source)),
    ]),
  ) as Record<LeadSource, SourceMetric>;

  return {
    totalPatients: total,
    stages,
    stageDurations,
    coldByStage,
    totalCold,
    reengaged,
    cohorts,
    bySource,
  };
}
