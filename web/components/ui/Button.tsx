import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  className?: string;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";

  const variantStyles = {
    primary:
      "border border-[#1677FF] bg-[#1677FF] text-white shadow-[4px_4px_9px_rgba(22,119,255,0.18),-3px_-3px_8px_rgba(255,255,255,0.8)] hover:bg-[#0F67E8] hover:border-[#0F67E8] focus:ring-[#1677FF]/20 active:translate-y-px active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.14)]",
    secondary:
      "border border-[#D7E3EF] bg-white text-[#1E3A5F] shadow-[4px_4px_9px_rgba(71,85,105,0.08),-3px_-3px_8px_rgba(255,255,255,0.9)] hover:border-[#BFD7EE] hover:bg-[#F8FBFF] focus:ring-[#1677FF]/20 active:translate-y-px",
    danger:
      "border border-red-200 bg-white text-red-600 shadow-[4px_4px_9px_rgba(71,85,105,0.07),-3px_-3px_8px_rgba(255,255,255,0.9)] hover:border-red-300 hover:bg-red-50 focus:ring-red-400/20 active:translate-y-px",
    ghost:
      "text-[#1E3A5F] hover:bg-[#EAF5FF] hover:text-[#1677FF] focus:ring-[#1677FF]/20",
    outline:
      "border border-[#D7E3EF] bg-white text-[#102A56] shadow-[4px_4px_9px_rgba(71,85,105,0.08),-3px_-3px_8px_rgba(255,255,255,0.9)] hover:border-[#BFD7EE] hover:bg-[#F8FBFF] focus:ring-[#1677FF]/20 active:translate-y-px",
  };

  const sizeStyles = {
    sm: "px-3 py-2 text-xs rounded-xl",
    md: "px-4 py-2.5 text-sm rounded-xl",
    lg: "px-5 py-3 text-base rounded-xl",
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Loading..." : children}
    </button>
  );
}
