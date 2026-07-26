import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useAuth } from "@/context/auth";
import { getSettings, upsertSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/types/database";
import type { PractitionerSettings } from "@/types/database";
import { Button, Card, Input } from "@/components/ui";

type SettingsState = Omit<PractitionerSettings, "id" | "user_id" | "created_at" | "updated_at">;

type ToggleKey = Extract<keyof SettingsState, `${string}_enabled`>;

const TOGGLE_ROWS: { key: ToggleKey; label: string; description: string }[] = [
  {
    key: "welcome_email_enabled",
    label: "Welcome Email",
    description: "Send a welcome email when a new patient is created.",
  },
  {
    key: "blood_test_reminder_enabled",
    label: "Blood Test Reminder",
    description: "Remind patients to complete their blood test when they reach that stage.",
  },
  {
    key: "week_6_checkin_enabled",
    label: "Week 6 Check-in",
    description: "Send a check-in email when a patient enters Week 6 Check-in.",
  },
  {
    key: "end_review_enabled",
    label: "End Review",
    description: "Notify patients when their treatment is entering the end review stage.",
  },
  {
    key: "lead_day3_enabled",
    label: "Lead Follow-up Day 3",
    description: "Send a follow-up message 3 days after a lead is created.",
  },
  {
    key: "lead_day7_enabled",
    label: "Lead Follow-up Day 7",
    description: "Send a follow-up message 7 days after a lead is created.",
  },
  {
    key: "lead_day12_enabled",
    label: "Lead Follow-up Day 12",
    description: "Send a final follow-up 12 days after a lead is created, then mark cold.",
  },
];

// ── Price field validation (A4: keep string state, validate before save) ──

function isValidPrice(value: string): boolean {
  if (value.trim() === "") return false;
  const n = Number(value);
  return !isNaN(n) && n > 0 && isFinite(n);
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsState>({ ...DEFAULT_SETTINGS });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toggleErrors, setToggleErrors] = useState<Partial<Record<ToggleKey, string>>>({});

  // Price editing — string state to handle empty/partial input (A4)
  const [priceStandard, setPriceStandard] = useState("");
  const [pricePremium, setPricePremium] = useState("");
  const [priceVip, setPriceVip] = useState("");
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [priceSaved, setPriceSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    getSettings(user.id).then(({ data, error }) => {
      if (error) {
        setLoadError(error.message);
        return;
      }
      if (data) {
        setSettings({
          welcome_email_enabled: data.welcome_email_enabled,
          blood_test_reminder_enabled: data.blood_test_reminder_enabled,
          week_6_checkin_enabled: data.week_6_checkin_enabled,
          end_review_enabled: data.end_review_enabled,
          lead_day3_enabled: data.lead_day3_enabled,
          lead_day7_enabled: data.lead_day7_enabled,
          lead_day12_enabled: data.lead_day12_enabled,
          price_standard: data.price_standard,
          price_premium: data.price_premium,
          price_vip: data.price_vip,
        });
        setPriceStandard(String(data.price_standard));
        setPricePremium(String(data.price_premium));
        setPriceVip(String(data.price_vip));
      }
    });
  }, [user]);

  async function handleToggle(key: ToggleKey) {
    if (!user) return;
    const prev = settings[key];
    const next = !prev;

    setSettings((s) => ({ ...s, [key]: next }));
    setToggleErrors((e) => ({ ...e, [key]: undefined }));

    const { error } = await upsertSettings(user.id, { [key]: next });
    if (error) {
      setSettings((s) => ({ ...s, [key]: prev }));
      setToggleErrors((e) => ({ ...e, [key]: "Save failed. Please try again." }));
    }
  }

  const pricesValid =
    isValidPrice(priceStandard) &&
    isValidPrice(pricePremium) &&
    isValidPrice(priceVip);

  async function handlePriceSave() {
    if (!user || !pricesValid) return;
    setPriceSaving(true);
    setPriceError(null);
    setPriceSaved(false);

    const update = {
      price_standard: Number(priceStandard),
      price_premium: Number(pricePremium),
      price_vip: Number(priceVip),
    };

    const { error } = await upsertSettings(user.id, update);
    if (error) {
      setPriceError("Failed to save prices. Please try again.");
    } else {
      setSettings((s) => ({ ...s, ...update }));
      setPriceSaved(true);
      setTimeout(() => setPriceSaved(false), 3000);
    }
    setPriceSaving(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="display-condensed text-[1.3rem] text-ink mb-1">Settings</h1>
      <p className="text-sm text-ink-secondary mb-6">
        Toggle automation features on or off without a code deploy.
      </p>

      {loadError && (
        <div className="mb-4 rounded-[10px] bg-red-soft px-4 py-3 text-sm text-red">
          {loadError}
        </div>
      )}

      {/* Package Prices Card */}
      <Card className="mb-6">
        <div className="px-6 py-4 border-b border-hairline">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            Package Prices
          </p>
          <p className="text-xs text-ink-secondary mt-0.5">
            Current prices for new patient assignments. Existing patient deals are not affected.
          </p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">
                Standard ($)
              </label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={priceStandard}
                onChange={(e) => setPriceStandard(e.target.value)}
                className={!isValidPrice(priceStandard) && priceStandard !== "" ? "border-red" : ""}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">
                Premium ($)
              </label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={pricePremium}
                onChange={(e) => setPricePremium(e.target.value)}
                className={!isValidPrice(pricePremium) && pricePremium !== "" ? "border-red" : ""}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">
                VIP ($)
              </label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={priceVip}
                onChange={(e) => setPriceVip(e.target.value)}
                className={!isValidPrice(priceVip) && priceVip !== "" ? "border-red" : ""}
              />
            </div>
          </div>
          {priceError && (
            <p className="text-xs text-red">{priceError}</p>
          )}
          {priceSaved && (
            <p className="text-xs text-olive-deep">Prices saved successfully.</p>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={handlePriceSave}
            disabled={!pricesValid || priceSaving}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {priceSaving ? "Saving…" : "Save Prices"}
          </Button>
        </div>
      </Card>

      {/* Automation Toggles Card */}
      <Card className="divide-y divide-divider">
        <div className="px-6 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            Automation Features
          </p>
        </div>
        {TOGGLE_ROWS.map(({ key, label, description }) => {
          const enabled = settings[key] as boolean;
          return (
            <div key={key} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="text-xs text-ink-muted mt-0.5">{description}</p>
                {toggleErrors[key] && (
                  <p className="text-xs text-red mt-1">{toggleErrors[key]}</p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!enabled}
                aria-label={label}
                onClick={() => handleToggle(key)}
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
            </div>
          );
        })}
      </Card>
    </div>
  );
}
