// extension/src/content.js

const VIN_PATTERN = /\b[A-HJ-NPR-Z0-9]{17}\b/g;

function findVinsInText(text) {
  if (!text) {
    return [];
  }

  const matches =
    text.toUpperCase().match(VIN_PATTERN) || [];

  return Array.from(new Set(matches));
}

function scanPage() {
  const text =
    document.body?.innerText || "";

  return findVinsInText(text);
}

scanPage();