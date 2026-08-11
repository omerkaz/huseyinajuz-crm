-- ============================================================
-- D019 — silent server-side retention of deleted patients
--
-- Meeting outcome 2026-08-11: Hüseyin deletes empty ManyChat leads on purpose
-- and does NOT want an archive feature in the UI. The CRM keeps hard-delete.
-- As a safety net, the DB quietly snapshots every deleted patient (plus its
-- child rows) into deleted_patients_archive before the delete cascades.
--
-- Access: service-role only (RLS enabled, NO policies on purpose — the
-- browser/anon key can never read this table). Storage files are NOT
-- retained — only attachment metadata survives.
--
-- Safe to re-run: all steps are guarded. Transactional.
-- ============================================================

begin;

create table if not exists deleted_patients_archive (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid        not null,
  patient      jsonb       not null,
  notes        jsonb       not null default '[]'::jsonb,
  payments     jsonb       not null default '[]'::jsonb,
  attachments  jsonb       not null default '[]'::jsonb,
  transitions  jsonb       not null default '[]'::jsonb,
  created_by   uuid,
  deleted_at   timestamptz not null default now()
);

create index if not exists idx_deleted_patients_archive_patient_id
  on deleted_patients_archive(patient_id);

-- RLS on, zero policies: only the service role (which bypasses RLS) can read.
alter table deleted_patients_archive enable row level security;

-- BEFORE DELETE on patients fires before the cascades remove child rows,
-- so the snapshot still sees notes/payments/attachments/transitions.
create or replace function archive_deleted_patient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into deleted_patients_archive
    (patient_id, patient, notes, payments, attachments, transitions, created_by)
  values (
    old.id,
    to_jsonb(old),
    coalesce((select jsonb_agg(to_jsonb(n)) from patient_notes n where n.patient_id = old.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(p)) from payments p where p.patient_id = old.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(a)) from patient_attachments a where a.patient_id = old.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(t)) from patient_state_transitions t where t.patient_id = old.id), '[]'::jsonb),
    old.created_by
  );
  return old;
end;
$$;

drop trigger if exists trg_archive_deleted_patient on patients;
create trigger trg_archive_deleted_patient
  before delete on patients
  for each row execute function archive_deleted_patient();

commit;

-- Verification (run after commit):
--   insert a throwaway patient, delete it, then:
--   select patient_id, patient->>'first_name', deleted_at
--     from deleted_patients_archive order by deleted_at desc limit 1;
