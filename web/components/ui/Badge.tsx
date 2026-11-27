import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  variant?: "default" | "primary" | "success" | "warning" | "danger" | "outline" | "subtle";
  className?: string;
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  const variantStyles = {
    default: "border border-[#D7E3EF] bg-[#F8FAFC] text-[#64748B]",
    primary: "border border-[#BFD7FF] bg-[#EAF5FF] text-[#1677FF]",
    success: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border border-amber-200 bg-amber-50 text-amber-700",
    danger: "border border-red-200 bg-red-50 text-red-600",
    outline: "border border-[#D7E3EF] bg-white text-[#64748B]",
    subtle: "border border-[#E8EEF5] bg-[#F8FAFC] text-[#8B9DB3]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
