import { useCallback, useEffect, useState } from "react";
import { Funnel, Loader2 } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { getPatients } from "@/lib/patients";
import { getStateTransitions } from "@/lib/transitions";
import { computeFunnel, type FunnelMetrics } from "@/lib/funnelMetrics";
import {
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LIFECYCLE_LABELS,
  type LifecycleState,
} from "@/types/database";

// ── Formatting helpers ──

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

function formatDays(n: number | null): string {
  if (n === null) return "—";
  return n < 10 ? `${n.toFixed(1)}d` : `${Math.round(n)}d`;
}

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
});

function formatMonth(month: string): string {
  return monthFormatter.format(new Date(`${month}-01T00:00:00Z`));
}

/** end_review row folds in extended_support (parallel branch, same depth). */
function stageLabel(state: LifecycleState): string {
  if (state === "end_review") return "End Review · Support";
  return LIFECYCLE_LABELS[state];
}

// ── Sub-components ──

function SectionHeader({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-hairline px-5 py-3.5">
      <h3 className="scale-label text-ink">{title}</h3>
      {aside && <span className="reading text-[0.65rem] text-ink-muted">{aside}</span>}
    </div>
  );
}

function FunnelBars({ metrics }: { metrics: FunnelMetrics }) {
  return (
    <Card hover={false} className="p-0">
      <SectionHeader
        title="Conversion Funnel"
        aside={`${metrics.totalPatients} PATIENTS ALL TIME`}
      />
      <div>
        {metrics.stages.map((s) => (
          <div
            key={s.state}
            className="flex items-center gap-4 border-b border-hairline px-5 py-3 last:border-b-0"
          >
            <span className="scale-label w-36 shrink-0 text-ink-secondary sm:w-44">
              {stageLabel(s.state)}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-wash">
              <div
                className="h-full bg-olive-deep transition-[width] duration-300"
                style={{ width: `${s.pctOfLeads}%` }}
              />
            </div>
            <span className="reading w-8 shrink-0 text-right text-[0.85rem] text-ink">
              {s.reached}
            </span>
            <span className="reading w-16 shrink-0 text-right text-[0.65rem] text-ink-muted">
              {pct(s.pctOfPrevious)} PREV
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SourceCard({ metrics }: { metrics: FunnelMetrics }) {
  const rows = LEAD_SOURCES.map((source) => ({
    label: LEAD_SOURCE_LABELS[source],
    data: metrics.bySource[source],
  }));
  return (
    <Card hover={false} className="p-0">
      <SectionHeader title="Lead Source → Treatment" />
      <div className="space-y-3 px-5 py-4">
        {rows.map(({ label, data }) => (
          <div key={label} className="flex items-baseline justify-between">
            <span className="text-[0.8rem] text-ink-secondary">
              {label}{" "}
              <span className="reading text-[0.65rem] text-ink-muted">
                {data.reachedTreatment}/{data.total}
              </span>
            </span>
            <span className="reading text-[0.95rem] text-ink">
              {pct(data.conversionPct)}
            </span>
          </div>
        ))}
        <p className="reading text-[0.65rem] text-ink-muted">
          SHARE OF LEADS REACHING ACTIVE TREATMENT
        </p>
      </div>
    </Card>
  );
}

function ColdCard({ metrics }: { metrics: FunnelMetrics }) {
  const entries = (Object.entries(metrics.coldByStage) as Array<[LifecycleState, number]>).sort(
    (a, b) => b[1] - a[1],
  );
  return (
    <Card hover={false} className="p-0">
      <SectionHeader title="Cold Drop-off" aside={`${metrics.totalCold} CURRENTLY COLD`} />
      <div className="space-y-3 px-5 py-4">
        {entries.length === 0 ? (
          <p className="text-[0.8rem] text-ink-secondary">
            No recorded drop-offs yet — origins appear as patients go cold.
          </p>
        ) : (
          entries.map(([state, count]) => (
            <div key={state} className="flex items-baseline justify-between">
              <span className="text-[0.8rem] text-ink-secondary">
                From {LIFECYCLE_LABELS[state]}
              </span>
              <span className="reading text-[0.85rem] text-red">{count}</span>
            </div>
          ))
        )}
        <div className="h-px bg-hairline" />
        <div className="flex items-baseline justify-between">
          <span className="text-[0.8rem] text-ink-secondary">Re-engaged (cold → lead)</span>
          <span className="reading text-[0.85rem] text-ink">{metrics.reengaged}</span>
        </div>
      </div>
    </Card>
  );
}

function DurationsCard({ metrics }: { metrics: FunnelMetrics }) {
  const rows = metrics.stageDurations.filter((d) => d.state !== "completed");
  return (
    <Card hover={false} className="p-0">
      <SectionHeader title="Median Days in Stage" />
      <div className="space-y-3 px-5 py-4">
        {rows.map((d) => (
          <div key={d.state} className="flex items-baseline justify-between">
            <span className="text-[0.8rem] text-ink-secondary">
              {LIFECYCLE_LABELS[d.state]}{" "}
              {d.samples > 0 && (
                <span className="reading text-[0.65rem] text-ink-muted">n={d.samples}</span>
              )}
            </span>
            <span className="reading text-[0.85rem] text-ink">
              {formatDays(d.medianDays)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CohortTable({ metrics }: { metrics: FunnelMetrics }) {
  return (
    <Card hover={false} className="overflow-hidden p-0">
      <SectionHeader title="Monthly Cohorts" aside="BY PATIENT CREATION MONTH" />
      {metrics.cohorts.length === 0 ? (
        <p className="px-5 py-6 text-[0.8rem] text-ink-secondary">
          Cohorts appear once patients are recorded.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-hairline">
                <th className="scale-label px-5 py-3 font-normal text-ink-secondary">Month</th>
                <th className="scale-label px-3 py-3 text-right font-normal text-ink-secondary">Patients</th>
                <th className="scale-label px-3 py-3 text-right font-normal text-ink-secondary">ManyChat</th>
                <th className="scale-label px-3 py-3 text-right font-normal text-ink-secondary">Treatment</th>
                <th className="scale-label px-3 py-3 text-right font-normal text-ink-secondary">Cold</th>
                <th className="scale-label px-5 py-3 text-right font-normal text-ink-secondary">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {metrics.cohorts.map((c) => (
                <tr key={c.month} className="border-b border-hairline last:border-b-0">
                  <td className="px-5 py-3 text-[0.85rem] font-semibold [font-stretch:87.5%] text-ink">
                    {formatMonth(c.month)}
                  </td>
                  <td className="reading px-3 py-3 text-right text-[0.85rem] text-ink">{c.total}</td>
                  <td className="reading px-3 py-3 text-right text-[0.85rem] text-ink-secondary">{c.fromManychat}</td>
                  <td className="reading px-3 py-3 text-right text-[0.85rem] text-ink">{c.reachedTreatment}</td>
                  <td className="reading px-3 py-3 text-right text-[0.85rem] text-red">{c.wentCold}</td>
                  <td className="reading px-5 py-3 text-right text-[0.85rem] text-ink">{pct(c.conversionPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── Page ──

export default function FunnelPage() {
  const [metrics, setMetrics] = useState<FunnelMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [patientsResult, transitionsResult] = await Promise.all([
      getPatients(),
      getStateTransitions(),
    ]);

    // Both datasets are required — partial data would render wrong
    // metrics, not just incomplete ones.
    const failure = patientsResult.error ?? transitionsResult.error;
    if (failure) {
      setError(failure.message);
      setLoading(false);
      return;
    }

    setMetrics(computeFunnel(patientsResult.data, transitionsResult.data));
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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
        <p className="font-medium text-red">Failed to load funnel</p>
        <p className="mt-1 text-sm text-ink-secondary">{error}</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => void fetchData()}>
          Try Again
        </Button>
      </Card>
    );
  }

  const m = metrics!;

  if (m.totalPatients === 0) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <Card hover={false} className="py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-hairline-strong bg-ink-wash">
            <Funnel className="h-7 w-7 text-ink-secondary" strokeWidth={1.5} />
          </div>
          <h3 className="mt-4 display-condensed text-[1rem] text-ink">No funnel data yet</h3>
          <p className="mt-1 text-sm text-ink-secondary">
            Metrics appear once patients enter the pipeline.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader />
      <FunnelBars metrics={m} />
      <div className="grid gap-5 lg:grid-cols-3">
        <SourceCard metrics={m} />
        <ColdCard metrics={m} />
        <DurationsCard metrics={m} />
      </div>
      <CohortTable metrics={m} />
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="display-condensed text-[1.3rem] text-ink">Funnel</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Lifecycle conversion, drop-off, and monthly cohorts.
      </p>
    </div>
  );
}
