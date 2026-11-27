import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  compact?: boolean;
  elevated?: boolean;
};

export function Card({
  children,
  className = "",
  noPadding = false,
  compact = false,
  elevated = false,
}: CardProps) {
  const paddingClass = noPadding ? "" : compact ? "p-3" : "p-4";

  const shadowClass = elevated
    ? "shadow-[8px_8px_18px_rgba(71,85,105,0.10),-8px_-8px_18px_rgba(255,255,255,0.95)]"
    : "shadow-[5px_5px_12px_rgba(71,85,105,0.07),-5px_-5px_12px_rgba(255,255,255,0.9)]";

  return (
    <div
      className={[
        "rounded-2xl border border-[#D7E3EF] bg-white",
        shadowClass,
        "transition-all duration-200",
        paddingClass,
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = {
  children: ReactNode;
  className?: string;
  compact?: boolean;
};

export function CardHeader({
  children,
  className = "",
  compact = false,
}: CardHeaderProps) {
  return (
    <div className={`mb-3 ${compact ? "mb-2" : ""} ${className}`}>
      {children}
    </div>
  );
}

type CardTitleProps = {
  children: ReactNode;
  className?: string;
};

export function CardTitle({ children, className = "" }: CardTitleProps) {
  return (
    <h3 className={`text-sm font-semibold text-[#102A56] ${className}`}>
      {children}
    </h3>
  );
}

type CardContentProps = {
  children: ReactNode;
  className?: string;
};

export function CardContent({ children, className = "" }: CardContentProps) {
  return <div className={className}>{children}</div>;
}
