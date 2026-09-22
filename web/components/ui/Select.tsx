import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  helperText?: string;
};

export function Select({ label, error, helperText, className = "", children, ...props }: SelectProps) {
  const baseStyles = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500";
  
  const errorStyles = error ? "border-red-500 focus:border-red-600 focus:ring-red-600" : "";
  
  return (
    <div className="flex flex-col">
      {label && (
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </label>
      )}
      
      <select
        className={`${baseStyles} ${errorStyles} ${className}`}
        {...props}
      >
        {children}
      </select>
      
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="mt-1 text-xs text-gray-500">{helperText}</p>
      )}
    </div>
  );
}
