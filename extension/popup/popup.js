// extension/popup/popup.js

import {
  WEB_APP_URL,
  isValidVin,
} from "../src/config.js";

const STORAGE_KEY = "allowedOrigins";

const sessionLine =
  document.getElementById("session-line");

const vinStatus =
  document.getElementById("vin-status");

const vinList =
  document.getElementById("vin-list");

const notApproved =
  document.getElementById("not-approved");

const openAppLink =
  document.getElementById("open-app-link");

const openOptionsLink =
  document.getElementById("open-options-link");

const openOptionsLink2 =
  document.getElementById("open-options-link-2");


/* -------------------------------------------------------
   LINKS
------------------------------------------------------- */

if (openAppLink) {
  openAppLink.href = WEB_APP_URL;

  openAppLink.addEventListener(
    "click",
    (event) => {
      event.preventDefault();

      chrome.tabs.create({
        url: WEB_APP_URL,
      });
    }
  );
}

[
  openOptionsLink,
  openOptionsLink2,
].forEach((link) => {
  if (!link) return;

  link.addEventListener(
    "click",
    (event) => {
      event.preventDefault();

      chrome.runtime.openOptionsPage();
    }
  );
});


/* -------------------------------------------------------
   SESSION
------------------------------------------------------- */

async function checkSession() {
  if (!sessionLine) return;

  try {
    const response = await fetch(
      `${WEB_APP_URL}/api/auth/session`,
      {
        credentials: "include",
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(
        `Session request failed: ${response.status}`
      );
    }

    const data = await response.json();

    if (data.loggedIn) {
      sessionLine.textContent =
        data.dealershipName
          ? `Signed in — ${data.dealershipName}`
          : "Signed in";
    } else {
      sessionLine.textContent =
        "Not signed in";
    }
  } catch (error) {
    console.error(
      "Shiftly session check failed:",
      error
    );

    sessionLine.textContent =
      "Can't reach Shiftly Auto";
  }
}


/* -------------------------------------------------------
   RUN REPORT
------------------------------------------------------- */

function runReport(vin) {
  const normalizedVin =
    String(vin || "")
      .trim()
      .toUpperCase();

  if (!isValidVin(normalizedVin)) {
    console.error(
      "Invalid VIN:",
      normalizedVin
    );

    return;
  }

  chrome.tabs.create({
    url:
      `${WEB_APP_URL}/vehicles/` +
      encodeURIComponent(normalizedVin),
  });
}


/* -------------------------------------------------------
   ADD TO INVENTORY
------------------------------------------------------- */

function addToInventory(vin) {
  const normalizedVin =
    String(vin || "")
      .trim()
      .toUpperCase();

  if (!isValidVin(normalizedVin)) {
    console.error(
      "Invalid VIN for inventory:",
      normalizedVin
    );

    return;
  }

  const inventoryUrl =
    `${WEB_APP_URL}/vehicles/new?vin=` +
    encodeURIComponent(normalizedVin);

  chrome.tabs.create({
    url: inventoryUrl,
  });
}


/* -------------------------------------------------------
   VIN RENDERING
------------------------------------------------------- */

function renderVins(vins) {
  if (!vinStatus || !vinList) {
    return;
  }

  vinList.innerHTML = "";

  const validVins =
    Array.from(
      new Set(
        (Array.isArray(vins) ? vins : [])
          .map((vin) =>
            String(vin || "")
              .trim()
              .toUpperCase()
          )
          .filter(isValidVin)
      )
    );

  if (validVins.length === 0) {
    vinStatus.textContent =
      "No VIN detected on this page.";

    return;
  }

  vinStatus.textContent =
    validVins.length === 1
      ? "VIN detected:"
      : `${validVins.length} VINs detected:`;

  for (const vin of validVins) {
    const row =
      document.createElement("div");

    row.className = "vin-row";

    const code =
      document.createElement("span");

    code.className = "vin-code";
    code.textContent = vin;

    row.appendChild(code);


    /* -----------------------------------------------
       RUN REPORT BUTTON
    ----------------------------------------------- */

    const reportButton =
      document.createElement("button");

    reportButton.type = "button";
    reportButton.className = "run-btn";
    reportButton.textContent =
      "Run Report";

    reportButton.addEventListener(
      "click",
      () => {
        runReport(vin);
      }
    );

    row.appendChild(reportButton);


    /* -----------------------------------------------
       ADD INVENTORY BUTTON
    ----------------------------------------------- */

    const inventoryButton =
      document.createElement("button");

    inventoryButton.type = "button";
    inventoryButton.className =
      "inventory-btn";

    inventoryButton.textContent =
      "Add to Inventory";

    inventoryButton.addEventListener(
      "click",
      () => {
        addToInventory(vin);
      }
    );

    row.appendChild(
      inventoryButton
    );

    vinList.appendChild(row);
  }
}


/* -------------------------------------------------------
   URL HELPERS
------------------------------------------------------- */

function getHttpOrigin(value) {
  if (
    !value ||
    typeof value !== "string"
  ) {
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
        [STORAGE_KEY]: [],
      });

    const stored =
      result[STORAGE_KEY];

    if (!Array.isArray(stored)) {
      return [];
    }

    return Array.from(
      new Set(
        stored
          .map((value) =>
            getHttpOrigin(
              String(value)
            )
          )
          .filter(Boolean)
      )
    );
  } catch (error) {
    console.error(
      "Could not read allowed origins:",
      error
    );

    return [];
  }
}


/* -------------------------------------------------------
   APPROVAL CHECK
------------------------------------------------------- */

async function isApprovedSite(tabUrl) {
  const currentOrigin =
    getHttpOrigin(tabUrl);

  if (!currentOrigin) {
    return false;
  }

  const allowedOrigins =
    await getAllowedOrigins();

  console.log(
    "SHIFTLY CURRENT ORIGIN:",
    currentOrigin
  );

  console.log(
    "SHIFTLY ALLOWED ORIGINS:",
    allowedOrigins
  );

  const normalizedCurrent =
    currentOrigin
      .toLowerCase()
      .replace(/\/+$/, "");

  const approved =
    allowedOrigins.some(
      (origin) => {
        const normalizedAllowed =
          String(origin)
            .toLowerCase()
            .replace(/\/+$/, "");

        return (
          normalizedAllowed ===
          normalizedCurrent
        );
      }
    );

  console.log(
    "SHIFTLY APPROVED RESULT:",
    approved
  );

  return approved;
}


/* -------------------------------------------------------
   CHROME HOST PERMISSION
------------------------------------------------------- */

async function hasChromeSitePermission(
  tabUrl
) {
  const origin =
    getHttpOrigin(tabUrl);

  if (!origin) {
    return false;
  }

  try {
    const permission =
      await chrome.permissions.contains({
        origins: [
          `${origin}/*`,
        ],
      });

    console.log(
      "SHIFTLY CHROME PERMISSION:",
      origin,
      permission
    );

    return permission;
  } catch (error) {
    console.error(
      "Chrome permission check failed:",
      error
    );

    return false;
  }
}


/* -------------------------------------------------------
   ACTIVE TAB
------------------------------------------------------- */

async function getActiveTab() {
  const tabs =
    await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

  return tabs?.[0] || null;
}


/* -------------------------------------------------------
   DIRECT VIN SCAN
------------------------------------------------------- */

async function requestTabVins(tabId) {
  console.log(
    "SHIFTLY REQUEST VIN SCAN:",
    tabId
  );

  try {
    const result =
      await chrome.runtime.sendMessage({
        type: "SHIFTLY_SCAN_TAB",
        tabId,
      });

    if (!result) {
      return [];
    }

    if (result.error) {
      console.error(
        "SHIFTLY BACKGROUND SCAN ERROR:",
        result.error
      );

      return [];
    }

    return Array.isArray(result.vins)
      ? result.vins
      : [];
  } catch (error) {
    console.error(
      "SHIFTLY VIN MESSAGE FAILED:",
      error
    );

    throw error;
  }
}


/* -------------------------------------------------------
   MAIN SCAN
------------------------------------------------------- */

async function checkApprovalAndScan() {
  if (!vinStatus) {
    return;
  }

  if (notApproved) {
    notApproved.hidden = true;
  }

  if (vinList) {
    vinList.innerHTML = "";
  }

  vinStatus.textContent =
    "Checking this page...";


  /* -----------------------------------------------
     GET ACTIVE TAB
  ----------------------------------------------- */

  let tab;

  try {
    tab = await getActiveTab();
  } catch (error) {
    console.error(
      "Could not get active tab:",
      error
    );

    vinStatus.textContent =
      "Unable to access the active tab.";

    return;
  }

  console.log(
    "SHIFTLY ACTIVE TAB:",
    tab
  );


  /* -----------------------------------------------
     VALID TAB
  ----------------------------------------------- */

  if (!tab?.id) {
    vinStatus.textContent =
      "No active tab.";

    return;
  }

  if (!tab.url) {
    vinStatus.textContent =
      "This page can't be scanned.";

    return;
  }

  const tabUrl =
    String(tab.url).trim();

  console.log(
    "SHIFTLY TAB URL:",
    tabUrl
  );


  /* -----------------------------------------------
     ONLY HTTP / HTTPS
  ----------------------------------------------- */

  const currentOrigin =
    getHttpOrigin(tabUrl);

  if (!currentOrigin) {
    console.log(
      "SHIFTLY NON-WEB PAGE:",
      tabUrl
    );

    vinStatus.textContent =
      "This page can't be scanned.";

    if (notApproved) {
      notApproved.hidden = true;
    }

    return;
  }


  /* -----------------------------------------------
     APPROVED SITE
  ----------------------------------------------- */

  const approved =
    await isApprovedSite(tabUrl);

  if (!approved) {
    vinStatus.textContent =
      "VIN detection is off for this site.";

    if (notApproved) {
      notApproved.hidden = false;
    }

    return;
  }


  /* -----------------------------------------------
     CHROME PERMISSION
  ----------------------------------------------- */

  const permission =
    await hasChromeSitePermission(
      tabUrl
    );

  if (!permission) {
    console.error(
      "SHIFTLY HOST PERMISSION MISSING:",
      currentOrigin
    );

    vinStatus.textContent =
      "Site permission is not granted.";

    if (notApproved) {
      notApproved.hidden = false;
    }

    return;
  }


  /* -----------------------------------------------
     APPROVED + PERMISSION OK
  ----------------------------------------------- */

  if (notApproved) {
    notApproved.hidden = true;
  }

  vinStatus.textContent =
    "Scanning this page...";


  /* -----------------------------------------------
     SCAN
  ----------------------------------------------- */

  try {
    const vins =
      await requestTabVins(tab.id);

    console.log(
      "SHIFTLY VINs:",
      vins
    );

    renderVins(vins);
  } catch (error) {
    console.error(
      "SHIFTLY VIN SCAN FAILED:",
      error
    );

    vinStatus.textContent =
      "Unable to scan this page.";
  }
}


/* -------------------------------------------------------
   START
------------------------------------------------------- */

checkSession();
checkApprovalAndScan();