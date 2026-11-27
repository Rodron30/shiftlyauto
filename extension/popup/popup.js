// extension/popup/popup.js

import {
  WEB_APP_URL,
  isValidVin,
} from "../src/config.js";

const STORAGE_KEY = "allowedOrigins";

// Latest AI-generated Facebook Marketplace listing
let latestFacebookListing = null;

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
const tricitySection =
  document.getElementById("tricity-section");

const tricityStatus =
  document.getElementById("tricity-status");

const tricityScanButton =
  document.getElementById("tricity-scan-button");

const tricityImportButton =
  document.getElementById("tricity-import-button");


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
          ? `Signed in ΓÇó ${data.dealershipName}`
          : "Signed in";
    } else {
      sessionLine.textContent =
        "Not signed in";
    }
  } catch (error) {
    // Gracefully handle network errors - web app may not be running
    console.warn(
      "Shiftly session check failed (web app may not be running):",
      error
    );

    sessionLine.textContent =
      "Shiftly Auto not reachable";
  }
}


/* -------------------------------------------------------
   RUN REPORT
------------------------------------------------------- */

async function runReport(vin, vehicle) {
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

  try {
    const updates = {};

    if (vehicle) {
      if (vehicle.year != null) updates.year = vehicle.year;
      if (vehicle.make) updates.make = vehicle.make;
      if (vehicle.model) updates.model = vehicle.model;
      if (vehicle.trim) updates.trim = vehicle.trim;
      if (vehicle.body) updates.body = vehicle.body;
      if (vehicle.engine) updates.engine = vehicle.engine;
      if (vehicle.drivetrain) updates.drivetrain = vehicle.drivetrain;
      if (vehicle.fuel) updates.fuel = vehicle.fuel;
      if (vehicle.price != null) updates.price = vehicle.price;
      if (vehicle.mileage != null) updates.mileage = vehicle.mileage;
      if (vehicle.mileageUnit) updates.mileageUnit = vehicle.mileageUnit;
      if (vehicle.description) updates.description = vehicle.description;
      if (vehicle.images && vehicle.images.length > 0) {
        updates.primary_image = vehicle.images[0];
      }
    }

    if (Object.keys(updates).length > 0) {
      const response = await fetch(
        `${WEB_APP_URL}/api/vehicles/` +
          encodeURIComponent(normalizedVin),
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        console.error(
          "Vehicle sync failed:",
          response.status,
          result
        );
      } else {
        console.log(
          "Vehicle synced before report:",
          result
        );
      }
    }
  } catch (error) {
    console.error(
      "Vehicle sync error:",
      error
    );
  }

  chrome.tabs.create({
    url:
      `${WEB_APP_URL}/vehicles/` +
      encodeURIComponent(normalizedVin),
  });
}

function runReportWithoutVin(vehicle) {
  // For vehicles without VIN, we need to first add them to inventory
  // Then navigate to the vehicle detail page
  // The vehicle detail page will show that VIN is required for reports
  addToInventoryWithoutVin(vehicle);
}


/* -------------------------------------------------------
   FACEBOOK MARKETPLACE
------------------------------------------------------- */

async function openFacebookAndFillForm() {
  try {
    console.log("FACEBOOK: ========== BUTTON CLICKED - STARTING AUTOMATION ==========");

    // Check if facebookListing exists in storage before starting
    chrome.storage.local.get(["facebookListing"], (stored) => {
      const listing = stored?.facebookListing || null;
      console.log("FACEBOOK: STORAGE CHECK - facebookListing exists:", !!listing);
      if (listing) {
        console.log("FACEBOOK: STORAGE DATA - title:", listing.title, "price_cad:", listing.price_cad, "mileage_km:", listing.mileage_km);
      } else {
        console.error("FACEBOOK: STORAGE ERROR - No facebookListing found in chrome.storage.local");
      }
    });

    console.log("FACEBOOK: Requesting background to start Facebook automation");

    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "SHIFTLY_START_FACEBOOK_LISTING"
        },
        (response) => {
          console.log(
            "FACEBOOK POPUP: SEND MESSAGE CALLBACK FIRED",
            response
          );

          if (chrome.runtime.lastError) {
            console.error("FACEBOOK: RUNTIME ERROR:", chrome.runtime.lastError);
            console.error("FACEBOOK: RUNTIME ERROR MESSAGE:", chrome.runtime.lastError.message);
            reject(
              new Error(
                chrome.runtime.lastError.message
              )
            );
            return;
          }

          console.log("FACEBOOK: ========== RECEIVED RESPONSE FROM BACKGROUND ==========");
          console.log("FACEBOOK: Response ok:", response?.ok);
          console.log("FACEBOOK: Response error:", response?.error);
          console.log("FACEBOOK: Full response:", JSON.stringify(response));

          if (!response?.ok) {
            reject(
              new Error(
                response?.error ||
                "Facebook automation failed."
              )
            );
            return;
          }

          resolve(response.result || response);
        }
      );
    });

    console.log(
      "FACEBOOK FORM FILL RESULT:",
      result
    );

    if (result?.ok) {
      // Handle both response structures: nested result or direct result
      const fields = result?.fields || result?.result?.fields || {};
      const successCount = Object.values(fields).filter(v => v === true).length;
      const failedCount = Object.values(fields).filter(v => v === false).length;
      const skippedCount = Object.values(fields).filter(v => v === null).length;
      const totalCount = Object.keys(fields).length;

      let fieldDetails = "";
      Object.entries(fields).forEach(([field, success]) => {
        const status = success === true ? "\u2713" : success === false ? "\u2717" : "\u2298";
        fieldDetails += `${field}: ${status}\n`;
      });

      alert(
        `Facebook Marketplace form filling complete.\n\n` +
        `Total fields: ${totalCount}\n` +
        `Successful: ${successCount}\n` +
        `Failed: ${failedCount}\n` +
        `Skipped: ${skippedCount}\n\n` +
        `Field Details:\n${fieldDetails}`
      );
    } else {
      alert(
        "Facebook tab detected, but form filling failed: " +
        (result?.error || "Unknown error")
      );
    }
  } catch (error) {
    console.error(
      "FACEBOOK FORM FILL FAILED:",
      error
    );

    alert(
      "Facebook form fill failed: " + (error?.message || "Unknown error")
    );
  }
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

function addToInventoryWithoutVin(vehicle) {
  // Build URL with vehicle data as query parameters
  const params = new URLSearchParams();
  if (vehicle.vin) params.set("vin", String(vehicle.vin).trim().toUpperCase());
  
  if (vehicle.year) params.set("year", String(vehicle.year));
  if (vehicle.make) params.set("make", vehicle.make);
  if (vehicle.model) params.set("model", vehicle.model);
  if (vehicle.trim) params.set("trim", vehicle.trim);
  if (vehicle.body) params.set("body", vehicle.body);
  if (vehicle.engine) params.set("engine", vehicle.engine);
  if (vehicle.drivetrain) params.set("drivetrain", vehicle.drivetrain);
  if (vehicle.transmission) params.set("transmission", vehicle.transmission);
  if (vehicle.fuel) params.set("fuel", vehicle.fuel);
  if (vehicle.price) params.set("price", String(vehicle.price));
  if (vehicle.currency) params.set("currency", vehicle.currency);
  if (vehicle.mileage != null) params.set("mileage", String(vehicle.mileage));
  if (vehicle.mileageUnit) params.set("mileageUnit", vehicle.mileageUnit);
  if (vehicle.description) params.set("description", vehicle.description);
  if (vehicle.location) params.set("location", vehicle.location);
  if (vehicle.sourceUrl) params.set("sourceUrl", vehicle.sourceUrl);
  if (vehicle.images && vehicle.images.length > 0) {
    params.set("primary_image", vehicle.images[0]);
    params.set("images", JSON.stringify(vehicle.images));
  }
  
  const inventoryUrl = `${WEB_APP_URL}/vehicles/new?${params.toString()}`;
  
  chrome.tabs.create({
    url: inventoryUrl,
  }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error("Failed to open tab:", chrome.runtime.lastError);
    } else {
      console.log("Vehicle added to inventory successfully");
    }
  });
}



async function generateFacebookListing(vehicle) {
  console.log("FACEBOOK LISTING INPUT:", {
    price: vehicle?.price,
    currency: vehicle?.currency,
    mileage: vehicle?.mileage,
    mileageUnit: vehicle?.mileageUnit,
    vehicle
  });
  console.log("FACEBOOK LISTING: vehicle.images.length:", vehicle?.images?.length || 0);
  console.log("FACEBOOK LISTING: vehicle.images[0:3]:", vehicle?.images?.slice(0, 3) || []);
  try {
    const requestUrl = `${WEB_APP_URL}/api/ai/listing`;
    console.log("FACEBOOK LISTING: Request URL:", requestUrl);
    
    const response = await fetch(
      requestUrl,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vehicle: {
            year: vehicle.year ?? null,
            make: vehicle.make ?? null,
            model: vehicle.model ?? null,
            trim: vehicle.trim ?? null,
            body: vehicle.body ?? null,
            engine: vehicle.engine ?? null,
            drivetrain: vehicle.drivetrain ?? null,
            transmission: vehicle.transmission ?? null,
            fuel: vehicle.fuel ?? null,
            price: vehicle.price ?? null,
            currency: vehicle.currency ?? null,
            mileage: vehicle.mileage ?? null,
            mileageUnit: vehicle.mileageUnit ?? null,
            location: vehicle.location ?? null,
            description: vehicle.description ?? null,
            images: vehicle.images ?? [],
          },
        }),
      }
    );

    console.log("FACEBOOK LISTING: Response received");
    console.log("FACEBOOK LISTING: Response status:", response.status);
    console.log("FACEBOOK LISTING: Response ok:", response.ok);
    console.log("FACEBOOK LISTING: Response content-type:", response.headers.get("content-type"));

    const responseText = await response.text();
    console.log("FACEBOOK LISTING: Raw response text length:", responseText.length);
    console.log("FACEBOOK LISTING: Raw response text preview:", responseText.substring(0, 200));

    let data;
    try {
      data = JSON.parse(responseText);
      console.log("FACEBOOK LISTING: Parsed JSON successfully");
      console.log("FACEBOOK LISTING: Data keys:", Object.keys(data));
      console.log("FACEBOOK LISTING: data.success:", data?.success);
      console.log("FACEBOOK LISTING: data.error:", data?.error);
      console.log("FACEBOOK LISTING: data.listing exists:", !!data?.listing);
    } catch (parseError) {
      console.error("FACEBOOK LISTING: JSON parse error:", parseError);
      console.error("FACEBOOK LISTING: Could not parse response as JSON");
      throw new Error("Invalid response from server");
    }

    console.log("FACEBOOK LISTING: Checking response.ok and data.success");
    console.log("FACEBOOK LISTING: response.ok:", response.ok);
    console.log("FACEBOOK LISTING: data.success:", data?.success);
    console.log("FACEBOOK LISTING: Condition !response.ok:", !response.ok);
    console.log("FACEBOOK LISTING: Condition !data?.success:", !data?.success);

    if (!response.ok || !data?.success) {
      console.error("FACEBOOK LISTING: ERROR BRANCH - Throwing error");
      console.error("FACEBOOK LISTING: response.ok was:", response.ok);
      console.error("FACEBOOK LISTING: data.success was:", data?.success);
      console.error("FACEBOOK LISTING: data.error:", data?.error);
      throw new Error(
        data?.error || "Failed to generate Facebook listing."
      );
    }

    console.log("FACEBOOK LISTING: SUCCESS BRANCH - Listing data valid");

    latestFacebookListing = data.listing;
    console.log("FACEBOOK LISTING: data.listing.images.length:", data.listing?.images?.length || 0);
    console.log("FACEBOOK LISTING: data.listing.images[0:3]:", data.listing?.images?.slice(0, 3) || []);

await chrome.storage.local.set({
  facebookListing: {
    ...data.listing,
    vehicle: vehicle,
  },
});
console.log("Facebook listing generated:", latestFacebookListing);

    alert(
      `Facebook Listing Ready\n\n` +
      `Title: ${data.listing.title}\n\n` +
      `Price: CAD ${Number(data.listing.price_cad).toLocaleString()}\n` +
      `Mileage: ${Number(data.listing.mileage_km).toLocaleString()} KM\n\n` +
      data.listing.description
    );
  } catch (error) {
    console.error("Facebook listing generation failed:", error);
    alert(
      error?.message ||
      "Failed to generate Facebook Marketplace listing."
    );
  }
}
/* -------------------------------------------------------
   VIN RENDERING
------------------------------------------------------- */

function renderVins(scanResult) {
  if (!vinStatus || !vinList) {
    return;
  }

  vinList.innerHTML = "";

  const vins = scanResult.vins || [];
  const vehicle = scanResult.vehicle || null;

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

  // Case 1: No VIN but meaningful vehicle data exists (e.g., Facebook Marketplace)
  if (validVins.length === 0 && vehicle && hasMeaningfulVehicleData(vehicle)) {
    vinStatus.textContent = "VIN not available on this listing.";
    
    // Show vehicle information if available
    const vehicleInfo = document.createElement("div");
    vehicleInfo.className = "vehicle-info";
    
    if (vehicle.year || vehicle.make || vehicle.model) {
      const vehicleTitle = document.createElement("div");
      vehicleTitle.className = "vehicle-title";
      vehicleTitle.textContent = [
        vehicle.year,
        vehicle.make,
        vehicle.model
      ].filter(Boolean).join(" ");
      vehicleInfo.appendChild(vehicleTitle);
    }
    
    if (vehicle.price) {
      const vehiclePrice = document.createElement("div");
      vehiclePrice.className = "vehicle-detail";
      const currencySymbol = vehicle.currency === "PHP" ? "\u20B1" : "$";
      vehiclePrice.textContent = `Price: ${currencySymbol}${vehicle.price.toLocaleString()}`;
      vehicleInfo.appendChild(vehiclePrice);
    }
    
    if (vehicle.mileage) {
      const vehicleMileage = document.createElement("div");
      vehicleMileage.className = "vehicle-detail";
      vehicleMileage.textContent = `Mileage: ${vehicle.mileage.toLocaleString()} ${vehicle.mileageUnit || ''}`;
      vehicleInfo.appendChild(vehicleMileage);
    }
    
    if (vehicle.transmission) {
      const vehicleTransmission = document.createElement("div");
      vehicleTransmission.className = "vehicle-detail";
      vehicleTransmission.textContent = `Transmission: ${vehicle.transmission}`;
      vehicleInfo.appendChild(vehicleTransmission);
    }
    
    if (vehicle.location) {
      const vehicleLocation = document.createElement("div");
      vehicleLocation.className = "vehicle-detail";
      vehicleLocation.textContent = `Location: ${vehicle.location}`;
      vehicleInfo.appendChild(vehicleLocation);
    }
    
    if (vehicle.description) {
      const vehicleDescription = document.createElement("div");
      vehicleDescription.className = "vehicle-detail vehicle-description";
      vehicleDescription.textContent = `Description: ${vehicle.description}`;
      vehicleInfo.appendChild(vehicleDescription);
    }
    
    // Add action buttons
    const vehicleActions = document.createElement("div");
    vehicleActions.className = "vehicle-actions";
    
    // Add to Inventory button
    const inventoryButton = document.createElement("button");
    inventoryButton.type = "button";
    inventoryButton.className = "inventory-btn";
    inventoryButton.textContent = "Add to Inventory";
    inventoryButton.addEventListener("click", () => {
      addToInventoryWithoutVin(vehicle);
    });
    vehicleActions.appendChild(inventoryButton);
// Run Report button
    const reportButton = document.createElement("button");
    reportButton.type = "button";
    reportButton.className = "run-btn";
    reportButton.textContent = "Run Report";
    reportButton.addEventListener("click", () => {
      runReportWithoutVin(vehicle);
    });
    vehicleActions.appendChild(reportButton);
    
    vehicleInfo.appendChild(vehicleActions);
    vinList.appendChild(vehicleInfo);
    return;
  }

  // Case 2: No VIN and no meaningful vehicle data
  if (validVins.length === 0) {
    vinStatus.textContent =
      "No vehicle detected on this page.";

    return;
  }

  // Case 3: VIN(s) detected
  vinStatus.textContent =
    validVins.length === 1
      ? "VIN detected:"
      : `${validVins.length} VINs detected:`;

  for (const vin of validVins) {
    const row =
      document.createElement("div");

    row.className = "vin-row";
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.flexWrap = "wrap";
    row.style.gap = "8px";
    row.style.marginBottom = "8px";

    const code =
      document.createElement("span");

    code.className = "vin-code";
    code.textContent = vin;
    code.style.fontSize = "13px";
    code.style.fontFamily = "monospace";
    code.style.color = "#111827";

    row.appendChild(code);
    vinList.appendChild(row);

    // Show vehicle details if available
    if (vehicle && vehicle.vin === vin) {
      const vehicleInfo = document.createElement("div");
      vehicleInfo.className = "vehicle-info";
      vehicleInfo.style.marginTop = "8px";
      vehicleInfo.style.marginLeft = "0";
      vehicleInfo.style.padding = "8px";
      vehicleInfo.style.background = "#f9fafb";
      vehicleInfo.style.borderRadius = "4px";

      if (vehicle.year || vehicle.make || vehicle.model) {
        const vehicleTitle = document.createElement("div");
        vehicleTitle.className = "vehicle-title";
        vehicleTitle.style.fontWeight = "600";
        vehicleTitle.style.fontSize = "12px";
        vehicleTitle.style.color = "#111827";
        vehicleTitle.textContent = [
          vehicle.year,
          vehicle.make,
          vehicle.model
        ].filter(Boolean).join(" ");
        vehicleInfo.appendChild(vehicleTitle);
      }

      if (vehicle.trim) {
        const vehicleTrim = document.createElement("div");
        vehicleTrim.className = "vehicle-detail";
        vehicleTrim.style.fontSize = "11px";
        vehicleTrim.style.color = "#6b7280";
        vehicleTrim.style.marginTop = "4px";
        vehicleTrim.textContent = `Trim: ${vehicle.trim}`;
        vehicleInfo.appendChild(vehicleTrim);
      }

      if (vehicle.price) {
        const vehiclePrice = document.createElement("div");
        vehiclePrice.className = "vehicle-detail";
        vehiclePrice.style.fontSize = "11px";
        vehiclePrice.style.color = "#6b7280";
        vehiclePrice.style.marginTop = "4px";
        const currencySymbol = vehicle.currency === "PHP" ? "\u20B1" : "$";
        vehiclePrice.textContent = `Price: ${currencySymbol}${vehicle.price.toLocaleString()}`;
        vehicleInfo.appendChild(vehiclePrice);
      }

      if (vehicle.mileage !== null && vehicle.mileage !== undefined) {
        const vehicleMileage = document.createElement("div");
        vehicleMileage.className = "vehicle-detail";
        vehicleMileage.style.fontSize = "11px";
        vehicleMileage.style.color = "#6b7280";
        vehicleMileage.style.marginTop = "4px";
        vehicleMileage.textContent = `Mileage: ${vehicle.mileage.toLocaleString()} ${vehicle.mileageUnit || ''}`;
        vehicleInfo.appendChild(vehicleMileage);
      }

      if (vehicle.body) {
        const vehicleBody = document.createElement("div");
        vehicleBody.className = "vehicle-detail";
        vehicleBody.style.fontSize = "11px";
        vehicleBody.style.color = "#6b7280";
        vehicleBody.style.marginTop = "4px";
        vehicleBody.textContent = `Body: ${vehicle.body}`;
        vehicleInfo.appendChild(vehicleBody);
      }

      if (vehicle.engine) {
        const vehicleEngine = document.createElement("div");
        vehicleEngine.className = "vehicle-detail";
        vehicleEngine.style.fontSize = "11px";
        vehicleEngine.style.color = "#6b7280";
        vehicleEngine.style.marginTop = "4px";
        vehicleEngine.textContent = `Engine: ${vehicle.engine}`;
        vehicleInfo.appendChild(vehicleEngine);
      }

      if (vehicle.drivetrain) {
        const vehicleDrivetrain = document.createElement("div");
        vehicleDrivetrain.className = "vehicle-detail";
        vehicleDrivetrain.style.fontSize = "11px";
        vehicleDrivetrain.style.color = "#6b7280";
        vehicleDrivetrain.style.marginTop = "4px";
        vehicleDrivetrain.textContent = `Drivetrain: ${vehicle.drivetrain}`;
        vehicleInfo.appendChild(vehicleDrivetrain);
      }

      if (vehicle.transmission) {
        const vehicleTransmission = document.createElement("div");
        vehicleTransmission.className = "vehicle-detail";
        vehicleTransmission.style.fontSize = "11px";
        vehicleTransmission.style.color = "#6b7280";
        vehicleTransmission.style.marginTop = "4px";
        vehicleTransmission.textContent = `Transmission: ${vehicle.transmission}`;
        vehicleInfo.appendChild(vehicleTransmission);
      }

      if (vehicle.fuel) {
        const vehicleFuel = document.createElement("div");
        vehicleFuel.className = "vehicle-detail";
        vehicleFuel.style.fontSize = "11px";
        vehicleFuel.style.color = "#6b7280";
        vehicleFuel.style.marginTop = "4px";
        vehicleFuel.textContent = `Fuel: ${vehicle.fuel}`;
        vehicleInfo.appendChild(vehicleFuel);
      }

      if (vehicle.location) {
        const vehicleLocation = document.createElement("div");
        vehicleLocation.className = "vehicle-detail";
        vehicleLocation.style.fontSize = "11px";
        vehicleLocation.style.color = "#6b7280";
        vehicleLocation.style.marginTop = "4px";
        vehicleLocation.textContent = `Location: ${vehicle.location}`;
        vehicleInfo.appendChild(vehicleLocation);
      }

      vinList.appendChild(vehicleInfo);
    }

    // Create separate actions container for buttons
    const actionsContainer = document.createElement("div");
    actionsContainer.style.display = "flex";
    actionsContainer.style.gap = "12px";
    actionsContainer.style.marginTop = "12px";
    actionsContainer.style.alignItems = "center";

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
        runReport(vin, vehicle);
      }
    );

    actionsContainer.appendChild(reportButton);
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
        addToInventoryWithoutVin(vehicle);
      }
    );

    actionsContainer.appendChild(inventoryButton);

    vinList.appendChild(actionsContainer);
  }
}

function hasMeaningfulVehicleData(vehicle) {
  if (!vehicle) return false;
  
  // Check if vehicle has meaningful data beyond empty values
  const meaningfulFields = [
    vehicle.year,
    vehicle.make,
    vehicle.model,
    vehicle.price,
    vehicle.mileage,
    vehicle.transmission,
    vehicle.location,
    vehicle.description
  ].filter(Boolean);
  
  // Require at least 2 meaningful fields to consider this a valid vehicle detection
  return meaningfulFields.length >= 2;
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



async function findAuthenticatedShiftlyTab() {
  const patterns = [
    "http://localhost:3000/*",
    "https://localhost:3000/*",
    "https://shiftlyauto.vercel.app/*",
    "https://shiftlyauto-two.vercel.app/*"
  ];

  let tabs = [];

  try {
    tabs = await chrome.tabs.query({ url: patterns });
  } catch (error) {
    console.error("Unable to find Shiftly tabs:", error);
    return null;
  }

  tabs.sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)));

  for (const tab of tabs) {
    if (!Number.isInteger(tab.id)) continue;

    try {
      const checks = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: async () => {
          try {
            const response = await fetch("/api/auth/session", {
              credentials: "same-origin",
              cache: "no-store"
            });

            if (!response.ok) return false;

            const session = await response.json();

            return Boolean(
              session?.loggedIn === true &&
              session?.profile?.id &&
              session?.profile?.dealership_id &&
              ["admin", "manager", "salesperson"].includes(
                session?.profile?.role
              )
            );
          } catch {
            return false;
          }
        }
      });

      if (checks?.[0]?.result === true) return tab;
    } catch (error) {
      console.debug("Shiftly tab is not ready for import:", error);
    }
  }

  return null;
}

async function importSavedTriCityInventory() {
  if (!tricityImportButton || !tricityStatus) return;

  tricityImportButton.disabled = true;
  tricityStatus.textContent = "Verifying saved inventory and Shiftly login...";

  try {
    const saved = await chrome.runtime.sendMessage({
      type: "SHIFTLY_GET_TRICITY_INVENTORY"
    });

    if (!saved?.ok || !saved.found || !saved.inventory) {
      throw new Error(
        "Saved inventory data is unavailable. Your scan has not been intentionally deleted; verify the saved record."
      );
    }

    const inventory = saved.inventory;

    if (
      inventory.source !== "tricitymits" ||
      inventory.complete !== true ||
      inventory.allPagesLoaded !== true ||
      inventory.incomplete === true ||
      !Array.isArray(inventory.vehicles) ||
      inventory.vehicles.length !== Number(inventory.totalVehicles) ||
      !Array.isArray(inventory.failedPages) ||
      inventory.failedPages.length !== 0 ||
      !Number.isInteger(Number(inventory.totalPages)) ||
      !Array.isArray(inventory.loadedPages) ||
      inventory.loadedPages.length !== Number(inventory.totalPages)
    ) {
      throw new Error("Saved scan failed completeness validation.");
    }

    const tab = await findAuthenticatedShiftlyTab();

    if (!tab || !Number.isInteger(tab.id)) {
      throw new Error(
        "No authorized Shiftly session found. Open Shiftly, sign in, and reopen the extension."
      );
    }

    tricityStatus.textContent =
      `Submitting ${inventory.vehicles.length} saved vehicles to Shiftly...`;

    const executions = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      args: [inventory],
      func: async (payload) => {
        try {
          const sessionResponse = await fetch("/api/auth/session", {
            credentials: "same-origin",
            cache: "no-store"
          });

          if (!sessionResponse.ok) {
            return { ok: false, error: "Could not verify Shiftly session." };
          }

          const session = await sessionResponse.json();

          if (
            session?.loggedIn !== true ||
            !session?.profile?.id ||
            !session?.profile?.dealership_id ||
            !["admin", "manager", "salesperson"].includes(
              session?.profile?.role
            )
          ) {
            return {
              ok: false,
              error: "The current Shiftly account is not authorized to import."
            };
          }

          const response = await fetch("/api/vehicles/tricity-import", {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          const data = await response.json().catch(() => null);

          return {
            ok: response.ok && data?.success === true,
            status: response.status,
            data,
            error: data?.error || null
          };
        } catch (error) {
          return {
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    });

    const result = executions?.[0]?.result;

    if (!result?.ok) {
      throw new Error(
        result?.error ||
        result?.data?.error ||
        `Import failed (HTTP ${result?.status ?? "unknown"}).`
      );
    }

    const summary = result.data?.summary;

    if (!summary) {
      throw new Error("Server response did not include an import summary.");
    }

    tricityStatus.textContent =
      `Import complete: ${summary.imported} imported, ` +
      `${summary.skipped} skipped, ${summary.errors} errors ` +
      `out of ${summary.scanned} scanned.`;

    console.info("SHIFTLY TRICITY IMPORT SUMMARY:", summary);
    console.table(result.data.results || []);
  } catch (error) {
    tricityStatus.textContent =
      error?.message || "Import failed. Check the extension console.";
    console.error("SHIFTLY TRICITY IMPORT FAILED:", error);
  } finally {
    const tab = await findAuthenticatedShiftlyTab();
    tricityImportButton.disabled = !tab;
  }
}
async function showSavedTriCityInventory(tabUrl) {
  if (!vinStatus || !vinList) return false;

  let hostname = "";
  try {
    hostname = new URL(tabUrl).hostname;
  } catch {
    return false;
  }

  if (
    hostname !== "www.tricitymits.com" &&
    hostname !== "tricitymits.com"
  ) {
    return false;
  }

  try {
    const result = await chrome.runtime.sendMessage({
      type: "SHIFTLY_GET_TRICITY_INVENTORY"
    });

    if (!result?.ok || !result.found || !result.inventory) return false;

    vinList.innerHTML = "";

    const info = document.createElement("div");
    info.className = "vehicle-info";

    const title = document.createElement("div");
    title.className = "vehicle-title";
    title.textContent = "Tri-City Inventory Scan";
    info.appendChild(title);

    const details = document.createElement("div");
    details.className = "vehicle-detail";
    details.textContent =
      `${result.totalVehicles} vehicles collected across ` +
      `${result.totalPages} pages.`;
    info.appendChild(details);

    if (result.capturedAt) {
      const captured = document.createElement("div");
      captured.className = "vehicle-detail";
      captured.textContent =
        `Last scan: ${new Date(result.capturedAt).toLocaleString()}`;
      info.appendChild(captured);
    }

    vinList.appendChild(info);
    vinStatus.textContent = "Inventory scan complete."; 
    if (tricityImportButton) {
      tricityImportButton.disabled = !(await findAuthenticatedShiftlyTab());
    }
    return true;
  } catch (error) {
    console.error("Unable to read saved Tri-City inventory:", error);
    return false;
  }
}

/* -------------------------------------------------------
   DIRECT VIN SCAN
------------------------------------------------------- */

async function requestTabVins(tabId) {
  try {
    const result =
      await chrome.runtime.sendMessage({
        type: "SHIFTLY_SCAN_TAB",
        tabId,
      });

    if (!result) {
      return { vins: [], vehicle: null };
    }

    if (result.error) {
      console.error(
        "SHIFTLY BACKGROUND SCAN ERROR:",
        result.error
      );

      return { vins: [], vehicle: null };
    }

    return {
      vins: Array.isArray(result.vins) ? result.vins : [],
      vehicle: result.vehicle || null
    };
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
  let isTriCityPage = false;
  try {
    const hostname = new URL(tabUrl).hostname.toLowerCase();
    isTriCityPage =
      hostname === "tricitymits.com" ||
      hostname === "www.tricitymits.com";
  } catch {
    isTriCityPage = false;
  }

  if (tricitySection) {
    tricitySection.hidden = !isTriCityPage;
  }

  // Import remains unavailable until a verified import handler exists.
  if (tricityImportButton) {
    tricityImportButton.disabled = true;
  }


  /* -----------------------------------------------
     ONLY HTTP / HTTPS
  ----------------------------------------------- */

  const currentOrigin =
    getHttpOrigin(tabUrl);

  if (!currentOrigin) {
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

  // Show the saved full inventory on Tri-City inventory pages.
  if (await showSavedTriCityInventory(tabUrl)) {
    return;
  }

  vinStatus.textContent =
    "Scanning this page...";
  /* -----------------------------------------------
     SCAN
  ----------------------------------------------- */

  try {
    const scanResult =
      await requestTabVins(tab.id);

    renderVins(scanResult);
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

async function startTriCityInventoryScan() {
  if (!tricityStatus || !tricityScanButton) return;

  let tab;

  try {
    tab = await getActiveTab();

    if (!tab?.id || !tab.url) {
      throw new Error("Could not identify the active browser tab.");
    }

    const hostname = new URL(tab.url).hostname.toLowerCase();
    if (
      hostname !== "tricitymits.com" &&
      hostname !== "www.tricitymits.com"
    ) {
      throw new Error("Open the Tri-City Mitsubishi inventory page first.");
    }

    tricityScanButton.disabled = true;
    tricityStatus.textContent =
      "Starting inventory scan. Keep this tab open...";

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: () => {
        window.postMessage(
          {
            source: "shiftly-auto",
            type: "TRICITY_START_INVENTORY_SCAN"
          },
          window.location.origin
        );
      }
    });

    tricityStatus.textContent =
      "Scan request sent. Wait for the inventory scan to finish.";
  } catch (error) {
    tricityStatus.textContent =
      error?.message || "Unable to start the Tri-City inventory scan.";
    tricityScanButton.disabled = false;
  }
}

if (tricityImportButton) {
  tricityImportButton.addEventListener("click", importSavedTriCityInventory);
}
if (tricityScanButton) {
  tricityScanButton.addEventListener(
    "click",
    startTriCityInventoryScan
  );
}
if (tricityImportButton) tricityImportButton.disabled = true;

checkSession();
checkApprovalAndScan();

















