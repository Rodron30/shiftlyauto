"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectTo = searchParams.get("redirectTo") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");
    setResetSent(false);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      console.error("Sign in error:", err);
      setError("Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setResetSent(false);
    setGoogleLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const { error: googleError } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo:
              typeof window !== "undefined"
                ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(
                    redirectTo
                  )}`
                : undefined,
          },
        });

      if (googleError) {
        setError(googleError.message);
      }
    } catch (err) {
      console.error("Google sign in error:", err);
      setError("Unable to connect to Google. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError(
        "Enter your email above first, then click Forgot Password."
      );
      return;
    }

    setError("");
    setResetSent(false);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo:
              typeof window !== "undefined"
                ? `${window.location.origin}/reset-password`
                : undefined,
          }
        );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setResetSent(
        true
      );
    } catch (err) {
      console.error("Password reset request error:", err);
      setError(
        "Unable to send the password reset email. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || googleLoading;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Shiftly Auto
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Dealer Vehicle Intelligence
          </p>
        </div>

        <form
          onSubmit={handleSignIn}
          className="mt-8 space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 outline-none focus:border-black"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 outline-none focus:border-black"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {resetSent && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              Password reset email sent — check your inbox.
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-black py-2.5 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white py-2.5 font-semibold text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
            >
              <path
                fill="#4285F4"
                d="M21.35 12.23c0-.79-.07-1.55-.23-2.27H12v4.3h5.22a4.47 4.47 0 0 1 5.22 4.3h3.14c1.84-1.69 2.93-4.18 2.93-7.39Z"
              />
              <path
                fill="#34A853"
                d="M12 21.9c2.63 0 4.84-.87 6.45-2.35l-3.14-2.43c-.87.58-1.98.93-3.31.93-2.54 0-4.7-1.72-5.47-4.03H3.28v2.5A9.75 9.75 0 0 0 12 21.9Z"
              />
              <path
                fill="#FBBC05"
                d="M6.53 14.02A5.86 5.86 0 0 1 6.22 12c0-.7.12-1.38.31-2.02V7.48H3.28A9.74 9.74 0 0 0 2.25 12c0 1.57.38 3.06 1.03 4.52l3.25-2.5Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.95c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.02 14.63 2.1 12 2.1a9.75 9.75 0 0 0-8.72 5.38l3.25 2.5c.77-2.31 2.93-4.03 5.47-4.03Z"
              />
            </svg>

            {googleLoading
              ? "Connecting to Google..."
              : "Continue with Google"}
          </button>

          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={busy}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-900 disabled:cursor-not-allowed"
          >
            Forgot Password?
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          New dealership?{" "}
          <Link
            href="/signup"
            className="font-semibold text-gray-900 hover:underline"
          >
            Set up your account
          </Link>
        </p>
      </div>
    </main>
  );
}
