import type { ReactNode } from "react";

type TableProps = {
  children: ReactNode;
  className?: string;
  compact?: boolean;
};

export function Table({
  children,
  className = "",
  compact = false,
}: TableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#D7E3EF] bg-white shadow-[4px_4px_10px_rgba(71,85,105,0.06),-4px_-4px_10px_rgba(255,255,255,0.9)]">
      <table className={`w-full ${compact ? "text-xs" : "text-sm"} ${className}`}>
        {children}
      </table>
    </div>
  );
}

type TableHeaderProps = {
  children: ReactNode;
  className?: string;
};

export function TableHeader({
  children,
  className = "",
}: TableHeaderProps) {
  return (
    <thead
      className={`border-b border-[#D7E3EF] bg-[#F4F8FC] ${className}`}
    >
      {children}
    </thead>
  );
}

type TableBodyProps = {
  children: ReactNode;
  className?: string;
};

export function TableBody({
  children,
  className = "",
}: TableBodyProps) {
  return (
    <tbody className={`divide-y divide-[#E5EDF5] ${className}`}>
      {children}
    </tbody>
  );
}

type TableRowProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
};

export function TableRow({
  children,
  className = "",
  onClick,
}: TableRowProps) {
  return (
    <tr
      className={`transition-colors duration-150 hover:bg-[#F8FBFF] ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

type TableCellProps = {
  children: ReactNode;
  className?: string;
  colSpan?: number;
  compact?: boolean;
};

export function TableCell({
  children,
  className = "",
  colSpan,
  compact = false,
}: TableCellProps) {
  const paddingClass = compact ? "px-3 py-2" : "px-4 py-3";

  return (
    <td
      className={`${paddingClass} text-[#102A56] ${className}`}
      colSpan={colSpan}
    >
      {children}
    </td>
  );
}

type TableHeadProps = {
  children: ReactNode;
  className?: string;
  compact?: boolean;
};

export function TableHead({
  children,
  className = "",
  compact = false,
}: TableHeadProps) {
  const paddingClass = compact ? "px-3 py-2" : "px-4 py-3";

  return (
    <th
      className={`${paddingClass} text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748B] ${className}`}
    >
      {children}
    </th>
  );
}
