// src/config.js

// Local Shiftly Auto web app.
// Change this to the deployed URL before publishing the extension.
export const WEB_APP_URL = "http://localhost:3000";

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