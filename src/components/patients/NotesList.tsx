import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { useAuth } from "@/context/auth";
import { createNote, deleteNote, getPatientNotes } from "@/lib/notes";
import type { PatientNote } from "@/types/database";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

interface NotesListProps {
  patientId: string;
}

export function NotesList({ patientId }: NotesListProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<PatientNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newContent, setNewContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    const { data, error: fetchError } = await getPatientNotes(patientId);
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setNotes(data);
      setError(null);
    }
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes]);

  async function handleAdd() {
    const trimmed = newContent.trim();
    if (!trimmed || !user) return;

    setSubmitting(true);
    const { error: addError } = await createNote(patientId, trimmed, user.id);

    if (addError) {
      setError(addError.message);
      setSubmitting(false);
      return;
    }

    setNewContent("");
    setSubmitting(false);
    void fetchNotes();
  }

  async function handleDelete(noteId: string) {
    if (!window.confirm("Delete this note?")) return;

    setDeletingId(noteId);
    const { error: delError } = await deleteNote(noteId);

    if (delError) {
      setError(delError.message);
      setDeletingId(null);
      return;
    }

    setDeletingId(null);
    void fetchNotes();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin text-ink" />
        <span className="text-sm text-ink-secondary">Loading notes…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <div className="space-y-2">
        <Textarea
          placeholder="Add a note…"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          disabled={submitting}
          rows={3}
        />
        <Button
          size="sm"
          loading={submitting}
          disabled={submitting || !newContent.trim()}
          onClick={() => void handleAdd()}
        >
          Add Note
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red">{error}</p>
      )}

      {/* Notes timeline */}
      {notes.length === 0 ? (
        <p className="text-sm text-ink-muted italic py-2">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="relative pl-4 border-l-2 border-hairline"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink whitespace-pre-wrap break-words">
                    {note.content}
                  </p>
                  <p className="text-xs text-ink-muted mt-1">
                    {dateFormatter.format(new Date(note.created_at))}
                  </p>
                </div>
                <button
                  onClick={() => void handleDelete(note.id)}
                  disabled={deletingId === note.id}
                  className="shrink-0 p-1 text-ink-muted hover:text-red transition-colors disabled:opacity-50"
                  title="Delete note"
                >
                  {deletingId === note.id ? (
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
