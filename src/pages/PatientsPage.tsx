import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Badge, Button, Card } from "@/components/ui";
import { LensAvatar } from "@/components/patients/LensAvatar";
import { PatientStatusBadge } from "@/components/patients/PatientStatusBadge";
import { PatientFilters } from "@/components/patients/PatientFilters";
import { getPatients } from "@/lib/patients";
import { getPayments } from "@/lib/payments";
import { getSurveyedPatientIds } from "@/lib/surveys";
import type {
  LeadSource,
  LifecycleState,
  PackageType,
  Patient,
  Payment,
  PaymentStatus,
} from "@/types/database";
import { Loader2, Plus, Users } from "lucide-react";

/* paid = settled growth, partial = needs attention, unpaid = not in motion */
const paymentStatusVariant: Record<PaymentStatus, "olive" | "yellow" | "muted"> = {
  paid: "olive",
  partial: "yellow",
  unpaid: "muted",
};

const paymentStatusLabel: Record<PaymentStatus, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
};

function computePaymentStatusMap(
  payments: Payment[],
  patients: Patient[],
): Map<string, PaymentStatus> {
  // Group payments by patient_id
  const byPatient = new Map<string, number>();
  for (const p of payments) {
    byPatient.set(p.patient_id, (byPatient.get(p.patient_id) ?? 0) + Number(p.amount));
  }

  // Compute status per patient using agreed_price (PRICE-01)
  const statusMap = new Map<string, PaymentStatus>();
  for (const pt of patients) {
    const totalPaid = byPatient.get(pt.id) ?? 0;

    if (pt.package_type === null) {
      // D008: no package → any payment = paid. With no payment either,
      // there's nothing to report — skip the badge (leads shouldn't scream "Unpaid")
      if (totalPaid > 0) statusMap.set(pt.id, "paid");
    } else if (pt.agreed_price === null) {
      // Fallback (shouldn't happen after migration)
      statusMap.set(pt.id, totalPaid > 0 ? "paid" : "unpaid");
    } else {
      // Cents-based comparison (A3)
      const paidCents = Math.round(totalPaid * 100);
      const targetCents = Math.round(pt.agreed_price * 100);
      if (paidCents >= targetCents) {
        statusMap.set(pt.id, "paid");
      } else if (paidCents > 0) {
        statusMap.set(pt.id, "partial");
      } else {
        statusMap.set(pt.id, "unpaid");
      }
    }
  }

  return statusMap;
}

const packageLabels: Record<PackageType, string> = {
  standard: "Standard",
  premium: "Premium",
  vip: "VIP",
};

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [paymentStatusMap, setPaymentStatusMap] = useState<Map<string, PaymentStatus>>(new Map());
  const [surveyedIds, setSurveyedIds] = useState<Set<string>>(new Set());
  const [surveyError, setSurveyError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LifecycleState | "">("");
  const [packageType, setPackageType] = useState<PackageType | "">("");
  const [source, setSource] = useState<LeadSource | "">("");

  const hasActiveFilters = Boolean(search || status || packageType || source);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);

    const filters: {
      search?: string;
      status?: LifecycleState;
      packageType?: PackageType;
      source?: LeadSource;
    } = {};

    if (search.trim()) filters.search = search.trim();
    if (status) filters.status = status;
    if (packageType) filters.packageType = packageType;
    if (source) filters.source = source;

    const [result, paymentsResult, surveysResult] = await Promise.all([
      getPatients(filters),
      getPayments(),
      getSurveyedPatientIds(),
    ]);

    if (result.error) {
      setError(result.error.message);
      setPatients([]);
      setLoading(false);
      return;
    }

    setPatients(result.data);

    // Compute payment status map — non-blocking; if payments fail, just skip badges
    if (!paymentsResult.error) {
      setPaymentStatusMap(computePaymentStatusMap(paymentsResult.data, result.data));
    }

    // Survey indicators (SURV-03). A failure here must not read as "nobody has
    // answered" — the badges are hidden and the reason is stated instead.
    setSurveyedIds(surveysResult.error ? new Set() : surveysResult.data);
    setSurveyError(surveysResult.error?.message ?? null);

    setLoading(false);
  }, [search, status, packageType, source]);

  useEffect(() => {
    // Debounce search input, instant for dropdowns
    const timer = setTimeout(fetchPatients, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchPatients, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="reading text-[0.72rem] text-ink-secondary">
            {String(patients.length).padStart(2, "0")} RECORDS
          </p>
          {surveyError && (
            <p className="mt-0.5 text-[0.7rem] text-ink-muted">
              Survey indicators unavailable — {surveyError}
            </p>
          )}
        </div>
        <Link to="/patients/new">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Add Patient
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card hover={false}>
        <PatientFilters
          search={search}
          status={status}
          packageType={packageType}
          source={source}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
          onPackageTypeChange={setPackageType}
          onSourceChange={setSource}
        />
      </Card>

      {/* Content area */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-ink" />
        </div>
      ) : error ? (
        <Card hover={false} className="text-center py-12">
          <p className="font-medium text-red">Something went wrong</p>
          <p className="mt-1 text-sm text-ink-secondary">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => void fetchPatients()}
          >
            Try Again
          </Button>
        </Card>
      ) : patients.length === 0 ? (
        <Card hover={false} className="text-center py-16">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-hairline-strong bg-ink-wash">
            <Users className="h-7 w-7 text-ink-secondary" strokeWidth={1.5} />
          </div>
          <h3 className="display-condensed mt-4 text-[1rem] text-ink">
            {hasActiveFilters
              ? "No patients match your filters"
              : "No patients yet"}
          </h3>
          <p className="mt-1 text-sm text-ink-secondary">
            {hasActiveFilters
              ? "Try adjusting your search or filters."
              : "Add your first patient to get started."}
          </p>
          {!hasActiveFilters && (
            <Link to="/patients/new" className="mt-4 inline-block">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Add Your First Patient
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <Card hover={false} className="p-0">
          <ul>
            {patients.map((patient) => (
              <li key={patient.id} className="border-b border-hairline last:border-b-0">
                <Link
                  to={`/patients/${patient.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-ink-wash"
                >
                  <LensAvatar
                    firstName={patient.first_name}
                    lastName={patient.last_name}
                    size="sm"
                  />

                  {/* Name + email */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.88rem] font-semibold [font-stretch:87.5%] text-ink">
                      {patient.first_name} {patient.last_name}
                    </p>
                    {patient.email && (
                      <p className="truncate text-[0.75rem] text-ink-secondary">
                        {patient.email}
                      </p>
                    )}
                  </div>

                  {/* Survey indicator (SURV-03) */}
                  {surveyedIds.has(patient.id) && (
                    <span title="Qualification survey completed">
                      <Badge variant="muted">Survey</Badge>
                    </span>
                  )}

                  {/* Status chip */}
                  <PatientStatusBadge status={patient.lifecycle_state} />

                  {/* Payment chip */}
                  {paymentStatusMap.has(patient.id) && (
                    <Badge variant={paymentStatusVariant[paymentStatusMap.get(patient.id)!]}>
                      {paymentStatusLabel[paymentStatusMap.get(patient.id)!]}
                    </Badge>
                  )}

                  {/* Package */}
                  {patient.package_type && (
                    <span className="hidden text-[0.78rem] text-ink-secondary sm:inline">
                      {packageLabels[patient.package_type]}
                    </span>
                  )}

                  {/* Phone — a reading */}
                  <span className="reading hidden text-[0.72rem] text-ink-secondary lg:inline">
                    {patient.phone_country_code} {patient.phone_number}
                  </span>

                  {/* Date — a reading */}
                  <span className="reading hidden text-[0.68rem] text-ink-muted xl:inline">
                    {new Date(patient.created_at).toISOString().slice(0, 10)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
