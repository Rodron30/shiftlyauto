import { useState } from "react";
import { authCls, AuthIcons } from "@/components/auth/AuthShell";

type PasswordFieldProps = {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  minLength?: number;
  error?: string;
  name?: string;
  variant?: "default" | "auth";
};

export function PasswordField({
  label,
  id,
  value,
  onChange,
  required = false,
  autoComplete = "new-password",
  placeholder,
  minLength,
  error,
  name,
  variant = "default",
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const auth = variant === "auth";

  return (
    <div>
      <label
        htmlFor={id}
        className={
          auth
            ? authCls.label
            : "block text-xs font-semibold text-[#6B7C93] uppercase tracking-wide"
        }
      >
        {label}
      </label>

      <div className={auth ? "relative" : "relative mt-2"}>
        {auth && <span className={authCls.iconLeft}><AuthIcons.lock className="h-4 w-4" /></span>}

        <input
          id={id}
          name={name || id}
          type={showPassword ? "text" : "password"}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={
            auth
              ? `${authCls.input} pl-10 pr-11`
              : "w-full rounded-lg border border-[#DCE8F5] bg-white px-3 py-2 pr-10 text-xs sm:text-sm text-[#102A56] outline-none transition-all shadow-sm focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#8B9DB3]"
          }
        />

        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
            auth
              ? "mt-[2px] text-[#6B7C93] hover:text-[#102A56]"
              : "text-[#6B7C93] hover:text-[#102A56]"
          }`}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            {showPassword ? (
              <>
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7c.9 0 1.78-.15 2.6-.45" />
                <line x1="2" x2="22" y1="2" y2="22" />
              </>
            ) : (
              <>
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>

      {!auth && minLength && (
        <p className="mt-1 text-xs text-[#8B9DB3]">
          Minimum {minLength} characters.
        </p>
      )}

      {error && (
        <p className="mt-1 text-xs sm:text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}