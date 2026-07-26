import { type ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

/* Instrument controls: flat ink panels, condensed uppercase labels, snap response. */
const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:bg-[#37305C]",
  secondary:
    "bg-transparent text-ink border border-hairline-strong hover:bg-ink-wash",
  danger: "bg-red text-white hover:bg-[#992917]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3.5 py-1.5 text-[0.72rem] rounded-[6px]",
  md: "px-5 py-2.5 text-[0.78rem] rounded-[6px]",
  lg: "px-7 py-3 text-[0.85rem] rounded-[6px]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      className = "",
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2
          font-semibold uppercase tracking-[0.06em] [font-stretch:87.5%]
          transition-colors duration-150
          active:translate-y-px
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button };
export type { ButtonProps };
