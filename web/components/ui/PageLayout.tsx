import type { ReactNode } from "react";

type PageLayoutProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageLayout({ children, title, subtitle, actions, className = "" }: PageLayoutProps) {
  return (
    <main className="min-h-screen bg-gray-100 lg:pl-72">
      <div className={`mx-auto max-w-7xl px-6 py-8 ${className}`}>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Vehicle Intelligence
            </p>
            <h1 className="mt-1 text-xl font-semibold text-gray-900">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-600">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap gap-2">
              {actions}
            </div>
          )}
        </div>
        
        {children}
      </div>
    </main>
  );
}
