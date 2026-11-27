import type { ReactNode } from "react";
import Link from "next/link";
import { BackIcon } from "@/components/icons";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  icon,
  backHref,
  backLabel = "Back to Dashboard",
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-4">
      {backHref && (
        <Link
          href={backHref}
          className="
            group
            mb-3
            inline-flex
            items-center
            gap-2
            rounded-lg
            border
            border-[#DCE8F5]
            bg-white
            px-4
            py-2
            text-sm
            font-semibold
            text-[#475569]
            shadow-[3px_3px_8px_rgba(71,85,105,0.07),-3px_-3px_8px_rgba(255,255,255,0.9)]
            transition-all
            duration-200
            hover:border-[#BFD7EE]
            hover:bg-[#EAF5FF]
            hover:text-[#1677FF]
          "
        >
          <BackIcon className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
          <span>{backLabel}</span>
        </Link>
      )}

      <div
        className="
          rounded-xl
          border
          border-[#DCE8F5]
          bg-white
          px-4
          py-3.5
          shadow-[5px_5px_14px_rgba(71,85,105,0.07),-5px_-5px_14px_rgba(255,255,255,0.95)]
          sm:px-5
        "
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {icon && (
                <span
                  className="
                    flex
                    h-8
                    w-8
                    shrink-0
                    items-center
                    justify-center
                    rounded-lg
                    border
                    border-[#CFE1F2]
                    bg-[#EAF5FF]
                    text-[#1677FF]
                    shadow-[inset_2px_2px_5px_rgba(71,112,150,0.08),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]
                  "
                >
                  {icon}
                </span>
              )}

              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                {eyebrow}
              </p>
            </div>

            <h1 className="mt-1.5 text-xl font-bold tracking-tight text-[#102A56] sm:text-2xl">
              {title}
            </h1>

            {description && (
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[#64748B] sm:text-sm">
                {description}
              </p>
            )}
          </div>

          {actions && (
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

