import Link from "next/link";
import { BackIcon } from "@/components/icons";

type BackButtonProps = {
  href: string;
  label: string;
  className?: string;
};

export function BackButton({
  href,
  label,
  className = "",
}: BackButtonProps) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-3.5 py-2 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF] hover:text-[#1677FF] ${className}`}
    >
      <BackIcon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
      <span>{label}</span>
    </Link>
  );
}
