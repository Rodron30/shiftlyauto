// src/webapp-injector.js
// Injects the extension ID into the Shiftly web app for communication

console.log("Shiftly: Web app injector loaded");

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
  
  // Also make it available globally as a fallback
  window.shiftlyExtensionId = extensionId;
  console.log("Shiftly: Extension ID available globally as window.shiftlyExtensionId");
  
  console.log("Shiftly: Extension ID successfully injected");
} else {
  console.error("Shiftly: Could not access chrome.runtime.id");
}