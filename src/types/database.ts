// ── Lifecycle States ──

export const LIFECYCLE_STATES = [
  "lead",
  "contacted",
  "awaiting_blood_test",
  "active_treatment",
  "week_6_checkin",
  "end_review",
  "extended_support",
  "completed",
  "cold",
] as const;

export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export const LIFECYCLE_LABELS: Record<LifecycleState, string> = {
  lead: "Lead",
  contacted: "Contacted",
  awaiting_blood_test: "Awaiting Blood Test",
  active_treatment: "Active Treatment",
  week_6_checkin: "Week 6 Check-in",
  end_review: "End Review",
  extended_support: "Extended Support",
  completed: "Completed",
  cold: "Cold",
};

export const VALID_TRANSITIONS: Record<LifecycleState, readonly LifecycleState[]> = {
  lead: ["contacted", "cold"],
  contacted: ["awaiting_blood_test", "cold"],
  awaiting_blood_test: ["active_treatment", "cold"],
  active_treatment: ["week_6_checkin", "cold"],
  week_6_checkin: ["end_review", "extended_support", "cold"],
  end_review: ["completed", "extended_support", "cold"],
  extended_support: ["end_review", "completed", "cold"],
  completed: [],
  cold: ["lead"],
};

// ── Package Types ──

export const PACKAGE_TYPES = ["standard", "premium", "vip"] as const;

export type PackageType = (typeof PACKAGE_TYPES)[number];

// ── Lead Sources ──

/**
 * First-touch acquisition channel (SRC-01). Set once at creation and never
 * updated — `source` is deliberately excluded from PatientUpdate.
 */
export const LEAD_SOURCES = ["manychat", "landing_page", "manual"] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  manychat: "ManyChat",
  landing_page: "Landing Page",
  manual: "Manual",
};

// ── Languages ──

export const LANGUAGES = [
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

// ── Patient ──

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone_country_code: string;
  phone_number: string;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | null;
  language: LanguageCode;
  country: string | null;
  lifecycle_state: LifecycleState;
  package_type: PackageType | null;
  agreed_price: number | null;
  notes_text: string | null;
  /** First-touch acquisition channel — immutable after creation. */
  source: LeadSource;
  manychat_id: string | null;
  instagram_username: string | null;
  /** Bearer key for the hosted survey page (?t=<token>). Never rendered in the UI. */
  survey_token: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  state_changed_at: string | null;
}

export type PatientInsert = Omit<Patient, "id" | "created_at" | "updated_at" | "manychat_id" | "instagram_username" | "state_changed_at" | "agreed_price" | "survey_token"> & {
  manychat_id?: string | null;
  instagram_username?: string | null;
  state_changed_at?: string | null;
  agreed_price?: number | null;
};
/** `source` is first-touch and immutable — it is never part of an update. */
export type PatientUpdate = Partial<
  Omit<Patient, "id" | "created_at" | "updated_at" | "created_by" | "source" | "survey_token">
>;

// ── Patient State Transition ──

/**
 * Append-only lifecycle history row, written exclusively by Postgres
 * triggers on `patients` (see schema.sql, v1.2 funnel analytics).
 * `from_state: null` marks a funnel entry — patient creation or a
 * backfill seed for patients that predate the log.
 */
export interface StateTransition {
  id: string;
  /** Identity column — deterministic sort tiebreak when changed_at ties. */
  seq: number;
  patient_id: string;
  from_state: LifecycleState | null;
  to_state: LifecycleState;
  changed_at: string;
  created_by: string;
}

// ── Patient Note ──

export interface PatientNote {
  id: string;
  patient_id: string;
  content: string;
  created_by: string;
  created_at: string;
}

export type PatientNoteInsert = Omit<PatientNote, "id" | "created_at">;

// ── Patient Attachment ──

export interface PatientAttachment {
  id: string;
  patient_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
}

export type PatientAttachmentInsert = Omit<PatientAttachment, "id" | "created_at">;

// ── Payment Methods ──

export const PAYMENT_METHODS = ["paypal", "bank_transfer"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  paypal: "PayPal",
  bank_transfer: "Bank Transfer",
};

// ── Package Price Utility ──

/** Resolve the current price for a package type from settings */
export function getPackagePrice(
  settings: Pick<PractitionerSettings, "price_standard" | "price_premium" | "price_vip">,
  packageType: PackageType,
): number {
  const map: Record<PackageType, number> = {
    standard: settings.price_standard,
    premium: settings.price_premium,
    vip: settings.price_vip,
  };
  return map[packageType];
}

// ── Payment ──

export type PaymentStatus = "paid" | "partial" | "unpaid";

export interface PaymentSummary {
  totalPaid: number;
  status: PaymentStatus;
  paymentCount: number;
}

export interface Payment {
  id: string;
  patient_id: string;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_date: string;
  reference: string | null;
  created_by: string;
  created_at: string;
}

export type PaymentInsert = Omit<Payment, "id" | "created_at">;

// ── Qualification Survey (SURV-02/03) ──

/**
 * Display-side mirror of supabase/functions/survey-submit/surveySchema.ts.
 * The Edge Function is the validation authority; these arrays exist so the CRM
 * can render answers with readable labels without importing Deno code.
 * supabase/tests/surveySchema.test.ts fails if the two ever drift.
 */
export const SURVEY_ANSWER_KEYS = [
  "q_name",
  "q_duration",
  "q_area",
  "q_blood_test",
  "q_age_range",
  "q_gender",
  "q_treatments",
  "q_readiness",
] as const;

export type SurveyAnswerKey = (typeof SURVEY_ANSWER_KEYS)[number];

export const SURVEY_OPTION_VALUES = {
  q_duration: ["under_6_months", "6_12_months", "1_3_years", "3_plus_years"],
  q_area: ["hairline_temples", "crown", "overall_thinning", "patches", "heavy_shedding"],
  q_blood_test: ["yes", "no"],
  q_age_range: ["18_24", "25_34", "35_44", "45_54", "55_plus"],
  q_gender: ["male", "female", "prefer_not_to_say"],
  q_treatments: ["minoxidil", "dht_blockers", "supplements", "prp_or_transplant", "nothing_yet"],
  q_readiness: ["ready_now", "within_a_month", "just_researching"],
} as const;

export const SURVEY_QUESTION_LABELS: Record<SurveyAnswerKey, string> = {
  q_name: "Name",
  q_duration: "How long experiencing hair loss",
  q_area: "Where it is most noticeable",
  q_blood_test: "Blood test in the last 6 months",
  q_age_range: "Age range",
  q_gender: "Gender",
  q_treatments: "Tried so far",
  q_readiness: "Readiness to start",
};

/** Option values are unique across questions, so one flat label map suffices. */
export const SURVEY_OPTION_LABELS: Record<string, string> = {
  under_6_months: "Under 6 months",
  "6_12_months": "6–12 months",
  "1_3_years": "1–3 years",
  "3_plus_years": "3+ years",
  hairline_temples: "Hairline or temples",
  crown: "Crown",
  overall_thinning: "Overall thinning",
  patches: "Patches",
  heavy_shedding: "Heavy shedding",
  yes: "Yes",
  no: "No",
  "18_24": "18–24",
  "25_34": "25–34",
  "35_44": "35–44",
  "45_54": "45–54",
  "55_plus": "55+",
  male: "Male",
  female: "Female",
  prefer_not_to_say: "Prefer not to say",
  minoxidil: "Minoxidil",
  dht_blockers: "DHT blockers",
  supplements: "Supplements",
  prp_or_transplant: "PRP or transplant",
  nothing_yet: "Nothing yet",
  ready_now: "Ready now",
  within_a_month: "Within a month",
  just_researching: "Just researching",
};

/** Where the respondent came from — mirrors patients.source plus 'unknown'. */
export const SURVEY_SOURCES = [...LEAD_SOURCES, "unknown"] as const;

export type SurveySource = (typeof SURVEY_SOURCES)[number];

export const SURVEY_SOURCE_LABELS: Record<SurveySource, string> = {
  ...LEAD_SOURCE_LABELS,
  unknown: "Unknown",
};

/** Answer payload as stored in survey_responses.answers (jsonb). */
export type SurveyAnswers = Partial<Record<SurveyAnswerKey, string | string[]>>;

export interface SurveyResponse {
  id: string;
  patient_id: string;
  source: SurveySource;
  answers: SurveyAnswers;
  survey_version: number;
  submitted_at: string;
}

/** A response joined with the minimum patient columns the /surveys list shows. */
export interface SurveyResponseWithPatient extends SurveyResponse {
  patient: Pick<Patient, "id" | "first_name" | "last_name" | "email" | "lifecycle_state"> | null;
}

// ── Practitioner Settings ──

export interface PractitionerSettings {
  id: string;
  user_id: string;
  welcome_email_enabled: boolean;
  blood_test_reminder_enabled: boolean;
  week_6_checkin_enabled: boolean;
  end_review_enabled: boolean;
  lead_day3_enabled: boolean;
  lead_day7_enabled: boolean;
  lead_day12_enabled: boolean;
  price_standard: number;
  price_premium: number;
  price_vip: number;
  created_at: string;
  updated_at: string;
}

export type PractitionerSettingsUpdate = Partial<
  Omit<PractitionerSettings, "id" | "user_id" | "created_at" | "updated_at">
>;

export const DEFAULT_SETTINGS: Omit<
  PractitionerSettings,
  "id" | "user_id" | "created_at" | "updated_at"
> = {
  welcome_email_enabled: false,
  blood_test_reminder_enabled: false,
  week_6_checkin_enabled: false,
  end_review_enabled: false,
  lead_day3_enabled: false,
  lead_day7_enabled: false,
  lead_day12_enabled: false,
  price_standard: 297,
  price_premium: 497,
  price_vip: 797,
} as const;
