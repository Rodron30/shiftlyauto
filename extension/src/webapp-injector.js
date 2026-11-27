// src/webapp-injector.js
// Injects the extension ID into the Shiftly web app for communication

console.log("Shiftly: Web app injector loaded");

// Allowed origins for extension ID injection
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://localhost:3000',
  'https://shiftlyauto.vercel.app',
  'https://shiftlyauto-two.vercel.app',
  'https://shiftlyauto-rodronlove08-3685s-projects.vercel.app'
];

// Validate current origin
const currentOrigin = window.location.origin;
const isAllowedOrigin = ALLOWED_ORIGINS.includes(currentOrigin);

if (!isAllowedOrigin) {
  console.error("Shiftly: Origin not allowed for extension ID injection:", currentOrigin);
  console.error("Shiftly: Injection blocked for security reasons");
} else {
  console.log("Shiftly: Origin validated:", currentOrigin);

  // Get the extension ID from the runtime
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    const extensionId = chrome.runtime.id;
    console.log("Shiftly: Injecting extension ID into web app:", extensionId);

    // Store the extension ID in localStorage for the web app to use
    try {
      localStorage.setItem('shiftly_extension_id', extensionId);
      console.log("Shiftly: Extension ID saved to localStorage");
    } catch (e) {
      console.error("Shiftly: Failed to save to localStorage:", e);
    }

    // Also make it available globally as a fallback (documented for transparency)
    window.shiftlyExtensionId = extensionId;
    console.log("Shiftly: Extension ID available globally as window.shiftlyExtensionId");

    console.log("Shiftly: Extension ID successfully injected");
  } else {
    console.error("Shiftly: Could not access chrome.runtime.id");
  }
}