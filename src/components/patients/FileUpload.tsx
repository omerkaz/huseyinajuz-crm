import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui";
import { useAuth } from "@/context/auth";
import {
  deleteAttachment,
  getAttachmentUrl,
  getAttachments,
  uploadAttachment,
} from "@/lib/attachments";
import type { PatientAttachment } from "@/types/database";

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.doc,.docx";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileUploadProps {
  patientId: string;
}

export function FileUpload({ patientId }: FileUploadProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<PatientAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchAttachments = useCallback(async () => {
    const { data, error: fetchError } = await getAttachments(patientId);
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setAttachments(data);
      setError(null);
    }
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    void fetchAttachments();
  }, [fetchAttachments]);

  async function handleUpload(file: File) {
    if (!user) return;
    setUploading(true);
    setError(null);

    const { error: uploadError } = await uploadAttachment(
      patientId,
      file,
      user.id,
    );

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    setUploading(false);
    void fetchAttachments();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void handleUpload(file);
    }
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  async function handleDownload(attachment: PatientAttachment) {
    setDownloadingId(attachment.id);
    const { data: url, error: urlError } = await getAttachmentUrl(
      attachment.storage_path,
    );

    if (urlError || !url) {
      setError(urlError?.message ?? "Failed to generate download link.");
      setDownloadingId(null);
      return;
    }

    // Open signed URL in a new tab
    window.open(url, "_blank", "noopener,noreferrer");
    setDownloadingId(null);
  }

  async function handleDelete(attachment: PatientAttachment) {
    if (!window.confirm(`Delete "${attachment.file_name}"?`)) return;

    setDeletingId(attachment.id);
    const { error: delError } = await deleteAttachment(
      attachment.id,
      attachment.storage_path,
    );

    if (delError) {
      setError(delError.message);
      setDeletingId(null);
      return;
    }

    setDeletingId(null);
    void fetchAttachments();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin text-ink" />
        <span className="text-sm text-ink-secondary">
          Loading attachments…
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={`
            w-full border-2 border-dashed rounded-xl py-6 px-4
            flex flex-col items-center gap-2
            text-sm transition-colors
            ${uploading
              ? "border-ink/40 bg-ink-wash cursor-wait"
              : "border-hairline-strong hover:border-ink hover:bg-ink-wash cursor-pointer"
            }
          `}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-ink" />
              <span className="text-ink-secondary">Uploading…</span>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-ink-muted" />
              <span className="text-ink-secondary">
                Click to upload a file
              </span>
              <span className="text-xs text-ink-muted">
                PDF, JPG, PNG, DOC, DOCX
              </span>
            </>
          )}
        </button>
      </div>

      {error && <p className="text-sm text-red">{error}</p>}

      {/* Attachment list */}
      {attachments.length === 0 ? (
        <p className="text-sm text-ink-muted italic py-2">
          No files uploaded.
        </p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-3 rounded-lg border border-hairline px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink font-medium truncate">
                  {att.file_name}
                </p>
                <p className="text-xs text-ink-muted">
                  {formatFileSize(att.file_size)} ·{" "}
                  {dateFormatter.format(new Date(att.created_at))}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={downloadingId === att.id}
                  disabled={downloadingId === att.id}
                  onClick={() => void handleDownload(att)}
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <button
                  onClick={() => void handleDelete(att)}
                  disabled={deletingId === att.id}
                  className="p-1.5 text-ink-muted hover:text-red transition-colors disabled:opacity-50"
                  title="Delete file"
                >
                  {deletingId === att.id ? (
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
