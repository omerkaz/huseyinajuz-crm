import { supabase } from "@/lib/supabase";
import type { StateTransition } from "@/types/database";

/**
 * PostgREST caps responses at 1000 rows — transitions accumulate ~a few
 * per patient, so paginate to avoid silent truncation of funnel data.
 */
const PAGE_SIZE = 1000;

/**
 * Fetch the full state transition log, ordered chronologically
 * (changed_at, then seq as a deterministic tiebreak).
 */
export async function getStateTransitions(): Promise<{
  data: StateTransition[];
  error: Error | null;
}> {
  const all: StateTransition[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("patient_state_transitions")
      .select("*")
      .order("changed_at", { ascending: true })
      .order("seq", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return {
        data: [],
        error: new Error(`Failed to fetch state transitions: ${error.message}`),
      };
    }

    const page = (data ?? []) as StateTransition[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return { data: all, error: null };
}
