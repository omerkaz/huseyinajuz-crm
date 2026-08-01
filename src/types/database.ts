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
  manychat_id: string | null;
  instagram_username: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  state_changed_at: string | null;
}

export type PatientInsert = Omit<Patient, "id" | "created_at" | "updated_at" | "manychat_id" | "instagram_username" | "state_changed_at" | "agreed_price"> & {
  manychat_id?: string | null;
  instagram_username?: string | null;
  state_changed_at?: string | null;
  agreed_price?: number | null;
};
export type PatientUpdate = Partial<Omit<Patient, "id" | "created_at" | "updated_at" | "created_by">>;

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
