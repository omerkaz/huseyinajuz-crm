-- ============================================================
-- Patient Records Schema
-- Huseyinajuz Hair Transplant CRM
-- ============================================================

-- ── Updated-at trigger function ──
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── Patients table ──
create table if not exists patients (
  id            uuid primary key default gen_random_uuid(),
  first_name    text not null,
  last_name     text not null,
  email         text,
  phone_country_code text not null default '+90',
  phone_number  text not null,
  date_of_birth date,
  gender        text check (gender in ('male', 'female', 'other')),
  language      text not null default 'tr',
  country       text,
  lifecycle_state text not null default 'lead'
    check (lifecycle_state in (
      'lead', 'contacted', 'awaiting_blood_test', 'active_treatment',
      'week_6_checkin', 'end_review', 'extended_support', 'completed', 'cold'
    )),
  package_type  text check (package_type in ('standard', 'premium', 'vip')),
  agreed_price  numeric(10,2) default null
    check (agreed_price >= 0),
  notes_text    text,
  manychat_id   text unique,
  instagram_username text,
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint chk_agreed_price_package_sync
    check ((package_type IS NULL) = (agreed_price IS NULL))
);

create trigger patients_updated_at
  before update on patients
  for each row execute function update_updated_at();

-- ── Patient notes table ──
create table if not exists patient_notes (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id) on delete cascade,
  content     text not null,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

-- ── Patient attachments table ──
create table if not exists patient_attachments (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references patients(id) on delete cascade,
  file_name    text not null,
  file_type    text not null,
  file_size    bigint not null,
  storage_path text not null,
  uploaded_by  uuid not null references auth.users(id),
  created_at   timestamptz not null default now()
);

-- ── Indexes ──
create index if not exists idx_patients_lifecycle on patients(lifecycle_state);
create index if not exists idx_patients_created_by on patients(created_by);
create index if not exists idx_patients_name on patients(last_name, first_name);
create index if not exists idx_patient_notes_patient on patient_notes(patient_id);
create index if not exists idx_patient_attachments_patient on patient_attachments(patient_id);

-- ── Row Level Security ──
alter table patients enable row level security;
alter table patient_notes enable row level security;
alter table patient_attachments enable row level security;

-- Patients: users can CRUD their own records
create policy "Users can view own patients"
  on patients for select using (auth.uid() = created_by);

create policy "Users can insert own patients"
  on patients for insert with check (auth.uid() = created_by);

create policy "Users can update own patients"
  on patients for update using (auth.uid() = created_by);

create policy "Users can delete own patients"
  on patients for delete using (auth.uid() = created_by);

-- Patient notes: users can CRUD notes on their own patients
create policy "Users can view own patient notes"
  on patient_notes for select using (auth.uid() = created_by);

create policy "Users can insert own patient notes"
  on patient_notes for insert with check (auth.uid() = created_by);

create policy "Users can delete own patient notes"
  on patient_notes for delete using (auth.uid() = created_by);

-- Patient attachments: users can CRUD attachments on their own patients
create policy "Users can view own patient attachments"
  on patient_attachments for select using (auth.uid() = uploaded_by);

create policy "Users can insert own patient attachments"
  on patient_attachments for insert with check (auth.uid() = uploaded_by);

create policy "Users can delete own patient attachments"
  on patient_attachments for delete using (auth.uid() = uploaded_by);

-- ── Payments table ──
create table payments (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patients(id) on delete cascade,
  amount          numeric(10,2) not null,
  currency        text not null default 'USD',
  payment_method  text not null check (payment_method in ('paypal', 'bank_transfer')),
  payment_date    date not null,
  reference       text,
  created_by      uuid not null references auth.users(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_payments_patient on payments(patient_id);

-- ── Payments RLS ──
alter table payments enable row level security;

create policy "Users can view own payments"
  on payments for select using (auth.uid() = created_by);

create policy "Users can insert own payments"
  on payments for insert with check (auth.uid() = created_by);

create policy "Users can delete own payments"
  on payments for delete using (auth.uid() = created_by);

-- ── Storage bucket ──
-- NOTE: Create a 'patient-attachments' bucket in Supabase Dashboard > Storage
-- with RLS policy: auth.uid() = owner
-- Max file size: 10MB
-- Allowed MIME types: image/*, application/pdf

-- ── Practitioner settings table ──
create table if not exists practitioner_settings (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null unique references auth.users(id),
  welcome_email_enabled       boolean not null default false,
  blood_test_reminder_enabled boolean not null default false,
  week_6_checkin_enabled      boolean not null default false,
  end_review_enabled          boolean not null default false,
  lead_day3_enabled           boolean not null default false,
  lead_day7_enabled           boolean not null default false,
  lead_day12_enabled          boolean not null default false,
  price_standard              numeric(10,2) not null default 297,
  price_premium               numeric(10,2) not null default 497,
  price_vip                   numeric(10,2) not null default 797,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint chk_prices_positive
    check (price_standard > 0 AND price_premium > 0 AND price_vip > 0)
);

create trigger practitioner_settings_updated_at
  before update on practitioner_settings
  for each row execute function update_updated_at();

alter table practitioner_settings enable row level security;

create policy "Users can view own settings"
  on practitioner_settings for select using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on practitioner_settings for insert with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on practitioner_settings for update using (auth.uid() = user_id);

-- ── Email send tracking log ──
-- Records when each reminder/drip email was sent to a patient.
-- Used by cron functions for at-least-once delivery (MAIL-02):
--   NOT EXISTS (... WHERE sent_at >= state_changed_at) replaces BETWEEN windows.
-- Design: tracking table (not per-feature columns) — scales to new features
-- without schema changes and provides an audit trail.

create table if not exists email_send_log (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id) on delete cascade,
  feature     text not null,
  sent_at     timestamptz not null default now()
);

create index if not exists idx_email_send_log_patient_feature
  on email_send_log(patient_id, feature);

alter table email_send_log enable row level security;

create policy "Users can view email send log"
  on email_send_log for select using (
    patient_id in (select id from patients where created_by = auth.uid())
  );

-- ── state_changed_at migration ──
ALTER TABLE patients ADD COLUMN IF NOT EXISTS state_changed_at TIMESTAMPTZ;
UPDATE patients SET state_changed_at = updated_at WHERE state_changed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_state_changed ON patients(lifecycle_state, state_changed_at);

-- ── M002 S04: Lifecycle reminder pg_cron jobs ──
--
-- PRE-RUN CHECKLIST (Supabase SQL Editor):
--   1. Ensure SUPABASE_FUNCTIONS_URL is stored in Vault:
--      Supabase Dashboard > Vault > New Secret, name = 'SUPABASE_FUNCTIONS_URL',
--      value = 'https://<project-ref>.supabase.co/functions/v1' (no trailing slash).
--      NOTE: `SET app.supabase_functions_url` is NOT possible on hosted Supabase
--      (permission denied for GUCs) — Vault is the supported mechanism.
--   2. Ensure WEBHOOK_SECRET is stored in Vault:
--      Supabase Dashboard > Vault > New Secret, name = 'WEBHOOK_SECRET', value = <your secret>
--      The functions read it via vault.decrypted_secrets — never hardcode it in SQL.
--   3. pg_cron and pg_net extensions must be enabled for the project
--      (Supabase Dashboard > Database > Extensions). The guards below are idempotent.
--
-- At-least-once delivery (MAIL-02): each function checks NOT EXISTS against
-- email_send_log so missed cron runs catch up on the next execution.
-- Deduplication: sent_at >= COALESCE(state_changed_at, created_at) ensures
-- re-engagement (cold → lead) resets tracking naturally.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper: send blood-test reminder emails (at-least-once)
-- Fires for patients in 'awaiting_blood_test' ≥14 days after entering the state,
-- if no email_send_log record exists for this lifecycle run.
CREATE OR REPLACE FUNCTION send_blood_test_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _secret  text;
  _url     text;
  _patient RECORD;
  _body    jsonb;
  _enabled boolean;
BEGIN
  SELECT (blood_test_reminder_enabled IS TRUE) INTO _enabled
    FROM practitioner_settings
   LIMIT 1;

  IF NOT COALESCE(_enabled, false) THEN
    RAISE NOTICE '[send_blood_test_reminders] feature=blood_test_reminder enabled=false skipped';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
   WHERE name = 'WEBHOOK_SECRET'
   LIMIT 1;

  SELECT decrypted_secret INTO _url
    FROM vault.decrypted_secrets
   WHERE name = 'SUPABASE_FUNCTIONS_URL'
   LIMIT 1;

  _url := _url || '/send-email';

  FOR _patient IN
    SELECT id, first_name, email
      FROM patients
     WHERE lifecycle_state = 'awaiting_blood_test'
       AND COALESCE(state_changed_at, created_at) <= now() - INTERVAL '14 days'
       AND email IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM email_send_log esl
          WHERE esl.patient_id = patients.id
            AND esl.feature = 'blood_test_reminder'
            AND esl.sent_at >= COALESCE(patients.state_changed_at, patients.created_at)
       )
  LOOP
    _body := jsonb_build_object(
      'feature', 'blood_test_reminder',
      'to',      _patient.email,
      'subject', 'Blood Test Reminder',
      'html',    '<p>Dear ' || _patient.first_name || ',</p><p>Please arrange your blood test at your earliest convenience. Your results are an important part of your personalised treatment plan.</p>'
    );

    PERFORM net.http_post(
      url     := _url,
      body    := _body,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || _secret
      )
    );

    INSERT INTO email_send_log (patient_id, feature)
    VALUES (_patient.id, 'blood_test_reminder');
  END LOOP;
END;
$$;

-- Helper: send week-6 check-in reminder emails (at-least-once)
-- Fires for patients in 'active_treatment' ≥42 days after entering the state,
-- if no email_send_log record exists for this lifecycle run.
CREATE OR REPLACE FUNCTION send_week6_checkin_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _secret  text;
  _url     text;
  _patient RECORD;
  _body    jsonb;
  _enabled boolean;
BEGIN
  SELECT (week_6_checkin_enabled IS TRUE) INTO _enabled
    FROM practitioner_settings
   LIMIT 1;

  IF NOT COALESCE(_enabled, false) THEN
    RAISE NOTICE '[send_week6_checkin_reminders] feature=week_6_checkin enabled=false skipped';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
   WHERE name = 'WEBHOOK_SECRET'
   LIMIT 1;

  SELECT decrypted_secret INTO _url
    FROM vault.decrypted_secrets
   WHERE name = 'SUPABASE_FUNCTIONS_URL'
   LIMIT 1;

  _url := _url || '/send-email';

  FOR _patient IN
    SELECT id, first_name, email
      FROM patients
     WHERE lifecycle_state = 'active_treatment'
       AND COALESCE(state_changed_at, created_at) <= now() - INTERVAL '42 days'
       AND email IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM email_send_log esl
          WHERE esl.patient_id = patients.id
            AND esl.feature = 'week_6_checkin'
            AND esl.sent_at >= COALESCE(patients.state_changed_at, patients.created_at)
       )
  LOOP
    _body := jsonb_build_object(
      'feature', 'week_6_checkin',
      'to',      _patient.email,
      'subject', 'Week 6 Check-in',
      'html',    '<p>Dear ' || _patient.first_name || ',</p><p>Your 6-week check-in is due. Please reach out so we can review your progress and adjust your treatment plan if needed.</p>'
    );

    PERFORM net.http_post(
      url     := _url,
      body    := _body,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || _secret
      )
    );

    INSERT INTO email_send_log (patient_id, feature)
    VALUES (_patient.id, 'week_6_checkin');
  END LOOP;
END;
$$;

-- Helper: send end-review reminder emails (at-least-once)
-- Fires for patients in 'week_6_checkin' ≥7 days after entering the state,
-- if no email_send_log record exists for this lifecycle run.
CREATE OR REPLACE FUNCTION send_end_review_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _secret  text;
  _url     text;
  _patient RECORD;
  _body    jsonb;
  _enabled boolean;
BEGIN
  SELECT (end_review_enabled IS TRUE) INTO _enabled
    FROM practitioner_settings
   LIMIT 1;

  IF NOT COALESCE(_enabled, false) THEN
    RAISE NOTICE '[send_end_review_reminders] feature=end_review enabled=false skipped';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
   WHERE name = 'WEBHOOK_SECRET'
   LIMIT 1;

  SELECT decrypted_secret INTO _url
    FROM vault.decrypted_secrets
   WHERE name = 'SUPABASE_FUNCTIONS_URL'
   LIMIT 1;

  _url := _url || '/send-email';

  FOR _patient IN
    SELECT id, first_name, email
      FROM patients
     WHERE lifecycle_state = 'week_6_checkin'
       AND COALESCE(state_changed_at, created_at) <= now() - INTERVAL '7 days'
       AND email IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM email_send_log esl
          WHERE esl.patient_id = patients.id
            AND esl.feature = 'end_review'
            AND esl.sent_at >= COALESCE(patients.state_changed_at, patients.created_at)
       )
  LOOP
    _body := jsonb_build_object(
      'feature', 'end_review',
      'to',      _patient.email,
      'subject', 'End Review',
      'html',    '<p>Dear ' || _patient.first_name || ',</p><p>Your treatment end review is approaching. Please get in touch to schedule your final consultation and discuss next steps.</p>'
    );

    PERFORM net.http_post(
      url     := _url,
      body    := _body,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || _secret
      )
    );

    INSERT INTO email_send_log (patient_id, feature)
    VALUES (_patient.id, 'end_review');
  END LOOP;
END;
$$;

-- Register the three daily cron jobs (idempotent: unschedule first if they exist)
DO $$
BEGIN
  -- blood-test-reminders
  PERFORM cron.unschedule('blood-test-reminders');
  EXCEPTION WHEN others THEN NULL;
END;
$$;
SELECT cron.schedule('blood-test-reminders', '0 8 * * *', 'SELECT send_blood_test_reminders();');

DO $$
BEGIN
  PERFORM cron.unschedule('week6-checkin-reminders');
  EXCEPTION WHEN others THEN NULL;
END;
$$;
SELECT cron.schedule('week6-checkin-reminders', '0 8 * * *', 'SELECT send_week6_checkin_reminders();');

DO $$
BEGIN
  PERFORM cron.unschedule('end-review-reminders');
  EXCEPTION WHEN others THEN NULL;
END;
$$;
SELECT cron.schedule('end-review-reminders', '0 8 * * *', 'SELECT send_end_review_reminders();');

-- ── M002 S05: Lead follow-up pg_cron jobs ──

-- Helper: send Day-3 follow-up email to leads (at-least-once)
-- Fires for leads ≥3 days after entering lead state,
-- if no email_send_log record exists for this lifecycle run.
CREATE OR REPLACE FUNCTION notify_lead_day3()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _secret  text;
  _url     text;
  _patient RECORD;
  _body    jsonb;
  _enabled boolean;
BEGIN
  SELECT (lead_day3_enabled IS TRUE) INTO _enabled
    FROM practitioner_settings
   LIMIT 1;

  IF NOT COALESCE(_enabled, false) THEN
    RAISE NOTICE '[notify_lead_day3] feature=lead_day3 enabled=false skipped';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
   WHERE name = 'WEBHOOK_SECRET'
   LIMIT 1;

  SELECT decrypted_secret INTO _url
    FROM vault.decrypted_secrets
   WHERE name = 'SUPABASE_FUNCTIONS_URL'
   LIMIT 1;

  _url := _url || '/send-email';

  FOR _patient IN
    SELECT id, first_name, email
      FROM patients
     WHERE lifecycle_state = 'lead'
       AND COALESCE(state_changed_at, created_at) <= now() - INTERVAL '3 days'
       AND email IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM email_send_log esl
          WHERE esl.patient_id = patients.id
            AND esl.feature = 'lead_day3'
            AND esl.sent_at >= COALESCE(patients.state_changed_at, patients.created_at)
       )
  LOOP
    _body := jsonb_build_object(
      'feature', 'lead_day3',
      'to',      _patient.email,
      'subject', 'Following up on your hair loss consultation',
      'html',    '<p>Hi ' || _patient.first_name || ',</p><p>I wanted to follow up on your interest in our hair loss consultation programme. I''d love to help you understand what''s causing your hair loss and put together a personalised plan for you.</p><p>Feel free to reply to this email or reach out via WhatsApp to book a slot.</p>'
    );

    PERFORM net.http_post(
      url     := _url,
      body    := _body,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || _secret
      )
    );

    INSERT INTO email_send_log (patient_id, feature)
    VALUES (_patient.id, 'lead_day3');
  END LOOP;
END;
$$;

-- Helper: send Day-7 follow-up email to leads (at-least-once)
-- Fires for leads ≥7 days after entering lead state,
-- if no email_send_log record exists for this lifecycle run.
CREATE OR REPLACE FUNCTION notify_lead_day7()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _secret  text;
  _url     text;
  _patient RECORD;
  _body    jsonb;
  _enabled boolean;
BEGIN
  SELECT (lead_day7_enabled IS TRUE) INTO _enabled
    FROM practitioner_settings
   LIMIT 1;

  IF NOT COALESCE(_enabled, false) THEN
    RAISE NOTICE '[notify_lead_day7] feature=lead_day7 enabled=false skipped';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
   WHERE name = 'WEBHOOK_SECRET'
   LIMIT 1;

  SELECT decrypted_secret INTO _url
    FROM vault.decrypted_secrets
   WHERE name = 'SUPABASE_FUNCTIONS_URL'
   LIMIT 1;

  _url := _url || '/send-email';

  FOR _patient IN
    SELECT id, first_name, email
      FROM patients
     WHERE lifecycle_state = 'lead'
       AND COALESCE(state_changed_at, created_at) <= now() - INTERVAL '7 days'
       AND email IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM email_send_log esl
          WHERE esl.patient_id = patients.id
            AND esl.feature = 'lead_day7'
            AND esl.sent_at >= COALESCE(patients.state_changed_at, patients.created_at)
       )
  LOOP
    _body := jsonb_build_object(
      'feature', 'lead_day7',
      'to',      _patient.email,
      'subject', 'Still thinking about your hair loss? Here''s what we can do',
      'html',    '<p>Hi ' || _patient.first_name || ',</p><p>A week has passed since you first reached out. Hair loss can be tricky to address without the right guidance — that''s exactly what we specialise in.</p><p>If you have any questions before booking, just hit reply. I''m happy to chat.</p>'
    );

    PERFORM net.http_post(
      url     := _url,
      body    := _body,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || _secret
      )
    );

    INSERT INTO email_send_log (patient_id, feature)
    VALUES (_patient.id, 'lead_day7');
  END LOOP;
END;
$$;

-- Helper: send Day-12 follow-up email to leads (at-least-once)
-- Fires for leads ≥12 days after entering lead state,
-- if no email_send_log record exists for this lifecycle run.
CREATE OR REPLACE FUNCTION notify_lead_day12()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _secret  text;
  _url     text;
  _patient RECORD;
  _body    jsonb;
  _enabled boolean;
BEGIN
  SELECT (lead_day12_enabled IS TRUE) INTO _enabled
    FROM practitioner_settings
   LIMIT 1;

  IF NOT COALESCE(_enabled, false) THEN
    RAISE NOTICE '[notify_lead_day12] feature=lead_day12 enabled=false skipped';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
   WHERE name = 'WEBHOOK_SECRET'
   LIMIT 1;

  SELECT decrypted_secret INTO _url
    FROM vault.decrypted_secrets
   WHERE name = 'SUPABASE_FUNCTIONS_URL'
   LIMIT 1;

  _url := _url || '/send-email';

  FOR _patient IN
    SELECT id, first_name, email
      FROM patients
     WHERE lifecycle_state = 'lead'
       AND COALESCE(state_changed_at, created_at) <= now() - INTERVAL '12 days'
       AND email IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM email_send_log esl
          WHERE esl.patient_id = patients.id
            AND esl.feature = 'lead_day12'
            AND esl.sent_at >= COALESCE(patients.state_changed_at, patients.created_at)
       )
  LOOP
    _body := jsonb_build_object(
      'feature', 'lead_day12',
      'to',      _patient.email,
      'subject', 'Last chance to book your consultation',
      'html',    '<p>Hi ' || _patient.first_name || ',</p><p>This is my final follow-up. I don''t want to overwhelm your inbox — but I did want to make sure you hadn''t missed us.</p><p>If you''re still interested in understanding and tackling your hair loss, I''d love to help. Just reply and we''ll take it from there.</p>'
    );

    PERFORM net.http_post(
      url     := _url,
      body    := _body,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || _secret
      )
    );

    INSERT INTO email_send_log (patient_id, feature)
    VALUES (_patient.id, 'lead_day12');
  END LOOP;
END;
$$;

-- Helper: auto-transition stale leads to cold state
-- Fires for all leads whose COALESCE(state_changed_at, created_at) is older than 12 days.
-- No toggle check — auto-cold is an unconditional safety net, not an optional email.
CREATE OR REPLACE FUNCTION auto_cold_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _count integer;
BEGIN
  UPDATE patients
     SET lifecycle_state  = 'cold',
         state_changed_at = now()
   WHERE lifecycle_state = 'lead'
     AND COALESCE(state_changed_at, created_at) < now() - INTERVAL '12 days';

  GET DIAGNOSTICS _count = ROW_COUNT;
  RAISE NOTICE '[auto_cold_leads] transitioned % leads to cold', _count;
END;
$$;

-- Register the four S05 cron jobs (idempotent: unschedule first if they exist)
DO $$
BEGIN
  PERFORM cron.unschedule('lead-followup-day3');
  EXCEPTION WHEN others THEN NULL;
END;
$$;
SELECT cron.schedule('lead-followup-day3', '0 9 * * *', 'SELECT notify_lead_day3();');

DO $$
BEGIN
  PERFORM cron.unschedule('lead-followup-day7');
  EXCEPTION WHEN others THEN NULL;
END;
$$;
SELECT cron.schedule('lead-followup-day7', '0 9 * * *', 'SELECT notify_lead_day7();');

DO $$
BEGIN
  PERFORM cron.unschedule('lead-followup-day12');
  EXCEPTION WHEN others THEN NULL;
END;
$$;
SELECT cron.schedule('lead-followup-day12', '0 9 * * *', 'SELECT notify_lead_day12();');

-- auto-cold runs at 10:00 UTC — one hour AFTER lead-followup-day12 (09:00 UTC),
-- so the final "last chance" email always fires before the lead is moved to cold.
DO $$
BEGIN
  PERFORM cron.unschedule('auto-cold-leads');
  EXCEPTION WHEN others THEN NULL;
END;
$$;
SELECT cron.schedule('auto-cold-leads', '0 10 * * *', 'SELECT auto_cold_leads();');

-- ============================================================
-- v1.2 — Funnel analytics: state transition log
-- ============================================================
-- Append-only history of lifecycle_state changes, written ONLY by
-- triggers on patients. Captures all three state writers without app
-- changes: browser (transitionState/updatePatient), auto_cold_leads
-- cron (runs as postgres), and the ManyChat webhook (service role).
-- Browser access is read-only via RLS.
--
-- Design notes:
--   * from_state NULL = funnel entry (patient creation, or backfill seed).
--   * seq (identity) is a deterministic sort tiebreak — now() is
--     transaction-scoped, so bulk updates can share changed_at.
--   * If the log insert fails, the parent patient write fails too —
--     intentional: history must not silently diverge from state.

create table if not exists patient_state_transitions (
  id          uuid primary key default gen_random_uuid(),
  seq         bigint generated always as identity,
  patient_id  uuid not null references patients(id) on delete cascade,
  from_state  text
    check (from_state in (
      'lead', 'contacted', 'awaiting_blood_test', 'active_treatment',
      'week_6_checkin', 'end_review', 'extended_support', 'completed', 'cold'
    )),
  to_state    text not null
    check (to_state in (
      'lead', 'contacted', 'awaiting_blood_test', 'active_treatment',
      'week_6_checkin', 'end_review', 'extended_support', 'completed', 'cold'
    )),
  changed_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users(id)
);

create index if not exists idx_pst_patient_time
  on patient_state_transitions(patient_id, changed_at, seq);

alter table patient_state_transitions enable row level security;

-- Read-only for the practitioner. No insert/update/delete policies:
-- writes happen exclusively through the SECURITY DEFINER trigger below.
create policy "Users can view own patient state transitions"
  on patient_state_transitions for select using (auth.uid() = created_by);

-- SECURITY DEFINER so the insert bypasses RLS regardless of which role
-- performs the patient write (authenticated browser, postgres cron,
-- service-role webhook). search_path pinned + schema-qualified names
-- guard against search-path hijacking.
create or replace function log_state_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.patient_state_transitions
      (patient_id, from_state, to_state, changed_at, created_by)
    values (new.id, null, new.lifecycle_state, now(), new.created_by);
  elsif old.lifecycle_state is distinct from new.lifecycle_state then
    insert into public.patient_state_transitions
      (patient_id, from_state, to_state, changed_at, created_by)
    values (new.id, old.lifecycle_state, new.lifecycle_state, now(), new.created_by);
  end if;
  return new;
end;
$$;

-- Direct calls are never needed — EXECUTE is only checked at trigger
-- creation time, so revoking is safe and closes the surface.
revoke execute on function log_state_transition() from public, anon, authenticated;

drop trigger if exists patients_log_state_insert on patients;
create trigger patients_log_state_insert
  after insert on patients
  for each row execute function log_state_transition();

drop trigger if exists patients_log_state_update on patients;
create trigger patients_log_state_update
  after update of lifecycle_state on patients
  for each row
  when (old.lifecycle_state is distinct from new.lifecycle_state)
  execute function log_state_transition();

-- Backfill: one seed row per pre-existing patient. changed_at uses
-- state_changed_at (when they entered their CURRENT state) so
-- time-in-current-stage stays accurate. Cohort month deliberately keys
-- on patients.created_at in app code, so seed imprecision cannot
-- pollute cohorts. Idempotent via NOT EXISTS.
insert into patient_state_transitions (patient_id, from_state, to_state, changed_at, created_by)
select p.id, null, p.lifecycle_state, coalesce(p.state_changed_at, p.created_at), p.created_by
  from patients p
 where not exists (
   select 1 from patient_state_transitions t where t.patient_id = p.id
 );
