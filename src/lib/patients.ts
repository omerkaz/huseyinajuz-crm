import { supabase } from "@/lib/supabase";
import { VALID_TRANSITIONS } from "@/types/database";
import type {
  LeadSource,
  LifecycleState,
  PackageType,
  Patient,
  PatientInsert,
  PatientUpdate,
} from "@/types/database";

// ── Filters ──

export interface PatientFilters {
  search?: string;
  status?: LifecycleState;
  packageType?: PackageType;
  source?: LeadSource;
}

// ── Queries ──

export async function getPatients(
  filters?: PatientFilters,
): Promise<{ data: Patient[]; error: Error | null }> {
  let query = supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("lifecycle_state", filters.status);
  }

  if (filters?.packageType) {
    query = query.eq("package_type", filters.packageType);
  }

  if (filters?.source) {
    query = query.eq("source", filters.source);
  }

  if (filters?.search) {
    const term = `%${filters.search}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`,
    );
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], error: new Error(`Failed to fetch patients: ${error.message}`) };
  }

  return { data: (data ?? []) as Patient[], error: null };
}

export async function getPatient(
  id: string,
): Promise<{ data: Patient | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, error: new Error(`Failed to fetch patient ${id}: ${error.message}`) };
  }

  return { data: data as Patient | null, error: null };
}

export async function createPatient(
  patient: PatientInsert,
): Promise<{ data: Patient | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("patients")
    .insert(patient)
    .select()
    .single();

  if (error) {
    return { data: null, error: new Error(`Failed to create patient: ${error.message}`) };
  }

  return { data: data as Patient, error: null };
}

export async function updatePatient(
  id: string,
  updates: PatientUpdate,
): Promise<{ data: Patient | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("patients")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { data: null, error: new Error(`Failed to update patient ${id}: ${error.message}`) };
  }

  return { data: data as Patient, error: null };
}

export async function deletePatient(
  id: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("patients").delete().eq("id", id);

  if (error) {
    return { error: new Error(`Failed to delete patient ${id}: ${error.message}`) };
  }

  return { error: null };
}

// ── State transitions ──

export async function transitionState(
  id: string,
  currentState: LifecycleState,
  newState: LifecycleState,
): Promise<{ data: Patient | null; error: Error | null }> {
  const allowed = VALID_TRANSITIONS[currentState];
  if (!allowed.includes(newState)) {
    return {
      data: null,
      error: new Error(
        `Invalid state transition: "${currentState}" → "${newState}". ` +
          `Allowed transitions from "${currentState}": [${allowed.join(", ")}]`,
      ),
    };
  }

  const { data, error } = await supabase
    .from("patients")
    .update({
      lifecycle_state: newState,
      updated_at: new Date().toISOString(),
      state_changed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("lifecycle_state", currentState) // optimistic concurrency — only update if state hasn't changed
    .select()
    .single();

  if (error) {
    return {
      data: null,
      error: new Error(
        `Failed to transition patient ${id} from "${currentState}" to "${newState}": ${error.message}`,
      ),
    };
  }

  return { data: data as Patient, error: null };
}
