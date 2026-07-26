import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

/* Flat instrument panel: hairline-ruled bezel, no shadows, no lift. */
function Card({ hover = true, className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`
        bg-surface rounded-[8px] border border-hairline p-6
        transition-colors duration-150
        ${hover ? "hover:border-hairline-strong" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export { Card };
export type { CardProps };
