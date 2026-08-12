import {
  EMAIL_FEATURE_LABELS,
  type EmailSendLogEntry,
  type LoggedEmailFeature,
  type Patient,
} from "../types/database.ts";

/**
 * Pure shaping for the /email send log (MAIL-06).
 *
 * The log stores only patient_id; names are joined in memory from the patients
 * fetch the page already performs (D009: fetch once, group client-side).
 * Kept free of the Supabase client so node:test can import it directly.
 */

export interface EmailLogRow {
  id: string;
  patientId: string;
  /** Resolved patient name, or a placeholder when the patient row is gone. */
  patientName: string;
  patientEmail: string | null;
  feature: string;
  featureLabel: string;
  sentAt: string;
}

/** Shown when a log row outlives its patient (should not happen — FK cascades). */
export const UNKNOWN_PATIENT_LABEL = "Unknown patient";

/** Humanise a feature key the registry does not know, rather than hiding it. */
export function featureLabel(feature: string): string {
  const known = EMAIL_FEATURE_LABELS[feature as LoggedEmailFeature];
  if (known) return known;
  return feature.replace(/_/g, " ");
}

type PatientLike = Pick<Patient, "id" | "first_name" | "last_name" | "email">;

/**
 * Join log entries with patients and sort newest first.
 *
 * Ties on sent_at fall back to id so the order is stable across renders —
 * cron runs insert several rows inside one transaction and can share a
 * timestamp to the microsecond.
 */
export function buildLogRows(
  entries: EmailSendLogEntry[],
  patients: PatientLike[],
): EmailLogRow[] {
  const byId = new Map<string, PatientLike>();
  for (const patient of patients) byId.set(patient.id, patient);

  return entries
    .map((entry) => {
      const patient = byId.get(entry.patient_id);
      return {
        id: entry.id,
        patientId: entry.patient_id,
        patientName: patient
          ? `${patient.first_name} ${patient.last_name}`.trim()
          : UNKNOWN_PATIENT_LABEL,
        patientEmail: patient?.email ?? null,
        feature: entry.feature,
        featureLabel: featureLabel(entry.feature),
        sentAt: entry.sent_at,
      };
    })
    .sort((a, b) => {
      const delta = new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
      return delta !== 0 ? delta : b.id.localeCompare(a.id);
    });
}

/** Distinct feature keys present in the log, for the filter dropdown. */
export function featuresInLog(entries: EmailSendLogEntry[]): string[] {
  return [...new Set(entries.map((entry) => entry.feature))].sort();
}

/** Count per feature — a small "what has been sent" summary above the list. */
export function countByFeature(entries: EmailSendLogEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.feature, (counts.get(entry.feature) ?? 0) + 1);
  }
  return counts;
}
