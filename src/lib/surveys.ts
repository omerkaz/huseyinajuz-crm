import { supabase } from "@/lib/supabase";
import {
  SURVEY_ANSWER_KEYS,
  SURVEY_OPTION_LABELS,
  SURVEY_QUESTION_LABELS,
} from "@/types/database";
import type {
  Patient,
  SurveyAnswers,
  SurveyResponse,
  SurveyResponseWithPatient,
  SurveySource,
} from "@/types/database";

/**
 * Patient ids that have a survey response, for the list-view indicator.
 *
 * Deliberately selects only `patient_id` (D009: one query, grouped client-side)
 * — pulling every answers payload just to draw a badge would bloat the page.
 */
export async function getSurveyedPatientIds(): Promise<{
  data: Set<string>;
  error: Error | null;
}> {
  const { data, error } = await supabase.from("survey_responses").select("patient_id");

  if (error) {
    return { data: new Set(), error: new Error(`Failed to fetch survey responses: ${error.message}`) };
  }

  const ids = (data ?? []) as { patient_id: string }[];
  return { data: new Set(ids.map((row) => row.patient_id)), error: null };
}

/** The single survey response for a patient, or null when they have not answered. */
export async function getSurveyResponse(
  patientId: string,
): Promise<{ data: SurveyResponse | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("survey_responses")
    .select("*")
    .eq("patient_id", patientId)
    .maybeSingle();

  if (error) {
    return {
      data: null,
      error: new Error(`Failed to fetch survey response for patient ${patientId}: ${error.message}`),
    };
  }

  return { data: data as SurveyResponse | null, error: null };
}

/** All responses, newest first, joined with the patient columns the list shows. */
export async function getSurveyResponses(filters?: {
  source?: SurveySource;
}): Promise<{ data: SurveyResponseWithPatient[]; error: Error | null }> {
  let query = supabase
    .from("survey_responses")
    .select(
      "*, patient:patients(id, first_name, last_name, email, lifecycle_state)",
    )
    .order("submitted_at", { ascending: false });

  if (filters?.source) {
    query = query.eq("source", filters.source);
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], error: new Error(`Failed to fetch survey responses: ${error.message}`) };
  }

  return { data: (data ?? []) as SurveyResponseWithPatient[], error: null };
}

// ── Display helpers ──

export interface DisplayedAnswer {
  key: string;
  question: string;
  value: string;
}

/** Fallback for values stored before a label existed — never show a raw key. */
function labelFor(value: string): string {
  return SURVEY_OPTION_LABELS[value] ?? value.replace(/_/g, " ");
}

/**
 * Flatten stored answers into ordered, human-readable question/answer pairs.
 * Unanswered questions are omitted; unknown keys (a future survey_version)
 * are still shown, de-underscored, rather than dropped.
 */
export function formatAnswers(answers: SurveyAnswers): DisplayedAnswer[] {
  const rows: DisplayedAnswer[] = [];
  const seen = new Set<string>();

  for (const key of SURVEY_ANSWER_KEYS) {
    const value = answers[key];
    if (value === undefined || value === null) continue;
    seen.add(key);

    const text = Array.isArray(value)
      ? value.map(labelFor).join(", ")
      : key === "q_name"
        ? value
        : labelFor(value);

    if (!text) continue;
    rows.push({ key, question: SURVEY_QUESTION_LABELS[key], value: text });
  }

  for (const [key, value] of Object.entries(answers)) {
    if (seen.has(key) || value === undefined || value === null) continue;
    const text = Array.isArray(value) ? value.map(labelFor).join(", ") : labelFor(String(value));
    rows.push({ key, question: key.replace(/^q_/, "").replace(/_/g, " "), value: text });
  }

  return rows;
}

/** "Ada Lovelace" for a joined patient row, with a fallback for deleted joins. */
export function patientDisplayName(
  patient: Pick<Patient, "first_name" | "last_name"> | null,
): string {
  if (!patient) return "Unknown patient";
  return `${patient.first_name} ${patient.last_name}`.trim();
}
