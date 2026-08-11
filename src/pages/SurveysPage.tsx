import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ClipboardList, Loader2 } from "lucide-react";
import { Button, Card, Select } from "@/components/ui";
import { PatientStatusBadge } from "@/components/patients/PatientStatusBadge";
import { formatAnswers, getSurveyResponses, patientDisplayName } from "@/lib/surveys";
import { SURVEY_SOURCES, SURVEY_SOURCE_LABELS } from "@/types/database";
import type { SurveyResponseWithPatient, SurveySource } from "@/types/database";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Compact one-line preview: the first few answers, already humanised. */
function answerPreview(response: SurveyResponseWithPatient): string {
  return formatAnswers(response.answers)
    .filter((row) => row.key !== "q_name")
    .slice(0, 3)
    .map((row) => row.value)
    .join(" · ");
}

export default function SurveysPage() {
  const [responses, setResponses] = useState<SurveyResponseWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<SurveySource | "">("");

  const fetchResponses = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await getSurveyResponses(
      source ? { source } : undefined,
    );

    if (fetchError) {
      setError(fetchError.message);
      setResponses([]);
      setLoading(false);
      return;
    }

    setResponses(data);
    setLoading(false);
  }, [source]);

  useEffect(() => {
    void fetchResponses();
  }, [fetchResponses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="reading text-[0.72rem] text-ink-secondary">
          {String(responses.length).padStart(2, "0")} RESPONSES
        </p>
        <div className="w-full sm:w-56">
          <Select
            value={source}
            onChange={(e) => setSource(e.target.value as SurveySource | "")}
          >
            <option value="">All Sources</option>
            {SURVEY_SOURCES.map((s) => (
              <option key={s} value={s}>
                {SURVEY_SOURCE_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-ink" />
        </div>
      ) : error ? (
        <Card hover={false} className="py-12 text-center">
          <p className="font-medium text-red">Something went wrong</p>
          <p className="mt-1 text-sm text-ink-secondary">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => void fetchResponses()}
          >
            Try Again
          </Button>
        </Card>
      ) : responses.length === 0 ? (
        <Card hover={false} className="py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-hairline-strong bg-ink-wash">
            <ClipboardList className="h-7 w-7 text-ink-secondary" strokeWidth={1.5} />
          </div>
          <h3 className="display-condensed mt-4 text-[1rem] text-ink">
            {source ? "No responses from this source" : "No survey responses yet"}
          </h3>
          <p className="mt-1 text-sm text-ink-secondary">
            Responses appear here as soon as a lead completes the qualification survey.
          </p>
        </Card>
      ) : (
        <Card hover={false} className="p-0">
          <ul>
            {responses.map((response) => (
              <li key={response.id} className="border-b border-hairline last:border-b-0">
                {response.patient ? (
                  <Link
                    to={`/patients/${response.patient.id}`}
                    className="block px-5 py-3.5 transition-colors duration-150 hover:bg-ink-wash"
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.88rem] font-semibold [font-stretch:87.5%] text-ink">
                          {patientDisplayName(response.patient)}
                        </p>
                        <p className="truncate text-[0.75rem] text-ink-secondary">
                          {answerPreview(response) || "No answers recorded"}
                        </p>
                      </div>
                      <PatientStatusBadge status={response.patient.lifecycle_state} />
                      <span className="reading hidden text-[0.7rem] text-ink-secondary sm:inline">
                        {SURVEY_SOURCE_LABELS[response.source]}
                      </span>
                      <span className="reading hidden text-[0.68rem] text-ink-muted lg:inline">
                        {dateTimeFormatter.format(new Date(response.submitted_at))}
                      </span>
                    </div>
                  </Link>
                ) : (
                  /* The patient row is gone (hard delete) — the response is
                     orphaned in this view but retained in the archive. */
                  <div className="px-5 py-3.5">
                    <p className="text-[0.88rem] text-ink-secondary">Deleted patient</p>
                    <p className="reading text-[0.68rem] text-ink-muted">
                      {dateTimeFormatter.format(new Date(response.submitted_at))}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
