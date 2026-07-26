import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Badge, Button, Input, Select } from "@/components/ui";
import { useAuth } from "@/context/auth";
import {
  createPayment,
  deletePayment,
  getPatientPayments,
  getPatientPaymentSummary,
} from "@/lib/payments";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from "@/types/database";
import type {
  PackageType,
  Payment,
  PaymentMethod,
  PaymentSummary,
} from "@/types/database";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Returns YYYY-MM-DD for today in local time. */
function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

const STATUS_BADGE_VARIANT = {
  paid: "olive",
  partial: "yellow",
  unpaid: "muted",
} as const;

const STATUS_LABELS: Record<PaymentSummary["status"], string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
};

interface PaymentsListProps {
  patientId: string;
  packageType: PackageType | null;
  agreedPrice: number | null;
}

export function PaymentsList({ patientId, packageType, agreedPrice }: PaymentsListProps) {
  const { user } = useAuth();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [reference, setReference] = useState("");

  const fetchData = useCallback(async () => {
    const [paymentsRes, summaryRes] = await Promise.all([
      getPatientPayments(patientId),
      getPatientPaymentSummary(patientId, packageType, agreedPrice),
    ]);

    if (paymentsRes.error) {
      setError(paymentsRes.error.message);
    } else {
      setPayments(paymentsRes.data);
      setError(null);
    }

    if (!summaryRes.error) {
      setSummary(summaryRes.data);
    }

    setLoading(false);
  }, [patientId, packageType, agreedPrice]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function isFormValid(): boolean {
    const parsedAmount = parseFloat(amount);
    return (
      !isNaN(parsedAmount) &&
      parsedAmount > 0 &&
      method !== "" &&
      paymentDate !== ""
    );
  }

  async function handleAdd() {
    if (!isFormValid() || !user) return;

    setSubmitting(true);
    setError(null);

    const { error: addError } = await createPayment({
      patient_id: patientId,
      amount: parseFloat(amount),
      currency: "USD",
      payment_method: method as PaymentMethod,
      payment_date: paymentDate,
      reference: reference.trim() || null,
      created_by: user.id,
    });

    if (addError) {
      setError(addError.message);
      setSubmitting(false);
      return;
    }

    // Reset form
    setAmount("");
    setMethod("");
    setPaymentDate(todayISO());
    setReference("");
    setSubmitting(false);
    void fetchData();
  }

  async function handleDelete(paymentId: string) {
    if (!window.confirm("Delete this payment?")) return;

    setDeletingId(paymentId);
    const { error: delError } = await deletePayment(paymentId);

    if (delError) {
      setError(delError.message);
      setDeletingId(null);
      return;
    }

    setDeletingId(null);
    void fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin text-ink" />
        <span className="text-sm text-ink-secondary">Loading payments…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Payment summary */}
      {summary && (
        <div className="flex items-center gap-3 text-sm">
          <Badge variant={STATUS_BADGE_VARIANT[summary.status]}>
            {STATUS_LABELS[summary.status]}
          </Badge>
          <span className="text-ink-secondary">
            {formatCurrency(summary.totalPaid)} paid
            {summary.paymentCount > 0 && ` (${summary.paymentCount} payment${summary.paymentCount === 1 ? "" : "s"})`}
          </span>
        </div>
      )}

      {/* Add payment form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Amount ($)"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={submitting}
        />
        <Select
          label="Payment Method"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod | "")}
          disabled={submitting}
        >
          <option value="">Select method…</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </Select>
        <Input
          label="Payment Date"
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Reference / Note"
          type="text"
          placeholder="Optional"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          disabled={submitting}
        />
      </div>
      <Button
        size="sm"
        loading={submitting}
        disabled={submitting || !isFormValid()}
        onClick={() => void handleAdd()}
      >
        Add Payment
      </Button>

      {error && <p className="text-sm text-red">{error}</p>}

      {/* Payments list */}
      {payments.length === 0 ? (
        <p className="text-sm text-ink-muted italic py-2">No payments recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="relative pl-4 border-l-2 border-hairline"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink font-medium">
                    {formatCurrency(payment.amount)}{" "}
                    <span className="font-normal text-ink-secondary">
                      via {PAYMENT_METHOD_LABELS[payment.payment_method]}
                    </span>
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {dateFormatter.format(new Date(payment.payment_date))}
                    {payment.reference && (
                      <span className="ml-2">— {payment.reference}</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => void handleDelete(payment.id)}
                  disabled={deletingId === payment.id}
                  className="shrink-0 p-1 text-ink-muted hover:text-red transition-colors disabled:opacity-50"
                  title="Delete payment"
                >
                  {deletingId === payment.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
