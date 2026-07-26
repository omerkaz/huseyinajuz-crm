type LensSize = "sm" | "md" | "lg";

interface LensAvatarProps {
  firstName: string;
  lastName: string;
  size?: LensSize;
  className?: string;
}

const SIZE_PX: Record<LensSize, number> = { sm: 32, md: 40, lg: 56 };
const FONT_PX: Record<LensSize, number> = { sm: 10, md: 12, lg: 16 };

/**
 * Circular calibrated lens frame with the patient's initials —
 * the brand's navy badge motif, made functional as the avatar.
 */
export function LensAvatar({
  firstName,
  lastName,
  size = "md",
  className = "",
}: LensAvatarProps) {
  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toLocaleUpperCase("tr-TR");
  const px = SIZE_PX[size];

  const ticks = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * 45 * Math.PI) / 180;
    return (
      <line
        key={i}
        x1={32 + 27 * Math.sin(angle)}
        y1={32 - 27 * Math.cos(angle)}
        x2={32 + 30 * Math.sin(angle)}
        y2={32 - 30 * Math.cos(angle)}
        stroke="currentColor"
        strokeWidth={i % 2 === 0 ? 2 : 1.25}
      />
    );
  });

  return (
    <svg
      viewBox="0 0 64 64"
      width={px}
      height={px}
      className={`shrink-0 text-ink ${className}`}
      role="img"
      aria-label={`${firstName} ${lastName}`}
    >
      <circle
        cx="32"
        cy="32"
        r="25"
        fill="var(--color-ink-wash)"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {ticks}
      <text
        x="32"
        y="33"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        style={{
          fontFamily: "var(--font-heading)",
          fontStretch: "80%",
          fontWeight: 700,
          fontSize: FONT_PX[size] * (64 / px),
          letterSpacing: "0.02em",
        }}
      >
        {initials}
      </text>
    </svg>
  );
}
