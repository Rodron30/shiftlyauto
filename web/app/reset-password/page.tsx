/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { PasswordField } from "@/components/PasswordField";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [checkingSession, setCheckingSession] = useState(true);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Clear form state on mount to prevent autofill from previous session
  useEffect(() => {
    setTimeout(() => { setPassword(""); }, 0);
    setTimeout(() => { setConfirmPassword(""); }, 0);
    setTimeout(() => { setError(""); }, 0);
    setTimeout(() => { setSuccess(""); }, 0);
  }, []);

  useEffect(() => {
    let mounted = true;

    const supabase = createSupabaseBrowserClient();

    async function checkRecoverySession() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError) {
          console.error(
            "Password recovery session error:",
            sessionError
          );

          setError(
            "Could not load your password recovery session. Please request a new reset link."
          );
          setCheckingSession(false);
          return;
        }

        if (!session) {
          setError(
            "Your password reset session is missing or expired. Please request a new reset link."
          );
          setCheckingSession(false);
          return;
        }

        setReady(true);
        setCheckingSession(false);
      } catch (err) {
        console.error(
          "Password recovery session check error:",
          err
        );

        if (!mounted) return;

        setError(
          "Unable to verify your password reset session. Please request a new reset link."
        );
        setCheckingSession(false);
      }
    }

    void checkRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        if (
          (event === "PASSWORD_RECOVERY" ||
            event === "SIGNED_IN") &&
          session
        ) {
          setReady(true);
          setCheckingSession(false);
          setTimeout(() => { setError(""); }, 0);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleUpdatePassword(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setTimeout(() => { setError(""); }, 0);
    setTimeout(() => { setSuccess(""); }, 0);

    if (!ready) {
      setError(
        "Your password recovery session is not ready. Please request a new reset link."
      );
      return;
    }

    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError(
          "Your password recovery session has expired. Please request a new reset link."
        );
        return;
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        console.error(
          "Password update error:",
          updateError
        );

        setError(updateError.message);
        return;
      }

      setSuccess(
        "Your password has been updated successfully."
      );

      // Revoke all trusted devices after password reset for security
      try {
        await fetch("/api/auth/trusted-devices/revoke-all", {
          method: "POST",
        });
      } catch (revokeError) {
        console.error("Failed to revoke trusted devices after password reset:", revokeError);
        // Don't block the password reset operation
      }

      await supabase.auth.signOut();

      window.setTimeout(() => {
        router.replace("/login");
        router.refresh();
      }, 1200);
    } catch (err) {
      console.error(
        "Unexpected password update error:",
        err
      );

      setError(
        "Something went wrong while updating your password. Please request a new reset link."
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F9FD] px-4">
        <div className="w-full max-w-md">
          {/* Branding Section */}
          <div className="mb-4 text-center">
            <div className="mb-3 flex justify-center">
              <div className="w-48 h-32 bg-white rounded-xl shadow-sm flex items-center justify-center overflow-hidden">
                <img
                  src="/images/car-login.png"
                  alt="Shiftly Auto"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-[#102A56] tracking-tight">
              Shiftly Auto
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#6B7C93]">
              Vehicle Intelligence Platform
            </p>
          </div>

          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="bg-[#1677FF] px-5 py-4">
              <div className="text-center">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Reset Password
                </h1>
              </div>
            </div>

            <div className="px-5 py-4 text-center">
              <p className="text-xs sm:text-sm text-[#8B9DB3]">
                Verifying your password reset session...
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F9FD] px-4">
      <div className="w-full max-w-md">
        {/* Branding Section */}
        <div className="mb-4 text-center">
          <div className="mb-3 flex justify-center">
            <div className="w-48 h-32 bg-white rounded-xl shadow-sm flex items-center justify-center overflow-hidden">
              <img
                src="/images/car-login.png"
                alt="Shiftly Auto"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-[#102A56] tracking-tight">
            Shiftly Auto
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6B7C93]">
            Vehicle Intelligence Platform
          </p>
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="bg-[#1677FF] px-5 py-4">
            <div className="text-center">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Reset Password
              </h1>

              <p className="mt-1 text-xs sm:text-sm text-white/80">
                Create a new password for your Shiftly Auto account.
              </p>
            </div>
          </div>

          <div className="px-5 py-4">
            {!ready ? (
              <div>
                {error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs sm:text-sm text-red-700 shadow-sm">
                    {error}
                  </p>
                )}

                <Link
                  href="/login"
                  className="mt-4 block text-center text-xs sm:text-sm font-semibold text-[#1677FF] hover:underline"
                >
                  Back to Sign In
                </Link>
              </div>
            ) : (
              <form
                key="reset-password-form"
                onSubmit={handleUpdatePassword}
                className="space-y-4"
              >
                <PasswordField
                  label="New Password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={setPassword}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="Minimum 8 characters"
                />

                <PasswordField
                  label="Confirm Password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  error={confirmPassword && password !== confirmPassword ? "Passwords do not match." : undefined}
                />

                {error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs sm:text-sm text-red-700 shadow-sm">
                    {error}
                  </p>
                )}

                {error && !confirmPassword && password === confirmPassword && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs sm:text-sm text-red-700 shadow-sm">
                    {error}
                  </p>
                )}

                {success && (
                  <p className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs sm:text-sm text-green-700 shadow-sm">
                    {success}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#1677FF] border border-[#1677FF] px-3 py-2 text-xs sm:text-sm font-semibold text-white transition-all shadow-sm hover:bg-[#0F5DE9] hover:border-[#0F5DE9] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? "Updating Password..."
                    : "Update Password"}
                </button>
              </form>
            )}

            <p className="mt-4 text-center text-xs sm:text-sm text-[#8B9DB3]">
              Remember your password?{" "}
              <Link
                href="/login"
                className="font-semibold text-[#1677FF] hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
