import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui";
import { getPatients } from "@/lib/patients";
import { getPayments } from "@/lib/payments";
import { getSettings } from "@/lib/settings";
import { useAuth } from "@/context/auth";
import { computeMetrics, formatUSD, type DashboardMetrics } from "@/lib/dashboardMetrics";
import { LifecycleDotScale } from "@/components/patients/LifecycleScale";
import { LensAvatar } from "@/components/patients/LensAvatar";
import { PatientStatusBadge } from "@/components/patients/PatientStatusBadge";
import {
  DEFAULT_SETTINGS,
  type LifecycleState,
  type PackageType,
  type Patient,
} from "@/types/database";

// ── Sub-components ──

/** Compact ring dial: active share of the whole caseload, with tick ring. */
function RingDial({ active, total }: { active: number; total: number }) {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const share = total > 0 ? active / total : 0;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 * Math.PI) / 180;
    return (
      <line
        key={i}
        x1={28 + 25 * Math.sin(angle)}
        y1={28 - 25 * Math.cos(angle)}
        x2={28 + 27 * Math.sin(angle)}
        y2={28 - 27 * Math.cos(angle)}
        stroke="var(--color-hairline-strong)"
        strokeWidth={1}
      />
    );
  });

  return (
    <svg
      viewBox="0 0 56 56"
      className="h-14 w-14 shrink-0"
      role="img"
      aria-label={`${active} active of ${total} patients`}
    >
      {ticks}
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="var(--color-hairline)"
        strokeWidth="4"
      />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="var(--color-olive)"
        strokeWidth="4"
        strokeDasharray={`${share * circumference} ${circumference}`}
        strokeLinecap="butt"
        transform="rotate(-90 28 28)"
      />
    </svg>
  );
}

function Readout({
  label,
  value,
  sub,
  dial,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  dial?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-4 border-hairline px-5 py-4 ${className}`}>
      {dial}
      <div>
        <p className="scale-label text-ink-secondary">{label}</p>
        <p className="reading mt-1 text-[1.7rem] leading-none text-ink">{value}</p>
        {sub && <p className="reading mt-1 text-[0.65rem] text-ink-muted">{sub}</p>}
      </div>
    </div>
  );
}

/** States that mean "waiting on the practitioner" — the yellow-dot list. */
const ATTENTION_STATES: readonly LifecycleState[] = [
  "awaiting_blood_test",
  "week_6_checkin",
  "end_review",
];

function daysSince(iso: string | null, fallback: string): number {
  const from = new Date(iso ?? fallback).getTime();
  return Math.max(0, Math.floor((Date.now() - from) / 86_400_000));
}

function AttentionPanel({ patients }: { patients: Patient[] }) {
  const rows = patients
    .filter((p) => ATTENTION_STATES.includes(p.lifecycle_state))
    .sort(
      (a, b) =>
        new Date(a.state_changed_at ?? a.created_at).getTime() -
        new Date(b.state_changed_at ?? b.created_at).getTime(),
    )
    .slice(0, 6);

  return (
    <Card hover={false} className="p-0">
      <div className="flex items-center gap-2 border-b border-hairline px-5 py-3.5">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-yellow ring-1 ring-hairline-strong" />
        <h3 className="scale-label text-ink">Needs Attention</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-[0.8rem] text-ink-secondary">
          All clear — no check-ins or reviews waiting.
        </p>
      ) : (
        <ul>
          {rows.map((p) => (
            <li key={p.id} className="border-b border-hairline last:border-b-0">
              <Link
                to={`/patients/${p.id}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-ink-wash"
              >
                <LensAvatar firstName={p.first_name} lastName={p.last_name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[0.85rem] font-semibold [font-stretch:87.5%] text-ink">
                  {p.first_name} {p.last_name}
                </span>
                <PatientStatusBadge status={p.lifecycle_state} />
                <span className="reading w-10 shrink-0 text-right text-[0.7rem] text-ink-muted">
                  {daysSince(p.state_changed_at, p.created_at)}d
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RevenueSummary({
  revenueTotal,
  revenueThisMonth,
  revenueByPackage,
  packagePrices,
}: Pick<DashboardMetrics, "revenueTotal" | "revenueThisMonth" | "revenueByPackage"> & {
  packagePrices: Record<PackageType, number>;
}) {
  const packageEntries: Array<{ key: PackageType; label: string; price: number }> = [
    { key: "standard", label: "Standard", price: packagePrices.standard },
    { key: "premium", label: "Premium", price: packagePrices.premium },
    { key: "vip", label: "VIP", price: packagePrices.vip },
  ];

  return (
    <Card hover={false} className="p-0">
      <div className="border-b border-hairline px-5 py-3.5">
        <h3 className="scale-label text-ink">Revenue</h3>
      </div>
      <div className="space-y-3 px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[0.8rem] text-ink-secondary">All time</span>
          <span className="reading text-[0.95rem] text-ink">{formatUSD(revenueTotal)}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[0.8rem] text-ink-secondary">This month</span>
          <span className="reading text-[0.95rem] text-ink">{formatUSD(revenueThisMonth)}</span>
        </div>
        <div className="h-px bg-hairline" />
        <p className="scale-label text-ink-secondary">By package</p>
        {packageEntries.map(({ key, label, price }) => (
          <div key={key} className="flex items-baseline justify-between">
            <span className="text-[0.8rem] text-ink-secondary">
              {label}{" "}
              <span className="reading text-[0.65rem] text-ink-muted">
                {formatUSD(price)}/client
              </span>
            </span>
            <span className="reading text-[0.85rem] text-ink">
              {formatUSD(revenueByPackage[key])}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Page ──

export default function DashboardPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [packagePrices, setPackagePrices] = useState<Record<PackageType, number>>({
    standard: DEFAULT_SETTINGS.price_standard,
    premium: DEFAULT_SETTINGS.price_premium,
    vip: DEFAULT_SETTINGS.price_vip,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const [patientsResult, paymentsResult, settingsResult] = await Promise.all([
      getPatients(),
      getPayments(),
      getSettings(user.id),
    ]);

    if (patientsResult.error) {
      setError(patientsResult.error.message);
      setLoading(false);
      return;
    }

    if (settingsResult.data) {
      setPackagePrices({
        standard: settingsResult.data.price_standard,
        premium: settingsResult.data.price_premium,
        vip: settingsResult.data.price_vip,
      });
    }

    const payments = paymentsResult.error ? [] : paymentsResult.data;
    setPatients(patientsResult.data);
    setMetrics(computeMetrics(patientsResult.data, payments));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-ink" />
      </div>
    );
  }

  if (error) {
    return (
      <Card hover={false} className="py-16 text-center">
        <p className="font-medium text-red">Failed to load dashboard</p>
        <p className="mt-1 text-sm text-ink-secondary">{error}</p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={() => void fetchMetrics()}
        >
          Try Again
        </Button>
      </Card>
    );
  }

  const m = metrics!;
  const pipelineCount =
    m.totalClients - m.stageCounts.completed - m.stageCounts.cold;

  return (
    <div className="space-y-5">
      {/* Readout strip — the faceplate's counters */}
      <Card hover={false} className="overflow-hidden p-0">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          <Readout
            label="Active Clients"
            value={String(m.activeClients).padStart(2, "0")}
            sub={`OF ${String(m.totalClients).padStart(2, "0")} TOTAL`}
            dial={<RingDial active={m.activeClients} total={m.totalClients} />}
          />
          <Readout
            label="In Pipeline"
            value={String(pipelineCount).padStart(2, "0")}
            sub="EXCL. DONE + COLD"
            className="border-l"
          />
          <Readout
            label="Revenue · Month"
            value={formatUSD(m.revenueThisMonth)}
            className="border-t lg:border-l lg:border-t-0"
          />
          <Readout
            label="Revenue · All Time"
            value={formatUSD(m.revenueTotal)}
            className="border-l border-t lg:border-t-0"
          />
        </div>
      </Card>

      {/* Lifecycle density scale */}
      <Card hover={false} className="p-0">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
          <h3 className="scale-label text-ink">Lifecycle Scale</h3>
          <Link
            to="/pipeline"
            className="scale-label text-ink-secondary transition-colors duration-150 hover:text-ink"
          >
            Open Pipeline →
          </Link>
        </div>
        <div className="overflow-x-auto px-5 py-5">
          <LifecycleDotScale counts={m.stageCounts} className="min-w-[560px]" />
        </div>
      </Card>

      {/* Attention + Revenue */}
      <div className="grid gap-5 lg:grid-cols-2">
        <AttentionPanel patients={patients} />
        <RevenueSummary
          revenueTotal={m.revenueTotal}
          revenueThisMonth={m.revenueThisMonth}
          revenueByPackage={m.revenueByPackage}
          packagePrices={packagePrices}
        />
      </div>
    </div>
  );
}
