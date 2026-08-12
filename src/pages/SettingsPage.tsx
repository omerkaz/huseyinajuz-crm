import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Save } from "lucide-react";
import { useAuth } from "@/context/auth";
import { getSettings, upsertSettings } from "@/lib/settings";
import { Button, Card, Input } from "@/components/ui";

// ── Price field validation (A4: keep string state, validate before save) ──

function isValidPrice(value: string): boolean {
  if (value.trim() === "") return false;
  const n = Number(value);
  return !isNaN(n) && n > 0 && isFinite(n);
}

/**
 * Settings — package prices.
 *
 * The 7 email automation toggles moved to /email in Phase 21 (MAIL-06); the
 * practitioner_settings columns behind them are unchanged.
 */
export default function SettingsPage() {
  const { user } = useAuth();
  const [loadError, setLoadError] = useState<string | null>(null);

  // Price editing — string state to handle empty/partial input (A4)
  const [priceStandard, setPriceStandard] = useState("");
  const [pricePremium, setPricePremium] = useState("");
  const [priceVip, setPriceVip] = useState("");
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [priceSaved, setPriceSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    void getSettings(user.id).then(({ data, error }) => {
      if (error) {
        setLoadError(error.message);
        return;
      }
      if (data) {
        setPriceStandard(String(data.price_standard));
        setPricePremium(String(data.price_premium));
        setPriceVip(String(data.price_vip));
      }
    });
  }, [user]);

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
      setPriceSaved(true);
      setTimeout(() => setPriceSaved(false), 3000);
    }
    setPriceSaving(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="display-condensed text-[1.3rem] text-ink mb-1">Settings</h1>
      <p className="text-sm text-ink-secondary mb-6">
        Package prices for new patient assignments. Email automations now live on the{" "}
        <Link to="/email" className="underline hover:text-ink">
          Email
        </Link>{" "}
        page.
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
          {priceError && <p className="text-xs text-red">{priceError}</p>}
          {priceSaved && (
            <p className="text-xs text-olive-deep">Prices saved successfully.</p>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handlePriceSave()}
            disabled={!pricesValid || priceSaving}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {priceSaving ? "Saving…" : "Save Prices"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
