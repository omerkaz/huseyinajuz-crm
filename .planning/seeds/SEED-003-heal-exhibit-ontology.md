---
created: 2026-07-30
planted_during: v1.3 pre-work (landing page art direction, playground session)
trigger_when: building the B4 "heal exhibit" or upgrading the strand field
  (huseyinajuz-landing/playground); scoping v1.3 WEB-01
source_method: design session 2026-07-30 — extends SEED-002 L3 rendering with
  a scene & interaction ontology for the interactive blood-panel exhibit
---

# SEED-003: Heal exhibit — scene & interaction ontology

Interactive B4 (Need-payoff) exhibit: an illustrative blood panel shows
deficient markers; the visitor applies a "drop" per corrected marker and
watches the degraded strand field heal. The visitor does what Hüseyin does:
read the panel → correct the cause → see the hair respond.

## Placement (decided)

- **NOT the hero.** Hero stays Beat B1 (strand field, thinning). This exhibit
  is **Beat B4**, last scroll section before the booking form.
- Symmetry: hero field *thins* (Situation), B4 field *heals* (Payoff). Same
  `strandField.js` module, two instances, degraded initial params on B4.
- Conversion adjacency: healed field sits directly above the form.

## Entities

| Entity | Implementation | Notes |
|---|---|---|
| Strand field | `strandField.js` (exists) | instanced, framework-free, lifts verbatim to static page |
| Scalp dome | build-time root placement on curved surface + whorl flow field | biggest realism jump; replaces flat-plane scatter |
| Marker panel | HTML/CSS chips over the canvas (NOT WebGL) | coral for low values; accessible buttons |
| Dropper/droplet | one reused teardrop mesh (`LatheGeometry`, ~20 lines) | teal-tinted; gravity-eased fall, slight stretch |
| Ripple impacts | `uImpacts[5]` vec4 uniforms (xyz point, w elapsed) | heal = max over impacts of ring smoothstep |
| Splash burst | ~30 one-shot instanced particles | reused pool |
| Wet patch | extra smoothstep darkening at impact, dries as ring passes | tactile detail, optional |

## Exhibit state machine

```
degraded ──select marker──▶ dropper-loaded ──tap field──▶ dripping
    ▲                                                        │ impact
    └──────────── (no reset in v1) ◀── fully-healed ◀── healing (ripple)
                                            │                │
                                           CTA        partially-healed
                                                     (loop per marker)
```

Per-marker: `deficient → correcting (ripple active) → corrected`.
All markers corrected → `fully-healed` → CTA rises.

## Marker → heal channel mapping (metaphorical, OPEN values)

| Marker | Display (illustrative) | Heal channel | Params tweened |
|---|---|---|---|
| Ferritin (iron) | low, coral | density | `coverage` ↑ |
| Vitamin D | low, coral | vigor | `height`, `width` ↑ |
| Zinc | low, coral | sheen | `tipColor` dull→rich, specular ↑ |
| B12 / others | OPEN | OPEN | OPEN |

**OPEN — needs Hüseyin:** which 3–5 markers he actually sees most, plausible
illustrative values + reference ranges. Mapping stays *metaphorical*
(iron→density is narrative, not a clinical claim).

## Interaction grammar

- **tap marker chip** → loads dropper (cursor/touch state)
- **tap field** → raycast impact point → droplet falls there → ripple heal
- **chip "apply" button** (mobile / no-aim fallback) → auto-drop at field center
- **hover field** → existing cursor repulsion (unchanged)
- **a11y:** chips are real `<button>`s; entire flow completable without
  touching the canvas; canvas is decorative (`aria-hidden`)
- **`prefers-reduced-motion`:** no droplet/ripple — instant crossfade
  degraded→healed params per corrected marker
- **WebGL unavailable:** static before/after poster pair (SEED-002 contract)

## Realism upgrades (code-only, no assets required)

1. Scalp dome + whorl/crown flow pattern (procedural noise + radial field)
2. Kajiya-Kay anisotropic specular (fragment shader — *the* hair-look upgrade)
3. Clumping: 5–15 strands share lean, one noise lookup per instance (build-time)
4. Root shadowing (fake AO near `t=0`)
5. Melanin variation: per-strand jitter along brown-black ramp

Register: **stylized but physically grounded** — medical-illustration-as-art
(SEED-002). Hyperreal scalp is uncanny; fascination comes from the healing
response, not pixel realism.

## Performance contract

- Healing/ripple/tween = **uniforms only**; zero geometry churn at runtime.
  Dome, clumping, melanin are build-time attributes (zero runtime cost).
- **Device tiers** (frozen param sets): desktop `count 4000 / segments 8 /
  dprCap 2`; mobile `~1800 / 5–6 / 1.5`. Heuristic: screen size +
  `hardwareConcurrency`. `createStrandField` grows a `tier` option.
- **Auto-degrade:** sustained <45fps for 3s → drop dprCap first, then rebuild
  lower count. One-way ratchet.
- **IntersectionObserver** starts/stops each canvas — only the visible
  exhibit runs RAF (makes the second instance ~free).
- **Poster-first LCP:** poster image is the LCP element; three.js deferred;
  canvas cross-fades in. `antialias: false` at DPR ≥ 2.
- Validate on mid-range Android before freezing params.

## Honesty constraints (from SEED-002 method)

- Panel labeled as an **illustrative example** — never real patient data.
- No invented clinical numbers in copy; marker values marked illustrative
  until Hüseyin supplies plausible ones.
- If an interaction can't be built honestly on mobile → simplify the beat
  (chips-only), never fake the exhibit.

## Assets

- **Ask Hüseyin: trichoscopy / macro scalp photos** — density & color
  calibration reference, degraded-state reference, and the static poster
  fallback. The only asset needed.
- Optional tiny HDRI for sheen; procedural gradient env acceptable.
- **DECIDED 2026-07-30: no img2threejs** — it reconstructs photographed
  objects; our exhibits are procedural particle systems. Teardrop is trivial
  by hand. Revisit only if v1.3 wants a hero-quality 3D blood-tube set piece.

## Build notes

- `sk on threejs` at build start (refs: 08-interaction, 11-materials-advanced,
  12-performance, 07-math).
- Scene module stays **framework-free** (lifts verbatim into static page via
  import map pinned to same three version). Leva playground grows folders:
  Dome/Whorl, Sheen, Heal (per-marker degraded/healed sets, impact test
  buttons), Tier preview.
- Run `edge_case_review` on the implementation plan before coding.
- Build order: ① dome + whorl ② Kajiya-Kay + clumping + AO + melanin
  ③ tiers + auto-degrade + IntersectionObserver ④ droplet + ripple heal
  ⑤ marker panel wiring.

## Open questions

1. Which markers + illustrative values (Hüseyin) — blocks copy, not build.
2. Reset affordance after fully-healed, or one-way by design?
3. Do B2/B3 get exhibits, or copy-only between the two strand-field bookends?
4. Shared canvas vs two instances (leaning two + IntersectionObserver).
