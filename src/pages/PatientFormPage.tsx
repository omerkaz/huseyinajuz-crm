import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button, Card, Input, Select } from "@/components/ui";
import { useAuth } from "@/context/auth";
import { createPatient, getPatient, updatePatient } from "@/lib/patients";
import { sendWelcomeEmail } from "@/lib/email";
import { getSettings } from "@/lib/settings";
import { COUNTRY_CODES, isValidPhone } from "@/lib/phone";
import { getPackagePrice, LANGUAGES, PACKAGE_TYPES } from "@/types/database";
import type { LanguageCode, PackageType, PractitionerSettings } from "@/types/database";

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  agreedPrice?: string;
  submit?: string;
}

export default function PatientFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);

  // ── Form state ──
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+90");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState<LanguageCode>("tr");
  const [packageType, setPackageType] = useState<PackageType | "">("standard");
  // agreed_price — string state for input (A4), shown when package selected
  const [agreedPriceStr, setAgreedPriceStr] = useState("");
  // Track original package (for detecting change in edit mode)
  const [originalPackage, setOriginalPackage] = useState<PackageType | null>(null);

  // ── Settings state (A2: need prices for snapshot) ──
  const [settings, setSettings] = useState<Pick<PractitionerSettings, "price_standard" | "price_premium" | "price_vip"> | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // ── UI state ──
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Load settings on mount ──
  useEffect(() => {
    if (!user) return;
    setSettingsLoading(true);
    getSettings(user.id).then(({ data }) => {
      if (data) {
        setSettings({
          price_standard: data.price_standard,
          price_premium: data.price_premium,
          price_vip: data.price_vip,
        });
      }
      setSettingsLoading(false);
    });
  }, [user]);

  // ── Auto-fill agreed price when package changes ──
  function handlePackageChange(newPkg: PackageType | "") {
    setPackageType(newPkg);
    if (!newPkg) {
      // Package cleared → agreed_price must also clear (A1)
      setAgreedPriceStr("");
    } else if (settings) {
      // Pre-fill from current settings price (editable for custom deals)
      // In edit mode: only re-snapshot if package actually changed
      if (!isEdit || newPkg !== originalPackage) {
        setAgreedPriceStr(String(getPackagePrice(settings, newPkg)));
      }
    }
  }

  // ── Load existing patient for edit mode ──
  const loadPatient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setFetchError(null);

    const { data, error } = await getPatient(id);

    if (error || !data) {
      setFetchError(error?.message ?? "Patient not found.");
      setLoading(false);
      return;
    }

    setFirstName(data.first_name);
    setLastName(data.last_name);
    setEmail(data.email ?? "");
    setPhoneCountryCode(
      COUNTRY_CODES.find((c) => c.dialCode === data.phone_country_code)
        ? data.phone_country_code
        : "+90",
    );
    setPhone(data.phone_number);
    setLanguage(data.language);
    setPackageType(data.package_type ?? "");
    setOriginalPackage(data.package_type ?? null);
    setAgreedPriceStr(data.agreed_price != null ? String(data.agreed_price) : "");
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (isEdit) {
      void loadPatient();
    }
  }, [isEdit, loadPatient]);

  // ── Validation ──
  function validate(): FormErrors {
    const next: FormErrors = {};

    if (!firstName.trim()) {
      next.firstName = "First name is required.";
    }
    if (!lastName.trim()) {
      next.lastName = "Last name is required.";
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (phone.trim() && !isValidPhone(phoneCountryCode, phone)) {
      next.phone = "Phone number must be 6–15 digits.";
    }
    // agreed_price validation when package is selected
    if (packageType) {
      if (!agreedPriceStr.trim()) {
        next.agreedPrice = "Agreed price is required when a package is selected.";
      } else {
        const n = Number(agreedPriceStr);
        if (isNaN(n) || n <= 0 || !isFinite(n)) {
          next.agreedPrice = "Enter a valid positive price.";
        }
      }
    }

    return next;
  }

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    // A2: Fresh settings fetch at submit time to avoid stale-tab race
    let freshPrice: number | null = null;
    const selectedPkg = (packageType || null) as PackageType | null;

    if (selectedPkg) {
      const { data: freshSettings } = await getSettings(user?.id ?? "");
      if (!freshSettings) {
        setErrors({ submit: "Could not verify current prices. Please try again." });
        setSubmitting(false);
        return;
      }
      // Use the user-edited price (allows custom deals), but default
      // from fresh settings if the package just changed
      const editedPrice = Number(agreedPriceStr);
      freshPrice = editedPrice > 0 ? editedPrice : getPackagePrice(freshSettings, selectedPkg);
    }

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim() || null,
      phone_country_code: phoneCountryCode,
      phone_number: phone.trim(),
      language,
      package_type: selectedPkg,
      // A1: package NULL → agreed_price NULL; package set → snapshot price
      agreed_price: selectedPkg ? freshPrice : null,
    };

    if (isEdit && id) {
      const { data, error } = await updatePatient(id, payload);
      if (error || !data) {
        setErrors({ submit: error?.message ?? "Failed to update patient." });
        setSubmitting(false);
        return;
      }
      void navigate(`/patients/${data.id}`);
    } else {
      const { data, error } = await createPatient({
        ...payload,
        date_of_birth: null,
        gender: null,
        country: null,
        lifecycle_state: "lead",
        notes_text: null,
        created_by: user?.id ?? "",
      });
      if (error || !data) {
        setErrors({ submit: error?.message ?? "Failed to create patient." });
        setSubmitting(false);
        return;
      }
      if (payload.email) {
        sendWelcomeEmail({ to: payload.email, firstName: payload.first_name }).catch(
          (err: unknown) => console.error("[email] sendWelcomeEmail error:", err),
        );
      }
      void navigate(`/patients/${data.id}`);
    }
  }

  // ── Loading / Error states ──
  if (loading || settingsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-ink" />
        <span className="ml-3 text-ink-secondary">Loading…</span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => void navigate("/patients")}
          className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to patients
        </button>
        <Card hover={false}>
          <p className="text-red">{fetchError}</p>
        </Card>
      </div>
    );
  }

  // A2: disable form if settings failed to load
  const settingsMissing = !settings;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => void navigate("/patients")}
          className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="display-condensed text-[1.3rem] text-ink">
          {isEdit ? "Edit Patient" : "New Patient"}
        </h1>
      </div>

      {settingsMissing && (
        <div className="rounded-lg bg-red-soft border border-red/30 px-4 py-3 text-sm text-red">
          Could not load package prices. Package assignment is disabled until settings load successfully.
        </div>
      )}

      {/* Form */}
      <Card hover={false}>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
          {/* Submit error banner */}
          {errors.submit && (
            <div className="rounded-lg bg-red-soft border border-red/30 px-4 py-3 text-sm text-red">
              {errors.submit}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* First Name */}
            <Input
              label="First Name *"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              error={errors.firstName}
              placeholder="Enter first name"
            />

            {/* Last Name */}
            <Input
              label="Last Name *"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              error={errors.lastName}
              placeholder="Enter last name"
            />

            {/* Email */}
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              placeholder="patient@example.com"
            />

            {/* Phone — country code + number */}
            <div className="md:col-span-2">
              <label className="block text-[0.78rem] font-medium text-ink-secondary mb-1.5">
                Phone Number
              </label>
              <div className="grid grid-cols-[160px_1fr] gap-3">
                <Select
                  value={phoneCountryCode}
                  onChange={(e) => setPhoneCountryCode(e.target.value)}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.dialCode}>
                      {c.flag} {c.dialCode}
                    </option>
                  ))}
                </Select>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  error={errors.phone}
                  placeholder="5551234567"
                  type="tel"
                />
              </div>
            </div>

            {/* Language */}
            <Select
              label="Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.label}
                </option>
              ))}
            </Select>

            {/* Package Type — disabled if settings unavailable (A2) */}
            <Select
              label="Package Type"
              value={packageType}
              onChange={(e) => handlePackageChange(e.target.value as PackageType | "")}
              disabled={settingsMissing}
            >
              <option value="">None</option>
              {PACKAGE_TYPES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </Select>

            {/* Agreed Price — shown only when package selected */}
            {packageType && (
              <div>
                <Input
                  label="Agreed Price ($)"
                  type="number"
                  min="1"
                  step="0.01"
                  value={agreedPriceStr}
                  onChange={(e) => setAgreedPriceStr(e.target.value)}
                  error={errors.agreedPrice}
                  placeholder="0.00"
                />
                <p className="text-xs text-ink-muted mt-1">
                  Auto-filled from current price. Edit for custom deals.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-hairline">
            <Button
              type="submit"
              loading={submitting}
              disabled={submitting || settingsMissing}
            >
              <Save className="h-4 w-4" />
              {isEdit ? "Save Changes" : "Create Patient"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void navigate("/patients")}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
