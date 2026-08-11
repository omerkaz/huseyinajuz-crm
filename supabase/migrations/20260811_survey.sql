-- ============================================================
-- SURV-01/02 — shared qualification survey
-- v1.3 Phase 19
--
-- Adds:
--   1. patients.survey_token           — unguessable per-patient survey key
--   2. unique index on normalised email — landing-lead dedup key
--   3. survey_responses                — one response row per patient
--   4. survey retention in deleted_patients_archive (D019 stays complete)
--
-- Safe to re-run: every step is guarded. Transactional — a failure anywhere
-- leaves the database exactly as it was.
--
-- IMPORTANT: step 2 aborts loudly if the current data already contains two
-- patients sharing a normalised email. That is a data problem, not a schema
-- problem — merge or clear the duplicates, then re-run. The exception message
-- lists the offending addresses.
--
-- Apply with:
--   $SUPA apply-migration --project-id hbhepcucokwlagqygwrz \
--     --name survey --query "$(cat supabase/migrations/20260811_survey.sql)"
-- ============================================================

begin;

-- ── 1. patients.survey_token ────────────────────────────────
-- Bearer credential for the hosted survey page (?t=<token>). uuid v4 from
-- gen_random_uuid() — 122 bits of entropy, not guessable like manychat_id.
alter table patients
  add column if not exists survey_token uuid not null default gen_random_uuid();

create unique index if not exists idx_patients_survey_token
  on patients(survey_token);

-- ── 2. Email dedup key for the landing form ─────────────────
-- Normalised (trimmed + lowercased) so "  Ada@X.com " and "ada@x.com" collide.
-- Partial: NULL and blank emails are not deduped (ManyChat leads arrive
-- email-less and must not collapse into one another).
do $$
declare
  _dupes text;
begin
  select string_agg(e || ' (' || c || ')', ', ')
    into _dupes
    from (
      select lower(btrim(email)) as e, count(*) as c
        from patients
       where email is not null
         and btrim(email) <> ''
       group by 1
      having count(*) > 1
    ) d;

  if _dupes is not null then
    raise exception
      'Cannot create unique email index — duplicate patient emails exist: %. Merge or clear them, then re-run this migration.',
      _dupes;
  end if;
end $$;

create unique index if not exists idx_patients_email_normalised
  on patients (lower(btrim(email)))
  where email is not null and btrim(email) <> '';

-- ── 3. survey_responses ─────────────────────────────────────
-- One response per patient (UNIQUE patient_id): re-submitting the same token
-- updates the row rather than appending. survey_version future-proofs the
-- question set (v1.4 question editor) — it is set on insert and never bumped
-- by an update, so old answers stay interpretable.
create table if not exists survey_responses (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null unique references patients(id) on delete cascade,
  -- Where the respondent came from. Mirrors patients.source values plus
  -- 'unknown' for links whose origin we cannot attribute.
  source         text not null default 'unknown'
    check (source in ('manychat', 'landing_page', 'manual', 'unknown')),
  answers        jsonb not null default '{}'::jsonb,
  survey_version integer not null default 1,
  submitted_at   timestamptz not null default now()
);

create index if not exists idx_survey_responses_submitted_at
  on survey_responses(submitted_at desc);

alter table survey_responses enable row level security;

-- Read-only for the practitioner, scoped through patient ownership.
-- No insert/update/delete policies: survey-submit writes with the service role.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'survey_responses'
       and policyname = 'Users can view own survey responses'
  ) then
    create policy "Users can view own survey responses"
      on survey_responses for select using (
        patient_id in (select id from patients where created_by = auth.uid())
      );
  end if;
end $$;

-- ── 4. Keep D019 retention complete ─────────────────────────
-- The BEFORE DELETE archive trigger snapshots child rows; survey answers are
-- exactly the kind of lead data D019 exists to preserve.
alter table deleted_patients_archive
  add column if not exists surveys jsonb not null default '[]'::jsonb;

create or replace function archive_deleted_patient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into deleted_patients_archive
    (patient_id, patient, notes, payments, attachments, transitions, surveys, created_by)
  values (
    old.id,
    to_jsonb(old),
    coalesce((select jsonb_agg(to_jsonb(n)) from patient_notes n where n.patient_id = old.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(p)) from payments p where p.patient_id = old.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(a)) from patient_attachments a where a.patient_id = old.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(t)) from patient_state_transitions t where t.patient_id = old.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(s)) from survey_responses s where s.patient_id = old.id), '[]'::jsonb),
    old.created_by
  );
  return old;
end;
$$;

commit;

-- Verification (run after commit):
--   select count(*) filter (where survey_token is null) as null_tokens,
--          count(distinct survey_token) = count(*)      as tokens_unique
--     from patients;
--   -- expected: 0, true
--
--   select relrowsecurity from pg_class where relname = 'survey_responses';
--   -- expected: true
--
--   select policyname, cmd from pg_policies where tablename = 'survey_responses';
--   -- expected: exactly one row, SELECT
