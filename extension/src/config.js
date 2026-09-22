// src/config.js

// Shiftly Auto web app URL.
// Automatically detects environment based on extension runtime.
export const WEB_APP_URL = (() => {
  // If not in extension environment (e.g., Node.js testing), default to localhost
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    return "http://localhost:3000";
  }
  
  // Check if running in development/localhost environment
  if (chrome.runtime.id && chrome.runtime.getManifest().name.includes('Dev')) {
    return "http://localhost:3000";
  }
  
  // Check if the extension is loaded from a local file system (development)
  const manifest = chrome.runtime.getManifest();
  if (manifest.version.includes('dev') || manifest.version.includes('beta')) {
    return "http://localhost:3000";
  }
  
  // Production environment
  return "https://shiftlyauto.vercel.app";
})();

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