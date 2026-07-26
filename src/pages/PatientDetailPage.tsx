import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Edit, Loader2, Trash2 } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { LensAvatar } from "@/components/patients/LensAvatar";
import { LifecycleMiniScale } from "@/components/patients/LifecycleScale";
import { PatientStatusBadge } from "@/components/patients/PatientStatusBadge";
import { StateTransitionButton } from "@/components/patients/StateTransitionButton";
import { NotesList } from "@/components/patients/NotesList";
import { PaymentsList } from "@/components/patients/PaymentsList";
import { FileUpload } from "@/components/patients/FileUpload";
import { deletePatient, getPatient } from "@/lib/patients";
import { getPatientPaymentSummary } from "@/lib/payments";
import { COUNTRY_CODES } from "@/lib/phone";
import { LANGUAGES, PACKAGE_TYPES } from "@/types/database";
import type { PackageType, Patient, PaymentSummary } from "@/types/database";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="scale-label text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children || "—"}</dd>
    </div>
  );
}

export default function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);

  const fetchPatient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await getPatient(id);

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setError("Patient not found.");
      setLoading(false);
      return;
    }

    setPatient(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void fetchPatient();
  }, [fetchPatient]);

  useEffect(() => {
    if (!patient) return;
    void getPatientPaymentSummary(
      patient.id,
      patient.package_type as PackageType | null,
      patient.agreed_price ?? null,
    ).then(({ data }) => setPaymentSummary(data));
  }, [patient]);

  async function handleDelete() {
    if (!id || !patient) return;
    if (
      !window.confirm(
        `Delete ${patient.first_name} ${patient.last_name}? This action cannot be undone.`,
      )
    )
      return;

    setDeleting(true);
    const { error: delError } = await deletePatient(id);

    if (delError) {
      setError(delError.message);
      setDeleting(false);
      return;
    }

    void navigate("/patients");
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-ink" />
        <span className="ml-3 text-ink-secondary">Loading patient…</span>
      </div>
    );
  }

  // ── Error / not found ──
  if (error || !patient) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => void navigate("/patients")}
          className="inline-flex items-center gap-1.5 text-sm text-ink-secondary transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to patients
        </button>
        <Card hover={false}>
          <p className="font-medium text-red">{error ?? "Patient not found."}</p>
        </Card>
      </div>
    );
  }

  // ── Derived display values ──
  const fullName = `${patient.first_name} ${patient.last_name}`;

  const countryEntry = COUNTRY_CODES.find(
    (c) => c.dialCode === patient.phone_country_code,
  );
  const phoneDisplay = patient.phone_number
    ? `${countryEntry?.flag ?? ""} ${patient.phone_country_code} ${patient.phone_number}`
    : null;

  const langEntry = LANGUAGES.find((l) => l.code === patient.language);
  const languageDisplay = langEntry
    ? `${langEntry.flag} ${langEntry.label}`
    : patient.language;

  const packageDisplay = patient.package_type
    ? PACKAGE_TYPES.includes(patient.package_type)
      ? patient.package_type.charAt(0).toUpperCase() +
        patient.package_type.slice(1)
      : patient.package_type
    : null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => void navigate("/patients")}
        className="inline-flex items-center gap-1.5 text-sm text-ink-secondary transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to patients
      </button>

      {/* Specimen header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <LensAvatar
            firstName={patient.first_name}
            lastName={patient.last_name}
            size="lg"
          />
          <div>
            <h1 className="display-condensed text-[1.45rem] text-ink">
              {fullName}
            </h1>
            <div className="mt-1.5 flex items-center gap-2">
              <PatientStatusBadge status={patient.lifecycle_state} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void navigate(`/patients/${id}/edit`)}
          >
            <Edit className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleting}
            disabled={deleting}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Patient Info */}
      <Card hover={false}>
        <h2 className="scale-label mb-4 text-ink-secondary">
          Patient Information
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <InfoItem label="Email">{patient.email}</InfoItem>
          <InfoItem label="Phone">{phoneDisplay}</InfoItem>
          <InfoItem label="Language">{languageDisplay}</InfoItem>
          <InfoItem label="Package">{packageDisplay}</InfoItem>
          <InfoItem label="Payment Status">
            {paymentSummary ? (
              <span className="inline-flex items-center gap-2">
                <Badge
                  variant={
                    paymentSummary.status === "paid"
                      ? "olive"
                      : paymentSummary.status === "partial"
                        ? "yellow"
                        : "muted"
                  }
                >
                  {paymentSummary.status === "paid"
                    ? "Paid"
                    : paymentSummary.status === "partial"
                      ? "Partial"
                      : "Unpaid"}
                </Badge>
                <span className="reading text-[0.78rem] text-ink-secondary">
                  ${paymentSummary.totalPaid.toFixed(2)}
                </span>
              </span>
            ) : (
              "—"
            )}
          </InfoItem>
          <InfoItem label="Date of Birth">
            {patient.date_of_birth
              ? dateFormatter.format(new Date(patient.date_of_birth))
              : null}
          </InfoItem>
          <InfoItem label="Gender">
            {patient.gender
              ? patient.gender.charAt(0).toUpperCase() +
                patient.gender.slice(1)
              : null}
          </InfoItem>
          <InfoItem label="Country">{patient.country}</InfoItem>
          <InfoItem label="Created">
            {dateFormatter.format(new Date(patient.created_at))}
          </InfoItem>
          <InfoItem label="Updated">
            {dateFormatter.format(new Date(patient.updated_at))}
          </InfoItem>
        </dl>
      </Card>

      {/* Lifecycle reading + transition */}
      <Card hover={false}>
        <h2 className="scale-label mb-4 text-ink-secondary">Lifecycle Scale</h2>
        <LifecycleMiniScale
          state={patient.lifecycle_state}
          className="mb-5 max-w-md"
        />
        <StateTransitionButton
          patientId={patient.id}
          currentState={patient.lifecycle_state}
          onTransition={() => void fetchPatient()}
        />
      </Card>

      {/* Notes */}
      <Card hover={false}>
        <h2 className="scale-label mb-4 text-ink-secondary">Notes</h2>
        <NotesList patientId={patient.id} />
      </Card>

      {/* Payments */}
      <Card hover={false}>
        <h2 className="scale-label mb-4 text-ink-secondary">Payments</h2>
        <PaymentsList
          patientId={patient.id}
          packageType={patient.package_type as PackageType | null}
          agreedPrice={patient.agreed_price ?? null}
        />
      </Card>

      {/* Files */}
      <Card hover={false}>
        <h2 className="scale-label mb-4 text-ink-secondary">Files</h2>
        <FileUpload patientId={patient.id} />
      </Card>
    </div>
  );
}
