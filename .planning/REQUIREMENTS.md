# Requirements: Hüseyin Ajuz Patient CRM

**Defined:** 2026-07-06 (reconstructed from CLAUDE.md + shipped behavior after GSD-3 state loss)
**Core Value:** Every patient's lifecycle state visible at a glance; no dropped leads or forgotten follow-ups.

## Shipped Requirements (v1.0 + v1.1 — validated in production)

### Patients

- [x] **PAT-01**: Patient CRUD with dual-mode form (create/edit)
- [x] **PAT-02**: Search + status/package filters on patient list
- [x] **PAT-03**: 9-state lifecycle machine with constrained transitions and optimistic concurrency
- [x] **PAT-04**: Kanban pipeline view across all lifecycle stages
- [x] **PAT-05**: Timestamped notes, cascade-delete with patient
- [x] **PAT-06**: File attachments via Supabase Storage (signed URLs, 1h expiry)

### Payments

- [x] **PAY-01**: Manual payment recording (amount, currency, method, date, reference)
- [x] **PAY-02**: Derived paid/partial/unpaid status vs PACKAGE_PRICES (computed at read time)
- [x] **PAY-03**: Filterable payments page + dashboard revenue summary

### Automation

- [x] **AUTO-01**: ManyChat webhook upserts leads (idempotent by manychat_id)
- [x] **AUTO-02**: Welcome email on new patient with email (opt-in toggle)
- [x] **AUTO-03**: Lifecycle reminder emails — blood test (14d), week-6 (42d), end review (7d)
- [x] **AUTO-04**: Lead follow-up emails — Day 3 / 7 / 12
- [x] **AUTO-05**: Auto-cold transition for leads stale >12 days
- [x] **AUTO-06**: Settings page with per-feature opt-in toggles (7 features)

### Auth

- [x] **AUTH-01**: Email/password login, redirect to dashboard on success
- [x] **AUTH-02**: Session persists across refresh (INITIAL_SESSION gate)
- [x] **AUTH-03**: RequireAuth layout guard; RLS on all tables

## v1.2 Requirements — Deliverability (scoped 2026-07-11)

### Email Deliverability (MAIL)

- [ ] **MAIL-01**: Automation emails are sent from `mrhus@huseyinacuz.com` —
      domain `huseyinacuz.com` verified on Resend (SPF/DKIM records in GoDaddy DNS),
      `send-email` sender switched, delivery confirmed to a real inbox (not spam)
- [ ] **MAIL-02**: Reminder emails survive missed cron runs — `last_reminder_sent_at`
      tracked per patient/feature; at-least-once delivery replaces 24h BETWEEN windows (D017 revisit)
- [ ] **MAIL-03**: Patient-facing emails have a professional identity — from-name
      "Hüseyin Ajuz", reply-to `mrhus@huseyinacuz.com`, consistent footer across all 7 templates
- [x] **MAIL-04**: Hüseyin's regular Google Workspace mail is SPF-protected —
      `v=spf1 include:_spf.google.com ~all` TXT added to `huseyinacuz.com`
      (domain currently has NO SPF record)

### Traceability

| Requirement | Phase |
|-------------|-------|
| MAIL-01 | Phase 13 |
| MAIL-02 | Phase 14 |
| MAIL-03 | Phase 13 |
| MAIL-04 | Phase 12 |

## v1.2 Requirements — Landing Page Drip Sequence (scoped 2026-07-15)

### Landing Page Lead Funnel (DRIP)

- [ ] ~~**DRIP-01**~~: **Superseded by SURV-01 (2026-08-10)** — direct JS POST
      replaced the Netlify webhook so the response can return a survey token
      synchronously for the survey redirect.
- [ ] **DRIP-02**: 4-step automated follow-up drip for landing page leads —
      Day 3 / Day 7 / Day 11 / Day 20. Each step is a separate email template.
      Timing measured from `created_at` of the lead record.
- [ ] **DRIP-03**: Day 20 email includes a preset discount offer —
      discount amount/code TBD by Hüseyin; template must stand out from
      earlier follow-ups (urgency framing, clear CTA).
- [ ] **DRIP-04**: Drip sequence stops when lead transitions out of `lead` state —
      if Hüseyin moves the patient to `contacted` or any later state,
      no further drip emails fire. Respects existing AUTO-05 cold logic.
- [ ] **DRIP-05**: Per-step opt-in toggles in Settings page —
      `drip_day3_enabled`, `drip_day7_enabled`, `drip_day11_enabled`,
      `drip_day20_enabled` columns on `practitioner_settings`. All OFF by default.

### Dependencies

| Requirement | Depends on |
|-------------|------------|
| DRIP-01 | MAIL-01 (custom domain — can't email real leads from sandbox) |
| DRIP-02 | DRIP-01, pg_cron infrastructure (already exists from AUTO-04) |
| DRIP-03 | DRIP-02, discount details from Hüseyin |
| DRIP-04 | DRIP-02, existing state machine |
| DRIP-05 | DRIP-02, existing settings page |

### Traceability

| Requirement | Phase |
|-------------|-------|
| DRIP-01 | Phase 15 |
| DRIP-02 | Phase 15 |
| DRIP-03 | Phase 15 |
| DRIP-04 | Phase 15 |
| DRIP-05 | Phase 15 |

### Open Questions — resolved 2026-08-10 (one remaining)

- Day 20 discount details — **still TBD by Hüseyin** (percentage/fixed/promo code)
- Email copy: we draft, Hüseyin approves (same pattern as v1.1 templates)
- ManyChat leads DO get the drip — condition is **has email + lifecycle = 'lead'**,
  source-agnostic. The survey supplies the email for ManyChat leads.
- Amendments: DRIP-02..05 moved to v1.3 Phase 22; DRIP-05 toggles live under the
  new `/email` route (not Settings); `auto_cold_leads` moves to day 22 so Day 20
  can fire; AUTO-04 lead follow-up is retired when the drip ships (same audience).

## v1.3 Requirements — Lead Intake & Nurture (scoped 2026-08-10)

### Lead Source (SRC)

- [x] **SRC-01**: Every patient carries a first-touch, immutable `source`
      (`manychat | landing_page | manual`) — DB CHECK + as-const union, backfill
      by `manychat_id` presence, patients list filter, funnel segmentation.

### Qualification Survey (SURV)

- [ ] **SURV-01**: Landing form submit creates a CRM lead (`source:
      'landing_page'`, email-deduped via partial unique index, never resets an
      existing patient's lifecycle) and returns a `survey_token`; browser
      redirects to `/survey?t=<token>`. Netlify Forms kept as fetch-failure
      fallback. (Absorbs DRIP-01.)
- [ ] **SURV-02**: Single hosted survey page (landing repo, EN, 8 questions +
      email capture) + survey-submit Edge Function — token-validated,
      server-side answer whitelist, `survey_responses` with `UNIQUE(patient_id)`
      + `survey_version` + stable `q_*` jsonb keys, atomic email backfill.
- [ ] **SURV-03**: CRM surfacing — survey-completed indicator (list + detail),
      raw answers on patient detail, `/surveys` responses list (source filter,
      newest first, patient links).
- [ ] **SURV-04**: ManyChat invite — CRM Lead Sync flow extended with External
      Request response mapping (`survey_token` → custom field) + immediate
      invite DM using the tokenized link. Raw `mc_id` never authorizes a
      submission. Includes renaming the 3 duplicate-named flows.

### Email Operations (MAIL)

- [ ] **MAIL-06**: `/email` route — send log viewer, manual per-patient
      template send (JWT path, server-side recipient check), and the 7 email
      toggles relocated from Settings (columns unchanged).

### Traceability

| Requirement | Phase |
|-------------|-------|
| SRC-01 | Phase 18 |
| SURV-01 | Phase 19 |
| SURV-02 | Phase 19 |
| SURV-03 | Phase 19 |
| SURV-04 | Phase 20 |
| MAIL-06 | Phase 21 |
| DRIP-02..05 | Phase 22 |

## Future Requirements (deferred to v1.4+)

- **CAL-01**: Appointment scheduling integration (Google Calendar or Calendly) —
      no specification yet; needs discuss session with Hüseyin (old R013)
- **DOC-01**: PDF protocol delivery/export — no protocol template exists;
      blocked on content from Hüseyin (old R014)
- **MSG-01**: ManyChat outbound messaging (WhatsApp/IG) — SEED-001; API key
      verified 2026-07-11, Pro account confirmed
- **WEB-01**: Landing page redesign — huseyinajuz.com on Netlify (R016, old M004);
      design groundwork already in development (Trichoscope Daylight, SEED-002/003)
- **Survey question editor**: CRM-managed survey questions (definition table,
      public fetch endpoint, response versioning) — schema future-proofed in
      SURV-02; build only if question churn becomes real

## Out of Scope

- DMARC policy record — optional hardening, ride-along candidate for v1.3
- PayPal/Stripe integration; mobile app; SaaS multi-tenant

---
*Requirement IDs re-keyed by category during GSD 1.6.1 migration; old R### numbers noted where known.*
