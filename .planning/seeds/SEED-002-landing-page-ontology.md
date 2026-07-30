---
created: 2026-07-19
planted_during: v1.3 Web Presence pre-work (landing page art direction)
trigger_when: scoping v1.3 landing page (huseyinajuz.com redesign) or building
  the Three.js exhibits / Leva playground
source_method: marketing-ontology (definitions → evidence → narrative → design,
  converging on 1 audience × 1 SPIN × 1 medium; "never fake an exhibit — rewrite
  the beat"; validated by use, not by more talk)
---

# SEED-002: Landing page ontology — Three.js exhibits for huseyinajuz.com

## L0 · Definitions (OPEN — confirm with Hüseyin before building)

| Concept | Proposed value | Status |
|---|---|---|
| **Audience** | Men ~20–45 experiencing hair loss, found via Instagram, skeptical of transplant clinics and miracle products, want a *cause-first* answer. TR + international (CRM already tracks language). | OPEN |
| **Core Claim** | "Your hair loss has a measurable cause — find it in your blood before you treat anything." | OPEN — one sentence, Hüseyin must own it |
| **Action** | Submit the form → enters CRM as `lead` (`source: 'landing_page'`, Phase 15) → drip → WhatsApp consultation. | Fixed by v1.2 plumbing |

## L1 · Evidence (Facts — real numbers only)

Every beat below must cite ≥1 fact. **Do not invent numbers.** Sources:

- FROM HÜSEYIN: patients treated to date, % of blood panels showing actionable
  deficiency/hormonal cause, typical visible-change window (week 6 check-in
  exists in the CRM lifecycle — use it), package completion counts.
- FROM LITERATURE (citable): androgenetic alopecia accounts for the large
  majority of male hair loss; it is hereditary; early intervention preserves
  follicles that miniaturize irreversibly. (Pull exact figures + citations
  during v1.3 scoping — placeholder facts are forbidden by the method.)

## L2 · Narrative (SPIN — this orders the beats and the scroll)

| Beat | SPIN | Argument | Cites |
|---|---|---|---|
| B1 | **S**ituation | You're losing hair and everyone is selling you a product, not an answer. | market/audience fact |
| B2 | **P**roblem | You don't know *why* — and the cause determines the treatment. | genetics/etiology fact |
| B3 | **I**mplication | Treating blind burns the months in which miniaturizing follicles can still be saved. | irreversibility fact |
| B4 | **N**eed-payoff | A blood panel reveals your cause; a targeted protocol follows; progress is checked at week 6. | Hüseyin's protocol + outcome facts |

**Key inversion vs. first instinct:** the visual story is
**Hair (symptom) → Genetics (cause) → Blood (diagnosis)** — narrative order,
not "blood → DNA → hair" aesthetic order.

## L3 · Rendering

| Beat | Exhibit (Three.js) | Sketch |
|---|---|---|
| B1 | **Strand field** | Full-viewport field of fine hair strands, wind/cursor reactive; density is a tunable — the field visibly thins as the situation is named. |
| B2 | **Helix** | Strands resolve into a rotating double helix (hereditary cause), base pairs lit teal `#2A9D8F`. |
| B3+B4 | **Blood flow** | Helix dissolves into plasma-like particle flow with cell clusters (coral `#E76F51`) → settles into a calm, ordered state as the panel/protocol beat lands. |
| — | **Morph** | One GPU particle system morphing across all three states, scroll-driven; sections between morphs carry the copy + facts. |

- **Medium:** landing page, huseyinajuz.com (Netlify). Scroll = narrative order.
- **Design:** brand system (linen #FAF6F1, cream surface, charcoal text, teal,
  coral, DM Serif Display / Inter). Medical-illustration-as-art, not sci-fi VFX.
- **Craft tool:** Leva playground (separate Vite app, NOT in the CRM bundle) —
  each exhibit gets folders of tunables + randomize + FPS monitor; parameters
  are frozen into the shipped page. `sk on threejs` when building starts.
- **Feasibility loop:** if an exhibit can't be built honestly (perf, mobile,
  reduced-motion), rewrite the beat — never fake the exhibit. Static fallback
  (canvas snapshot or SVG plate) required for `prefers-reduced-motion` and
  low-end mobile.

## Extensions

- **SEED-003** (2026-07-30): scene & interaction ontology for the **B4 heal
  exhibit** — interactive blood panel → drip → strand field heals. Decides
  placement (B4, not hero), marker→channel mapping, drip/ripple interaction,
  realism upgrades, performance tiers. Read it before touching the playground.

## Open questions

1. Hüseyin's real numbers for L1 (blocks copywriting, not playground work).
2. ~~Playground location~~ DECIDED 2026-07-19: `huseyinajuz-landing/playground/`
   (Vite+React+Leva shell, framework-free scene module). The Three.js artifact
   is scoped to the **hero** of the landing page.
3. Language: single-language page first (which?), or TR/EN from day one?
4. Custom domain email (v1.2) and landing page share the domain — coordinate
   DNS work once.
