-- ============================================================
-- SRC-01 — first-touch lead source on patients
-- v1.3 Phase 18
--
-- Adds patients.source ('manychat' | 'landing_page' | 'manual'), backfills it
-- from manychat_id presence, then locks it down with NOT NULL + a CHECK.
--
-- 'landing_page' is in the CHECK list from day one so Phase 19 (landing form →
-- Edge Function) needs no further DDL.
--
-- Safe to re-run: every step is guarded. Transactional — a failure anywhere
-- leaves the table exactly as it was.
--
-- Apply with:
--   supabase/scripts or the Supabase SQL editor, or
--   $SUPA apply-migration --project-id hbhepcucokwlagqygwrz \
--     --name add_patient_source --query "$(cat supabase/migrations/20260811_add_patient_source.sql)"
-- ============================================================

begin;

-- 1. Add the column nullable, so existing rows are not rejected.
alter table patients
  add column if not exists source text;

-- 2. Backfill: anything that came through the ManyChat webhook carries a
--    manychat_id; everything else was entered by hand in the CRM.
update patients
   set source = case when manychat_id is not null then 'manychat' else 'manual' end
 where source is null;

-- 3. Default for future writers that do not set it explicitly.
alter table patients
  alter column source set default 'manual';

-- 4. Lock it down. Both statements are no-ops if already applied.
alter table patients
  alter column source set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'patients_source_check'
       and conrelid = 'patients'::regclass
  ) then
    alter table patients
      add constraint patients_source_check
      check (source in ('manychat', 'landing_page', 'manual'));
  end if;
end $$;

-- 5. Index for the patients-list filter and funnel segmentation.
create index if not exists idx_patients_source on patients(source);

commit;

-- Verification (run after commit):
--   select source, count(*) from patients group by source order by source;
--   -- expected on the current dataset: manychat + manual only, summing to the
--   -- full patient count, with zero NULLs.
