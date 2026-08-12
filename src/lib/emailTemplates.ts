import {
  EMAIL_FEATURES,
  EMAIL_FEATURE_LABELS,
  type EmailFeature,
} from "../types/database.ts";

/**
 * Registry of the practice's email templates (MAIL-06).
 *
 * The copy is the same as the automated senders use — the pg_cron SQL
 * functions for the reminders and follow-ups, and src/lib/email.ts for the
 * welcome mail — so a manual send reads exactly like the automated one it
 * stands in for.
 *
 * Pure module: no Supabase client, no Vite globals, so node:test can import it
 * directly (same arrangement as dashboardMetrics.ts and funnelMetrics.ts).
 *
 * Templates produce a bare content FRAGMENT. The send-email Edge Function is
 * the single branding chokepoint and wraps it in the branded shell (MAIL-05) —
 * never paste a full HTML document in here.
 */

export interface EmailTemplate {
  key: EmailFeature;
  label: string;
  /** One-line description of when the automation would send this. */
  context: string;
  subject: string;
  /** @param firstName the patient's first name, already trimmed. */
  buildHtml: (firstName: string) => string;
}

/** Fallback greeting when a patient record carries no usable first name. */
export const FALLBACK_GREETING_NAME = "there";

export function greetingName(firstName: string | null | undefined): string {
  const trimmed = (firstName ?? "").trim();
  return trimmed.length > 0 ? trimmed : FALLBACK_GREETING_NAME;
}

const TEMPLATE_LIST: EmailTemplate[] = [
  {
    key: "welcome_email",
    label: EMAIL_FEATURE_LABELS.welcome_email,
    context: "Sent automatically when a new patient is created.",
    subject: "Welcome — Hüseyin Ajuz Hair Loss Consultation",
    buildHtml: (firstName) =>
      `<p>Dear ${firstName},</p><p>Thank you for registering with Hüseyin Ajuz. We will be in touch shortly to guide you through your personalised hair loss treatment journey.</p>`,
  },
  {
    key: "blood_test_reminder",
    label: EMAIL_FEATURE_LABELS.blood_test_reminder,
    context: "Automation sends this 14 days into Awaiting Blood Test.",
    subject: "Blood Test Reminder",
    buildHtml: (firstName) =>
      `<p>Dear ${firstName},</p><p>Please arrange your blood test at your earliest convenience. Your results are an important part of your personalised treatment plan.</p>`,
  },
  {
    key: "week_6_checkin",
    label: EMAIL_FEATURE_LABELS.week_6_checkin,
    context: "Automation sends this 42 days into Active Treatment.",
    subject: "Week 6 Check-in",
    buildHtml: (firstName) =>
      `<p>Dear ${firstName},</p><p>Your 6-week check-in is due. Please reach out so we can review your progress and adjust your treatment plan if needed.</p>`,
  },
  {
    key: "end_review",
    label: EMAIL_FEATURE_LABELS.end_review,
    context: "Automation sends this 7 days into Week 6 Check-in.",
    subject: "End Review",
    buildHtml: (firstName) =>
      `<p>Dear ${firstName},</p><p>Your treatment end review is approaching. Please get in touch to schedule your final consultation and discuss next steps.</p>`,
  },
  {
    key: "lead_day3",
    label: EMAIL_FEATURE_LABELS.lead_day3,
    context: "Automation sends this 3 days after a lead is created.",
    subject: "Following up on your hair loss consultation",
    buildHtml: (firstName) =>
      `<p>Hi ${firstName},</p><p>I wanted to follow up on your interest in our hair loss consultation programme. I'd love to help you understand what's causing your hair loss and put together a personalised plan for you.</p><p>Feel free to reply to this email or reach out via WhatsApp to book a slot.</p>`,
  },
  {
    key: "lead_day7",
    label: EMAIL_FEATURE_LABELS.lead_day7,
    context: "Automation sends this 7 days after a lead is created.",
    subject: "Still thinking about your hair loss? Here's what we can do",
    buildHtml: (firstName) =>
      `<p>Hi ${firstName},</p><p>A week has passed since you first reached out. Hair loss can be tricky to address without the right guidance — that's exactly what we specialise in.</p><p>If you have any questions before booking, just hit reply. I'm happy to chat.</p>`,
  },
  {
    key: "lead_day12",
    label: EMAIL_FEATURE_LABELS.lead_day12,
    context: "Automation sends this 12 days after a lead is created.",
    subject: "Last chance to book your consultation",
    buildHtml: (firstName) =>
      `<p>Hi ${firstName},</p><p>This is my final follow-up. I don't want to overwhelm your inbox — but I did want to make sure you hadn't missed us.</p><p>If you're still interested in understanding and tackling your hair loss, I'd love to help. Just reply and we'll take it from there.</p>`,
  },
];

/** Templates in the order they appear in the lifecycle, for the picker. */
export const EMAIL_TEMPLATES: readonly EmailTemplate[] = TEMPLATE_LIST;

const TEMPLATES_BY_KEY = new Map<EmailFeature, EmailTemplate>(
  TEMPLATE_LIST.map((template) => [template.key, template]),
);

export function getEmailTemplate(key: EmailFeature): EmailTemplate {
  const template = TEMPLATES_BY_KEY.get(key);
  if (!template) {
    // Unreachable while the registry covers EMAIL_FEATURES — the drift test
    // fails long before this could ship.
    throw new Error(`No email template registered for feature "${key}"`);
  }
  return template;
}

/** Subject + body for a template, ready to drop into the manual send form. */
export function renderTemplate(
  key: EmailFeature,
  firstName: string | null | undefined,
): { subject: string; html: string } {
  const template = getEmailTemplate(key);
  return {
    subject: template.subject,
    html: template.buildHtml(greetingName(firstName)),
  };
}

/** Every feature has a template — asserted by src/lib/emailTemplates.test.ts. */
export const TEMPLATE_KEYS: readonly EmailFeature[] = EMAIL_FEATURES;
