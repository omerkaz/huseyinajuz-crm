import { LIFECYCLE_STATES, LIFECYCLE_LABELS } from "@/types/database";
import type { LifecycleState } from "@/types/database";

/**
 * The calibrated lifecycle scale — the instrument's core read.
 * Every tick encodes a real state; the same 9-graduation scale appears
 * wherever lifecycle does (dashboard, pipeline cards, patient detail).
 */

/** Short axis labels for tight spaces. */
export const LIFECYCLE_SHORT_LABELS: Record<LifecycleState, string> = {
  lead: "Lead",
  contacted: "Contact",
  awaiting_blood_test: "Blood",
  active_treatment: "Treat",
  week_6_checkin: "Wk 6",
  end_review: "Review",
  extended_support: "Support",
  completed: "Done",
  cold: "Cold",
};

/** Marker color per state — same semantics as Badge chips. */
const STATE_DOT_COLOR: Record<LifecycleState, string> = {
  lead: "var(--color-ink-muted)",
  contacted: "var(--color-ink-muted)",
  awaiting_blood_test: "var(--color-yellow)",
  active_treatment: "var(--color-olive)",
  week_6_checkin: "var(--color-yellow)",
  end_review: "var(--color-yellow)",
  extended_support: "var(--color-olive)",
  completed: "var(--color-ink)",
  cold: "var(--color-red)",
};

interface LifecycleMiniScaleProps {
  state: LifecycleState;
  className?: string;
}

/**
 * Per-patient 9-tick reading: hairline rail, travelled ticks in ink-tint,
 * the current position as a filled marker in the state's color.
 */
export function LifecycleMiniScale({ state, className = "" }: LifecycleMiniScaleProps) {
  const currentIndex = LIFECYCLE_STATES.indexOf(state);

  return (
    <div
      className={`relative flex items-center justify-between ${className}`}
      role="img"
      aria-label={`Lifecycle: ${LIFECYCLE_LABELS[state]} (position ${currentIndex + 1} of ${LIFECYCLE_STATES.length})`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-hairline"
      />
      {LIFECYCLE_STATES.map((s, i) => {
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        return (
          <span
            key={s}
            aria-hidden="true"
            className="relative rounded-full"
            style={
              isCurrent
                ? {
                    width: 9,
                    height: 9,
                    backgroundColor: STATE_DOT_COLOR[s],
                    boxShadow: "0 0 0 1.5px var(--color-surface), 0 0 0 2.5px var(--color-hairline-strong)",
                  }
                : {
                    width: 5,
                    height: 5,
                    backgroundColor: isPast
                      ? "var(--color-hairline-strong)"
                      : "var(--color-surface)",
                    border: isPast ? "none" : "1px solid var(--color-hairline-strong)",
                  }
            }
          />
        );
      })}
    </div>
  );
}

interface LifecycleDotScaleProps {
  /** Patient count per lifecycle state. */
  counts: Record<LifecycleState, number>;
  className?: string;
}

const MAX_STACK = 4;

/**
 * The faceplate's density read: 9 graduations on one axis, patient counts
 * stacked above each as dot markers (capped, with the exact mono count below).
 */
export function LifecycleDotScale({ counts, className = "" }: LifecycleDotScaleProps) {
  return (
    <div className={`grid grid-cols-9 ${className}`}>
      {LIFECYCLE_STATES.map((state) => {
        const count = counts[state] ?? 0;
        const dots = Math.min(count, MAX_STACK);
        return (
          <div key={state} className="flex flex-col items-center">
            {/* Dot stack */}
            <div
              className="flex h-16 flex-col-reverse items-center justify-start gap-1 pb-1.5"
              aria-hidden="true"
            >
              {Array.from({ length: dots }, (_, i) => (
                <span
                  key={i}
                  className="rounded-full"
                  style={{
                    width: 8,
                    height: 8,
                    backgroundColor: STATE_DOT_COLOR[state],
                    opacity: count > MAX_STACK && i === dots - 1 ? 0.45 : 1,
                  }}
                />
              ))}
            </div>
            {/* Graduation tick */}
            <span aria-hidden="true" className="h-2 w-px bg-hairline-strong" />
            {/* Axis label + exact reading */}
            <p className="scale-label mt-1.5 text-center text-ink-secondary">
              {LIFECYCLE_SHORT_LABELS[state]}
            </p>
            <p
              className="reading text-[0.7rem] text-ink"
              aria-label={`${LIFECYCLE_LABELS[state]}: ${count}`}
            >
              {String(count).padStart(2, "0")}
            </p>
          </div>
        );
      })}
    </div>
  );
}
