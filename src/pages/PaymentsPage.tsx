import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Badge, Button, Card, Select } from "@/components/ui";
import { getPayments } from "@/lib/payments";
import { getPatients } from "@/lib/patients";
import type { Payment, PaymentMethod, Patient } from "@/types/database";
import { PAYMENT_METHOD_LABELS } from "@/types/database";
import { CreditCard, Loader2 } from "lucide-react";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatCurrency(amount: number): string {
  return `$${Number(amount).toFixed(2)}`;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [patients, setPatients] = useState<Map<string, Patient>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "">("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const filters: { method?: PaymentMethod } = {};
    if (methodFilter) filters.method = methodFilter;

    const [paymentsResult, patientsResult] = await Promise.all([
      getPayments(filters),
      getPatients(),
    ]);

    if (paymentsResult.error) {
      setError(paymentsResult.error.message);
      setPayments([]);
      setLoading(false);
      return;
    }

    if (patientsResult.error) {
      setError(patientsResult.error.message);
      setPayments([]);
      setLoading(false);
      return;
    }

    // Build patient lookup map
    const patientMap = new Map<string, Patient>();
    for (const p of patientsResult.data) {
      patientMap.set(p.id, p);
    }

    setPayments(paymentsResult.data);
    setPatients(patientMap);
    setLoading(false);
  }, [methodFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="display-condensed text-[1.3rem] text-ink">Payments</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          View and filter all recorded payments.
        </p>
      </div>

      {/* Filter bar */}
      <Card hover={false}>
        <div className="max-w-xs">
          <Select
            label="Payment Method"
            value={methodFilter}
            onChange={(e) =>
              setMethodFilter(e.target.value as PaymentMethod | "")
            }
          >
            <option value="">All Methods</option>
            <option value="paypal">PayPal</option>
            <option value="bank_transfer">Bank Transfer</option>
          </Select>
        </div>
      </Card>

      {/* Content area */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-ink" />
        </div>
      ) : error ? (
        <Card hover={false} className="text-center py-12">
          <p className="text-red font-medium">Something went wrong</p>
          <p className="mt-1 text-sm text-ink-secondary">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => void fetchData()}
          >
            Try Again
          </Button>
        </Card>
      ) : payments.length === 0 ? (
        <Card hover={false} className="text-center py-16">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-hairline-strong bg-ink-wash">
            <CreditCard className="h-7 w-7 text-ink-secondary" strokeWidth={1.5} />
          </div>
          <h3 className="mt-4 display-condensed text-[1rem] text-ink">
            {methodFilter ? "No payments match this filter" : "No payments yet"}
          </h3>
          <p className="mt-1 text-sm text-ink-secondary">
            {methodFilter
              ? "Try selecting a different payment method."
              : "Payments will appear here once recorded on patient records."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => {
            const patient = patients.get(payment.patient_id);
            const patientName = patient
              ? `${patient.first_name} ${patient.last_name}`
              : "Unknown Patient";

            return (
              <Card key={payment.id} className="flex items-center gap-4">
                {/* Patient name (linked) */}
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/patients/${payment.patient_id}`}
                    className="font-medium text-cyan-deep hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {patientName}
                  </Link>
                  {payment.reference && (
                    <p className="truncate text-sm text-ink-secondary">
                      Ref: {payment.reference}
                    </p>
                  )}
                </div>

                {/* Amount */}
                <span className="font-semibold text-ink">
                  {formatCurrency(payment.amount)}
                </span>

                {/* Method badge */}
                <Badge variant="neutral">
                  {PAYMENT_METHOD_LABELS[payment.payment_method]}
                </Badge>

                {/* Date */}
                <span className="hidden text-sm text-ink-secondary sm:inline">
                  {dateFormatter.format(new Date(payment.payment_date))}
                </span>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
