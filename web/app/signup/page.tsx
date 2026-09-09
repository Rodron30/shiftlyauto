"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type InviteInfo = {
  email: string;
  role: string;
  dealershipName: string;
};

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const inviteToken = searchParams.get("invite");

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [inviteChecked, setInviteChecked] = useState(!inviteToken);
  const [inviteError, setInviteError] = useState("");

  const [dealershipName, setDealershipName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    if (!inviteToken) {
      return;
    }

    const activeInviteToken = inviteToken;
    let cancelled = false;

    async function loadInvite() {
      try {
        setInviteError("");
        setInviteChecked(false);

        const response = await fetch(
          `/api/team/invite/${encodeURIComponent(activeInviteToken)}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
            },
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error ||
              "This invite is invalid or has expired."
          );
        }

        if (cancelled) {
          return;
        }

        const inviteEmail = String(result.email ?? "")
          .trim()
          .toLowerCase();

        setInvite({
          email: inviteEmail,
          role: String(result.role ?? "salesperson"),
          dealershipName:
            String(result.dealershipName ?? "your dealership").trim(),
        });

        setEmail(inviteEmail);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setInvite(null);

        setInviteError(
          err instanceof Error
            ? err.message
            : "This invite is invalid or has expired."
        );
      } finally {
        if (!cancelled) {
          setInviteChecked(true);
        }
      }
    }

    loadInvite();

    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFullName = fullName.trim();
    const normalizedDealershipName = dealershipName.trim();

    if (!normalizedFullName) {
      setError("Please enter your full name.");
      return;
    }

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    // Basic browser-independent email validation.
    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (!invite && !normalizedDealershipName) {
      setError("Please enter your dealership name.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const metadata = invite
        ? {
            invite_token: inviteToken,
            full_name: normalizedFullName,
          }
        : {
            dealership_name: normalizedDealershipName,
            full_name: normalizedFullName,
          };

      const { data, error: signUpError } =
        await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: metadata,

            emailRedirectTo:
              typeof window !== "undefined"
                ? `${window.location.origin}/auth/callback`
                : undefined,
          },
        });

      if (signUpError) {
        console.error("Signup error:", signUpError);

        setError(signUpError.message);
        return;
      }

      if (!data.session) {
        setEmail(normalizedEmail);
        setCheckEmail(true);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Unexpected signup error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while creating your account."
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkEmail) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            Check your email
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            We sent a confirmation link to{" "}
            <strong>{email}</strong>. Click it to activate
            your account.
          </p>

          <Link
            href="/login"
            className="mt-6 inline-flex text-sm font-semibold text-gray-900 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  if (inviteToken && !inviteChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <p className="text-sm text-gray-500">
          Checking invite...
        </p>
      </main>
    );
  }

  if (inviteToken && inviteError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-red-600">
            {inviteError}
          </p>

          <p className="mt-2 text-sm text-gray-500">
            Ask your dealership admin to send a new invite,
            or set up a new dealership below.
          </p>

          <Link
            href="/signup"
            className="mt-4 inline-flex text-sm font-semibold text-gray-900 hover:underline"
          >
            Set up a new dealership instead
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {invite
              ? "Join Your Dealership"
              : "Set Up Your Dealership"}
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            {invite
              ? `You're joining ${invite.dealershipName} as a ${invite.role}.`
              : "Create your dealership's Shiftly Auto account."}
          </p>
        </div>

        <form
          onSubmit={handleSignUp}
          className="mt-8 space-y-4"
        >
          {!invite && (
            <div>
              <label
                htmlFor="dealershipName"
                className="block text-sm font-medium text-gray-700"
              >
                Dealership Name
              </label>

              <input
                id="dealershipName"
                type="text"
                required
                value={dealershipName}
                onChange={(e) =>
                  setDealershipName(e.target.value)
                }
                placeholder="e.g. Downtown Motors"
                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 outline-none focus:border-black"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-gray-700"
            >
              Your Full Name
            </label>

            <input
              id="fullName"
              type="text"
              required
              autoComplete="name"
              placeholder="e.g. John Smith"
              value={fullName}
              onChange={(e) =>
                setFullName(e.target.value)
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 outline-none focus:border-black"
            />
          </div>

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
              readOnly={Boolean(invite)}
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 outline-none focus:border-black read-only:bg-gray-50 read-only:text-gray-500"
            />

            {invite && (
              <p className="mt-1 text-xs text-gray-400">
                This email is locked to the dealership
                invitation.
              </p>
            )}
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
              minLength={8}
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 outline-none focus:border-black"
            />

            <p className="mt-1 text-xs text-gray-400">
              Minimum 8 characters.
            </p>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black py-2.5 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading
              ? "Creating account..."
              : invite
                ? "Join Dealership"
                : "Create Dealership Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}

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