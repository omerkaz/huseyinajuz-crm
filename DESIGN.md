---
name: Trichoscope Daylight
description: A patient CRM rendered as the practitioner's own instrument — scalp-analysis charting software in tropical daylight, carrying the Instagram brand palette.
---

<!-- SEED: established with the user before implementation; re-run /impeccable document once there's code to capture the actual tokens and components. -->

# Design System: Trichoscope Daylight

## Overview

**Creative North Star: "The Practitioner's Instrument"**

The CRM speaks the interface language of trichoscopy charting software — the
dermatoscope-and-density-map tools of Hüseyin's own trade — but rendered in
daylight, not in a lab. The ground is optical white, legible on a phone under
tropical sun. Deep indigo-navy (sampled from his Instagram caption ink) is the
single structural ink: every rule, label, control, and hairline. His Reels
sticker-yellow becomes the instrument's marker color — trichoscopy literally
charts "yellow dots," and here a yellow dot means *this needs your attention
now*. Olive/moss (his other sticker color) marks growth and healthy progress;
cyan marks a live reading in progress; signal red marks cold.

Data is treated as measurement: counts render as instrument digits in mono,
lifecycle position renders as a calibrated 9-graduation scale, and patients
appear inside circular calibrated lens frames — his navy Instagram highlight
badges, made functional. The overall energy is precise but sunny: an
instrument owned by a barefoot practitioner, not a hospital.

**Anti-references (confirmed):** the previous linen/cream + serif + terracotta
"warm medical trust" world; generic SaaS admin (white/grey/blue, soft
shadows, Inter everywhere); dark-mode neon dashboards.

**Key Characteristics:**
- Optical-white daylight ground; flat, hairline-ruled instrument panels
- One structural ink (deep indigo-navy) carrying all chrome and text
- Sticker-saturated functional color: yellow = attention, olive = growth, cyan = live, red = cold
- Circular calibrated lens frames as the recurring signature motif
- Condensed grotesk display voice echoing his Reels caption cards; mono measurement digits
- Every tick, scale, and graduation encodes real data — zero ornamental calibration

## Colors

Sampled from the binding brand evidence (`docs/brand/instagram-profile-2026-07-26.jpeg`); exact UI tints/shades to be resolved during implementation.

### Primary
- **Caption Ink Navy** (#211A47): the one structural ink — all body text, headings, rules, hairlines, icons, and control outlines. Sampled from his caption lettering. Secondary/muted text is this ink at reduced strength (tint), never a neutral grey.

### Secondary
- **Sticker Yellow** (#FEDE5C): the marker color. Due follow-ups, focus rings, active selection, "reading in progress" highlights, and attention dots. High-value, small-area.
- **Moss Olive** (#8E985E): growth and health — active-treatment states, positive deltas, completed readings.

### Tertiary
- **Live Cyan** (#16BCD4): momentary "live" accents — an in-flight transition, a fresh webhook lead, a link. Rare.
- **Signal Red** (#B3301F): cold patients, destructive actions, overdue alerts. Trichoscopy's "red dot," used sparingly. AA on white for text and white-on-fill chips.

### Neutral
- **Optical White** (#FCFDFB, settled): the ground everywhere; surfaces are #FFFFFF panels. Ink tints: secondary #575170, muted #757090, hairline rgba(33,26,71,.16), strong hairline rgba(33,26,71,.38), wash rgba(33,26,71,.05) — the instrument's light table. Panels separate by hairline navy rules, not by grey fills.

### Named Rules
**The Yellow Dot Rule.** Yellow marks what needs the practitioner's attention *now*. If everything is yellow, nothing is due — yellow area on any screen stays small enough that a single glance finds the dots.
**The One Ink Rule.** Structure has exactly one ink: navy. De-emphasis is done with tints of the ink, never with grey. Grey chrome is the generic-SaaS tell this world refuses.

## Typography

**Display Font:** Archivo (condensed/expanded via width axis; fallback: system sans)
**Body Font:** Archivo (fallback: -apple-system, system-ui, sans-serif)
**Label/Mono Font:** Spline Sans Mono (fallback: ui-monospace, monospace)

**Character:** One grotesk family doing two jobs — bold condensed headings that
echo the sticker-caption lettering of his Reels covers, and a quiet regular
width for UI prose. Numbers are never prose: any count, price, date, or
measurement renders in mono with tabular figures, like an instrument readout.

### Hierarchy
(Settled in build: Archivo variable wdth 62–125; display at font-stretch 75% uppercase, UI semibold at 87.5%; readings in Spline Sans Mono tabular. Utility classes: `.display-condensed`, `.scale-label`, `.reading` in `src/app.css`.)
- **Display** (Archivo, bold, condensed width, uppercase): page titles, the wordmark, kanban column heads.
- **Headline** (Archivo, semibold, slight condensation): card titles, patient names.
- **Body** (Archivo, regular): form labels, notes, prose.
- **Reading** (Spline Sans Mono, medium, tabular): every number — counts, currency, dates, durations, IDs.
- **Label** (Archivo, medium, uppercase, tracked): micro-labels on scales, axes, chips.

### Named Rules
**The Instrument Digit Rule.** If it's a value the practitioner reads, it's mono and tabular. Prose never carries a number's weight.

## Layout

An instrument panel, not a document: regions are calibrated zones separated by
hairline navy rules on the shared optical-white ground. Density is confident —
the dashboard reads at a glance like a device faceplate — but each zone holds
one kind of reading. Desktop and phone are co-primary (confirmed): phone
reflows zones into a vertical stack with the calibrated lifecycle scale
staying full-width and horizontally scrubbing where needed; touch targets
sized for outdoor one-thumb use. Exact grid and spacing rhythm [to be
resolved during implementation].

## Elevation & Depth

Flat. The instrument has no floating layers: depth is conveyed by hairline
rules, ink-tint layering, and the lens frames' concentric rings. Shadows do
not appear at rest; at most, a single soft shadow may mark a truly transient
layer (dropdown, dialog). "Card with drop shadow on grey" is the anti-pattern.

### Named Rules
**The Flat Faceplate Rule.** Surfaces are flat panels ruled by hairlines. If a region needs separation, it earns a rule, not a shadow.

## Shapes

Two form languages, deliberately paired:
- **The lens:** perfect circles with calibration tick marks — patient avatars, key readouts, empty states. The signature silhouette, inherited from his navy Instagram highlight badges.
- **The sticker:** generously rounded rectangles for state chips and badges, echoing his Reels caption cards.
- **The panel:** rectangles with small radius (bezel-like) for structural zones and inputs.
Settled radii: panels/cards 8px, inputs/buttons/inner 6px, chips 8px.

### Named Rules
**The Functional Tick Rule.** Calibration marks — ticks, graduations, ring segments — always encode real data (a count, a position in the 9-state lifecycle, a proportion). A tick that measures nothing is deleted.

## Do's and Don'ts

### Do:
- **Do** render the 9-state lifecycle as one calibrated scale wherever lifecycle appears — the same instrument read everywhere (dashboard, patient detail, pipeline).
- **Do** put every avatar in a circular lens frame; it is the brand carrier inside the product.
- **Do** keep the ground optical white on every screen and verify legibility at high ambient-light contrast (phone in sunlight).
- **Do** use sticker-rounded chips in yellow/olive for lifecycle states, matching the state semantics already in the app (active = growth colors, cold = red).

### Don't:
- **Don't** reintroduce the cream/linen ground, serif display, grain, or vignette of the replaced world.
- **Don't** use grey for chrome, borders, or secondary text — tint the navy ink instead.
- **Don't** scatter yellow: it is the attention marker, not a theme color.
- **Don't** draw decorative ticks, dials, or gauges that encode nothing.
