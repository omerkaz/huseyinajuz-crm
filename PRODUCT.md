# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Hüseyin Ajuz — sole practitioner, a trichologist (hair loss consultant) running
an online practice via Instagram → ManyChat → WhatsApp. He is the only person
who ever sees or uses the CRM UI; patients never see it (confirmed). He uses
the CRM on **both desktop and phone** (confirmed), in between filming content
and holding WhatsApp consultations.

Secondary: Ömer (developer/maintainer) — builds and operates the system, not a
daily UI user.

## Product Purpose

Single-user patient management CRM. Replaces manual Google Drive / DM tracking
with structured lifecycle management (9-state pipeline), payment recording, and
automated email workflows. Success = every patient's lifecycle state visible at
a glance, zero dropped leads, zero forgotten follow-ups. The pipeline is the
practice.

## Positioning

A CRM purpose-built for one practitioner's exact funnel (Instagram → ManyChat →
WhatsApp → treatment programme), with a constrained 9-state lifecycle machine
and automation that mirrors how he actually works — not a generic multi-tenant
CRM adapted to fit.

## Operating Context

- Lead acquisition: Instagram (`huseyin_ajuz`, verified) → ManyChat webhook →
  CRM as `lead`; landing page form ingestion planned (v1.2 Phase 15).
- Consultations happen on WhatsApp; the CRM is the record-keeping and
  follow-up engine beside it.
- Instagram reach: videos typically 1,000–2,000 views (confirmed).
- Email automation via Resend from Supabase Edge Functions; pg_cron schedules.
- Solo operation: single `practitioner_settings` row is the practitioner
  registry.

## Capabilities and Constraints

- React 19 + TypeScript ~6.0 (`erasableSyntaxOnly` — no enums) + Vite 8 +
  Tailwind v4 (`@theme` block in `src/app.css`, no config file).
- Supabase hosted: Postgres + Auth + RLS on every table, Deno Edge Functions
  (`fetch()` only), Storage with signed URLs.
- Patient data is sensitive medical information — privacy first, no
  third-party analytics.
- Surfaces: Dashboard, Patients list, Patient form, Patient detail, Pipeline
  (kanban), Payments, Settings, Login.
- All work artifacts in English.

## Brand Commitments

- The Instagram profile is the brand surface patients know Hüseyin by; the
  user made it the binding brand evidence for the CRM redesign (confirmed
  2026-07-26). Evidence: `docs/brand/instagram-profile-2026-07-26.jpeg` —
  sunlit outdoor selfie videos in tropical greenery; rounded caption cards in
  vivid yellow and olive/moss green; bold condensed caption type in white,
  deep navy/indigo, and cyan-teal; navy circular highlight badges ("Results",
  "Consultation") with a hair-follicle icon.
- The incumbent CRM visual world (linen/teal/coral "warm medical trust",
  DM Serif Display) is **to be replaced** (confirmed): it is evidence and
  anti-reference only, not a commitment.
- Name: Hüseyin Ajuz. Domains: `huseyinajuz.com` (site, Netlify),
  `huseyinacuz.com` (email).

## Evidence on Hand

- `docs/brand/instagram-profile-2026-07-26.jpeg` — Instagram profile
  screenshot (brand evidence).
- `public/favicon.svg`, `public/icons.svg` — current app assets (incumbent
  world, replaceable).
- No logo file exists. No testimonial/case-study assets in repo — do not
  fabricate.
- Landing page `huseyinajuz.com` exists on Netlify (separate surface; redesign
  deferred to v1.3 Web Presence). Intended to later inherit/extend the CRM's
  new visual world (user decision 2026-07-26).

## Product Principles

1. **Pipeline at a glance** — lifecycle visibility is the core value; nothing
   may bury it.
2. **Zero dropped leads** — follow-up state and staleness must surface
   themselves, not wait to be found.
3. **Privacy first** — medical data; no third-party trackers, RLS everywhere.
4. **One-person operable** — every workflow must be fast for a solo
   practitioner on phone or desktop.
5. **Brand continuity** — the CRM should feel like Hüseyin's world (the
   Instagram presence), so the tool he lives in daily carries his identity.

## Accessibility & Inclusion

No product-specific standard established. Confirmed usage on both desktop and
phone — touch-capable interactions (including the kanban) are a requirement,
not an enhancement.
