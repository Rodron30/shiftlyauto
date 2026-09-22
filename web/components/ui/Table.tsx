import type { ReactNode } from "react";

type TableProps = {
  children: ReactNode;
  className?: string;
};

export function Table({ children, className = "" }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${className}`}>
        {children}
      </table>
    </div>
  );
}

type TableHeaderProps = {
  children: ReactNode;
  className?: string;
};

export function TableHeader({ children, className = "" }: TableHeaderProps) {
  return <thead className={`bg-gray-50 ${className}`}>{children}</thead>;
}

type TableBodyProps = {
  children: ReactNode;
  className?: string;
};

export function TableBody({ children, className = "" }: TableBodyProps) {
  return <tbody className={`divide-y divide-gray-200 ${className}`}>{children}</tbody>;
}

type TableRowProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
};

export function TableRow({ children, className = "", onClick }: TableRowProps) {
  return (
    <tr
      className={`hover:bg-gray-50 ${onClick ? "cursor-pointer" : ""} ${className}`}
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
};

export function TableCell({ children, className = "", colSpan }: TableCellProps) {
  return (
    <td className={`px-4 py-3 text-gray-900 ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}

type TableHeadProps = {
  children: ReactNode;
  className?: string;
};

export function TableHead({ children, className = "" }: TableHeadProps) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 ${className}`}>
      {children}
    </th>
  );
}
