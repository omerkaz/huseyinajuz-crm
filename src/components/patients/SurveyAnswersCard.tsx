import { useEffect, useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { formatAnswers, getSurveyResponse } from "@/lib/surveys";
import { SURVEY_SOURCE_LABELS } from "@/types/database";
import type { SurveyResponse } from "@/types/database";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Qualification survey answers for one patient (SURV-03).
 * Renders readable question/answer pairs — never raw `q_*` keys.
 */
export function SurveyAnswersCard({ patientId }: { patientId: string }) {
  const [response, setResponse] = useState<SurveyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void getSurveyResponse(patientId).then(({ data, error: fetchError }) => {
      if (!active) return;
      setResponse(data);
      setError(fetchError?.message ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [patientId]);

  const rows = response ? formatAnswers(response.answers) : [];

  return (
    <Card hover={false}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="scale-label text-ink-secondary">Qualification Survey</h2>
        {response && (
          <span className="reading text-[0.7rem] text-ink-muted">
            {SURVEY_SOURCE_LABELS[response.source]} ·{" "}
            {dateTimeFormatter.format(new Date(response.submitted_at))}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-ink-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading answers…
        </div>
      ) : error ? (
        <p className="text-sm text-red">{error}</p>
      ) : !response ? (
        <div className="flex items-center gap-3 py-2">
          <ClipboardList className="h-5 w-5 text-ink-muted" strokeWidth={1.5} />
          <p className="text-sm text-ink-secondary">
            No survey submitted yet.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-secondary">
          The survey was submitted with no answers filled in.
        </p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.key}>
              <dt className="scale-label text-ink-muted">{row.question}</dt>
              <dd className="mt-0.5 text-sm text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {response && response.survey_version !== 1 && (
        <div className="mt-4">
          <Badge variant="muted">Survey v{response.survey_version}</Badge>
        </div>
      )}
    </Card>
  );
}
