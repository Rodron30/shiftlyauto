import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  helperText?: string;
  compact?: boolean;
};

export function Select({
  label,
  error,
  helperText,
  className = "",
  compact = false,
  children,
  ...props
}: SelectProps) {
  const baseStyles =
    "w-full rounded-xl border border-[#D7E3EF] bg-[#F8FAFC] px-4 py-2.5 text-sm text-[#102A56] shadow-[inset_2px_2px_5px_rgba(71,85,105,0.07),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] focus:border-[#8DBFFF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1677FF]/10 disabled:bg-[#F1F5F9] disabled:text-gray-500 transition-all duration-200";

  const compactStyles = compact ? "px-3 py-2 text-xs" : "";

  const errorStyles = error
    ? "border-red-300 focus:border-red-400 focus:ring-red-400/10"
    : "";

  return (
    <div className="flex flex-col">
      {label && (
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#64748B]">
          {label}
        </label>
      )}

      <select
        className={`${baseStyles} ${compactStyles} ${errorStyles} ${className}`}
        {...props}
      >
        {children}
      </select>

      {error && (
        <p className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}

      {helperText && !error && (
        <p className="mt-1.5 text-xs text-[#8B9DB3]">
          {helperText}
        </p>
      )}
    </div>
  );
}
