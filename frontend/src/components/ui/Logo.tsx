import React from "react";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  textClassName?: string;
}

export const Logo = ({ className = "", showText = true, size = "md", textClassName = "" }: LogoProps) => {
  const textSizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* QR-geometry mark: 3×3 grid with corner anchors */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={size === "sm" ? "h-5 w-5" : size === "lg" ? "h-7 w-7" : "h-6 w-6"}
        aria-hidden="true"
      >
        {/* Top-left anchor */}
        <rect x="2"  y="2"  width="6" height="6" rx="1" style={{ fill: "var(--color-accent)" }} />
        {/* Top-right anchor */}
        <rect x="16" y="2"  width="6" height="6" rx="1" style={{ fill: "var(--color-accent)" }} />
        {/* Bottom-left anchor */}
        <rect x="2"  y="16" width="6" height="6" rx="1" style={{ fill: "var(--color-accent)" }} />
        {/* Center dot cluster — accent dim */}
        <rect x="10" y="10" width="4" height="4" rx="0.5" style={{ fill: "var(--color-accent-dim)" }} />
        {/* Data modules */}
        <rect x="16" y="10" width="2.5" height="2.5" rx="0.5" style={{ fill: "var(--color-accent)", opacity: 0.6 }} />
        <rect x="10" y="16" width="2.5" height="2.5" rx="0.5" style={{ fill: "var(--color-accent)", opacity: 0.6 }} />
        <rect x="19" y="16" width="2.5" height="2.5" rx="0.5" style={{ fill: "var(--color-accent)", opacity: 0.4 }} />
        <rect x="16" y="19" width="2.5" height="2.5" rx="0.5" style={{ fill: "var(--color-accent)", opacity: 0.4 }} />
      </svg>

      {showText && (
        <span
          className={`font-bold tracking-tight ${textSizeClasses[size]} ${textClassName}`}
          style={{ color: "var(--color-text)" }}
        >
          MiraTrust
        </span>
      )}
    </div>
  );
};
