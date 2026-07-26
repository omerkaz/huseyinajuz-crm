import { type InputHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id: externalId, ...props }, ref) => {
    const generatedId = useId();
    const id = externalId ?? generatedId;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-ink-secondary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`
            w-full px-3.5 py-2.5 text-[0.9rem]
            bg-surface text-ink
            border rounded-[6px]
            outline-none transition-colors duration-150
            placeholder:text-ink-muted
            ${
              error
                ? "border-red focus:border-red focus:ring-2 focus:ring-red-soft"
                : "border-hairline-strong focus:border-ink focus:ring-2 focus:ring-yellow"
            }
            ${className}
          `}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          {...props}
        />
        {error && (
          <p id={`${id}-error`} className="text-[0.75rem] text-red font-medium">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${id}-hint`} className="text-[0.7rem] text-ink-muted">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
