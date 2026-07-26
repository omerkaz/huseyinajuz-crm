import type { LifecycleState } from "@/types/database";

/**
 * Sticker chips — the rounded caption-card language of the brand.
 * yellow = needs attention now · olive = growth/health · red = cold ·
 * neutral = settled/terminal · muted = not yet in motion.
 * "teal" and "coral" are deprecated migration aliases (→ olive / red).
 */
type BadgeVariant =
  | "yellow"
  | "olive"
  | "red"
  | "neutral"
  | "muted"
  | "teal"
  | "coral";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  yellow: "bg-yellow text-ink",
  olive: "bg-olive-deep text-white",
  red: "bg-red text-white",
  neutral: "bg-ink-wash text-ink-secondary",
  muted: "bg-transparent text-ink-secondary border border-hairline-strong",
  /* deprecated aliases — remove with the migration sweep */
  teal: "bg-olive-deep text-white",
  coral: "bg-red text-white",
};

/**
 * Map lifecycle states to chip colors.
 * Attention moments (blood test, week 6, review) → yellow;
 * growth states (treatment, support) → olive; cold → red;
 * completed → neutral; early funnel → muted.
 */
const stateVariantMap: Record<LifecycleState, BadgeVariant> = {
  lead: "muted",
  contacted: "muted",
  awaiting_blood_test: "yellow",
  active_treatment: "olive",
  week_6_checkin: "yellow",
  end_review: "yellow",
  extended_support: "olive",
  completed: "neutral",
  cold: "red",
};

export function getVariantForState(state: LifecycleState): BadgeVariant {
  return stateVariantMap[state];
}

function Badge({ children, variant = "neutral", className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center
        px-2.5 py-1 text-[0.65rem] font-semibold
        uppercase tracking-[0.05em] [font-stretch:80%]
        rounded-[8px]
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

Badge.displayName = "Badge";

export { Badge };
export type { BadgeProps, BadgeVariant };
