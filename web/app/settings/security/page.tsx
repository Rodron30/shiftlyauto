/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  BackIcon,
  SecurityIcon,
  RefreshIcon,
  CheckIcon,
  XIcon,
  TrashIcon,
  ClockIcon,
  UserIcon,
  PlusIcon,
} from "@/components/icons";

type Factor = {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: "verified" | "unverified";
  created_at: string;
  updated_at: string;
};

type TrustedDevice = {
  id: string;
  device_name: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  revoked_at: string | null;
};

export default function SecurityPage() {
  const supabase = createSupabaseBrowserClient();

  const [factor, setFactor] = useState<Factor | null>(null);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadFactor = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const totpFactor = data?.all?.find(
      (item) =>
        item.factor_type === "totp" &&
        (item.status === "verified" || item.status === "unverified"),
    );

    setFactor(totpFactor ?? null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    setTimeout(() => {
      void loadFactor();
      void loadTrustedDevices();
    }, 0);
  }, [loadFactor]);

  async function loadTrustedDevices() {
    setLoadingDevices(true);
    try {
      const response = await fetch("/api/auth/trusted-devices");
      const result = await response.json();

      if (result.success) {
        setTrustedDevices(result.trusted_devices || []);
      }
    } catch (err) {
      console.error("Failed to load trusted devices:", err);
    } finally {
      setLoadingDevices(false);
    }
  }

  async function handleRevokeDevice(deviceId: string) {
    if (
      !confirm(
        "Revoke this trusted device? You will need to complete MFA verification on this device again.",
      )
    ) {
      return;
    }

    setRevoking(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/auth/trusted-devices/${deviceId}`, {
        method: "PATCH",
      });
      const result = await response.json();

      if (result.success) {
        setMessage("Trusted device revoked successfully.");
        await loadTrustedDevices();
      } else {
        setError(result.error || "Failed to revoke trusted device.");
      }
    } catch (err) {
      console.error("Failed to revoke trusted device:", err);
      setError("Failed to revoke trusted device.");
    } finally {
      setRevoking(false);
    }
  }

async function handleDeleteDevice(deviceId: string) {
  if (!confirm("Permanently delete this trusted-device record? This cannot be undone. This will not disable 2FA.")) {
    return;
  }

  setRevoking(true);
  setError("");
  setMessage("");

  try {
    const response = await fetch(`/api/auth/trusted-devices/${deviceId}`, {
      method: "DELETE",
    });
    const result = await response.json();

    if (response.ok && result.success) {
      setMessage("Trusted-device record permanently deleted.");
      await loadTrustedDevices();
    } else {
      setError(result.error || "Failed to permanently delete trusted device.");
    }
  } catch (err) {
    console.error("Failed to delete trusted device:", err);
    setError("Failed to permanently delete trusted device.");
  } finally {
    setRevoking(false);
  }
}
  async function handleRevokeAll() {
    if (
      !confirm(
        "Revoke all trusted devices? You will need to complete MFA verification on all devices again.",
      )
    ) {
      return;
    }

    setRevoking(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/trusted-devices/revoke-all", {
        method: "POST",
      });
      const result = await response.json();

      if (result.success) {
        setMessage("All trusted devices revoked successfully.");
        await loadTrustedDevices();
      } else {
        setError(result.error || "Failed to revoke all trusted devices.");
      }
    } catch (err) {
      console.error("Failed to revoke all trusted devices:", err);
      setError("Failed to revoke all trusted devices.");
    } finally {
      setRevoking(false);
    }
  }

async function handleDeleteAllDevices() {
  if (!confirm("PERMANENTLY DELETE ALL trusted-device records for your account? This cannot be undone and will not disable 2FA.")) {
    return;
  }

  setRevoking(true);
  setError("");
  setMessage("");

  try {
    const response = await fetch("/api/auth/trusted-devices/revoke-all", {
      method: "DELETE",
    });
    const result = await response.json();

    if (response.ok && result.success) {
      setMessage("All trusted-device records permanently deleted.");
      await loadTrustedDevices();
    } else {
      setError(result.error || "Failed to permanently delete all trusted devices.");
    }
  } catch (err) {
    console.error("Failed to delete all trusted devices:", err);
    setError("Failed to permanently delete all trusted devices.");
  } finally {
    setRevoking(false);
  }
}
  async function handleEnable() {
    setEnrolling(true);
    setError("");
    setMessage("");

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Shiftly Auto Authenticator",
      issuer: "Shiftly Auto",
    });

    if (error) {
      setError(error.message);
      setEnrolling(false);
      return;
    }

    if (!data?.totp) {
      setError("Unable to generate the authenticator setup.");
      setEnrolling(false);
      return;
    }

    setFactor({
      id: data.id,
      factor_type: data.type,
      status: "unverified",
      friendly_name: data.friendly_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setEnrolling(false);
  }

  async function handleVerify() {
    if (!factor?.id) {
      setError("Authenticator setup was not found.");
      return;
    }

    if (!/^\d{6}$/.test(verificationCode)) {
      setError("Enter the 6-digit authenticator code.");
      return;
    }

    setVerifying(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: verificationCode,
    });

    if (error) {
      setError(error.message);
      setVerifying(false);
      return;
    }

    setVerificationCode("");
    setQrCode("");
    setSecret("");
    setMessage("Authenticator app enabled successfully.");

    await loadFactor();
    setVerifying(false);
  }

  async function handleResetUnverified() {
    if (!factor?.id || factor.status !== "unverified") return;

    const confirmed = window.confirm(
      "Cancel this incomplete authenticator setup and generate a new QR code?",
    );

    if (!confirmed) return;

    setDisabling(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.mfa.unenroll({
      factorId: factor.id,
    });

    if (error) {
      setError(error.message);
      setDisabling(false);
      return;
    }

    setFactor(null);
    setQrCode("");
    setSecret("");
    setMessage(
      "Incomplete authenticator setup removed. Click Enable Authenticator to generate a new QR code.",
    );
    setDisabling(false);
  }
  async function handleDisable() {
    if (!factor?.id) return;

    const confirmed = window.confirm(
      "Disable two-factor authentication for this account? This will also revoke all trusted devices.",
    );

    if (!confirmed) return;

    setDisabling(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.mfa.unenroll({
      factorId: factor.id,
    });

    if (error) {
      setError(error.message);
      setDisabling(false);
      return;
    }

    // Revoke all trusted devices when MFA is disabled
    try {
      await fetch("/api/auth/trusted-devices/revoke-all", {
        method: "POST",
      });
    } catch (err) {
      console.error("Failed to revoke trusted devices:", err);
      // Don't block the disable operation
    }

    setFactor(null);
    setTrustedDevices([]);
    setMessage(
      "Two-factor authentication has been disabled and all trusted devices have been revoked.",
    );
    setDisabling(false);
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-3 pb-6 sm:px-4 lg:px-5">
        <div className="flex items-center justify-center py-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
            <RefreshIcon className="h-5 w-5 animate-spin" />
          </span>
          <p className="ml-3 text-sm font-medium text-[#64748B]">
            Loading security settings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pb-6 sm:px-4 lg:px-5">
      <div className="mb-5">
        <Link
          href="/settings"
          className="group mb-3 inline-flex items-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-3.5 py-2 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF] hover:text-[#1677FF]"
        >
          <BackIcon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
          <span>Back to Settings</span>
        </Link>

        <div className="rounded-2xl border border-[#DCE8F5] bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
              <SecurityIcon className="h-4 w-4" />
            </span>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">
                Security Settings
              </p>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
                Security
              </h1>

              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#64748B]">
                Manage multi-factor authentication, trusted devices, and account
                security.
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <XIcon className="h-4 w-4 shrink-0" />
            {error}
          </div>
        </div>
      )}

      {message && (
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <div className="flex items-center gap-2">
            <CheckIcon className="h-4 w-4 shrink-0" />
            {message}
          </div>
        </div>
      )}

      {/* MFA Section */}
      <section className="mb-5 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
              <SecurityIcon className="h-4 w-4" />
            </span>

            <div>
              <h2 className="text-base font-bold text-[#102A56]">
                Two-Factor Authentication
              </h2>

              <p className="text-xs text-[#64748B]">
                Use an authenticator app to add an additional security step
              </p>
            </div>
          </div>

          {factor?.status === "verified" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-2.5 py-1 text-xs font-semibold text-[#166534]">
              <CheckIcon className="h-3 w-3" />
              Enabled
            </span>
          )}
        </div>

        {factor?.status === "unverified" && !qrCode && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 shrink-0" />
              An incomplete authenticator setup is already associated with this
              account.
            </div>

            <button
              type="button"
              onClick={handleResetUnverified}
              disabled={disabling}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <XIcon className="h-4 w-4" />
              {disabling ? "Removing..." : "Reset Incomplete Setup"}
            </button>
          </div>
        )}

        {!factor && !qrCode && (
          <div className="mt-4">
            <button
              type="button"
              onClick={handleEnable}
              disabled={enrolling}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:bg-[#CBD5E1]"
            >
              <PlusIcon className="h-4 w-4" />
              {enrolling ? "Setting up..." : "Enable Authenticator"}
            </button>
          </div>
        )}

        {factor?.status === "unverified" && qrCode && (
          <div className="mt-5 border-t border-[#E7EEF6] pt-5">
            <h3 className="text-base font-bold text-[#102A56]">
              Set up your authenticator app
            </h3>

            <p className="mt-1.5 text-sm text-[#64748B]">
              Scan this QR code using Google Authenticator, Microsoft
              Authenticator, 1Password, or another compatible TOTP app.
            </p>

            <div className="mt-4 flex justify-center rounded-xl border border-[#DCE8F5] bg-white p-6">
              <img
                src={qrCode}
                alt="Authenticator setup QR code"
                className="h-48 w-48"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold text-[#334155]">
                Manual setup key
              </label>

              <input
                type="text"
                readOnly
                value={secret}
                onFocus={(event) => event.currentTarget.select()}
                className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 font-mono text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
              />

              <p className="mt-1.5 text-sm text-[#64748B]">
                Use this key only if you cannot scan the QR code. Keep it
                private.
              </p>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold text-[#334155]">
                Verification code
              </label>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(event) =>
                  setVerificationCode(
                    event.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm tracking-[0.3em] text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
              />
            </div>

            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying || verificationCode.length !== 6}
              className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:bg-[#CBD5E1]"
            >
              <CheckIcon className="h-4 w-4" />
              {verifying ? "Verifying..." : "Verify & Enable"}
            </button>
          </div>
        )}

        {factor?.status === "verified" && (
          <div className="mt-4 border-t border-[#E7EEF6] pt-5">
            <p className="text-sm text-[#475569]">
              Your authenticator app is currently connected to this account.
            </p>

            <button
              type="button"
              onClick={handleDisable}
              disabled={disabling}
              className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <XIcon className="h-4 w-4" />
              {disabling ? "Disabling..." : "Disable 2FA"}
            </button>
          </div>
        )}
      </section>

      {/* Trusted Devices Section */}
      {factor?.status === "verified" && (
        <section className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                <UserIcon className="h-4 w-4" />
              </span>

              <div>
                <h2 className="text-base font-bold text-[#102A56]">
                  Trusted Devices
                </h2>

                <p className="text-xs text-[#64748B]">
                  Manage devices that skip two-factor authentication
                </p>
              </div>
            </div>
          </div>

          {loadingDevices ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-[#64748B]">
              <RefreshIcon className="h-4 w-4 animate-spin" />
              Loading trusted devices...
            </div>
          ) : trustedDevices.length === 0 ? (
            <div className="mt-4 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-10 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                <UserIcon className="h-5 w-5" />
              </span>

              <h3 className="mt-4 text-base font-bold text-[#102A56]">
                No trusted devices
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-[#64748B]">
                Complete MFA verification and check &quot;Trust this device&quot; to add a
                trusted device.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {trustedDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-white text-[#1677FF]">
                      <UserIcon className="h-4 w-4" />
                    </span>

                    <div>
                      <p className="text-sm font-semibold text-[#102A56]">
                        {device.device_name}
                      </p>
                      <p className="mt-0.5 text-xs text-[#64748B]">
                        Last used:{" "}
                        {new Date(device.last_used_at).toLocaleDateString()} â€¢
                        Expires:{" "}
                        {new Date(device.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRevokeDevice(device.id)}
                    disabled={revoking}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Revoke
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDevice(device.id)}
                    disabled={revoking}
                    className="ml-2 inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {trustedDevices.length > 0 && (
            <button
              type="button"
              onClick={handleRevokeAll}
              disabled={revoking}
              className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <TrashIcon className="h-4 w-4" />
              {revoking ? "Revoking..." : "Revoke All Trusted Devices"}
            </button>
          )}
      {trustedDevices.length > 0 && (
        <button
          type="button"
          onClick={handleDeleteAllDevices}
          disabled={revoking}
          className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <TrashIcon className="h-4 w-4" />
          {revoking ? "Deleting..." : "Delete All Trusted Devices"}
        </button>
      )}
        </section>
      )}
    </div>
  );
}


