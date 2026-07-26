import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Badge, Button, Card } from "@/components/ui";
import { LensAvatar } from "@/components/patients/LensAvatar";
import { LifecycleMiniScale } from "@/components/patients/LifecycleScale";
import { getPatients } from "@/lib/patients";
import { LIFECYCLE_STATES, LIFECYCLE_LABELS } from "@/types/database";
import type { LifecycleState, PackageType, Patient } from "@/types/database";
import { Loader2 } from "lucide-react";

const packageLabels: Record<PackageType, string> = {
  standard: "Standard",
  premium: "Premium",
  vip: "VIP",
};

/** Channels where a waiting patient means the practitioner owes an action. */
const ATTENTION_STATES: readonly LifecycleState[] = [
  "awaiting_blood_test",
  "week_6_checkin",
  "end_review",
];

function groupByState(
  patients: Patient[],
): Record<LifecycleState, Patient[]> {
  const grouped = {} as Record<LifecycleState, Patient[]>;
  for (const state of LIFECYCLE_STATES) {
    grouped[state] = [];
  }
  for (const patient of patients) {
    grouped[patient.lifecycle_state].push(patient);
  }
  return grouped;
}

function formatReadingDate(iso: string | null, fallback: string): string {
  return new Date(iso ?? fallback).toISOString().slice(0, 10);
}

export default function PipelinePage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await getPatients();

    if (result.error) {
      setError(result.error.message);
      setPatients([]);
    } else {
      setPatients(result.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchPatients();
  }, [fetchPatients]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-ink" />
      </div>
    );
  }

  if (error) {
    return (
      <Card hover={false} className="py-12 text-center">
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
    );
  }

  const grouped = groupByState(patients);

  return (
    <div className="space-y-4">
      {/* Reading header */}
      <p className="reading text-[0.72rem] text-ink-secondary">
        {String(patients.length).padStart(2, "0")} PATIENTS ·{" "}
        {LIFECYCLE_STATES.length} CHANNELS
      </p>

      {/* Reading channels */}
      <Card hover={false} className="overflow-x-auto p-0">
        <div className="flex min-h-[420px]">
          {LIFECYCLE_STATES.map((state) => {
            const statePatients = grouped[state];
            const count = statePatients.length;
            const needsAttention =
              count > 0 && ATTENTION_STATES.includes(state);

            return (
              <div
                key={state}
                className="w-[236px] shrink-0 border-l border-hairline px-3 py-4 first:border-l-0"
              >
                {/* Channel header */}
                <div className="mb-3 flex items-baseline justify-between gap-2 px-1">
                  <span className="display-condensed flex items-center gap-1.5 text-[0.78rem] text-ink">
                    {needsAttention && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-yellow ring-1 ring-hairline-strong"
                        role="img"
                        aria-label="Needs attention"
                      />
                    )}
                    {LIFECYCLE_LABELS[state]}
                  </span>
                  <span className="reading text-[0.75rem] text-ink-secondary">
                    {String(count).padStart(2, "0")}
                  </span>
                </div>

                {/* Channel body */}
                <div className="space-y-2">
                  {count === 0 ? (
                    <p className="reading py-6 text-center text-[0.7rem] text-ink-muted">
                      — 00 —
                    </p>
                  ) : (
                    statePatients.map((patient) => (
                      <Link
                        key={patient.id}
                        to={`/patients/${patient.id}`}
                        className="block rounded-[6px] border border-hairline bg-surface p-3 transition-colors duration-150 hover:border-hairline-strong"
                      >
                        <div className="flex items-center gap-2.5">
                          <LensAvatar
                            firstName={patient.first_name}
                            lastName={patient.last_name}
                            size="sm"
                          />
                          <p className="min-w-0 flex-1 truncate text-[0.82rem] font-semibold [font-stretch:87.5%] text-ink">
                            {patient.first_name} {patient.last_name}
                          </p>
                        </div>
                        <LifecycleMiniScale
                          state={patient.lifecycle_state}
                          className="mt-3"
                        />
                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <span className="reading text-[0.65rem] text-ink-muted">
                            {formatReadingDate(
                              patient.state_changed_at,
                              patient.created_at,
                            )}
                          </span>
                          {patient.package_type && (
                            <Badge variant="neutral">
                              {packageLabels[patient.package_type]}
                            </Badge>
                          )}
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
