"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { PasswordField } from "@/components/PasswordField";
import AuthShell, { AuthIcons, authCls } from "@/components/auth/AuthShell";

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
  const [mfaCode, setMfaCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);

  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);

  // Clear form state on mount to prevent autofill from previous session
  useEffect(() => {
    setTimeout(() => { setEmail(""); }, 0);
    setTimeout(() => { setPassword(""); }, 0);
    setTimeout(() => { setMfaCode(""); }, 0);
    setTimeout(() => { setError(""); }, 0);
    setTimeout(() => { setResetSent(false); }, 0);
    setTimeout(() => { setMfaRequired(searchParams.get("mfa") === "required"); }, 0);
  }, [searchParams]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setTimeout(() => { setError(""); }, 0);
    setTimeout(() => { setResetSent(false); }, 0);
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

      const { data: factorsData, error: factorsError } =
        await supabase.auth.mfa.listFactors();

      if (factorsError) {
        setError(factorsError.message);
        return;
      }

      const verifiedTotp = factorsData?.totp?.find(
        (factor) => factor.status === "verified"
      );

      if (verifiedTotp) {
        const { data: aalData, error: aalError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (aalError) {
          setError(aalError.message);
          return;
        }

        if (
          aalData.currentLevel === "aal1" &&
          aalData.nextLevel === "aal2"
        ) {
          // Check for trusted device before requiring MFA
          try {
            const verifyResponse = await fetch("/api/auth/verify-trusted-device", {
              method: "POST",
            });
            const verifyResult = await verifyResponse.json();

            if (verifyResult.success && verifyResult.trusted) {
              // Trusted device verified - skip MFA
              router.push(redirectTo);
              router.refresh();
              return;
            }
          } catch (verifyError) {
            console.error("Trusted device verification error:", verifyError);
            // Fall through to MFA on error
          }

          setMfaRequired(true);
          return;
        }
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

  const handleMfaVerify = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!/^\d{6}$/.test(mfaCode)) {
      setError("Enter the 6-digit authenticator code.");
      return;
    }

    setTimeout(() => { setError(""); }, 0);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const { data: factorsData, error: factorsError } =
        await supabase.auth.mfa.listFactors();

      if (factorsError) {
        setError(factorsError.message);
        return;
      }

      const verifiedTotp = factorsData?.totp?.find(
        (factor) => factor.status === "verified"
      );

      if (!verifiedTotp) {
        setError("No verified authenticator factor was found.");
        setMfaRequired(false);
        return;
      }

      const { error: verifyError } =
        await supabase.auth.mfa.challengeAndVerify({
          factorId: verifiedTotp.id,
          code: mfaCode,
        });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      // If user checked "Trust this device", create trusted device record
      if (trustDevice) {
        try {
          await fetch("/api/auth/trusted-device", {
            method: "POST",
          });
        } catch (trustError) {
          console.error("Failed to create trusted device:", trustError);
          // Don't block login on trusted device failure
        }
      }

      setTimeout(() => { setMfaCode(""); }, 0);
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      console.error("MFA verification error:", err);
      setError("Unable to verify the authenticator code.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setTimeout(() => { setError(""); }, 0);
    setTimeout(() => { setResetSent(false); }, 0);
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

    setTimeout(() => { setError(""); }, 0);
    setTimeout(() => { setResetSent(false); }, 0);
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

      setResetSent(true);
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

  /* -------------------------------------------------- */

  const shellProps = {};

  if (mfaRequired) {
    return (
      <AuthShell {...shellProps}>
        <div className={authCls.card}>
          <h1 className={authCls.title}>Verify Your Identity</h1>
          <p className={authCls.sub}>
            Enter the 6-digit verification code from your authenticator app.
          </p>

          <form onSubmit={handleMfaVerify} className="mt-5 space-y-3">
            <div>
              <label htmlFor="mfa-code" className={authCls.label}>
                Verification Code
              </label>
              <input
                id="mfa-code"
                name="mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                required
                value={mfaCode}
                onChange={(e) =>
                  setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className={`${authCls.input} text-center font-semibold tracking-[0.3em]`}
              />
            </div>

            {error && <p className={authCls.error}>{error}</p>}

            <div className="flex items-start gap-3 rounded-xl border border-[#E4ECF5] bg-[#F8FBFF] px-3.5 py-3">
              <input
                id="trust-device"
                type="checkbox"
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
                disabled={busy}
                className="mt-0.5 h-4 w-4 rounded-xl border border-[#B8D0EB] bg-white text-[#1677FF] focus:ring-[#1677FF] focus:ring-offset-0"
              />
              <label
                htmlFor="trust-device"
                className="cursor-pointer text-xs sm:text-sm leading-relaxed text-[#6B7C93]"
              >
                Trust this device for 30 days. You won&apos;t be asked for your verification code again on this device until the trusted-device period expires or you revoke it.
              </label>
            </div>

            <button
              type="submit"
              disabled={busy || mfaCode.length !== 6}
              className={authCls.primary}
            >
              {loading ? "Verifying..." : "Verify & Sign In"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMfaRequired(false);
                setTimeout(() => { setMfaCode(""); }, 0);
                setTimeout(() => { setError(""); }, 0);
              }}
              disabled={busy}
              className="w-full text-center text-xs font-medium text-[#64748B] transition-colors hover:text-[#1677FF] disabled:cursor-not-allowed sm:text-sm"
            >
              Back to Sign In
            </button>
          </form>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell {...shellProps}>
      <div className={authCls.card}>
        <h1 className={authCls.title}>Welcome back</h1>
        <p className={authCls.sub}>Sign in to your Shiftly Auto account</p>

        <form
          key={searchParams.toString()}
          onSubmit={handleSignIn}
          className="mt-5 space-y-3"
        >
          <div>
            <label htmlFor="email" className={authCls.label}>
              Email Address
            </label>
            <div className="relative">
              <span className={authCls.iconLeft}><AuthIcons.mail className="h-4 w-4" /></span>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${authCls.input} pl-10`}
                placeholder="Enter your email address"
              />
            </div>
          </div>

          <PasswordField
            variant="auth"
            label="Password"
            id="password"
            name="password"
            value={password}
            onChange={setPassword}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                id="remember"
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border border-[#B8D0EB] bg-white text-[#1677FF] focus:ring-[#1677FF] focus:ring-offset-0"
              />
              <label htmlFor="remember" className="cursor-pointer text-xs sm:text-sm text-[#6B7C93]">
                Remember me
              </label>
            </div>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={busy}
              className="text-xs font-semibold text-[#1677FF] transition-colors hover:text-[#0F67E8] hover:underline disabled:cursor-not-allowed sm:text-sm"
            >
              Forgot password?
            </button>
          </div>

          {error && <p className={authCls.error}>{error}</p>}

          {resetSent && (
            <p className={authCls.info}>
              Password reset email sent - check your inbox.
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`${authCls.primary} flex items-center justify-center gap-2`}
          >
            <AuthIcons.login className="h-4 w-4" />
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#DCE8F5]" />
            </div>
            <div className="relative flex justify-center text-[11px] font-medium">
              <span className="bg-white px-2 text-[#8B9DB3]">OR</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy}
            className={`${authCls.secondary} gap-3`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {googleLoading ? "Connecting to Google..." : "Continue with Google"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs leading-5 text-[#8B9DB3] sm:text-sm">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-[#1677FF] transition-colors hover:text-[#0F67E8] hover:underline"
          >
            Create account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}




