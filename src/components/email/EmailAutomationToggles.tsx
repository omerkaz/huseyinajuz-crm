import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth";
import { getSettings, upsertSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS, EMAIL_FEATURES, EMAIL_FEATURE_LABELS } from "@/types/database";
import type { EmailFeature, EmailToggleKey, PractitionerSettings } from "@/types/database";

/**
 * The 7 automation toggles (MAIL-06), relocated from Settings.
 *
 * The practitioner_settings columns are unchanged — only the home moved, so
 * every email control lives on one page and the drip toggles (Phase 22) are
 * born in their final place.
 */

const TOGGLE_DESCRIPTIONS: Record<EmailFeature, string> = {
  welcome_email: "Send a welcome email when a new patient is created.",
  blood_test_reminder:
    "Remind patients to complete their blood test when they reach that stage.",
  week_6_checkin: "Send a check-in email when a patient enters Week 6 Check-in.",
  end_review: "Notify patients when their treatment is entering the end review stage.",
  lead_day3: "Send a follow-up message 3 days after a lead is created.",
  lead_day7: "Send a follow-up message 7 days after a lead is created.",
  lead_day12: "Send a final follow-up 12 days after a lead is created, then mark cold.",
};

type ToggleState = Pick<PractitionerSettings, EmailToggleKey>;

function readToggles(settings: PractitionerSettings | null): ToggleState {
  const source = settings ?? DEFAULT_SETTINGS;
  return {
    welcome_email_enabled: source.welcome_email_enabled,
    blood_test_reminder_enabled: source.blood_test_reminder_enabled,
    week_6_checkin_enabled: source.week_6_checkin_enabled,
    end_review_enabled: source.end_review_enabled,
    lead_day3_enabled: source.lead_day3_enabled,
    lead_day7_enabled: source.lead_day7_enabled,
    lead_day12_enabled: source.lead_day12_enabled,
  };
}

export function EmailAutomationToggles() {
  const { user } = useAuth();
  const [toggles, setToggles] = useState<ToggleState>(readToggles(null));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Partial<Record<EmailToggleKey, string>>>({});

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);

    void getSettings(user.id).then(({ data, error }) => {
      if (!active) return;
      setLoadError(error?.message ?? null);
      if (!error) setToggles(readToggles(data));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [user]);

  async function handleToggle(key: EmailToggleKey) {
    if (!user) return;
    const previous = toggles[key];

    setToggles((current) => ({ ...current, [key]: !previous }));
    setSaveErrors((errors) => ({ ...errors, [key]: undefined }));

    const { error } = await upsertSettings(user.id, { [key]: !previous });
    if (!error) return;

    // Re-read rather than trusting the local snapshot: another tab may have
    // changed this row while the request was in flight.
    const { data: fresh, error: refetchError } = await getSettings(user.id);
    setToggles(refetchError ? (current) => ({ ...current, [key]: previous }) : readToggles(fresh));
    setSaveErrors((errors) => ({ ...errors, [key]: "Save failed. Please try again." }));
  }

  return (
    <div>
      <div className="mb-3">
        <h2 className="scale-label text-ink-secondary">Email Automations</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Each toggle gates one scheduled email. Manual sends above are never affected.
        </p>
      </div>

      {loadError && (
        <div className="mb-3 rounded-[6px] bg-red-soft px-4 py-3 text-sm text-red">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-ink-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading automation settings…
        </div>
      ) : (
        <ul className="divide-y divide-hairline">
          {EMAIL_FEATURES.map((feature) => {
            const key = `${feature}_enabled` as EmailToggleKey;
            const enabled = toggles[key];
            const label = EMAIL_FEATURE_LABELS[feature];

            return (
              <li key={key} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{label}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {TOGGLE_DESCRIPTIONS[feature]}
                  </p>
                  {saveErrors[key] && (
                    <p className="mt-1 text-xs text-red">{saveErrors[key]}</p>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={label}
                  onClick={() => void handleToggle(key)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ${
                    enabled ? "bg-olive-deep" : "bg-ink-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      enabled ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
