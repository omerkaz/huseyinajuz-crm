---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Deliverability & Landing Page Drip
status: in_progress
last_updated: "2026-08-10T00:00:00.000Z"
last_activity: 2026-08-10
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 5
  completed_plans: 5
  percent: 80
---

# Project State

**Last updated:** 2026-08-10
**Current milestone:** v1.2 Deliverability (in progress — Phase 16 remaining)
**Next milestone:** v1.3 Lead Intake & Nurture (scoped 2026-08-10)

## Current Position

Phase: 17 — Package Price Management (DONE 2026-07-19)
Plans: 12-01 ✅, 13-01 ✅, 14-01 ✅, 14-02 ✅, 17-01 ✅
Status: PRICE-01 complete — prices editable, agreed_price live, 26 tests pass
Last activity: 2026-08-11 — Phase 16 implemented (delegated agent) and
send-email v4 DEPLOYED to live (function ACTIVE, 401 on unauthenticated).
Phase 16 not yet closed: real-inbox render checks pending, and an **email
style elegance pass is still needed** — current shell is a functional
baseline, not the final visual quality (must land before Phase 22 templates).
Phase 18 (SRC-01) DONE 2026-08-11: 4 commits, migration applied to live
(11 patients backfilled, 0 NULLs), manychat-webhook v7 deployed, smoke test
201 → source='manychat' verified → test row cleaned up.
⚠️ ANOMALY RESOLVED (2026-08-11): DB had ZERO manychat patients despite 25
CRM Lead Sync runs. Investigation (flow config capture + Vault secret compare
+ 24h edge/api logs) proved the pipeline healthy: a real IG lead 201'd at
18:29 Aug 10 and was manually DELETED from the CRM UI at 19:36 (two browser
DELETEs that evening). ManyChat leads are being deleted by hand — likely
mistaken for junk (phone 'unknown', no email). Open with Hüseyin: stop
deleting ManyChat leads / consider archive-instead-of-delete. Board card in
Reviewing.

## Meeting Outcomes (2026-08-11, Hüseyin)

- Deletion mystery CLOSED: he deletes empty ManyChat leads on purpose (no
  email/phone — nothing to work with). No archive feature wanted in the UI.
- D019 shipped the same day: `deleted_patients_archive` + BEFORE DELETE
  trigger live — DB silently retains every deleted patient (verified with
  live insert→delete→archive→cleanup cycle). UI unchanged.
- Survey/drip/secondary decisions move to the Notion decision ticket
  "KARAR: Anket + Drip — Hüseyin onayı (v1.3)" (restructured 2026-08-11 for practitioner UX: Turkish, 5 numbered questions, defaults + silence-accepts, WhatsApp-answerable; only the Day 20 discount is mandatory) — Hüseyin approves
  there; Phase 19 starts on approval.
- Email design: decided BY US (no practitioner input needed) — present the
  result. Render-test target: omerkazfd@gmail.com. Two live test sends
  delivered (welcome + blood test reminder, Resend sent:true, toggles
  flipped on→off around the sends).
## Hüseyin Approved (2026-08-11, in-card edits on the KARAR ticket)

- Survey: name-first + email-last (both mandatory), 7 content questions,
  EN-only; optional WhatsApp number added (silence-accepts). Age-range question
  KEPT (confirmed) — final survey is 9 questions, inserted before gender.
- Invite DM approved with his wording ("...understand your problem and how
  I can help you").
- Discount: 20%, valid one month from send. Drip: Day 3/7 reminders,
  Day 11 + Day 20 BOTH carry the discount (DRIP-03 widened).
- Backfill of 12,809 old contacts: definitive no.
Phase 19 (SURV-01..03) DONE 2026-08-11: survey live at huseyinajuz.com/survey,
landing-lead + survey-submit functions deployed, migration applied, E2E
smoke-verified (create->submit->backfill->dedup->404), D019 extended with
survey snapshots. 70/70 tests.
Phase 20 (SURV-04) DONE 2026-08-11: webhook v8 returns survey_token;
ManyChat CRM Lead Sync flow published with response mapping (field 14861107)
+ tokenized Instagram invite DM (verified server-side via getFlowData);
3 duplicate flows renamed. Full ManyChat->survey chain live.
Phase 21 (MAIL-06) code complete 2026-08-12: /email route (send log viewer,
manual template send, 7 toggles relocated from Settings), send-email v5
deployed (recipient authorization + JWT-only 'manual' feature bypassing
toggle gates). Auth matrix smoke-verified; UI click-through by Ömer pending.
Known deferral: browser-triggered sends don't write log rows (Phase 22 item).
Next code-ready work: v1.3 Phase 22 (drip — last phase); email elegance pass
ride-along

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 12 | Domain & DNS Verification | ✅ Done (domain verified, API key valid) |
| 13 | Verified Sender Identity | ✅ Done (human-verified 2026-07-19) |
| 14 | Reliable Reminders | ✅ Executed (migration applied to live DB) |
| 15 | Landing Page Drip Sequence | ⏳ Pending (blocked on Hüseyin's input) |
| 16 | Email Design System | 🔜 Unblocked (next-eligible) |
| 17 | Package Price Management | ✅ Done (PRICE-01, 2026-07-19) |

## Verified Production State (2026-07-06)

- Login → dashboard → settings verified in browser against live backend
- Webhook: 201 + correct `created_by` attribution (RLS-visible)
- Email chain: cron fn → toggle gate → Vault → net.http_post → send-email → Resend `sent:true`
- All 7 email toggles OFF (opt-in) — Hüseyin enables via Settings when ready
- Auth user: `mrhus@huseyinacuz.com` (UUID `a0e60f0f-77f9-417f-9c74-9aa4c285cf6b`)
- Repo `main` in sync with origin; build passes

## ManyChat Acquisition ACTIVATED (2026-08-01)

- ManyChat automation **"CRM Lead Sync"** set LIVE (flow builder, account fb4605315):
  trigger `Contact Event → New contact created` → action `Make External Request`
  POST → `manychat-webhook` Edge Function, `Authorization: Bearer <WEBHOOK_SECRET>`,
  body = Full Contact Data (top-level `id`/`first_name`/`last_name`/`email`/`phone`/
  `ig_username`/`gender`/`language` match the webhook contract; extras ignored)
- Test Request verified: 201 `{"status":"created","manychat_id":"314573794"}`;
  DB row confirmed (Ali Rana, lifecycle `lead`, correct `created_by` attribution)
- Covers ALL entry points (24 auto-DM flows + future ones + TikTok) — no per-flow edits
- Only contacts created AFTER activation sync; the 12,809 pre-existing contacts do not
  (backfill would be a separate task). IG contacts arrive with `phone: null` →
  stored as `unknown`; `language: null` → defaults `tr`

## v1.3 Scoped: Lead Intake & Nurture (2026-08-10)

- Method: grilling session (3 rounds) + Gemini/GPT edge case review
- Phases 18–22: source tag → survey (landing-hosted, tokenized) → ManyChat
  invite (response-mapped token, NOT raw mc_id) → /email route (toggles move
  there) → drip (email-gated, source-agnostic; auto_cold → day 22; AUTO-04
  retired on ship)
- Facts that shaped it: landing form is Netlify-Forms-only today; IG leads
  arrive email-less (ManyChat flows captured 0 emails) — survey is the email
  gate that makes ManyChat leads drippable
- Artifacts: ROADMAP v1.3 section, REQUIREMENTS v1.3 section,
  docs/diagrams/lead-intake-nurture.html, Notion "ManyChat Flow Inventory"

## Accumulated Context

### Roadmap Evolution
- Phase 17 added: Package Price Management (PRICE-01)
- Phase 17 executed: 5 commits, 26 tests pass, migration live
- 2026-08-10: drip moved v1.2→v1.3; old v1.3 candidates → v1.4

- Edge Function env has NO `PRACTITIONER_USER_ID` — functions resolve the
  practitioner from the `practitioner_settings` row (D015). Setting the env var
  requires `supabase login` (Management API scope `edge_functions_secrets_write`
  is missing from the MCP OAuth token).

- Vault secrets (authoritative): `WEBHOOK_SECRET`, `RESEND_API_KEY`,
  `SUPABASE_FUNCTIONS_URL`, `PRACTITIONER_USER_ID` (correct UUID; `_V2` deleted)

- `supabase/schema.sql` is the single source of truth and matches the live DB
  (migration `fix_cron_email_functions` applied 2026-07-06)

- GitHub remote is misnamed `deal-calculator` — rename someday
- Dev app runs on tmux `pit-18:app` at http://localhost:5174 (5173 occupied)

## Tooling Migration (2026-07-06)

GSD-3 (`gsd-pi` TUI) was removed during malware remediation; `~/.gsd/` state was
lost. Now on **GSD 1.6.1** (`~/.claude/gsd-core/`, workflow-based, `.planning/`
in-repo). Planning docs reconstructed from CLAUDE.md + git history + verified
session evidence. `from-gsd2` auto-migration was impossible (source deleted).
