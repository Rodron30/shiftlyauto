"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { PasswordField } from "@/components/PasswordField";
import AuthShell, { AuthIcons, authCls } from "@/components/auth/AuthShell";

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

/* UI helper: card para sa mga status screen (check email, checking, error) */
function StatusCard({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className={authCls.card}>
      <h1 className={authCls.title}>{title}</h1>
      {children && (
        <div className="mt-2 space-y-2 text-xs sm:text-sm text-[#6B7C93]">
          {children}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
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
  const [dealershipChecked, setDealershipChecked] =
    useState(!dealershipSignupCode);
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
    setTimeout(() => {
      setDealershipName("");
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setError("");
      setCheckEmail(false);
    }, 0);
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
          },
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
            dealershipName: String(
              customerResult.dealership_name ?? "your dealership",
            ).trim(),
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
          },
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "This invite is invalid or has expired.",
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
          dealershipName: String(
            result.dealershipName ?? "your dealership",
          ).trim(),
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
            : "This invite is invalid or has expired.",
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

    // Validate dealership signup code
    const activeCode = dealershipSignupCode;
    let cancelled = false;

    async function loadDealership() {
      try {
        setDealershipError("");
        setDealershipChecked(false);

        const response = await fetch(
          `/api/dealership/validate-signup?code=${encodeURIComponent(
            activeCode,
          )}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
            },
          },
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Invalid dealership signup code.");
        }

        if (cancelled) {
          return;
        }

        setDealership({
          id: result.dealership.id,
          name: result.dealership.name || "Your Dealership",
          signupCode: activeCode,
        });

        setDealershipChecked(true);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setDealership(null);

        setDealershipError(
          err instanceof Error
            ? err.message
            : "Invalid dealership signup code.",
        );
      } finally {
        if (!cancelled) {
          setDealershipChecked(true);
        }
      }
    }

    loadDealership();

    return () => {
      cancelled = true;
    };
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
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

      const { data, error: signUpError } = await supabase.auth.signUp({
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
          : "Something went wrong while creating your account.",
      );
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------- UI ------------------------- */

  const shellProps = {};

  if (checkEmail) {
    return (
      <AuthShell {...shellProps}>
        <StatusCard
          title="Check your email"
          action={
            <Link
              href="/login"
              className={`${authCls.primary} inline-flex items-center justify-center`}
            >
              Back to Sign In
            </Link>
          }
        >
          <p>
            We sent a confirmation link to{" "}
            <strong className="text-[#102A56]">{email}</strong>. Click it to
            activate your account.
          </p>
        </StatusCard>
      </AuthShell>
    );
  }

  if (inviteToken && !inviteChecked) {
    return (
      <AuthShell {...shellProps}>
        <StatusCard title="Shiftly Auto">
          <p>Checking invite...</p>
        </StatusCard>
      </AuthShell>
    );
  }

  if (dealershipSignupCode && !dealershipChecked) {
    return (
      <AuthShell {...shellProps}>
        <StatusCard title="Shiftly Auto">
          <p>Checking dealership...</p>
        </StatusCard>
      </AuthShell>
    );
  }

  if (inviteToken && inviteError) {
    return (
      <AuthShell {...shellProps}>
        <StatusCard
          title="Invalid Invite"
          action={
            <Link href="/signup" className={`${authCls.secondary} inline-flex`}>
              Set up a new dealership instead
            </Link>
          }
        >
          <p>{inviteError}</p>
          <p className="text-xs">
            Ask your dealership admin to send a new invite, or set up a new
            dealership below.
          </p>
        </StatusCard>
      </AuthShell>
    );
  }

  if (dealershipSignupCode && dealershipError) {
    return (
      <AuthShell {...shellProps}>
        <StatusCard
          title="Registration Restricted"
          action={
            <Link href="/login" className={`${authCls.secondary} inline-flex`}>
              Back to Sign In
            </Link>
          }
        >
          <p>{dealershipError}</p>
          <p className="text-xs">
            Public customer registration is no longer supported. Please contact
            your dealership administrator for an invitation.
          </p>
        </StatusCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell {...shellProps}>
      <div className={authCls.card}>
        <h1 className={authCls.title}>
          {invite?.isCustomerInvite
            ? "Complete Your Customer Account"
            : invite
              ? "Join Your Dealership"
              : dealership
                ? "Create Customer Account"
                : "Create Your Account"}
        </h1>
        <p className={authCls.sub}>
          {invite?.isCustomerInvite
            ? `You've been invited to ${invite.dealershipName} as a customer.`
            : invite
              ? `You're joining ${invite.dealershipName} as a ${invite.role}.`
              : dealership
                ? `Create your customer account for ${dealership.name}.`
                : "Get started with Shiftly Auto today"}
        </p>

        <form
          key={`${inviteToken}-${dealershipSignupCode}`}
          onSubmit={handleSignUp}
          className="mt-3 space-y-3"
        >
          {dealership && (
            <div className="rounded-xl border border-[#B8D0EB] bg-[#F5F9FD] p-3 text-xs text-[#6B7C93]">
              <p className="font-medium text-[#102A56]">
                Public customer registration is no longer supported
              </p>
              <p className="mt-1">
                Please contact your dealership administrator for an invitation.
              </p>
            </div>
          )}

          {!dealership && (
            <>
              <div>
                <label htmlFor="fullName" className={authCls.label}>
                  Full Name
                </label>
                <div className="relative">
                  <span className={authCls.iconLeft}>
                    <AuthIcons.user className="h-4 w-4" />
                  </span>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`${authCls.input} pl-10`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className={authCls.label}>
                  Email Address
                </label>
                <div className="relative">
                  <span className={authCls.iconLeft}>
                    <AuthIcons.mail className="h-4 w-4" />
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    readOnly={Boolean(invite)}
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${authCls.input} pl-10 read-only:bg-[#E8F0FA] read-only:text-[#8B9DB3]`}
                  />
                </div>
              </div>

              {!invite && (
                <div>
                  <label htmlFor="dealershipName" className={authCls.label}>
                    Dealership / Organization
                  </label>
                  <div className="relative">
                    <span className={authCls.iconLeft}>
                      <AuthIcons.building className="h-4 w-4" />
                    </span>
                    <input
                      id="dealershipName"
                      name="dealershipName"
                      type="text"
                      required
                      autoComplete="organization"
                      value={dealershipName}
                      onChange={(e) => setDealershipName(e.target.value)}
                      placeholder="Enter your dealership name"
                      className={`${authCls.input} pl-10`}
                    />
                  </div>
                </div>
              )}

              <PasswordField
                variant="auth"
                label="Password"
                id="password"
                name="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
                placeholder="Create a password (min. 8 characters)"
                minLength={8}
              />

              <PasswordField
                variant="auth"
                label="Confirm Password"
                id="confirmPassword"
                name="confirmPassword"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Confirm your password"
                minLength={8}
                error={
                  confirmPassword && password !== confirmPassword
                    ? "Passwords do not match."
                    : undefined
                }
              />

              {error && <p className={authCls.error}>{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className={`${authCls.primary} flex items-center justify-center gap-2`}
              >
                <AuthIcons.userPlus className="h-4 w-4" />
                {loading
                  ? "Creating account..."
                  : invite?.isCustomerInvite
                    ? "Complete Customer Account"
                    : invite
                      ? "Join Dealership"
                      : dealership
                        ? "Create Customer Account"
                        : "Create Account"}
              </button>
            </>
          )}
        </form>

        <p className="mt-4 text-center text-xs text-[#8B9DB3]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-[#1677FF] transition-colors hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
