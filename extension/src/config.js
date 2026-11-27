// src/config.js

// PRODUCTION URL - Shiftly Auto web application
// Update this if deploying to a different domain
// NOTE: Verify this matches your actual production deployment before use
export const WEB_APP_URL = "https://shiftlyauto.vercel.app";

// For local development, uncomment the line below:
// export const WEB_APP_URL = "http://localhost:3000";

// Excludes I, O, Q per the VIN standard.
const VIN_PATTERN = /\b[A-HJ-NPR-Z0-9]{17}\b/g;

export function findVinsInText(text) {
  if (!text) return [];

  const matches =
    text.toUpperCase().match(VIN_PATTERN) || [];

  return Array.from(new Set(matches));
}

export function isValidVin(vin) {
  return (
    typeof vin === "string" &&
    /^[A-HJ-NPR-Z0-9]{17}$/.test(vin)
  );
}