import { supabase } from "@/lib/supabase";
import type { EmailSendLogEntry } from "@/types/database";

/**
 * Read access to email_send_log (MAIL-06).
 *
 * Rows are written by the pg_cron reminder functions and by manual sends from
 * /email (feature 'manual', inserted by the send-email Edge Function). Browser
 * access is SELECT-only through the RLS policy scoped by patient ownership.
 */

/**
 * The log is append-only and unbounded, so the viewer reads a recent window
 * rather than the whole table. At the practice's volume this is years of
 * history; the cap exists so the page cannot degrade silently.
 */
export const EMAIL_LOG_LIMIT = 500;

export async function getEmailSendLog(filters?: {
  feature?: string;
  limit?: number;
}): Promise<{ data: EmailSendLogEntry[]; error: Error | null; truncated: boolean }> {
  const limit = filters?.limit ?? EMAIL_LOG_LIMIT;

  let query = supabase
    .from("email_send_log")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (filters?.feature) {
    query = query.eq("feature", filters.feature);
  }

  const { data, error } = await query;

  if (error) {
    return {
      data: [],
      error: new Error(`Failed to fetch email send log: ${error.message}`),
      truncated: false,
    };
  }

  const rows = (data ?? []) as EmailSendLogEntry[];
  return { data: rows, error: null, truncated: rows.length === limit };
}
