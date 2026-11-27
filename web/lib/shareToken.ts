// lib/shareToken.ts
//
// Generates short, URL-friendly share tokens for customer report links
// (Blueprint §23, e.g. https://yourapp.com/report/8FJ29K).

import { randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

export function generateShareToken(length = 8): string {
  const bytes = randomBytes(length);
  let token = "";

  for (let i = 0; i < length; i++) {
    token += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return token;
}

/**
 * Longer, higher-entropy token for team invites — these grant account
 * creation into a paid dealership, so they warrant more entropy than the
 * short customer-report share codes above.
 */
export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Check if a share token has expired based on report creation date
 * Default expiration: 30 days
 */
export function isShareTokenExpired(createdAt: string | Date, maxAgeDays = 30): boolean {
  const created = new Date(createdAt);
  const now = new Date();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const ageMs = now.getTime() - created.getTime();

  return ageMs > maxAgeMs;
}

/**
 * Get the expiration date for a share token
 */
export function getShareTokenExpirationDate(createdAt: string | Date, maxAgeDays = 30): Date {
  const created = new Date(createdAt);
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return new Date(created.getTime() + maxAgeMs);
}
