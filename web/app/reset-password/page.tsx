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
    setPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
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
          setError("");
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

    setError("");
    setSuccess("");

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
      <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            Reset Password
          </h1>

          <p className="mt-3 text-sm text-gray-500">
            Verifying your password reset session...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Reset Password
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Create a new password for your Shiftly Auto account.
          </p>
        </div>

        {!ready ? (
          <div className="mt-6">
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <Link
              href="/login"
              className="mt-5 block text-center text-sm font-semibold text-gray-900 hover:underline"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form
            key="reset-password-form"
            onSubmit={handleUpdatePassword}
            className="mt-8 space-y-5"
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
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            {error && !confirmPassword && password === confirmPassword && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            {success && (
              <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-black py-2.5 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {loading
                ? "Updating Password..."
                : "Update Password"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          Remember your password?{" "}
          <Link
            href="/login"
            className="font-semibold text-gray-900 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
