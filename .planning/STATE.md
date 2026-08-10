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
Last activity: 2026-08-10 — v1.3 scoped (grilling + edge case review); ManyChat
flow inventory captured (Notion Doc Hub); old Phase 15 superseded
Next code-ready work: Phase 16 (Email Design System), then v1.3 Phase 18 (SRC-01)

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
