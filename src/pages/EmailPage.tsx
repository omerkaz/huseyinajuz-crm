import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Loader2, Mail } from "lucide-react";
import { Button, Card, Select } from "@/components/ui";
import { EmailAutomationToggles } from "@/components/email/EmailAutomationToggles";
import { ManualSendForm } from "@/components/email/ManualSendForm";
import { EMAIL_LOG_LIMIT, getEmailSendLog } from "@/lib/emailLog";
import { buildLogRows, featureLabel } from "@/lib/emailLogView";
import { getPatients } from "@/lib/patients";
import type { EmailLogRow } from "@/lib/emailLogView";
import { LOGGED_EMAIL_FEATURES } from "@/types/database";
import type { Patient } from "@/types/database";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * /email (MAIL-06) — every email control in one place: what has been sent,
 * a manual send, and the automation toggles.
 *
 * The three sections fail independently: a broken log fetch must not take the
 * toggles or the send form down with it.
 */
export default function EmailPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsError, setPatientsError] = useState<string | null>(null);

  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [logLoading, setLogLoading] = useState(true);
  const [logError, setLogError] = useState<string | null>(null);
  const [feature, setFeature] = useState("");

  const fetchLog = useCallback(async () => {
    setLogLoading(true);
    setLogError(null);

    const [logResult, patientsResult] = await Promise.all([
      getEmailSendLog(feature ? { feature } : undefined),
      getPatients(),
    ]);

    setPatients(patientsResult.data);
    setPatientsError(patientsResult.error?.message ?? null);

    if (logResult.error) {
      setLogError(logResult.error.message);
      setRows([]);
      setTruncated(false);
      setLogLoading(false);
      return;
    }

    setRows(buildLogRows(logResult.data, patientsResult.data));
    setTruncated(logResult.truncated);
    setLogLoading(false);
  }, [feature]);

  useEffect(() => {
    void fetchLog();
  }, [fetchLog]);

  return (
    <div className="space-y-6">
      {/* ── Manual send ── */}
      <Card hover={false}>
        {patientsError ? (
          <div>
            <h2 className="scale-label text-ink-secondary">Send an Email</h2>
            <p className="mt-2 text-sm text-red">
              Patients could not be loaded — {patientsError}
            </p>
          </div>
        ) : (
          <ManualSendForm patients={patients} onSent={() => void fetchLog()} />
        )}
      </Card>

      {/* ── Send log ── */}
      <Card hover={false}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="scale-label text-ink-secondary">Send Log</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Scheduled automation sends and manual sends, newest first.
            </p>
          </div>
          <div className="w-full sm:w-56">
            <Select value={feature} onChange={(e) => setFeature(e.target.value)}>
              <option value="">All Emails</option>
              {LOGGED_EMAIL_FEATURES.map((key) => (
                <option key={key} value={key}>
                  {featureLabel(key)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {logLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-ink-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading send log…
          </div>
        ) : logError ? (
          <div className="py-6 text-center">
            <p className="font-medium text-red">Could not load the send log</p>
            <p className="mt-1 text-sm text-ink-secondary">{logError}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => void fetchLog()}>
              Try Again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-hairline-strong bg-ink-wash">
              <Mail className="h-6 w-6 text-ink-secondary" strokeWidth={1.5} />
            </div>
            <p className="mt-3 text-sm text-ink-secondary">
              {feature ? "No emails logged for this type yet." : "No emails logged yet."}
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-hairline">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/patients/${row.patientId}`}
                      className="truncate text-[0.85rem] font-semibold [font-stretch:87.5%] text-ink hover:underline"
                    >
                      {row.patientName}
                    </Link>
                    {row.patientEmail && (
                      <p className="truncate text-[0.72rem] text-ink-secondary">
                        {row.patientEmail}
                      </p>
                    )}
                  </div>
                  <span className="text-[0.78rem] text-ink-secondary">{row.featureLabel}</span>
                  <span className="reading hidden text-[0.68rem] text-ink-muted sm:inline">
                    {dateTimeFormatter.format(new Date(row.sentAt))}
                  </span>
                </li>
              ))}
            </ul>
            {truncated && (
              <p className="mt-3 text-xs text-ink-muted">
                Showing the {EMAIL_LOG_LIMIT} most recent entries.
              </p>
            )}
          </>
        )}
      </Card>

      {/* ── Automation toggles (moved from Settings) ── */}
      <Card hover={false}>
        <EmailAutomationToggles />
      </Card>
    </div>
  );
}
