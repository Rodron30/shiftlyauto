import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
};

export function Card({ children, className = "", noPadding = false }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-neutral-200 bg-white shadow-sm ${
        noPadding ? "" : "p-4"
      } ${className}`}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = {
  children: ReactNode;
  className?: string;
};

export function CardHeader({ children, className = "" }: CardHeaderProps) {
  return <div className={`mb-3 ${className}`}>{children}</div>;
}

type CardTitleProps = {
  children: ReactNode;
  className?: string;
};

export function CardTitle({ children, className = "" }: CardTitleProps) {
  return <h3 className={`text-base font-semibold text-neutral-900 ${className}`}>{children}</h3>;
}

type CardContentProps = {
  children: ReactNode;
  className?: string;
};

export function CardContent({ children, className = "" }: CardContentProps) {
  return <div className={className}>{children}</div>;
}
