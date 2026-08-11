# Roadmap: Hüseyin Ajuz Patient CRM

**Migrated:** 2026-07-06 from GSD-3 milestone structure (M001/M002 → v1.0/v1.1)
**Current milestone:** v1.2 Deliverability & Landing Page Drip (scoped 2026-07-11, DRIP added 2026-07-15)

## Milestones

- ✅ **v1.0 — Core Patient Management CRM** (was M001) — SHIPPED. 6 slices:
  schema+auth, patient CRUD, lifecycle machine, payments, notes/files,
  dashboard+pipeline. Archived: `milestones/v1.0-core-crm.md`

- ✅ **v1.1 — Automation & Polish** (was M002) — SHIPPED + hardened. 5 slices:
  polish/deploy, Resend+settings, welcome email, lifecycle reminders, lead
  follow-up. Post-ship hardening pass (2026-07-06) fixed 6 broken cron
  functions and verified the email chain end-to-end in production.
  Archived: `milestones/v1.1-automation-polish.md`

- 🔄 **v1.2 — Deliverability** — IN PROGRESS. Phases 12–14, 16, 17 below.
  Remaining: Phase 16 (Email Design System). The drip (old Phase 15) moved to
  v1.3 on 2026-08-10 — see Phase 15 supersession note.
- 🔜 **v1.3 — Lead Intake & Nurture** — SCOPED 2026-08-10 (grilling session +
  two-model edge case review). Phases 18–22 below.
- 💤 **v1.4 — Patient Communication & Scheduling** (candidates: CAL-01, DOC-01,
  MSG-01/SEED-001, WEB-01, survey question editor, DMARC ride-along)

## v1.2 Phases

### Phase 12: Domain & DNS Verification

**Goal:** `huseyinacuz.com` is a verified Resend sending domain and Hüseyin's
regular Google Workspace mail is SPF-protected.

**Requirements:** MAIL-04 (MAIL-01 groundwork; completes in Phase 13)

**Scope:**

- Add `huseyinacuz.com` as a domain in Resend (region: default)
- Add Resend's records in GoDaddy DNS: `send.` subdomain MX + SPF TXT
  (Return-Path), `resend._domainkey` DKIM TXT

- Add missing Google Workspace SPF: TXT `@` → `v=spf1 include:_spf.google.com ~all`
- Wait for propagation, trigger verification in Resend

**Success criteria:**

1. Resend dashboard shows `huseyinacuz.com` **Verified** (SPF + DKIM green)
2. `dig` confirms all 3 Resend records + the Google SPF record are live
3. Hüseyin's Google mailbox mail flow is undisrupted (MX untouched)

### Phase 13: Verified Sender Identity

**Goal:** Every automation email is sent from
`"Hüseyin Ajuz" <mrhus@huseyinacuz.com>` with a professional, consistent
identity — and lands in the inbox, not spam.

**Requirements:** MAIL-01, MAIL-03

**Scope:**

- `send-email` Edge Function v3: sender switch from `onboarding@resend.dev`,
  from-name "Hüseyin Ajuz", reply-to `mrhus@huseyinacuz.com`

- Consistent footer across all 7 email templates
- End-to-end test of each of the 7 features to a real inbox
- Deploy via deploy-helper; verify toggles still gate sends

**Success criteria:**

1. Each of the 7 email features delivers to a real inbox — headers show
   SPF/DKIM **pass**, message not in spam

2. From-name, reply-to, and footer consistent across all templates
3. Toggle OFF = zero sends (regression check)

### Phase 14: Reliable Reminders

**Goal:** Reminder emails survive missed cron runs — at-least-once delivery
replaces the fragile 24h BETWEEN windows (D017 revisit).

**Requirements:** MAIL-02

**Scope:**

- Schema: track `last_reminder_sent_at` per patient per reminder feature
  (design decision in-phase: columns vs tracking table)

- Rewrite cron functions: "past window AND not yet sent" instead of BETWEEN
- Migration applied to live DB; `schema.sql` kept in exact sync

**Success criteria:**

1. Missed-cron catch-up: an overdue patient with no recorded send receives
   exactly one email on the next run

2. No duplicate reminders on normal consecutive runs
3. `schema.sql` matches live DB after migration

### Phase 15: Landing Page Drip Sequence

> **SUPERSEDED (2026-08-10):** never executed. DRIP-01 (form → lead) was absorbed
> into v1.3 SURV-01 (direct POST replaces the Netlify webhook so the response can
> return a survey token). The drip itself (DRIP-02..05) moved to v1.3 Phase 22
> with amended conditions. Section kept for history.

**Goal:** Landing page form submissions automatically enter the CRM as leads
and receive a 4-step email drip (Day 3 / 7 / 11 / 20) with a discount offer
on the final step — stopping when the lead advances past `lead` state.

**Requirements:** DRIP-01, DRIP-02, DRIP-03, DRIP-04, DRIP-05

**Dependencies:** Phase 13 (MAIL-01 — can't email from sandbox), existing
pg_cron infrastructure (AUTO-04)

**Scope:**

- Edge Function: Netlify form webhook → patient upsert with `source: 'landing_page'`
  (idempotent by email, analogous to manychat-webhook)

- 4 email templates: Day 3, Day 7, Day 11, Day 20 (discount/urgency CTA)
- pg_cron function(s): timing from `created_at`, skip if `lifecycle_state != 'lead'`
- Schema: `source` column on patients (or equivalent), `drip_day*_enabled`
  toggles on `practitioner_settings`

- Settings page: 4 new toggles for drip steps (all OFF by default)

**Open questions (need Hüseyin's input):**

- Day 20 discount details (percentage, fixed amount, or promo code)
- Email copy/tone for each step — draft for approval?
- Should ManyChat leads also get this drip, or landing page only?

**Success criteria:**

1. Netlify form → Edge Function → patient created with `source: 'landing_page'`
2. Each drip step fires on schedule for `lead`-state landing page patients
3. Drip stops when lead transitions to `contacted` or later
4. Per-step toggles in Settings; all OFF by default
5. Day 20 email has distinct discount/urgency design

### Phase 16: Email Design System

> **STATUS (2026-08-11):** send-email v4 deployed to live (branded shell,
> table layout, dark mode, plain-text parity; tsc/test/lint green; headless
> Chrome render verified). Remaining: real-inbox render checks (Gmail/Apple
> Mail/Outlook/iOS dark) and SPF/DKIM spot-check. **Known gap: the current
> shell is a functional baseline — an elegance pass (typography rhythm,
> spacing, visual refinement toward the CRM's warm editorial feel) is still
> wanted before Phase 22 drip templates adopt it.**

**Goal:** Emails look professionally designed and on-brand — not bare
paragraphs — while staying deliverability-safe across major clients.

**Requirements:** MAIL-05

**Dependencies:** Phase 13 (v3 chokepoint footer is the injection point)

**Scope:**

- Branded HTML wrapper template: header (name/wordmark), content slot, footer
  — injected at the send-email chokepoint (extends the v3 footer pattern)

- Design-token alignment with CRM design system (linen bg, cream surface,
  teal accents, charcoal text) using email-safe approximations; font stacks
  for email clients (DM Serif/Inter won’t load — define safe fallbacks)

- Email-client compatibility: table-based layout for Outlook, dark-mode
  meta/media queries, mobile responsiveness (max-width pattern)

- Plain-text parity maintained (text footer already handled by v3)
- Spam-safety: text/image ratio, no heavy images, keep SPF/DKIM-clean sending
- Applies to existing 7 templates + sets pattern for Phase 15 drip templates

**Positioning:** Unblocked now. Phase 15 drip templates (esp. DRIP-05
“distinct discount/urgency design”) should adopt the Phase 16 design system.

**Success criteria:**

1. All 7 existing emails render with branded wrapper (header + styled footer)
2. Renders correctly in Gmail, Apple Mail, Outlook (table-based fallback)
3. Dark-mode doesn’t break readability
4. SPF/DKIM still pass; spam score unchanged or improved
5. Design tokens documented for Phase 15 drip template authors

## Requirement Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MAIL-01 | 13 | Done |
| MAIL-02 | 14 | Done |
| MAIL-03 | 13 | Done |
| MAIL-04 | 12 | Done |
| MAIL-05 | 16 | Pending |
| DRIP-01 | 15 | Superseded by SURV-01 |
| DRIP-02 | 22 | Pending |
| DRIP-03 | 22 | Pending |
| DRIP-04 | 22 | Pending |
| DRIP-05 | 22 | Pending (toggles live in /email route, not Settings) |
| PRICE-01 | 17 | Done |
| SRC-01 | 18 | Done (2026-08-11, live-verified) |
| SURV-01 | 19 | Done (2026-08-11, live-verified) |
| SURV-02 | 19 | Done (2026-08-11, live-verified) |
| SURV-03 | 19 | Done (2026-08-11, live-verified) |
| SURV-04 | 20 | Done (2026-08-11, published + verified) |
| MAIL-06 | 21 | Pending |

## Phase Numbering

Phases 1–11 consumed by v1.0 (1–6) and v1.1 (7–11) under the old slice
structure. v1.2 continues at 12–17 (15 superseded, never executed). v1.3
continues at 18–22.

## Context Loss Note

Detailed slice plans and verification records for v1.0/v1.1 lived in `~/.gsd/`
(GSD-3) and were deleted during malware remediation on 2026-07-06. The shipped
code, git history, CLAUDE.md, and `milestones/` archives are the surviving
record. All planning artifacts are now committed in-repo.

### Phase 17: Package Price Management

**Goal:** Make package prices editable data (not hard-coded constants), snapshot
an `agreed_price` per patient at package assignment, and update the payment
status derivation so historical fully-paid patients remain correct while new
sales use the updated prices ($297/$497/$797).

**Requirements:** PRICE-01

**Dependencies:** None (no code dependency on Phases 12–16; schema migration only)

**Scope:**
- Add price columns to `practitioner_settings` (D014 single-row pattern)
- Add `agreed_price numeric(10,2)` column to `patients` table
- Migration: backfill `agreed_price` from OLD prices for existing patients
- Update `getPatientPaymentSummary` derivation: target = agreed_price ?? current_price
- Settings page: "Package Prices" card (edit 3 tier prices)
- PatientFormPage: snapshot price on package assignment, allow editing agreed_price
- Reconcile all PACKAGE_PRICES usages; update/extend tests

**Success criteria:**
1. Prices editable in Settings UI; persisted to `practitioner_settings`
2. `agreed_price` snapshotted from current price when package is assigned
3. Historical payment statuses provably unchanged (before/after evidence query)
4. New sales compute against new prices
5. `npx tsc -b` clean + `npm test` green
6. `schema.sql` matches live DB after migration

## v1.3 Phases — Lead Intake & Nurture (scoped 2026-08-10)

**Scoping method:** grilling session (3 rounds) + edge case review (Gemini 3.1 +
GPT 5.4). Target architecture diagram: `docs/diagrams/lead-intake-nurture.html`.
ManyChat account audit snapshot: Notion Document Hub "ManyChat Flow Inventory
(2026-08-10)" — 23 post-based Auto-DM flows (all one easy-builder template,
acquisition, untouched) + CRM Lead Sync. Sequences empty; no nurture overlap.

**Key decisions:**

- `source` is **first-touch and immutable** (`manychat | landing_page | manual`)
- Survey is a **single hosted page** in the landing repo (`huseyinajuz.com/survey`),
  English-only, ~8 qualification questions + email capture; ManyChat delivers a
  tokenized link, landing redirects to it after form submit
- **Token, not mc_id:** manychat-webhook response returns `survey_token`; the
  CRM Lead Sync flow maps it to a custom field via External Request response
  mapping and the invite DM uses it — raw `mc_id` is guessable and never
  authorizes a submission (edge-case review, both models)
- Lead is born at **form submit** (survey abandonment keeps the contact);
  landing form JS POSTs directly to an Edge Function (sync token return),
  Netlify Forms kept as fallback capture on fetch failure
- Survey completion sets an **indicator only** — lifecycle is never
  auto-advanced; `contacted` stays a human action
- Drip condition is **has email AND lifecycle = 'lead'** (source-agnostic);
  the survey is what makes ManyChat leads drippable (IG contacts arrive
  email-less; ManyChat flows have captured 0 emails)
- `auto_cold_leads` moves from day 12 to **day 22** so Day 20 can fire
  (D018 revision); v1.1 lead follow-up emails (AUTO-04, day 3/7/12) are
  **retired when the drip ships** — same audience, double-send otherwise
- Email toggles (7 existing + 4 drip) move from Settings to the new
  **/email route** (user decision, overrides keep-in-Settings recommendation)
- Question editor deferred to v1.4; schema future-proofed instead
  (stable answer keys `q_*` in jsonb + `survey_version` column)

### Phase 18: Lead Source Tag (SRC-01)

- `patients.source text NOT NULL CHECK (source IN ('manychat','landing_page','manual'))`
- Backfill: `manychat_id IS NOT NULL → 'manychat'`, else `'manual'`
- manychat-webhook sets `'manychat'`; manual form sets `'manual'`
- `LEAD_SOURCES` as-const union in `types/database.ts`
- Patients list filter + funnel segmentation by source

### Phase 19: Shared Qualification Survey (SURV-01, SURV-02, SURV-03)

- **SURV-01** — landing form → Edge Function: creates patient
  (`source: 'landing_page'`, dedup by `lower(email)` partial unique index,
  never resets lifecycle of an existing patient), returns `survey_token`,
  JS redirects to `/survey?t=<token>`; Netlify Forms fallback on fetch failure
- **SURV-02** — `/survey` static page in landing repo (EN; question set
  APPROVED by Hüseyin 2026-08-11: 1 name+surname mandatory, 2 duration,
  3 area, 4 recent blood test, 5 gender, 6 prior treatments, 7 readiness,
  8 email mandatory LAST, + optional WhatsApp number; age-range KEPT —
  confirmed 2026-08-11, inserted before gender → final set is 9 questions:
  name / duration / area / blood test / age range / gender / treatments /
  readiness / email+WhatsApp) + survey-submit Edge Function: validates token, whitelists
  answer keys/values server-side, upserts `survey_responses`
  (`UNIQUE(patient_id)`, `survey_version`), atomic email backfill
  (`UPDATE … WHERE email IS NULL`), skeleton patient on webhook race
- **SURV-03** — CRM surfacing: "survey completed" indicator (list + detail),
  raw answers on patient detail, `/surveys` responses list route
  (newest first, source filter, link to patient)
- Hardening from review: CORS/OPTIONS for huseyinajuz.com, rate limiting,
  payload size limits, Referrer-Policy on survey page

### Phase 20: ManyChat Survey Invite (SURV-04)

- Extend the live CRM Lead Sync flow: External Request response mapping
  (`survey_token` → custom field) + invite DM step with tokenized link
  `?t={{survey_token}}&src=manychat` — immediate on new contact
- Rename the 3 identically-named "Auto-DM links from comments" flows (hygiene)
- Built via dev-browser against the ManyChat account

### Phase 21: Email Route (MAIL-06)

- New `/email` route: `email_send_log` viewer + manual per-patient template
  send (existing send-email JWT path, server-side recipient check)
- Move the 7 email toggles from Settings to `/email` (UI relocation;
  `practitioner_settings` columns unchanged) — drip toggles will be born here
- Ordered before the drip so its toggles land in their final home

### Phase 22: Drip Sequence (DRIP-02..05 amended)

- Day 3 / 7 / 11 / 20 emails — APPROVED structure (2026-08-11): Day 3/7 plain
  reminders; Day 11 AND Day 20 carry the discount: **20%, valid for one month
  from send date** (Hüseyin's decision — DRIP-03 covers both discount steps)
- Condition: has email AND `lifecycle_state = 'lead'`; stops on any transition
- At-least-once accounting via existing `email_send_log` pattern
- Survey CTA in drip emails when survey not completed
- `auto_cold_leads` → day 22; retire AUTO-04 lead follow-up (supersession)
- Per-step toggles (OFF by default) under `/email`; templates use Phase 16
  design system
