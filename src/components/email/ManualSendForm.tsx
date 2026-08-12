import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { EMAIL_TEMPLATES, renderTemplate, sendManualEmail } from "@/lib/email";
import { EMAIL_FEATURES } from "@/types/database";
import type { EmailFeature, Patient } from "@/types/database";

/**
 * One-off template send to a single patient (MAIL-06).
 *
 * The template only seeds the subject and body — both stay editable. The
 * request itself carries feature "manual": the toggles gate automation, and a
 * person pressing Send has already decided. The Edge Function re-derives the
 * patient from the recipient address, so nothing here can address a patient
 * this practitioner does not own.
 */

/** A patient can only be mailed if their record holds a usable address. */
function mailablePatients(patients: Patient[]): Patient[] {
  return patients
    .filter((patient) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((patient.email ?? "").trim()))
    .sort((a, b) =>
      `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
    );
}

type SendState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent"; logged: boolean; to: string }
  | { status: "failed"; message: string };

export function ManualSendForm({
  patients,
  onSent,
}: {
  patients: Patient[];
  onSent: () => void;
}) {
  const options = useMemo(() => mailablePatients(patients), [patients]);

  const [patientId, setPatientId] = useState("");
  const [templateKey, setTemplateKey] = useState<EmailFeature | "">("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [state, setState] = useState<SendState>({ status: "idle" });

  const selected = options.find((patient) => patient.id === patientId) ?? null;

  function applyTemplate(key: EmailFeature | "", patient: Patient | null) {
    setTemplateKey(key);
    if (!key) return;
    const rendered = renderTemplate(key, patient?.first_name ?? null);
    setSubject(rendered.subject);
    setHtml(rendered.html);
  }

  function handlePatientChange(nextId: string) {
    setPatientId(nextId);
    setState({ status: "idle" });
    // Re-render the chosen template so the greeting matches the new patient.
    if (templateKey) {
      const nextPatient = options.find((patient) => patient.id === nextId) ?? null;
      applyTemplate(templateKey, nextPatient);
    }
  }

  const canSend =
    Boolean(selected?.email) &&
    subject.trim().length > 0 &&
    html.trim().length > 0 &&
    state.status !== "sending";

  async function handleSend() {
    if (!selected?.email || !canSend) return;

    setState({ status: "sending" });
    const result = await sendManualEmail({
      to: selected.email,
      subject: subject.trim(),
      html: html.trim(),
    });

    if (!result.sent) {
      setState({ status: "failed", message: result.error?.message ?? "The email was not sent." });
      return;
    }

    setState({ status: "sent", logged: result.logged, to: selected.email });
    onSent();
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="scale-label text-ink-secondary">Send an Email</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Pick a patient and a template, edit anything you like, then send.
        </p>
      </div>

      {options.length === 0 ? (
        <p className="py-2 text-sm text-ink-secondary">
          No patient has an email address on file yet.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="manual-send-patient"
                className="block text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-ink-secondary"
              >
                Patient
              </label>
              <Select
                id="manual-send-patient"
                value={patientId}
                onChange={(e) => handlePatientChange(e.target.value)}
              >
                <option value="">Choose a patient…</option>
                {options.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.first_name} {patient.last_name} — {patient.email}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="manual-send-template"
                className="block text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-ink-secondary"
              >
                Template
              </label>
              <Select
                id="manual-send-template"
                value={templateKey}
                onChange={(e) => applyTemplate(e.target.value as EmailFeature | "", selected)}
              >
                <option value="">Choose a template…</option>
                {EMAIL_TEMPLATES.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {templateKey && EMAIL_FEATURES.includes(templateKey) && (
            <p className="text-xs text-ink-muted">
              {EMAIL_TEMPLATES.find((t) => t.key === templateKey)?.context}
            </p>
          )}

          <Input
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line"
          />

          <Textarea
            label="Body"
            rows={8}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="<p>Dear Ada,</p>"
            hint="Simple HTML. The branded header, footer and plain-text version are added when it is sent."
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              onClick={() => void handleSend()}
              disabled={!canSend}
              loading={state.status === "sending"}
            >
              <Send className="h-3.5 w-3.5" />
              {state.status === "sending" ? "Sending…" : "Send Email"}
            </Button>

            {state.status === "sent" && (
              <p className="text-sm text-olive-deep">
                Sent to {state.to}.
                {!state.logged && " (Delivered, but it could not be added to the log.)"}
              </p>
            )}
            {state.status === "failed" && (
              <p className="text-sm text-red">{state.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
