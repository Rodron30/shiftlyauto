import type { ReactNode } from "react";
import Link from "next/link";

type StatCardProps = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
  detail?: string;
  href?: string;
  className?: string;
  onClick?: () => void;
  active?: boolean;
};

export function StatCard({
  label,
  value,
  icon,
  trend,
  detail,
  href,
  className = "",
  onClick,
  active = false,
}: StatCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7C93] sm:text-xs">
          {label}
        </p>

        {icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D7E3EF] bg-[#EAF5FF] text-[#1677FF] shadow-[inset_2px_2px_4px_rgba(71,85,105,0.06),inset_-2px_-2px_4px_rgba(255,255,255,0.9)]">
            {icon}
          </div>
        )}
      </div>

      <p className="mt-2 text-xl font-bold tracking-tight text-[#102A56]">
        {value}
      </p>

      {(trend || detail) && (
        <p className="mt-1 truncate text-[10px] text-[#8B9DB3] sm:text-xs">
          {trend || detail}
        </p>
      )}
    </>
  );

  const cardClassName = `rounded-xl border border-[#D7E3EF] bg-white p-3 text-left shadow-[4px_4px_10px_rgba(71,85,105,0.07),-4px_-4px_10px_rgba(255,255,255,0.9)] transition-all duration-200 hover:border-[#BFD7EE] hover:-translate-y-px ${
    active
      ? "border-[#BFD7FF] bg-[#F8FBFF] shadow-[inset_2px_2px_6px_rgba(71,85,105,0.07),inset_-2px_-2px_6px_rgba(255,255,255,0.9)]"
      : ""
  } ${(onClick || href) ? "cursor-pointer" : ""} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cardClassName}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cardClassName}
      disabled={!onClick}
    >
      {content}
    </button>
  );
}
