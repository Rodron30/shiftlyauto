import type { ReactNode } from "react";

type PageLayoutProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageLayout({
  children,
  title,
  subtitle,
  actions,
  className = "",
}: PageLayoutProps) {
  return (
    <div
      className={`
        mx-auto
        w-full
        max-w-[1440px]
        px-3
        py-4
        sm:px-5
        lg:px-6
        lg:py-5
        ${className}
      `}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-[#102A56] sm:text-2xl">
            {title}
          </h1>

          {subtitle && (
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#64748B] sm:text-sm">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            {actions}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
