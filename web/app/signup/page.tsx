"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { PasswordField } from "@/components/PasswordField";

type InviteInfo = {
  email: string;
  role: string;
  dealershipName: string;
  customerName?: string;
  isCustomerInvite?: boolean;
};

type DealershipInfo = {
  id: string;
  name: string;
  signupCode: string;
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
  const dealershipSignupCode = searchParams.get("dealership");

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [inviteChecked, setInviteChecked] = useState(!inviteToken);
  const [inviteError, setInviteError] = useState("");

  const [dealership, setDealership] = useState<DealershipInfo | null>(null);
  const [dealershipChecked, setDealershipChecked] = useState(!dealershipSignupCode);
  const [dealershipError, setDealershipError] = useState("");

  const [dealershipName, setDealershipName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);

  // Clear form state on mount to prevent autofill from previous session
  useEffect(() => {
    setDealershipName("");
    setFullName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setCheckEmail(false);
  }, [inviteToken, dealershipSignupCode]);

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

        // First try to validate as a customer invite
        const customerResponse = await fetch(
          `/api/customer/validate-invite?token=${encodeURIComponent(activeInviteToken)}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
            },
          }
        );

        const customerResult = await customerResponse.json();

        if (customerResponse.ok && customerResult.success) {
          if (cancelled) {
            return;
          }

          const inviteEmail = String(customerResult.email ?? "")
            .trim()
            .toLowerCase();

          setInvite({
            email: inviteEmail,
            role: "customer",
            dealershipName:
              String(customerResult.dealership_name ?? "your dealership").trim(),
            customerName: customerResult.customer_name,
            isCustomerInvite: true,
          });

          setEmail(inviteEmail);
          setFullName(customerResult.customer_name || "");
          setInviteChecked(true);
          return;
        }

        // If not a customer invite, try team invite
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
          isCustomerInvite: false,
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

  useEffect(() => {
    if (!dealershipSignupCode) {
      return;
    }

    // DISABLED: Public customer signup via dealership codes is no longer supported
    // Customers must be invited by admin through the new customer invitation system
    setDealershipError(
      "Public customer registration is no longer supported. Please contact your dealership administrator for an invitation."
    );
    setDealershipChecked(true);
  }, [dealershipSignupCode]);

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

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!invite && !dealership && !normalizedDealershipName) {
      setError("Please enter your dealership name.");
      return;
    }

    // Customer signup: must have dealership code
    if (dealership && normalizedDealershipName) {
      setError("Customer signup uses dealership link, not dealership name.");
      return;
    }

    // Customer invitations are handled separately
    if (invite?.isCustomerInvite) {
      // Customer signup via invitation - role is always customer
      // The name can be updated by the customer
    }

    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const metadata = invite
        ? {
            invite_token: inviteToken,
            full_name: normalizedFullName,
          }
        : dealership
        ? {
            dealership_signup_code: dealership.signupCode,
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
        // Don't persist email - let user re-enter it after email confirmation
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
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-neutral-900">
            Check your email
          </h1>

          <p className="mt-3 text-sm text-neutral-600">
            We sent a confirmation link to{" "}
            <strong>{email}</strong>. Click it to activate
            your account.
          </p>

          <Link
            href="/login"
            className="mt-6 inline-flex text-sm font-semibold text-neutral-900 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  if (inviteToken && !inviteChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <p className="text-sm text-neutral-500">
          Checking invite...
        </p>
      </main>
    );
  }

  if (dealershipSignupCode && !dealershipChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <p className="text-sm text-neutral-500">
          Checking dealership...
        </p>
      </main>
    );
  }

  if (inviteToken && inviteError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-red-600">
            {inviteError}
          </p>

          <p className="mt-2 text-sm text-neutral-500">
            Ask your dealership admin to send a new invite,
            or set up a new dealership below.
          </p>

          <Link
            href="/signup"
            className="mt-4 inline-flex text-sm font-semibold text-neutral-900 hover:underline"
          >
            Set up a new dealership instead
          </Link>
        </div>
      </main>
    );
  }

  if (dealershipSignupCode && dealershipError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-red-600">
            {dealershipError}
          </p>

          <p className="mt-2 text-sm text-neutral-500">
            Public customer registration is no longer supported.
            Please contact your dealership administrator for an invitation.
          </p>

          <Link
            href="/login"
            className="mt-4 inline-flex text-sm font-semibold text-neutral-900 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900">
            {invite?.isCustomerInvite
              ? "Complete Your Customer Account"
              : invite
              ? "Join Your Dealership"
              : dealership
              ? "Create Customer Account"
              : "Set Up Your Dealership"}
          </h1>

          <p className="mt-1 text-sm text-neutral-500">
            {invite?.isCustomerInvite
              ? `You've been invited to ${invite.dealershipName} as a customer.`
              : invite
              ? `You're joining ${invite.dealershipName} as a ${invite.role}.`
              : dealership
              ? `Create your customer account for ${dealership.name}.`
              : "Create your dealership's Shiftly Auto account."}
          </p>
        </div>

        <form
          key={`${inviteToken}-${dealershipSignupCode}`}
          onSubmit={handleSignUp}
          className="mt-8 space-y-4"
        >
          {!invite && !dealership && (
            <div>
              <label
                htmlFor="dealershipName"
                className="block text-sm font-medium text-neutral-700"
              >
                Dealership Name
              </label>

              <input
                id="dealershipName"
                name="dealershipName"
                type="text"
                required
                autoComplete="organization"
                value={dealershipName}
                onChange={(e) =>
                  setDealershipName(e.target.value)
                }
                placeholder="e.g. Downtown Motors"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-neutral-900 outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
              />
            </div>
          )}

          {dealership && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <p className="font-medium">Public customer registration is no longer supported</p>
              <p className="mt-1">Please contact your dealership administrator for an invitation.</p>
            </div>
          )}

          {!dealership && (
            <>
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-medium text-neutral-700"
                >
                  Your Full Name
                </label>

                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="e.g. John Smith"
                  value={fullName}
                  onChange={(e) =>
                    setFullName(e.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-neutral-900 outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-neutral-700"
                >
                  Email
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  readOnly={Boolean(invite)}
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-neutral-900 outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 read-only:bg-neutral-50 read-only:text-neutral-500"
                />
              </div>

              <PasswordField
                label="Password"
                id="password"
                name="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
                placeholder="Create a password"
                minLength={8}
              />

              <PasswordField
                label="Confirm Password"
                id="confirmPassword"
                name="confirmPassword"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Confirm your password"
                minLength={8}
                error={confirmPassword && password !== confirmPassword ? "Passwords do not match." : undefined}
              />

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black py-2.5 font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {loading
              ? "Creating account..."
              : invite?.isCustomerInvite
                ? "Complete Customer Account"
                : invite
                ? "Join Dealership"
                : dealership
                ? "Create Customer Account"
                : "Create Dealership Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Already have an account?{" "}

          <Link
            href="/login"
            className="font-semibold text-neutral-900 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}