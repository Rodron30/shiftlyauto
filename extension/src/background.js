// extension/src/background.js

const tabVins = new Map();

/* -------------------------------------------------------
   URL HELPERS
------------------------------------------------------- */

function getHttpOrigin(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------
   APPROVED SITES
------------------------------------------------------- */

async function getAllowedOrigins() {
  try {
    const result =
      await chrome.storage.sync.get({
        allowedOrigins: [],
      });

    const stored =
      Array.isArray(result.allowedOrigins)
        ? result.allowedOrigins
        : [];

    return Array.from(
      new Set(
        stored
          .map((value) =>
            getHttpOrigin(String(value))
          )
          .filter(Boolean)
      )
    );
  } catch (error) {
    console.error(
      "SHIFTLY STORAGE ERROR:",
      error
    );

    return [];
  }
}

async function isApprovedSite(tabUrl) {
  const currentOrigin =
    getHttpOrigin(tabUrl);

  if (!currentOrigin) {
    return false;
  }

  const allowedOrigins =
    await getAllowedOrigins();

  return allowedOrigins.some(
    (origin) =>
      origin.toLowerCase() ===
      currentOrigin.toLowerCase()
  );
}

/* -------------------------------------------------------
   DIRECT VIN SCANNER
------------------------------------------------------- */

async function scanTab(tabId) {
  if (!tabId) {
    throw new Error(
      "Missing tab ID."
    );
  }

  const tabs =
    await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

  const tab =
    tabs.find(
      (item) => item.id === tabId
    ) || null;

  if (!tab?.url) {
    throw new Error(
      "The selected tab has no URL."
    );
  }

  const tabUrl =
    String(tab.url).trim();

  const origin =
    getHttpOrigin(tabUrl);

  if (!origin) {
    throw new Error(
      "This page cannot be scanned."
    );
  }

  const approved =
    await isApprovedSite(tabUrl);

  if (!approved) {
    throw new Error(
      "This site is not approved."
    );
  }

  const permission =
    await chrome.permissions.contains({
      origins: [`${origin}/*`],
    });

  if (!permission) {
    throw new Error(
      "Site permission is not granted."
    );
  }

  console.log(
    "SHIFTLY EXECUTING VIN SCANNER:",
    tabId,
    origin
  );

  const results =
    await chrome.scripting.executeScript({
      target: {
        tabId,
      },

      func: () => {
        const VIN_PATTERN =
          /\b[A-HJ-NPR-Z0-9]{17}\b/g;

        const text =
          document.body?.innerText || "";

        const matches =
          text
            .toUpperCase()
            .match(VIN_PATTERN) || [];

        return Array.from(
          new Set(matches)
        );
      },
    });

  const vins =
    Array.isArray(results?.[0]?.result)
      ? results[0].result
      : [];

  console.log(
    "SHIFTLY DIRECT VIN RESULT:",
    vins
  );

  tabVins.set(tabId, {
    vins,
    url: tabUrl,
  });

  return vins;
}

/* -------------------------------------------------------
   MESSAGE HANDLER
------------------------------------------------------- */

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {

    if (
      message?.type ===
      "SHIFTLY_SCAN_TAB"
    ) {
      const tabId =
        Number(message.tabId);

      scanTab(tabId)
        .then((vins) => {
          sendResponse({
            ok: true,
            vins,
            url:
              tabVins.get(tabId)?.url ||
              null,
          });
        })
        .catch((error) => {
          console.error(
            "SHIFTLY SCAN FAILED:",
            error
          );

          sendResponse({
            ok: false,
            vins: [],
            error:
              error?.message ||
              String(error),
          });
        });

      return true;
    }

    if (
      message?.type ===
      "SHIFTLY_GET_TAB_VINS"
    ) {
      const tabId =
        Number(message.tabId);

      sendResponse(
        tabVins.get(tabId) || {
          vins: [],
          url: null,
        }
      );

      return true;
    }
  }
);

/* -------------------------------------------------------
   CLEANUP
------------------------------------------------------- */

chrome.tabs.onRemoved.addListener(
  (tabId) => {
    tabVins.delete(tabId);
  }
);

console.log(
  "SHIFTLY BACKGROUND READY"
);