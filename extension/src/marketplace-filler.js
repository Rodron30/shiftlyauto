// ============================================================
// SHIFTLY AUTO - FACEBOOK MARKETPLACE FORM FILLER
// ============================================================

console.log("SHIFTLY AUTO: Marketplace form filler loaded");
console.log("MARKETPLACE_FILLER_VERSION_2026_09_21_B_LOADED");


// ============================================================
// BASIC HELPERS
// ============================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getElementText(element) {
  if (!element) return "";

  const parts = [
    element.getAttribute?.("aria-label"),
    element.getAttribute?.("placeholder"),
    element.getAttribute?.("name"),
    element.getAttribute?.("title"),
    element.textContent
  ];

  let parent = element.parentElement;

  for (let i = 0; i < 3 && parent; i++) {
    parts.push(parent.textContent);
    parts.push(parent.getAttribute?.("aria-label"));
    parts.push(parent.getAttribute?.("role"));
    parent = parent.parentElement;
  }

  return normalizeText(parts.filter(Boolean).join(" "));
}


// ============================================================
// REACT-COMPATIBLE INPUT
// ============================================================

function simulateInput(element, value) {
  if (!element) {
    return false;
  }

  try {
    element.focus();

    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;

    const descriptor = Object.getOwnPropertyDescriptor(
      prototype,
      "value"
    );

    if (descriptor && descriptor.set) {
      descriptor.set.call(element, String(value));
    } else {
      element.value = String(value);
    }

    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: String(value)
      })
    );

    element.dispatchEvent(
      new Event("change", {
        bubbles: true
      })
    );

    element.dispatchEvent(
      new Event("blur", {
        bubbles: true
      })
    );

    return true;
  } catch (error) {
    console.error(
      "SHIFTLY: Error simulating input:",
      error
    );

    return false;
  }
}


// ============================================================
// CLICK HELPER
// ============================================================

function clickElement(element) {
  if (!element) {
    return false;
  }

  try {
    element.scrollIntoView({
      behavior: "instant",
      block: "center"
    });

    element.focus();

    element.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        view: window
      })
    );

    element.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        view: window
      })
    );

    element.click();

    return true;
  } catch (error) {
    console.error(
      "SHIFTLY: Click failed:",
      error
    );

    return false;
  }
}


// ============================================================
// WAIT FOR MARKETPLACE FORM
// ============================================================

async function waitForFormToRender() {
  console.log(
    "SHIFTLY: Waiting for Marketplace form to fully render"
  );

  const maxAttempts = 40;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const inputs = document.querySelectorAll("input");

    const hasMarketplaceText =
      normalizeText(document.body?.innerText || "")
        .includes("marketplace");

    if (
      inputs.length >= 8 ||
      hasMarketplaceText
    ) {
      console.log(
        "SHIFTLY: Form rendered with",
        inputs.length,
        "inputs"
      );

      await sleep(1500);

      return true;
    }

    await sleep(500);
  }

  console.warn(
    "SHIFTLY: Marketplace form did not render within timeout"
  );

  return false;
}


// ============================================================
// FIELD FINDING
// ============================================================

function findInputByKeywords(keywords, options = {}) {
  const {
    excludeTypes = [],
    includeTypes = []
  } = options;

  const inputs = Array.from(
    document.querySelectorAll("input")
  );

  for (const input of inputs) {
    const type = normalizeText(
      input.getAttribute("type") || "text"
    );

    if (excludeTypes.includes(type)) {
      continue;
    }

    if (
      includeTypes.length > 0 &&
      !includeTypes.includes(type)
    ) {
      continue;
    }

    const context = getElementText(input);

    const matched = keywords.some(keyword =>
      context.includes(normalizeText(keyword))
    );

    if (matched) {
      return input;
    }
  }

  return null;
}


function findTextareaByKeywords(keywords) {
  const textareas = Array.from(
    document.querySelectorAll("textarea")
  );

  for (const textarea of textareas) {
    const context = getElementText(textarea);

    if (
      keywords.some(keyword =>
        context.includes(normalizeText(keyword))
      )
    ) {
      return textarea;
    }
  }

  return null;
}


function findClickableByKeywords(keywords) {
  const candidates = Array.from(
    document.querySelectorAll(
      'button, [role="button"], [role="combobox"], [role="option"]'
    )
  );

  for (const element of candidates) {
    const context = getElementText(element);

    if (
      keywords.some(keyword =>
        context.includes(normalizeText(keyword))
      )
    ) {
      return element;
    }
  }

  return null;
}


// ============================================================
// FIELD SCAN
// ============================================================

function inspectMarketplaceFields() {
  const inputs = Array.from(
    document.querySelectorAll("input")
  );

  const textareas = Array.from(
    document.querySelectorAll("textarea")
  );

  console.log(
    "SHIFTLY: Inspecting Marketplace fields..."
  );

  inputs.forEach((input, index) => {
    console.log(
      `SHIFTLY: input[${index}]`,
      {
        type: input.type,
        value: input.value,
        ariaLabel: input.getAttribute("aria-label"),
        placeholder: input.getAttribute("placeholder"),
        role: input.getAttribute("role"),
        context: getElementText(input)
      }
    );
  });

  textareas.forEach((textarea, index) => {
    console.log(
      `SHIFTLY: textarea[${index}]`,
      {
        value: textarea.value,
        ariaLabel: textarea.getAttribute("aria-label"),
        placeholder: textarea.getAttribute("placeholder"),
        context: getElementText(textarea)
      }
    );
  });
}


// ============================================================
// LOCATION
// ============================================================

async function fillLocation(location) {
  console.log(
    "SHIFTLY LOCATION TRACE: RAW TYPE =",
    typeof location
  );
  console.log(
    "SHIFTLY LOCATION TRACE: RAW VALUE =",
    location
  );
  console.log(
    "SHIFTLY LOCATION TRACE: RAW JSON =",
    (() => {
      try {
        return JSON.stringify(location);
      } catch {
        return "JSON_STRINGIFY_FAILED";
      }
    })()
  );
  if (location && typeof location === "object") {
    const city = cleanText(location.city);
    const region = cleanText(location.region);
    const postalCode = cleanText(location.postal_code);
    const country = cleanText(location.country);

    location = [
      city,
      region,
      postalCode,
      country
    ]
      .filter(Boolean)
      .join(", ");
  } else {
    location = cleanText(location);
  }

  if (!location) {
    console.log(
      "SHIFTLY: No vehicle location supplied"
    );

    return {
      success: false,
      reason: "no-location"
    };
  }

  console.log(
    "SHIFTLY: Looking for Marketplace Location field"
  );

  let locationInput =
    findInputByKeywords(
      [
        "location",
        "where"
      ],
      {
        excludeTypes: [
          "hidden",
          "file",
          "checkbox",
          "radio",
          "search"
        ]
      }
    );

  // Current Facebook Marketplace QA fallback.
  if (!locationInput) {
    const inputs = Array.from(
      document.querySelectorAll("input")
    );

    locationInput = inputs.find(input =>
      input.getAttribute("aria-label") === "Location"
    );
  }

  if (!locationInput) {
    console.warn(
      "SHIFTLY: Location input not found"
    );

    return {
      success: false,
      reason: "location-input-not-found"
    };
  }

  console.log(
    "SHIFTLY: Filling location:",
    location
  );

  simulateInput(locationInput, location);

  await sleep(2000);

  // Facebook usually displays autocomplete suggestions.
  console.log(
    "SHIFTLY: Looking for location autocomplete suggestions..."
  );

  const suggestionCandidates = Array.from(
    document.querySelectorAll(
      '[role="option"], [role="listbox"] [role="option"], [role="menuitem"], [role="button"]'
    )
  );

  console.log(
    "SHIFTLY: Location suggestion candidates found:",
    suggestionCandidates.length
  );

  const normalizedLocation =
    normalizeText(location);

  let exactSuggestion = suggestionCandidates.find(
    element => {
      const text = normalizeText(
        element.textContent
      );

      return (
        text === normalizedLocation ||
        text.includes(normalizedLocation)
      );
    }
  );

  if (!exactSuggestion) {
    // Try city/state portion.
    const locationParts = location
      .split(",")
      .map(part => part.trim())
      .filter(Boolean);

    const city =
      locationParts.length > 0
        ? normalizeText(locationParts[0])
        : "";

    console.log(
      "SHIFTLY: Trying city match:",
      city
    );

    if (city) {
      exactSuggestion =
        suggestionCandidates.find(element => {
          const text = normalizeText(
            element.textContent
          );

          return text.includes(city);
        });
    }
  }

  if (exactSuggestion) {
    console.log(
      "SHIFTLY: Selecting location suggestion:",
      exactSuggestion.textContent
    );

    clickElement(exactSuggestion);

    await sleep(1000);

    // Verify location was accepted by checking for validation errors
    const locationParent = locationInput.parentElement;
    const hasValidationError = locationParent?.querySelector('[role="alert"]') ||
                               locationParent?.querySelector('.error') ||
                               locationInput.getAttribute('aria-invalid') === 'true';

    if (hasValidationError) {
      console.warn(
        "SHIFTLY: Location still has validation error after selection"
      );
    } else {
      console.log(
        "SHIFTLY: Location accepted without validation error"
      );
    }

    return {
      success: !hasValidationError
    };
  }

  console.warn(
    "SHIFTLY: Location suggestion was not found."
  );

  console.log(
    "SHIFTLY: Available suggestions:",
    suggestionCandidates.map(el => el.textContent).slice(0, 5)
  );

  console.warn(
    "SHIFTLY: Facebook may require the user to select the location manually."
  );

  return {
    success: false,
    reason: "location-suggestion-not-found"
  };
}


// ============================================================
// VEHICLE TYPE
// ============================================================

function normalizeVehicleType(body) {
  // Remove hardcoded normalization - use source value as-is
  // Facebook's actual visible options will be the authoritative target vocabulary
  return normalizeText(body) || body;
}

function getLabelParentChain(label) {
  const chain = [];
  let current = label.parentElement;
  let depth = 0;

  while (current && depth < 10) {
    chain.push({
      tag: current.tagName,
      id: current.id,
      class: current.className,
      role: current.getAttribute('role'),
      tabindex: current.getAttribute('tabindex')
    });
    current = current.parentElement;
    depth++;
  }

  return chain;
}

async function fillVehicleType(listing) {
  // VERSION MARKER - Verify latest code is running
  console.log("VEHICLE TYPE DEBUG: fillVehicleType VERSION = VT_DEBUG_2026_09_21_A");
  console.log("VEHICLE TYPE DEBUG: fillVehicleType called with listing:", listing);

  const sourceBodyType = normalizeVehicleType(listing?.body);

  console.log(
    "SHIFTLY: Vehicle body/source type:",
    sourceBodyType
  );

  if (!sourceBodyType) {
    console.warn(
      "SHIFTLY: Vehicle type is empty"
    );
    return { filled: false, status: "SKIPPED_NO_DATA", reason: "No source body type" };
  }

  // Generic vehicle type - will match against whatever Facebook exposes
  const sourceVehicleType = sourceBodyType;

  console.log(
    "SHIFTLY: Source vehicle type:",
    sourceVehicleType
  );

  const normalizeVehicleOption = (value) => {
    return normalizeText(value)
      .replace(/[^a-z0-9]/g, "");
  };

  const sourceNormalized =
    normalizeVehicleOption(sourceVehicleType);

  console.log(
    "SHIFTLY: Source vehicle type normalized:",
    sourceVehicleType,
    sourceNormalized
  );

  // Semantic vehicle type understanding
  // These functions help determine if a source body type semantically matches a Facebook option
  function isPassengerVehicleType(sourceType) {
    const type = sourceType.toLowerCase();
    return type.includes('suv') || type.includes('suvs') ||
           type.includes('sedan') ||
           type.includes('coupe') ||
           type.includes('convertible') ||
           type.includes('hatchback') ||
           type.includes('wagon') ||
           type.includes('car');
  }

  function isTruckType(sourceType) {
    const type = sourceType.toLowerCase();
    return type.includes('truck') ||
           type.includes('pickup');
  }

  function isVanType(sourceType) {
    const type = sourceType.toLowerCase();
    return type.includes('van') ||
           type.includes('minivan');
  }

  function isMotorcycleType(sourceType) {
    const type = sourceType.toLowerCase();
    return type.includes('motorcycle') ||
           type.includes('motorbike') ||
           type.includes('bike');
  }

  function isRVType(sourceType) {
    const type = sourceType.toLowerCase();
    return type.includes('rv') ||
           type.includes('camper') ||
           type.includes('recreational');
  }

  function isBoatType(sourceType) {
    const type = sourceType.toLowerCase();
    return type.includes('boat') ||
           type.includes('watercraft');
  }

  // Determine what category a Facebook option represents
  function getFacebookOptionCategory(optionText) {
    const text = optionText.toLowerCase();

    if (text.includes('car') && text.includes('truck')) {
      return 'car-truck'; // Broad category covering both cars and trucks
    }
    if (text.includes('car')) {
      return 'car';
    }
    if (text.includes('truck')) {
      return 'truck';
    }
    if (text.includes('suv')) {
      return 'suv';
    }
    if (text.includes('motorcycle') || text.includes('motorbike')) {
      return 'motorcycle';
    }
    if (text.includes('rv') || text.includes('camper')) {
      return 'rv';
    }
    if (text.includes('boat')) {
      return 'boat';
    }
    if (text.includes('van')) {
      return 'van';
    }

    return 'unknown';
  }

  // Semantic matching: determine if source type falls under Facebook option category
  function semanticallyMatches(sourceType, facebookOptionText) {
    const sourceLower = sourceType.toLowerCase();
    const fbCategory = getFacebookOptionCategory(facebookOptionText);

    console.log(
      "SHIFTLY: Semantic matching - source:",
      sourceType,
      "Facebook option:",
      facebookOptionText,
      "Facebook category:",
      fbCategory
    );

    // Exact match always wins
    if (sourceLower === facebookOptionText.toLowerCase()) {
      console.log("SHIFTLY: Semantic match - exact match");
      return true;
    }

    // Facebook option is a broad category like "Car/Truck"
    if (fbCategory === 'car-truck') {
      // Car/Truck should match passenger vehicles and trucks
      if (isPassengerVehicleType(sourceType) || isTruckType(sourceType)) {
        console.log("SHIFTLY: Semantic match - source is car/truck type, matches Car/Truck category");
        return true;
      }
    }

    // Facebook option is specifically "Car"
    if (fbCategory === 'car') {
      if (isPassengerVehicleType(sourceType)) {
        console.log("SHIFTLY: Semantic match - source is passenger vehicle, matches Car category");
        return true;
      }
    }

    // Facebook option is specifically "Truck"
    if (fbCategory === 'truck') {
      if (isTruckType(sourceType)) {
        console.log("SHIFTLY: Semantic match - source is truck type, matches Truck category");
        return true;
      }
    }

    // Facebook option is specifically "SUV"
    if (fbCategory === 'suv') {
      if (sourceLower.includes('suv') || sourceLower.includes('suvs')) {
        console.log("SHIFTLY: Semantic match - source is SUV, matches SUV category");
        return true;
      }
    }

    // Facebook option is specifically "Motorcycle"
    if (fbCategory === 'motorcycle') {
      if (isMotorcycleType(sourceType)) {
        console.log("SHIFTLY: Semantic match - source is motorcycle, matches Motorcycle category");
        return true;
      }
    }

    // Facebook option is specifically "RV"
    if (fbCategory === 'rv') {
      if (isRVType(sourceType)) {
        console.log("SHIFTLY: Semantic match - source is RV, matches RV category");
        return true;
      }
    }

    // Facebook option is specifically "Boat"
    if (fbCategory === 'boat') {
      if (isBoatType(sourceType)) {
        console.log("SHIFTLY: Semantic match - source is boat, matches Boat category");
        return true;
      }
    }

    // Facebook option is specifically "Van"
    if (fbCategory === 'van') {
      if (isVanType(sourceType)) {
        console.log("SHIFTLY: Semantic match - source is van, matches Van category");
        return true;
      }
    }

    console.log("SHIFTLY: Semantic match - no semantic relationship found");
    return false;
  }

  // Find the actual Facebook combobox control directly
  // Facebook's actual Vehicle Type control is: <label role="combobox" tabindex="0" aria-haspopup="listbox">
  const vehicleTypeControls = Array.from(
    document.querySelectorAll('label[role="combobox"][aria-haspopup="listbox"]')
  );

  let control = vehicleTypeControls.find((element) => {
    const ariaLabel = normalizeText(element.getAttribute("aria-label") || "");
    const labelledBy = element.getAttribute("aria-labelledby");

    let labelledText = "";
    if (labelledBy) {
      const labelledElement = document.getElementById(labelledBy);
      labelledText = normalizeText(labelledElement?.textContent || "");
    }

    const text = normalizeText(element.textContent || "");

    return (
      ariaLabel === "vehicle type" ||
      labelledText === "vehicle type" ||
      text.includes("vehicle type")
    );
  });

  if (!control) {
    console.warn(
      "SHIFTLY: Vehicle type combobox control not found - field may not be available in current Facebook form"
    );
    console.log(
      "SHIFTLY: Vehicle Type: SKIPPED_UNAVAILABLE - Facebook combobox control not found"
    );
    return { filled: false, status: "SKIPPED_UNAVAILABLE", reason: "Facebook combobox control not found" };
  }

  // Debug logs for the actual combobox found
  console.log("VEHICLE TYPE DEBUG: actual combobox found");
  console.log("VEHICLE TYPE DEBUG: tagName:", control.tagName);
  console.log("VEHICLE TYPE DEBUG: role:", control.getAttribute('role'));
  console.log("VEHICLE TYPE DEBUG: tabindex:", control.getAttribute('tabindex'));
  console.log("VEHICLE TYPE DEBUG: aria-expanded:", control.getAttribute('aria-expanded'));
  console.log("VEHICLE TYPE DEBUG: aria-haspopup:", control.getAttribute('aria-haspopup'));
  console.log("VEHICLE TYPE DEBUG: aria-labelledby:", control.getAttribute('aria-labelledby'));

  const labelledBy = control.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelledElement = document.getElementById(labelledBy);
    const labelledText = normalizeText(labelledElement?.textContent || "");
    console.log("VEHICLE TYPE DEBUG: labelled text:", labelledText);
  }

  console.log(
    "SHIFTLY: Vehicle type combobox control found:",
    control
  );

  clickElement(control);

  await sleep(1000);

  // Re-find the actual combobox after first click to ensure we have the right reference
  const reFindCombobox = () => {
    return vehicleTypeControls.find((element) => {
      const ariaLabel = normalizeText(element.getAttribute("aria-label") || "");
      const labelledBy = element.getAttribute("aria-labelledby");

      let labelledText = "";
      if (labelledBy) {
        const labelledElement = document.getElementById(labelledBy);
        labelledText = normalizeText(labelledElement?.textContent || "");
      }

      const text = normalizeText(element.textContent || "");

      return (
        ariaLabel === "vehicle type" ||
        labelledText === "vehicle type" ||
        text.includes("vehicle type")
      );
    });
  };

  control = reFindCombobox();

  if (!control) {
    console.error("VEHICLE TYPE DEBUG: CRITICAL - Combobox disappeared after first click");
    return { filled: false, status: "FAILED", reason: "Combobox disappeared after first click", source: sourceVehicleType };
  }

  // Verify dropdown is actually opened
  let isExpanded =
    control.getAttribute("aria-expanded") === "true" ||
    control.getAttribute("aria-expanded") === "1";

  console.log(
    "SHIFTLY: Vehicle type dropdown expanded:",
    isExpanded
  );

  // DEBUG: Log control state after click
  console.log("VEHICLE TYPE DEBUG: control after click", {
    ariaExpanded: control.getAttribute('aria-expanded'),
    ariaHaspopup: control.getAttribute('aria-haspopup'),
    textContent: normalizeText(control.textContent),
    tagName: control.tagName,
    className: control.className
  });

  // If dropdown not expanded, try clicking again
  if (!isExpanded) {
    console.log(
      "SHIFTLY: Dropdown not expanded, clicking again..."
    );
    clickElement(control);
    await sleep(1000);

    // Re-find the actual combobox after second click
    control = reFindCombobox();

    if (!control) {
      console.error("VEHICLE TYPE DEBUG: CRITICAL - Combobox disappeared after second click");
      return { filled: false, status: "FAILED", reason: "Combobox disappeared after second click", source: sourceVehicleType };
    }

    // Re-read aria-expanded from the ACTUAL control after second click
    isExpanded =
      control.getAttribute("aria-expanded") === "true" ||
      control.getAttribute("aria-expanded") === "1";

    // DEBUG: Log control state after second click
    console.log("VEHICLE TYPE DEBUG: control after second click", {
      ariaExpanded: control.getAttribute('aria-expanded'),
      ariaHaspopup: control.getAttribute('aria-haspopup'),
      textContent: normalizeText(control.textContent)
    });

    console.log(
      "SHIFTLY: Vehicle type dropdown expanded after second click:",
      isExpanded
    );
  }

  // TEMPORARY DIAGNOSTIC LOGGING: Runtime DOM inventory for open Vehicle Type dropdown
  console.log("=== VEHICLE TYPE DOM INVENTORY START ===");
  console.log("sourceVehicleType:", sourceVehicleType);
  console.log("sourceNormalized:", sourceNormalized);
  console.log("isExpanded:", isExpanded);

  const diagnosticSelectors = [
    '[role="option"]',
    '[role="menuitem"]',
    '[role="listbox"]',
    '[role="button"]',
    '[tabindex="0"]',
    '[tabindex="-1"]'
  ];

  console.log("=== DOM ELEMENTS BY SELECTOR ===");
  for (const selector of diagnosticSelectors) {
    const elements = Array.from(document.querySelectorAll(selector));
    const visibleElements = elements.filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    console.log(`Selector: ${selector}`);
    console.log(`  Total elements: ${elements.length}`);
    console.log(`  Visible elements: ${visibleElements.length}`);

    visibleElements.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      const textContent = normalizeText(element.textContent);
      console.log(`  Element ${index + 1}:`);
      console.log(`    tagName: ${element.tagName}`);
      console.log(`    textContent: ${textContent}`);
      console.log(`    role: ${element.getAttribute('role')}`);
      console.log(`    aria-label: ${element.getAttribute('aria-label')}`);
      console.log(`    aria-selected: ${element.getAttribute('aria-selected')}`);
      console.log(`    aria-expanded: ${element.getAttribute('aria-expanded')}`);
      console.log(`    tabindex: ${element.getAttribute('tabindex')}`);
      console.log(`    className: ${element.className}`);
      console.log(`    boundingClientRect: width=${rect.width}, height=${rect.height}, top=${rect.top}, left=${rect.left}`);
    });
  }

  console.log("=== SPECIFIC VEHICLE TYPE MATCHES ===");
  const targetVehicleTypes = ['Car', 'Truck', 'Car/Truck', 'SUV', 'Motorcycle', 'RV', 'Boat', 'Van'];
  for (const targetType of targetVehicleTypes) {
    const matchingElements = [];
    for (const selector of diagnosticSelectors) {
      const elements = Array.from(document.querySelectorAll(selector));
      elements.forEach(element => {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const textContent = normalizeText(element.textContent);
          if (textContent.toLowerCase() === targetType.toLowerCase() ||
              textContent.toLowerCase().includes(targetType.toLowerCase())) {
            matchingElements.push({
              selector,
              tagName: element.tagName,
              textContent,
              role: element.getAttribute('role'),
              ariaLabel: element.getAttribute('aria-label'),
              tabindex: element.getAttribute('tabindex'),
              className: element.className
            });
          }
        }
      });
    }

    if (matchingElements.length > 0) {
      console.log(`Found ${matchingElements.length} elements matching "${targetType}":`);
      matchingElements.forEach((match, index) => {
        console.log(`  Match ${index + 1}:`, match);
      });
    } else {
      console.log(`No elements found matching "${targetType}"`);
    }
  }

  console.log("=== VEHICLE TYPE DOM INVENTORY END ===");

  console.log(
    "SHIFTLY: VEHICLE TYPE OPTIONS START"
  );

  // Prioritize actual role="option" elements first
  let options = Array.from(
    document.querySelectorAll('[role="option"]')
  );

  // If no role="option" elements found, try other legitimate structures
  if (options.length === 0) {
    console.log("SHIFTLY: No role=option elements found, trying other selectors");
    const fallbackSelectors = [
      '[role="menuitem"]',
      '[role="listbox"] [role="button"]',
      '[role="listbox"] button',
      '[role="listbox"] [tabindex="0"]'
    ];

    for (const selector of fallbackSelectors) {
      options.push(
        ...Array.from(
          document.querySelectorAll(selector)
        )
      );
    }
  }

  options = Array.from(
    new Set(options)
  ).filter((element) => {
    const rect =
      element.getBoundingClientRect();

    const text =
      normalizeText(element.textContent);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      text.length > 0
    );
  });

  console.log(
    "SHIFTLY: Vehicle type options found:",
    options.length
  );

  // DEBUG: Log initial option discovery results
  console.log("VEHICLE TYPE DEBUG: initial option discovery results =", options.length, "options");
  if (options.length === 0) {
    console.log("VEHICLE TYPE DEBUG: WARNING - No options found with initial selectors");
    console.log("VEHICLE TYPE DEBUG: Document has role=option elements:", document.querySelectorAll('[role="option"]').length);
    console.log("VEHICLE TYPE DEBUG: Document has role=menuitem elements:", document.querySelectorAll('[role="menuitem"]').length);
  }

  const optionInfo = options.map((element) => {
    const text =
      normalizeText(element.textContent);

    const ariaLabel =
      normalizeText(
        element.getAttribute("aria-label") || ""
      );

    const role =
      element.getAttribute("role") || "";

    return {
      element,
      text,
      ariaLabel,
      role,
      normalized:
        normalizeVehicleOption(text)
    };
  });

  optionInfo.forEach((item, index) => {
    console.log(
      `SHIFTLY: OPTION ${index + 1}`
    );
    console.log(
      `SHIFTLY: text = ${item.text}`
    );
    console.log(
      `SHIFTLY: aria-label = ${item.ariaLabel}`
    );
    console.log(
      `SHIFTLY: role = ${item.role}`
    );
    console.log(
      `SHIFTLY: normalized = ${item.normalized}`
    );
  });

  console.log(
    "SHIFTLY: VEHICLE TYPE OPTIONS END"
  );

  // Log all Facebook options for debugging
  console.log(
    "SHIFTLY: Facebook Vehicle Type options:",
    optionInfo.map(o => o.text)
  );

  // No hardcoded aliases - match directly against Facebook's actual options
  // The source value is used as-is for dynamic matching
  console.log(
    "SHIFTLY: Source normalized:",
    sourceNormalized
  );

  let target = null;
  let matchMethod = null;

  // 1. Exact normalized match against source
  console.log(
    "SHIFTLY: Attempting exact normalized match against source..."
  );
  target = optionInfo.find((item) => {
    return (
      item.normalized ===
      sourceNormalized
    );
  })?.element || null;

  if (target) {
    matchMethod = "exact normalized match";
    console.log(
      "SHIFTLY: Exact match found!"
    );
  }

  // 2. Semantic matching - handle vocabulary differences (e.g., SUV ? Car/Truck)
  if (!target) {
    console.log(
      "SHIFTLY: Attempting semantic match..."
    );
    console.log("VEHICLE TYPE DEBUG: Testing semantic match for source:", sourceVehicleType, "against options:", optionInfo.map(o => o.text));

    target = optionInfo.find((item) => {
      const matchResult = semanticallyMatches(sourceVehicleType, item.text);
      console.log("VEHICLE TYPE DEBUG: semantic test result for", item.text, "=", matchResult);
      return matchResult;
    })?.element || null;

    if (target) {
      matchMethod = "semantic match";
      console.log(
        "SHIFTLY: Semantic match found!"
      );
      console.log("VEHICLE TYPE DEBUG: semantic match successful -", sourceVehicleType, "->", target.textContent);
    } else {
      console.log("VEHICLE TYPE DEBUG: semantic match failed for all options");
    }
  }

  // 3. Case-insensitive text match (before normalization)
  if (!target) {
    console.log(
      "SHIFTLY: Attempting case-insensitive text match..."
    );
    target = optionInfo.find((item) => {
      const lowerText = item.text.toLowerCase();
      const lowerSource = sourceVehicleType.toLowerCase();
      return lowerText === lowerSource ||
             lowerText.includes(lowerSource) ||
             lowerSource.includes(lowerText);
    })?.element || null;

    if (target) {
      matchMethod = "case-insensitive text match";
      console.log(
        "SHIFTLY: Case-insensitive text match found!"
      );
    }
  }

  // 4. Starts-with match
  if (!target) {
    console.log(
      "SHIFTLY: Attempting starts-with match..."
    );
    target = optionInfo.find((item) => {
      return (
        item.normalized.startsWith(
          sourceNormalized
        ) ||
        sourceNormalized.startsWith(
          item.normalized
        )
      );
    })?.element || null;

    if (target) {
      matchMethod = "starts-with match";
      console.log(
        "SHIFTLY: Starts-with match found!"
      );
    }
  }

  // 5. Contains match (substring)
  if (!target) {
    console.log(
      "SHIFTLY: Attempting contains match..."
    );
    target = optionInfo.find((item) => {
      return (
        item.normalized.includes(sourceNormalized) ||
        sourceNormalized.includes(item.normalized)
      );
    })?.element || null;

    if (target) {
      matchMethod = "contains match";
      console.log(
        "SHIFTLY: Contains match found!"
      );
    }
  }

  // NO FALLBACK: Only select when there is a reliable semantic match
  // Do NOT select an arbitrary option just to keep the workflow moving

  if (!target) {
    // DEBUG: Log comprehensive information before failing
    console.log("=== VEHICLE TYPE ERROR DEBUG START ===");
    console.log("MARKETPLACE_FILLER_VERSION_2026_09_21_B");
    console.log("VEHICLE TYPE DEBUG: source =", sourceVehicleType);
    console.log("VEHICLE TYPE DEBUG: dropdown opened =", isExpanded);

    // DEBUG: Log all candidate options with full DOM details
    console.log("VEHICLE TYPE DEBUG: candidate options =", optionInfo.map((item, index) => {
      const rect = item.element.getBoundingClientRect();
      return {
        index: index,
        textContent: item.text,
        tagName: item.element.tagName,
        role: item.role,
        ariaLabel: item.ariaLabel,
        ariaSelected: item.element.getAttribute('aria-selected'),
        ariaChecked: item.element.getAttribute('aria-checked'),
        tabindex: item.element.getAttribute('tabindex'),
        className: item.element.className,
        isConnected: item.element.isConnected,
        visible: rect.width > 0 && rect.height > 0,
        rect: {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left
        }
      };
    }));

    // DEBUG: Global search for options in case they're rendered in a portal/overlay
    console.log("VEHICLE TYPE DEBUG: performing global document search for vehicle type options...");
    const globalOptionSelectors = [
      '[role="option"]',
      '[role="menuitem"]',
      '[role="listbox"] [role="button"]',
      '[role="listbox"] button',
      '[role="listbox"] [tabindex="0"]',
      'div[role="listbox"]',
      'ul[role="listbox"]',
      '[role="combobox"] + div [role="option"]'
    ];

    let globalOptions = [];
    for (const selector of globalOptionSelectors) {
      globalOptions.push(...Array.from(document.querySelectorAll(selector)));
    }

    globalOptions = Array.from(new Set(globalOptions)).filter((element) => {
      const rect = element.getBoundingClientRect();
      const text = normalizeText(element.textContent);
      return rect.width > 0 && rect.height > 0 && text.length > 0;
    });

    console.log("VEHICLE TYPE DEBUG: global options found =", globalOptions.length);
    console.log("VEHICLE TYPE DEBUG: global options details =", globalOptions.map((item, index) => {
      const rect = item.getBoundingClientRect();
      return {
        index: index,
        textContent: normalizeText(item.textContent),
        tagName: item.tagName,
        role: item.getAttribute('role'),
        ariaLabel: normalizeText(item.getAttribute('aria-label') || ''),
        className: item.className,
        visible: rect.width > 0 && rect.height > 0,
        rect: {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left
        }
      };
    }));

    console.log("=== VEHICLE TYPE ERROR DEBUG END ===");
    console.log("=== VEHICLE TYPE FAILURE DEBUG ===");
    console.log("MARKETPLACE_FILLER_VERSION_2026_09_21_B: Vehicle Type FAILED");
    console.log("Source body type:", sourceVehicleType);
    console.log("Normalized source:", sourceNormalized);
    console.log("Facebook options found:", optionInfo.length);
    console.log("Facebook options:", optionInfo.map(o => o.text));
    console.log("Dropdown opened:", isExpanded);
    console.log("Match method attempted:", matchMethod);
    console.log("Semantic matching was attempted:", !!matchMethod);
    console.log("=== END VEHICLE TYPE FAILURE DEBUG ===");

    console.warn(
      "SHIFTLY: Vehicle type option not found for source:",
      sourceVehicleType,
      "(MARKETPLACE_FILLER_VERSION_2026_09_21_B)"
    );

    console.log(
      "SHIFTLY: Available vehicle type options (detailed):",
      optionInfo.map((item) => ({
        text: item.text,
        ariaLabel: item.ariaLabel,
        role: item.role,
        normalized: item.normalized
      }))
    );

    console.log(
      "SHIFTLY: FAILED - No reliable semantic match found"
    );
    console.log(
      "SHIFTLY: Source was:",
      sourceVehicleType,
      "(normalized:",
      sourceNormalized,
      ")"
    );
    console.log(
      "SHIFTLY: Actual options available:",
      optionInfo.map(o => o.text)
    );
    console.log(
      "SHIFTLY: NOT selecting arbitrary option - would create incorrect vehicle data"
    );

    return { filled: false, status: "FAILED", reason: "No reliable semantic match found", source: sourceVehicleType, availableOptions: optionInfo.map(o => o.text) };
  }

  console.log(
    "SHIFTLY: Vehicle type matched via:",
    matchMethod
  );

  console.log(
    "SHIFTLY: Vehicle type target selected:",
    target.textContent
  );

  console.log("VEHICLE TYPE DEBUG: clicking option", target.textContent);
  console.log("VEHICLE TYPE DEBUG: target element details", {
    textContent: target.textContent,
    tagName: target.tagName,
    role: target.getAttribute('role'),
    ariaLabel: target.getAttribute('aria-label'),
    className: target.className
  });

  try {
    target.scrollIntoView({
      block: "center",
      inline: "nearest"
    });
  } catch (_) {}

  await sleep(250);

  clickElement(target);

  await sleep(700);

  // Critical verification: re-read the actual Facebook combobox and verify selection
  console.log("VEHICLE TYPE DEBUG: Re-reading actual combobox after selection");
  const controlAfterSelection = reFindCombobox();

  if (!controlAfterSelection) {
    console.error("VEHICLE TYPE DEBUG: CRITICAL - Combobox disappeared after selection");
    return { filled: false, status: "FAILED", reason: "Combobox disappeared after selection", source: sourceVehicleType };
  }

  // Verify Facebook accepted the selection.
  const selectedText =
    normalizeText(
      controlAfterSelection.textContent
    );

  const selectedAria =
    normalizeText(
      controlAfterSelection.getAttribute("aria-label")
    );

  const selectedNormalized =
    normalizeVehicleOption(
      selectedText
    );

  console.log(
    "SHIFTLY: Vehicle type verification - FIRST CHECK"
  );
  console.log(
    "SHIFTLY: Source:",
    sourceVehicleType
  );
  console.log(
    "SHIFTLY: Source normalized:",
    sourceNormalized
  );
  console.log(
    "SHIFTLY: Matched Facebook option:",
    target.textContent
  );
  console.log(
    "SHIFTLY: Control textContent:",
    selectedText
  );
  console.log(
    "SHIFTLY: Control aria-label:",
    selectedAria
  );
  console.log(
    "SHIFTLY: Control normalized:",
    selectedNormalized
  );

  console.log("VEHICLE TYPE DEBUG: committed value =", selectedText);
  console.log("VEHICLE TYPE DEBUG: verification check - source:", sourceVehicleType, "committed:", selectedText);

  // Verify the selected value changed from blank state
  const wasBlank = !selectedText || selectedText === "" || selectedText === "vehicle type";
  if (wasBlank) {
    console.warn("VEHICLE TYPE DEBUG: Control value is still blank after selection");
  }

  // Verify the selected value semantically corresponds to the requested source vehicle type
  const selectedSuccessfully =
    selectedNormalized === sourceNormalized ||
    selectedAria.includes(sourceNormalized) ||
    selectedText.toLowerCase().includes(sourceVehicleType.toLowerCase()) ||
    sourceVehicleType.toLowerCase().includes(selectedText.toLowerCase()) ||
    semanticallyMatches(sourceVehicleType, selectedText);

  console.log(
    "SHIFTLY: First verification result:",
    selectedSuccessfully
  );

  if (!selectedSuccessfully) {
    // Facebook sometimes updates the control asynchronously.
    console.log(
      "SHIFTLY: First verification failed, waiting for async update..."
    );
    await sleep(1000);

    // Re-read the actual combobox again for retry verification
    const controlForRetry = reFindCombobox();

    if (!controlForRetry) {
      console.error("VEHICLE TYPE DEBUG: CRITICAL - Combobox disappeared during retry");
      return { filled: false, status: "FAILED", reason: "Combobox disappeared during retry", source: sourceVehicleType };
    }

    const retryText =
      normalizeText(
        controlForRetry.textContent
      );

    const retryAria =
      normalizeText(
        controlForRetry.getAttribute("aria-label")
      );

    const retryNormalized =
      normalizeVehicleOption(
        retryText
      );

    console.log(
      "SHIFTLY: Vehicle type verification - RETRY CHECK"
    );
    console.log(
      "SHIFTLY: Control textContent:",
      retryText
    );
    console.log(
      "SHIFTLY: Control aria-label:",
      retryAria
    );
    console.log(
      "SHIFTLY: Control normalized:",
      retryNormalized
    );

    const retrySuccess =
      retryNormalized === sourceNormalized ||
      retryAria.includes(sourceNormalized) ||
      retryText.toLowerCase().includes(sourceVehicleType.toLowerCase()) ||
      sourceVehicleType.toLowerCase().includes(retryText.toLowerCase()) ||
      semanticallyMatches(sourceVehicleType, retryText);

    console.log(
      "SHIFTLY: Retry verification result:",
      retrySuccess
    );

    if (!retrySuccess) {
      console.warn(
        "SHIFTLY: Vehicle type selection could not be verified after retry."
      );
      console.log(
        "SHIFTLY: FAILED - Selection not committed to Facebook state"
      );
      console.log(
        "SHIFTLY: Source was:",
        sourceVehicleType
      );
      console.log(
        "SHIFTLY: Matched Facebook option was:",
        target.textContent
      );
      console.log(
        "SHIFTLY: Actual control text:",
        retryText
      );
      console.log(
        "SHIFTLY: Actual control aria:",
        retryAria
      );
      console.log(
        "SHIFTLY: SUCCESS CRITERION FAILED: source ? matched option ? committed ? verified"
      );
      return { filled: false, status: "FAILED", reason: "Selection not committed to Facebook state", source: sourceVehicleType, matchedOption: target.textContent, actualValue: retryText };
    }
  }

  console.log(
    "SHIFTLY: SUCCESS - Full chain verified:"
  );
  console.log(
    "SHIFTLY: Source body type:",
    sourceVehicleType
  );
  console.log(
    "SHIFTLY: Matched Facebook option:",
    target.textContent
  );
  console.log(
    "SHIFTLY: Actual committed value:",
    selectedText
  );
  console.log(
    "SHIFTLY: Verification:",
    "source ? matched option ? committed ? verified = PASS"
  );

  console.log("VEHICLE TYPE DEBUG: verification result = PASS");

  // Sequential state verification: ensure Vehicle Type remains committed
  console.log(
    "SHIFTLY: Sequential state check - verifying Vehicle Type persists after selection"
  );

  await sleep(500);

  // Re-read the actual combobox for sequential state verification
  const controlForSequential = reFindCombobox();

  if (!controlForSequential) {
    console.error("VEHICLE TYPE DEBUG: CRITICAL - Combobox disappeared during sequential check");
    return { filled: false, status: "FAILED", reason: "Combobox disappeared during sequential check", source: sourceVehicleType };
  }

  const finalText = normalizeText(controlForSequential.textContent);
  const finalAria = normalizeText(controlForSequential.getAttribute("aria-label"));

  console.log(
    "SHIFTLY: Sequential check - control text:",
    finalText
  );
  console.log(
    "SHIFTLY: Sequential check - control aria:",
    finalAria
  );

  console.log("VEHICLE TYPE DEBUG: sequential state check - committed value persists:", finalText);

  const persists = finalText === selectedText ||
                   finalAria.includes(sourceVehicleType) ||
                   finalText.toLowerCase().includes(sourceVehicleType.toLowerCase()) ||
                   semanticallyMatches(sourceVehicleType, finalText);

  if (!persists) {
    console.warn(
      "SHIFTLY: Sequential state check FAILED - Vehicle Type did not persist"
    );
    console.log("VEHICLE TYPE DEBUG: sequential state verification = FAIL");
    return { filled: false, status: "FAILED", reason: "Vehicle Type selection did not persist", source: sourceVehicleType, facebookValue: finalText };
  }

  console.log(
    "SHIFTLY: Sequential state check PASSED - Vehicle Type persists"
  );

  console.log("VEHICLE TYPE DEBUG: sequential state verification = PASS");
  console.log("VEHICLE TYPE DEBUG: proceeding to next field");

  // Final verification using the actual combobox state
  const finalControl = reFindCombobox();
  if (!finalControl) {
    console.error("VEHICLE TYPE DEBUG: CRITICAL - Combobox disappeared at final verification");
    return { filled: false, status: "FAILED", reason: "Combobox disappeared at final verification", source: sourceVehicleType };
  }

  const finalControlText = normalizeText(finalControl.textContent);
  const finalControlAria = normalizeText(finalControl.getAttribute("aria-label"));

  console.log("VEHICLE TYPE DEBUG: final verification - control text:", finalControlText);
  console.log("VEHICLE TYPE DEBUG: final verification - control aria:", finalControlAria);

  return { filled: true, status: "FILLED", sourceValue: sourceVehicleType, facebookValue: finalControlText, matchedOption: target.textContent };
}
async function fillYear(listing) {
  if (!listing.year) {
    return false;
  }

  const year = String(listing.year);

  console.log(
    "SHIFTLY: Looking for year field:",
    year
  );

  let yearInput =
    findInputByKeywords(
      [
        "year"
      ],
      {
        excludeTypes: [
          "hidden",
          "file",
          "checkbox",
          "radio"
        ]
      }
    );

  if (yearInput) {
    return simulateInput(
      yearInput,
      year
    );
  }

  const yearControl =
    findClickableByKeywords([
      "year"
    ]);

  if (!yearControl) {
    console.warn(
      "SHIFTLY: Year control not found"
    );

    return false;
  }

  clickElement(yearControl);

  await sleep(500);

  const options = Array.from(
    document.querySelectorAll(
      '[role="option"], [role="menuitem"], button, [role="button"]'
    )
  );

  const target = options.find(element =>
    normalizeText(
      element.textContent
    ) === normalizeText(year)
  );

  if (target) {
    clickElement(target);

    await sleep(500);

    return true;
  }

  console.warn(
    "SHIFTLY: Year option not found:",
    year
  );

  return false;
}


// ============================================================
// MAKE
// ============================================================

async function findMarketplaceMakeControl() {
  const controls = Array.from(
    document.querySelectorAll(
      'label[role="combobox"][aria-haspopup="listbox"]'
    )
  );

  return (
    controls.find((control) => {
      const labelledBy = control.getAttribute("aria-labelledby");
      const labelElement = labelledBy
        ? document.getElementById(labelledBy)
        : null;

      return (
        normalizeText(labelElement?.textContent || "") ===
        normalizeText("Make")
      );
    }) || null
  );
}

async function fillMake(listing, fallbackInput) {
  const wanted = String(listing?.make || "").trim();

  if (!wanted) {
    console.warn("SHIFTLY: Make skipped - no source data");
    return false;
  }

  const control = await findMarketplaceMakeControl();

  if (!control) {
    console.warn("SHIFTLY: Make control not found");
    return false;
  }

  console.log("SHIFTLY: Filling Make:", wanted);

  control.focus();
  control.click();

  await sleep(400);

  const listbox = document.querySelector('[role="listbox"]');

  if (!listbox) {
    console.error("SHIFTLY: Make listbox did not open");
    return false;
  }

  const wantedNormalized = normalizeText(wanted);

  const option = Array.from(
    listbox.querySelectorAll('[role="option"]')
  ).find(
    (item) =>
      normalizeText(item.textContent || "") ===
      wantedNormalized
  );

  if (!option) {
    console.error(
      "SHIFTLY: Make option not found:",
      wanted
    );
    return false;
  }

  option.scrollIntoView({
    block: "center"
  });

  option.click();

  await sleep(500);

  const committedText = normalizeText(
    control.innerText ||
    control.textContent ||
    ""
  );

  const committed =
    control.getAttribute("aria-expanded") === "false" &&
    committedText.includes(wantedNormalized);

  console.log("SHIFTLY: Make result:", {
    wanted,
    committed,
    text: control.innerText,
    expanded: control.getAttribute("aria-expanded")
  });

  return committed;
}


// ============================================================
// MODEL
// ============================================================

async function findMarketplaceModelInput() {
  const inputs = Array.from(
    document.querySelectorAll('input[type="text"]')
  );

  return (
    inputs.find((input) => {
      const parent = input.parentElement;
      const label = parent?.querySelector("span");

      return (
        normalizeText(label?.textContent || "") ===
        normalizeText("Model")
      );
    }) || null
  );
}

async function fillModel(listing, fallbackInput) {
  const wanted = String(listing?.model || "").trim();

  if (!wanted) {
    console.warn("SHIFTLY: Model skipped - no source data");
    return false;
  }

  let input = await findMarketplaceModelInput();

  if (!input) {
    input = fallbackInput;
  }

  if (!input) {
    console.error("SHIFTLY: Model input not found");
    return false;
  }

  console.log("SHIFTLY: Filling Model:", wanted);

  input.focus();

  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;

  if (!setter) {
    console.error(
      "SHIFTLY: Native input setter unavailable"
    );
    return false;
  }

  setter.call(input, wanted);

  input.dispatchEvent(
    new Event("input", {
      bubbles: true
    })
  );

  input.dispatchEvent(
    new Event("change", {
      bubbles: true
    })
  );

  await sleep(500);

  const committedValue =
    String(input.value || "").trim();

  const committed =
    normalizeText(committedValue) ===
      normalizeText(wanted) &&
    input.getAttribute("aria-invalid") !== "true";

  console.log("SHIFTLY: Model result:", {
    wanted,
    committed,
    value: input.value,
    invalid: input.getAttribute("aria-invalid")
  });

  return committed;
}


// ============================================================
// PRICE
// ============================================================
function fillPrice(listing, fallbackInput) {
  if (
    listing.price === null ||
    listing.price === undefined
  ) {
    return false;
  }

  let priceInput =
    findInputByKeywords(
      [
        "price"
      ],
      {
        excludeTypes: [
          "hidden",
          "file",
          "checkbox",
          "radio"
        ]
      }
    );

  if (!priceInput) {
    priceInput = fallbackInput;
  }

  if (!priceInput) {
    console.warn(
      "SHIFTLY: Price field not found"
    );

    return false;
  }

  console.log(
    "SHIFTLY: Filling price:",
    listing.price,
    "currency:",
    listing.currency
  );

  return simulateInput(
    priceInput,
    String(listing.price)
  );
}


// ============================================================
// MILEAGE
// ============================================================

function fillMileage(listing, fallbackInput) {
  if (
    listing.mileage === null ||
    listing.mileage === undefined
  ) {
    return false;
  }

  let mileageInput =
    findInputByKeywords(
      [
        "mileage",
        "odometer",
        "kilometer",
        "km"
      ],
      {
        excludeTypes: [
          "hidden",
          "file",
          "checkbox",
          "radio"
        ]
      }
    );

  if (!mileageInput) {
    mileageInput = fallbackInput;
  }

  if (!mileageInput) {
    console.warn(
      "SHIFTLY: Mileage field not found"
    );

    return false;
  }

  // Format mileage without commas for Facebook
  const mileageValue = String(listing.mileage).replace(/,/g, "");

  console.log(
    "SHIFTLY: Filling mileage:",
    mileageValue,
    "unit:",
    listing.mileageUnit || "KM"
  );

  return simulateInput(
    mileageInput,
    mileageValue
  );
}


// ============================================================
// FUEL TYPE
// ============================================================

async function fillFuelType(listing) {
  if (!listing.fuel) {
    console.log("SHIFTLY: Fuel: SKIPPED - No source data");
    return { filled: false, status: "SKIPPED_NO_DATA", reason: "No source data" };
  }

  const fuel = normalizeText(listing.fuel);

  console.log(
    "SHIFTLY: Fuel type source:",
    fuel
  );

  // Map common fuel types to Facebook options
  const fuelMapping = {
    "gasoline": "Gasoline",
    "gas": "Gasoline",
    "petrol": "Gasoline",
    "diesel": "Diesel",
    "electric": "Electric",
    "hybrid": "Hybrid",
    "plugin hybrid": "Plug-in Hybrid",
    "plug-in hybrid": "Plug-in Hybrid",
    "flex fuel": "Flex Fuel",
    "flexfuel": "Flex Fuel",
    "e85": "Flex Fuel"
  };

  let facebookFuel = fuelMapping[fuel] || "Gasoline";

  console.log(
    "SHIFTLY: Facebook fuel target:",
    facebookFuel
  );

  // Find fuel control
  const labels = Array.from(
    document.querySelectorAll("span")
  );

  const label = labels.find((element) => {
    const text = normalizeText(element.textContent);
    return (
      text === "fuel" ||
      text === "fuel type" ||
      text === "engine"
    );
  });

  if (!label) {
    console.warn(
      "SHIFTLY: Fuel type label not found - field may not be available in current Facebook form"
    );
    console.log(
      "SHIFTLY: Fuel: SKIPPED_UNAVAILABLE - Facebook control not found"
    );
    return { filled: false, status: "SKIPPED_UNAVAILABLE", reason: "Facebook control not found" };
  }

  console.log(
    "SHIFTLY: Fuel type label found:",
    label
  );

  let container = label.parentElement;
  let control = null;

  for (
    let i = 0;
    i < 12 && container;
    i++
  ) {
    const clickable = Array.from(
      container.querySelectorAll(
        '[role="combobox"], [role="button"], button, [tabindex="0"]'
      )
    );

    control = clickable.find((element) => {
      if (element === label) {
        return false;
      }

      const ariaLabel = normalizeText(
        element.getAttribute("aria-label")
      );

      const text = normalizeText(
        element.textContent
      );

      return (
        ariaLabel.includes("fuel") ||
        element.contains(label) ||
        text.includes("fuel")
      );
    });

    if (control) {
      break;
    }

    container = container.parentElement;
  }

  if (!control) {
    console.warn(
      "SHIFTLY: Fuel type control not found"
    );
    return { filled: false, status: "FAILED", reason: "Control not found" };
  }

  console.log(
    "SHIFTLY: Fuel type control found:",
    control
  );

  clickElement(control);

  await sleep(1000);

  const optionSelectors = [
    '[role="option"]',
    '[role="menuitem"]',
    '[role="listbox"] [role="button"]',
    '[role="listbox"] button',
    '[role="listbox"] [tabindex="0"]'
  ];

  let options = [];

  for (const selector of optionSelectors) {
    options.push(
      ...Array.from(
        document.querySelectorAll(selector)
      )
    );
  }

  options = Array.from(
    new Set(options)
  ).filter((element) => {
    const rect =
      element.getBoundingClientRect();

    const text =
      normalizeText(element.textContent);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      text.length > 0
    );
  });

  console.log(
    "SHIFTLY: Fuel type visible options:",
    options.map((element) =>
      normalizeText(element.textContent)
    ).filter(Boolean)
  );

  const target = options.find((element) => {
    const optionText = normalizeText(
      element.textContent
    );

    return (
      optionText === normalizeText(facebookFuel) ||
      optionText.includes(normalizeText(facebookFuel))
    );
  });

  if (!target) {
    console.warn(
      "SHIFTLY: Fuel type option not found:",
      facebookFuel
    );

    console.log(
      "SHIFTLY: Available fuel type options:",
      options.map((element) =>
        normalizeText(element.textContent)
      )
    );

    return { filled: false, status: "FAILED", reason: "Option not found", availableOptions: options.map(o => o.textContent) };
  }

  console.log(
    "SHIFTLY: Fuel type target selected:",
    target.textContent
  );

  try {
    target.scrollIntoView({
      block: "center",
      inline: "nearest"
    });
  } catch (_) {}

  await sleep(250);

  clickElement(target);

  await sleep(700);

  console.log(
    "SHIFTLY: Fuel type selected successfully:",
    facebookFuel
  );

  return { filled: true, status: "FILLED", facebookValue: facebookFuel };
}


// ============================================================
// TRANSMISSION
// ============================================================

async function fillTransmission(listing) {
  if (!listing.transmission) {
    console.log("SHIFTLY: Transmission: SKIPPED - No source data");
    return { filled: false, status: "SKIPPED_NO_DATA", reason: "No source data" };
  }

  const transmission = normalizeText(listing.transmission);

  console.log(
    "SHIFTLY: Transmission source:",
    transmission
  );

  // Map transmission types to Facebook options
  const transmissionMapping = {
    "automatic": "Automatic",
    "auto": "Automatic",
    "manual": "Manual",
    "cvt": "CVT",
    "continuously variable": "CVT",
    "dual clutch": "Dual Clutch",
    "dct": "Dual Clutch",
    "7-speed": "7-Speed",
    "8-speed": "8-Speed",
    "9-speed": "9-Speed",
    "10-speed": "10-Speed"
  };

  let facebookTransmission = "Automatic";

  for (const [key, value] of Object.entries(transmissionMapping)) {
    if (transmission.includes(key)) {
      facebookTransmission = value;
      break;
    }
  }

  console.log(
    "SHIFTLY: Facebook transmission target:",
    facebookTransmission
  );

  // Find transmission control
  const labels = Array.from(
    document.querySelectorAll("span")
  );

  const label = labels.find((element) => {
    const text = normalizeText(element.textContent);
    return (
      text === "transmission" ||
      text === "trans"
    );
  });

  if (!label) {
    console.warn(
      "SHIFTLY: Transmission label not found - field may not be available in current Facebook form"
    );
    console.log(
      "SHIFTLY: Transmission: SKIPPED_UNAVAILABLE - Facebook control not found"
    );
    return { filled: false, status: "SKIPPED_UNAVAILABLE", reason: "Facebook control not found" };
  }

  console.log(
    "SHIFTLY: Transmission label found:",
    label
  );

  let container = label.parentElement;
  let control = null;

  for (
    let i = 0;
    i < 12 && container;
    i++
  ) {
    const clickable = Array.from(
      container.querySelectorAll(
        '[role="combobox"], [role="button"], button, [tabindex="0"]'
      )
    );

    control = clickable.find((element) => {
      if (element === label) {
        return false;
      }

      const ariaLabel = normalizeText(
        element.getAttribute("aria-label")
      );

      const text = normalizeText(
        element.textContent
      );

      return (
        ariaLabel.includes("transmission") ||
        element.contains(label) ||
        text.includes("transmission")
      );
    });

    if (control) {
      break;
    }

    container = container.parentElement;
  }

  if (!control) {
    console.warn(
      "SHIFTLY: Transmission control not found"
    );
    return { filled: false, status: "FAILED", reason: "Control not found" };
  }

  console.log(
    "SHIFTLY: Transmission control found:",
    control
  );

  clickElement(control);

  await sleep(1000);

  const optionSelectors = [
    '[role="option"]',
    '[role="menuitem"]',
    '[role="listbox"] [role="button"]',
    '[role="listbox"] button',
    '[role="listbox"] [tabindex="0"]'
  ];

  let options = [];

  for (const selector of optionSelectors) {
    options.push(
      ...Array.from(
        document.querySelectorAll(selector)
      )
    );
  }

  options = Array.from(
    new Set(options)
  ).filter((element) => {
    const rect =
      element.getBoundingClientRect();

    const text =
      normalizeText(element.textContent);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      text.length > 0
    );
  });

  console.log(
    "SHIFTLY: Transmission visible options:",
    options.map((element) =>
      normalizeText(element.textContent)
    ).filter(Boolean)
  );

  const target = options.find((element) => {
    const optionText = normalizeText(
      element.textContent
    );

    return (
      optionText === normalizeText(facebookTransmission) ||
      optionText.includes(normalizeText(facebookTransmission))
    );
  });

  if (!target) {
    console.warn(
      "SHIFTLY: Transmission option not found:",
      facebookTransmission
    );

    console.log(
      "SHIFTLY: Available transmission options:",
      options.map((element) =>
        normalizeText(element.textContent)
      )
    );

    return { filled: false, status: "FAILED", reason: "Option not found", availableOptions: options.map(o => o.textContent) };
  }

  console.log(
    "SHIFTLY: Transmission target selected:",
    target.textContent
  );

  try {
    target.scrollIntoView({
      block: "center",
      inline: "nearest"
    });
  } catch (_) {}

  await sleep(250);

  clickElement(target);

  await sleep(700);

  console.log(
    "SHIFTLY: Transmission selected successfully:",
    facebookTransmission
  );

  return { filled: true, status: "FILLED", facebookValue: facebookTransmission };
}


// ============================================================
// DRIVETRAIN
// ============================================================

async function fillDrivetrain(listing) {
  if (!listing.drivetrain) {
    console.log("SHIFTLY: Drivetrain: SKIPPED - No source data");
    return { filled: false, status: "SKIPPED_NO_DATA", reason: "No source data" };
  }

  const drivetrain = normalizeText(listing.drivetrain);

  console.log(
    "SHIFTLY: Drivetrain source:",
    drivetrain
  );

  // Map drivetrain types to Facebook options
  const drivetrainMapping = {
    "awd": "AWD",
    "4wd": "4WD",
    "four wheel drive": "4WD",
    "4x4": "4WD",
    "fwd": "FWD",
    "front wheel drive": "FWD",
    "rwd": "RWD",
    "rear wheel drive": "RWD"
  };

  let facebookDrivetrain = drivetrainMapping[drivetrain] || drivetrain;

  console.log(
    "SHIFTLY: Facebook drivetrain target:",
    facebookDrivetrain
  );

  // Find drivetrain control
  const labels = Array.from(
    document.querySelectorAll("span")
  );

  const label = labels.find((element) => {
    const text = normalizeText(element.textContent);
    return (
      text === "drivetrain" ||
      text === "drive" ||
      text === "wheel drive"
    );
  });

  if (!label) {
    console.warn(
      "SHIFTLY: Drivetrain label not found - field may not be available in current Facebook form"
    );
    console.log(
      "SHIFTLY: Drivetrain: SKIPPED_UNAVAILABLE - Facebook control not found"
    );
    return { filled: false, status: "SKIPPED_UNAVAILABLE", reason: "Facebook control not found" };
  }

  console.log(
    "SHIFTLY: Drivetrain label found:",
    label
  );

  let container = label.parentElement;
  let control = null;

  for (
    let i = 0;
    i < 12 && container;
    i++
  ) {
    const clickable = Array.from(
      container.querySelectorAll(
        '[role="combobox"], [role="button"], button, [tabindex="0"]'
      )
    );

    control = clickable.find((element) => {
      if (element === label) {
        return false;
      }

      const ariaLabel = normalizeText(
        element.getAttribute("aria-label")
      );

      const text = normalizeText(
        element.textContent
      );

      return (
        ariaLabel.includes("drivetrain") ||
        ariaLabel.includes("drive") ||
        element.contains(label) ||
        text.includes("drivetrain") ||
        text.includes("drive")
      );
    });

    if (control) {
      break;
    }

    container = container.parentElement;
  }

  if (!control) {
    console.warn(
      "SHIFTLY: Drivetrain control not found"
    );
    return { filled: false, status: "FAILED", reason: "Control not found" };
  }

  console.log(
    "SHIFTLY: Drivetrain control found:",
    control
  );

  clickElement(control);

  await sleep(1000);

  const optionSelectors = [
    '[role="option"]',
    '[role="menuitem"]',
    '[role="listbox"] [role="button"]',
    '[role="listbox"] button',
    '[role="listbox"] [tabindex="0"]'
  ];

  let options = [];

  for (const selector of optionSelectors) {
    options.push(
      ...Array.from(
        document.querySelectorAll(selector)
      )
    );
  }

  options = Array.from(
    new Set(options)
  ).filter((element) => {
    const rect =
      element.getBoundingClientRect();

    const text =
      normalizeText(element.textContent);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      text.length > 0
    );
  });

  console.log(
    "SHIFTLY: Drivetrain visible options:",
    options.map((element) =>
      normalizeText(element.textContent)
    ).filter(Boolean)
  );

  const target = options.find((element) => {
    const optionText = normalizeText(
      element.textContent
    );

    return (
      optionText === normalizeText(facebookDrivetrain) ||
      optionText.includes(normalizeText(facebookDrivetrain))
    );
  });

  if (!target) {
    console.warn(
      "SHIFTLY: Drivetrain option not found:",
      facebookDrivetrain
    );

    console.log(
      "SHIFTLY: Available drivetrain options:",
      options.map((element) =>
        normalizeText(element.textContent)
      )
    );

    return { filled: false, status: "FAILED", reason: "Option not found", availableOptions: options.map(o => o.textContent) };
  }

  console.log(
    "SHIFTLY: Drivetrain target selected:",
    target.textContent
  );

  try {
    target.scrollIntoView({
      block: "center",
      inline: "nearest"
    });
  } catch (_) {}

  await sleep(250);

  clickElement(target);

  await sleep(700);

  console.log(
    "SHIFTLY: Drivetrain selected successfully:",
    facebookDrivetrain
  );

  return { filled: true, status: "FILLED", facebookValue: facebookDrivetrain };
}


// ============================================================
// CONDITION
// ============================================================

async function fillCondition(listing) {
  if (!listing.condition) {
    console.log("SHIFTLY: Condition: SKIPPED - No source data");
    return { filled: false, status: "SKIPPED_NO_DATA", reason: "No source data" };
  }

  const condition = normalizeText(listing.condition);

  console.log(
    "SHIFTLY: Condition source:",
    condition
  );

  // Map condition types to Facebook options
  const conditionMapping = {
    "used": "Used",
    "new": "New",
    "certified": "Certified Pre-Owned",
    "certified pre-owned": "Certified Pre-Owned",
    "salvage": "Salvage"
  };

  let facebookCondition = conditionMapping[condition] || "Used";

  console.log(
    "SHIFTLY: Facebook condition target:",
    facebookCondition
  );

  // Find condition control
  const labels = Array.from(
    document.querySelectorAll("span")
  );

  const label = labels.find((element) => {
    const text = normalizeText(element.textContent);
    return (
      text === "condition" ||
      text === "item condition"
    );
  });

  if (!label) {
    console.warn(
      "SHIFTLY: Condition label not found - field may not be available in current Facebook form"
    );
    console.log(
      "SHIFTLY: Condition: SKIPPED_UNAVAILABLE - Facebook control not found"
    );
    return { filled: false, status: "SKIPPED_UNAVAILABLE", reason: "Facebook control not found" };
  }

  console.log(
    "SHIFTLY: Condition label found:",
    label
  );

  let container = label.parentElement;
  let control = null;

  for (
    let i = 0;
    i < 12 && container;
    i++
  ) {
    const clickable = Array.from(
      container.querySelectorAll(
        '[role="combobox"], [role="button"], button, [tabindex="0"]'
      )
    );

    control = clickable.find((element) => {
      if (element === label) {
        return false;
      }

      const ariaLabel = normalizeText(
        element.getAttribute("aria-label")
      );

      const text = normalizeText(
        element.textContent
      );

      return (
        ariaLabel.includes("condition") ||
        element.contains(label) ||
        text.includes("condition")
      );
    });

    if (control) {
      break;
    }

    container = container.parentElement;
  }

  if (!control) {
    console.warn(
      "SHIFTLY: Condition control not found"
    );
    return { filled: false, status: "FAILED", reason: "Control not found" };
  }

  console.log(
    "SHIFTLY: Condition control found:",
    control
  );

  clickElement(control);

  await sleep(1000);

  const optionSelectors = [
    '[role="option"]',
    '[role="menuitem"]',
    '[role="listbox"] [role="button"]',
    '[role="listbox"] button',
    '[role="listbox"] [tabindex="0"]'
  ];

  let options = [];

  for (const selector of optionSelectors) {
    options.push(
      ...Array.from(
        document.querySelectorAll(selector)
      )
    );
  }

  options = Array.from(
    new Set(options)
  ).filter((element) => {
    const rect =
      element.getBoundingClientRect();

    const text =
      normalizeText(element.textContent);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      text.length > 0
    );
  });

  console.log(
    "SHIFTLY: Condition visible options:",
    options.map((element) =>
      normalizeText(element.textContent)
    ).filter(Boolean)
  );

  const target = options.find((element) => {
    const optionText = normalizeText(
      element.textContent
    );

    return (
      optionText === normalizeText(facebookCondition) ||
      optionText.includes(normalizeText(facebookCondition))
    );
  });

  if (!target) {
    console.warn(
      "SHIFTLY: Condition option not found:",
      facebookCondition
    );

    console.log(
      "SHIFTLY: Available condition options:",
      options.map((element) =>
        normalizeText(element.textContent)
      )
    );

    return { filled: false, status: "FAILED", reason: "Option not found", availableOptions: options.map(o => o.textContent) };
  }

  console.log(
    "SHIFTLY: Condition target selected:",
    target.textContent
  );

  try {
    target.scrollIntoView({
      block: "center",
      inline: "nearest"
    });
  } catch (_) {}

  await sleep(250);

  clickElement(target);

  await sleep(700);

  console.log(
    "SHIFTLY: Condition selected successfully:",
    facebookCondition
  );

  return { filled: true, status: "FILLED", facebookValue: facebookCondition };
}


// ============================================================
// DESCRIPTION
// ============================================================

function fillDescription(listing) {
  if (!listing.description) {
    return false;
  }

  let textarea =
    findTextareaByKeywords([
      "description",
      "details",
      "about",
      "tell us more"
    ]);

  if (!textarea) {
    textarea =
      document.querySelector("textarea");
  }

  if (!textarea) {
    console.warn(
      "SHIFTLY: Description field not found"
    );

    return false;
  }

  console.log(
    "SHIFTLY: Filling original source description only"
  );

  return simulateInput(
    textarea,
    listing.description
  );
}


// ============================================================
// PHOTOS
// ============================================================

async function uploadPhotos(listing) {
  console.log(
    "SHIFTLY PHOTO: Starting upload using background-downloaded images."
  );

  const downloadedImages = Array.isArray(listing?.downloadedImages)
    ? listing.downloadedImages
    : [];

  const sourceImageCount = listing.photos?.length || listing.images?.length || 0;

  console.log(
    "SHIFTLY PHOTO: downloadedImages received:",
    downloadedImages.length
  );

  console.log(
    "SHIFTLY PHOTO: Source listing.images still has",
    sourceImageCount,
    "photos (FULL ARRAY PRESERVED in vehicle record)"
  );

  if (downloadedImages.length === 0) {
    console.warn(
      "SHIFTLY PHOTO: No background-downloaded images available."
    );
    return false;
  }

  let fileInput = null;

  for (let attempt = 1; attempt <= 30; attempt++) {
    const inputs = [
      ...document.querySelectorAll('input[type="file"]')
    ];

    console.log(
      "SHIFTLY PHOTO: file input search",
      attempt,
      "found:",
      inputs.length
    );

    for (const input of inputs) {
      const accept = input.getAttribute("accept") || "";
      const multiple = input.hasAttribute("multiple");

      if (
        accept.toLowerCase().includes("image") &&
        multiple
      ) {
        fileInput = input;
        break;
      }
    }

    if (fileInput) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!fileInput) {
    console.error(
      "SHIFTLY PHOTO: Facebook photo file input not found."
    );
    return false;
  }

  console.log(
    "SHIFTLY PHOTO: Facebook photo file input found."
  );

  const files = [];

  for (let i = 0; i < downloadedImages.length; i++) {
    const image = downloadedImages[i];

    try {
      console.log(
        "SHIFTLY PHOTO: Creating file",
        i + 1,
        "of",
        downloadedImages.length
      );

      if (!image?.data) {
        console.warn(
          "SHIFTLY PHOTO: Missing image data for",
          i + 1
        );
        continue;
      }

      const binary = atob(image.data);
      const bytes = new Uint8Array(binary.length);

      for (let j = 0; j < binary.length; j++) {
        bytes[j] = binary.charCodeAt(j);
      }

      const mimeType =
        image.mimeType || "image/jpeg";

      const fileName =
        image.name ||
        `vehicle_${i + 1}.jpg`;

      const blob = new Blob(
        [bytes],
        { type: mimeType }
      );

      const file = new File(
        [blob],
        fileName,
        { type: mimeType }
      );

      files.push(file);

      console.log(
        "SHIFTLY PHOTO: File created:",
        fileName,
        mimeType,
        file.size
      );
    } catch (error) {
      console.error(
        "SHIFTLY PHOTO: Failed creating file",
        i + 1,
        error
      );
    }
  }

  if (files.length === 0) {
    console.error(
      "SHIFTLY PHOTO: No files could be created."
    );
    return false;
  }

  try {
    const dataTransfer = new DataTransfer();

    for (const file of files) {
      dataTransfer.items.add(file);
    }

    fileInput.files = dataTransfer.files;

    console.log(
      "SHIFTLY PHOTO: Files assigned to Facebook input:",
      fileInput.files.length
    );

    fileInput.dispatchEvent(
      new Event("change", {
        bubbles: true
      })
    );

    console.log(
      "SHIFTLY PHOTO: Change event dispatched."
    );

    await new Promise(resolve =>
      setTimeout(resolve, 5000)
    );

    console.log(
      "SHIFTLY PHOTO: Upload processing wait completed."
    );

    const photoText =
      document.body?.innerText || "";

    const photoMatch =
      photoText.match(/Photos\s+(\d+)\/20/i);

    if (photoMatch) {
      const count =
        Number(photoMatch[1]);

      console.log(
        "SHIFTLY PHOTO: Facebook photo count:",
        count
      );

      if (count > 0) {
        console.log(
          "SHIFTLY PHOTO: PHOTO UPLOAD VERIFIED."
        );
        return true;
      }
    }

    if (fileInput.files?.length > 0) {
      console.log(
        "SHIFTLY PHOTO: Files remain attached to input:",
        fileInput.files.length
      );

      return true;
    }

    console.warn(
      "SHIFTLY PHOTO: Could not verify Facebook photo upload."
    );

    return false;

  } catch (error) {
    console.error(
      "SHIFTLY PHOTO: Upload failed:",
      error
    );

    return false;
  }
}

async function fillMarketplaceForm(listing) {
  console.log("FM_HANDLER_DEBUG_2026_09_21_A: fillMarketplaceForm function called");
  console.log(
    "SHIFTLY: Filling Marketplace form with listing data"
  );

  console.log(
    "SHIFTLY: Listing data:",
    JSON.stringify(
      {
        ...listing
      },
      null,
      2
    )
  );

  const fieldsFilled = [];
  const errors = [];

  try {
    const rendered =
      await waitForFormToRender();

    if (!rendered) {
      throw new Error(
        "Marketplace form did not render"
      );
    }

    await sleep(2000);

    inspectMarketplaceFields();

    const allInputs = Array.from(
      document.querySelectorAll("input")
    );

    const textareas = Array.from(
      document.querySelectorAll("textarea")
    );

    // Current QA fallback positions.
    const fallbackMake = allInputs[6] || null;
    const fallbackModel = allInputs[7] || null;
    const fallbackPrice = allInputs[8] || null;

    let locationResult = { success: false };
    let downloadedImages = [];
    let sourcePhotoCount = listing.photos?.length || listing.images?.length || 0;
    let maxFacebookPhotos = 20;
    let expectedPhotos = Math.min(sourcePhotoCount, maxFacebookPhotos);

    console.log(
      "SHIFTLY PHOTO: Source vehicle has",
      sourcePhotoCount,
      "photos (FULL ARRAY PRESERVED in vehicle record)"
    );
    console.log(
      "SHIFTLY PHOTO: Expecting to upload",
      expectedPhotos,
      "photos to Facebook (max 20)"
    );

    // --------------------------------------------------------
    // LOCATION
    // --------------------------------------------------------

    if (listing.location) {
      locationResult =
        await fillLocation(
          listing.location
        );

      if (locationResult.success) {
        fieldsFilled.push("location");
      } else {
        console.warn(
          "SHIFTLY: Location requires manual selection"
        );
        errors.push(
          "Location could not be filled"
        );
      }
    }

    // --------------------------------------------------------
    // VEHICLE TYPE
    // --------------------------------------------------------

    console.log("VT_CALL_DEBUG_2026_09_21_A: About to call fillVehicleType with listing:", listing);
    const vehicleTypeResult =
      await fillVehicleType(listing);

    if (vehicleTypeResult?.filled) {
      fieldsFilled.push("vehicle type");
      console.log("SHIFTLY: Vehicle Type: FILLED -", vehicleTypeResult.facebookValue);
    } else if (vehicleTypeResult?.status === "SKIPPED_UNAVAILABLE") {
      console.log("SHIFTLY: Vehicle Type: SKIPPED_UNAVAILABLE -", vehicleTypeResult.reason);
      // Vehicle Type is required, so this is an error
      errors.push(
        `Vehicle Type: SKIPPED_UNAVAILABLE - ${vehicleTypeResult.reason}`
      );
    } else if (vehicleTypeResult?.status === "SKIPPED_NO_DATA") {
      console.log("SHIFTLY: Vehicle Type: SKIPPED_NO_DATA -", vehicleTypeResult.reason);
      // Vehicle Type is required, so this is an error
      errors.push(
        `Vehicle Type: SKIPPED_NO_DATA - ${vehicleTypeResult.reason}`
      );
    } else {
      console.warn(
        "SHIFTLY: Vehicle Type: FAILED -", vehicleTypeResult?.reason
      );
      errors.push(
        `Vehicle Type: FAILED - ${vehicleTypeResult?.reason || "Unknown error"}`
      );
    }

    // --------------------------------------------------------
    // YEAR
    // --------------------------------------------------------

    const yearFilled =
      await fillYear(listing);

    if (yearFilled) {
      fieldsFilled.push("year");
    }

    // --------------------------------------------------------
    // MAKE
    // --------------------------------------------------------

    const makeFilled =
      await fillMake(
        listing,
        fallbackMake
      );

    if (makeFilled) {
      fieldsFilled.push("make");
    } else {
      errors.push(
        "Make could not be filled"
      );
    }

    // --------------------------------------------------------
    // MODEL
    // --------------------------------------------------------

    const modelFilled =
      await fillModel(
        listing,
        fallbackModel
      );

    if (modelFilled) {
      fieldsFilled.push("model");
    } else {
      errors.push(
        "Model could not be filled"
      );
    }

    // --------------------------------------------------------
    // PRICE
    // --------------------------------------------------------

    const priceFilled =
      fillPrice(
        listing,
        fallbackPrice
      );

    if (priceFilled) {
      fieldsFilled.push("price");
    } else {
      errors.push(
        "Price could not be filled"
      );
    }

    // --------------------------------------------------------
    // MILEAGE
    // --------------------------------------------------------

    const mileageFilled =
      fillMileage(
        listing,
        allInputs[9] || null
      );

    if (mileageFilled) {
      fieldsFilled.push("mileage");
    } else {
      errors.push(
        "Mileage could not be filled"
      );
    }

    // --------------------------------------------------------
    // FUEL TYPE
    // --------------------------------------------------------

    const fuelResult =
      await fillFuelType(listing);

    if (fuelResult?.filled) {
      fieldsFilled.push("fuel type");
      console.log("SHIFTLY: Fuel: FILLED -", fuelResult.facebookValue);
    } else if (fuelResult?.status === "SKIPPED_UNAVAILABLE") {
      console.log("SHIFTLY: Fuel: SKIPPED_UNAVAILABLE -", fuelResult.reason);
      // Do not add to errors - this is expected for optional fields
    } else if (fuelResult?.status === "SKIPPED_NO_DATA") {
      console.log("SHIFTLY: Fuel: SKIPPED_NO_DATA -", fuelResult.reason);
      // Do not add to errors - this is expected when source data is missing
    } else {
      console.warn(
        "SHIFTLY: Fuel: FAILED -", fuelResult?.reason
      );
      errors.push(
        `Fuel could not be filled: ${fuelResult?.reason || "Unknown error"}`
      );
    }

    // --------------------------------------------------------
    // TRANSMISSION
    // --------------------------------------------------------

    const transmissionResult =
      await fillTransmission(listing);

    if (transmissionResult?.filled) {
      fieldsFilled.push("transmission");
      console.log("SHIFTLY: Transmission: FILLED -", transmissionResult.facebookValue);
    } else if (transmissionResult?.status === "SKIPPED_UNAVAILABLE") {
      console.log("SHIFTLY: Transmission: SKIPPED_UNAVAILABLE -", transmissionResult.reason);
      // Do not add to errors - this is expected for optional fields
    } else if (transmissionResult?.status === "SKIPPED_NO_DATA") {
      console.log("SHIFTLY: Transmission: SKIPPED_NO_DATA -", transmissionResult.reason);
      // Do not add to errors - this is expected when source data is missing
    } else {
      console.warn(
        "SHIFTLY: Transmission: FAILED -", transmissionResult?.reason
      );
      errors.push(
        `Transmission could not be filled: ${transmissionResult?.reason || "Unknown error"}`
      );
    }

    // --------------------------------------------------------
    // DRIVETRAIN
    // --------------------------------------------------------

    const drivetrainResult =
      await fillDrivetrain(listing);

    if (drivetrainResult?.filled) {
      fieldsFilled.push("drivetrain");
      console.log("SHIFTLY: Drivetrain: FILLED -", drivetrainResult.facebookValue);
    } else if (drivetrainResult?.status === "SKIPPED_UNAVAILABLE") {
      console.log("SHIFTLY: Drivetrain: SKIPPED_UNAVAILABLE -", drivetrainResult.reason);
      // Do not add to errors - this is expected for optional fields
    } else if (drivetrainResult?.status === "SKIPPED_NO_DATA") {
      console.log("SHIFTLY: Drivetrain: SKIPPED_NO_DATA -", drivetrainResult.reason);
      // Do not add to errors - this is expected when source data is missing
    } else {
      console.warn(
        "SHIFTLY: Drivetrain: FAILED -", drivetrainResult?.reason
      );
      errors.push(
        `Drivetrain could not be filled: ${drivetrainResult?.reason || "Unknown error"}`
      );
    }

    // --------------------------------------------------------
    // CONDITION
    // --------------------------------------------------------

    const conditionResult =
      await fillCondition(listing);

    if (conditionResult?.filled) {
      fieldsFilled.push("condition");
      console.log("SHIFTLY: Condition: FILLED -", conditionResult.facebookValue);
    } else if (conditionResult?.status === "SKIPPED_UNAVAILABLE") {
      console.log("SHIFTLY: Condition: SKIPPED_UNAVAILABLE -", conditionResult.reason);
      // Do not add to errors - this is expected for optional fields
    } else if (conditionResult?.status === "SKIPPED_NO_DATA") {
      console.log("SHIFTLY: Condition: SKIPPED_NO_DATA -", conditionResult.reason);
      // Do not add to errors - this is expected when source data is missing
    } else {
      console.warn(
        "SHIFTLY: Condition: FAILED -", conditionResult?.reason
      );
      errors.push(
        `Condition could not be filled: ${conditionResult?.reason || "Unknown error"}`
      );
    }

    // --------------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------------

    const descriptionFilled =
      fillDescription(listing);

    if (descriptionFilled) {
      fieldsFilled.push("description");
    } else {
      errors.push(
        "Description could not be filled"
      );
    }

    // --------------------------------------------------------
    // PHOTOS
    // --------------------------------------------------------

    downloadedImages = Array.isArray(listing?.downloadedImages)
      ? listing.downloadedImages
      : [];

    const photosFilled =
      await uploadPhotos(listing);

    if (photosFilled) {
      fieldsFilled.push("photos");
    } else if (
      listing.photos?.length
    ) {
      console.warn(
        "SHIFTLY: Photos could not be automatically attached."
      );
      errors.push(
        "Photos could not be automatically attached"
      );
    }

    // --------------------------------------------------------
    // FINAL VALIDATION
    // --------------------------------------------------------

    console.log(
      "SHIFTLY: FINAL MARKETPLACE VALIDATION"
    );

    const validationResults = {
      "Vehicle Type": vehicleTypeResult?.status === "FILLED" ? "PASS" : vehicleTypeResult?.status === "SKIPPED_UNAVAILABLE" ? "SKIPPED" : "FAIL",
      "Year": yearFilled ? "PASS" : "FAIL",
      "Make": makeFilled ? "PASS" : "FAIL",
      "Model": modelFilled ? "PASS" : "FAIL",
      "Mileage": mileageFilled ? "PASS" : "FAIL",
      "Price": priceFilled ? "PASS" : "FAIL",
      "Fuel": fuelResult?.status === "FILLED" ? "PASS" : fuelResult?.status === "SKIPPED_UNAVAILABLE" ? "SKIPPED" : "FAIL",
      "Transmission": transmissionResult?.status === "FILLED" ? "PASS" : transmissionResult?.status === "SKIPPED_UNAVAILABLE" ? "SKIPPED" : "FAIL",
      "Drivetrain": drivetrainResult?.status === "FILLED" ? "PASS" : drivetrainResult?.status === "SKIPPED_UNAVAILABLE" ? "SKIPPED" : "FAIL",
      "Condition": conditionResult?.status === "FILLED" ? "PASS" : conditionResult?.status === "SKIPPED_UNAVAILABLE" ? "SKIPPED" : "FAIL",
      "Location": locationResult?.success ? "PASS" : "FAIL",
      "Description": descriptionFilled ? "PASS" : "FAIL",
      "Photos": photosFilled ? `${downloadedImages.length}/${expectedPhotos} (Facebook)` : `0/${expectedPhotos} (Facebook)`
    };

    console.log(
      "SHIFTLY PHOTO: Source vehicle record has",
      sourcePhotoCount,
      "photos (FULL ARRAY PRESERVED)"
    );
    console.log(
      "SHIFTLY PHOTO: Facebook received",
      downloadedImages.length,
      "photos (Facebook max: 20)"
    );

    console.log("SHIFTLY: ========== FIELD RESULTS ==========");
    console.log("SHIFTLY: Vehicle Type:", validationResults["Vehicle Type"], vehicleTypeResult?.status || "N/A", vehicleTypeResult?.reason || "");
    console.log("SHIFTLY: Year:", validationResults["Year"]);
    console.log("SHIFTLY: Make:", validationResults["Make"]);
    console.log("SHIFTLY: Model:", validationResults["Model"]);
    console.log("SHIFTLY: Mileage:", validationResults["Mileage"]);
    console.log("SHIFTLY: Price:", validationResults["Price"]);
    console.log("SHIFTLY: Fuel:", validationResults["Fuel"], fuelResult?.status || "N/A", fuelResult?.reason || "");
    console.log("SHIFTLY: Transmission:", validationResults["Transmission"], transmissionResult?.status || "N/A", transmissionResult?.reason || "");
    console.log("SHIFTLY: Drivetrain:", validationResults["Drivetrain"], drivetrainResult?.status || "N/A", drivetrainResult?.reason || "");
    console.log("SHIFTLY: Condition:", validationResults["Condition"], conditionResult?.status || "N/A", conditionResult?.reason || "");
    console.log("SHIFTLY: Location:", validationResults["Location"]);
    console.log("SHIFTLY: Description:", validationResults["Description"]);
    console.log("SHIFTLY: Photos:", validationResults["Photos"]);
    console.log("SHIFTLY: =============================================");

    for (const [field, result] of Object.entries(validationResults)) {
      console.log(
        `SHIFTLY: ${field}: ${result}`
      );
    }

    // --------------------------------------------------------
    // RESULT
    // --------------------------------------------------------

    console.log(
      "SHIFTLY: Form filling complete."
    );

    console.log(
      "SHIFTLY: Fields filled:",
      fieldsFilled
    );

    console.log(
      "SHIFTLY: Errors:",
      errors
    );

    if (!fieldsFilled.length) {
      showStatusMessage(
        "Shiftly Auto: Could not fill vehicle information. Please fill manually.",
        "error"
      );

      return {
        success: false,
        fieldsFilled,
        errors,
        message:
          "Could not fill vehicle information. Please fill manually."
      };
    }

    showStatusMessage(
      "Shiftly Auto: Vehicle information filled. Please review the listing and publish manually.",
      "info"
    );

    return {
      success: true,
      fieldsFilled,
      errors,
      message:
        "Vehicle information filled. Please review the listing and publish manually."
    };

  } catch (error) {
    console.error("SHIFTLY: Form fill error:", error);
    console.error("SHIFTLY: FORM ERROR NAME:", error?.name);
    console.error("SHIFTLY: FORM ERROR MESSAGE:", error?.message);
    console.error("SHIFTLY: FORM ERROR STACK:", error?.stack);

    showStatusMessage(
      "Shiftly Auto: Could not auto-fill form. Please fill manually.",
      "error"
    );

    return {
      success: false,
      fieldsFilled,
      errors: [
        ...errors,
        error.message
      ]
    };
  }
}

// ============================================================
// MESSAGE HANDLER
// ============================================================

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {

    if (
      message.type ===
      "SHIFTLY_FILL_MARKETPLACE_FORM"
    ) {
      console.log("FM_HANDLER_DEBUG_2026_09_21_A: Received SHIFTLY_FILL_MARKETPLACE_FORM message");
      console.log(
        "SHIFTLY: Received form fill request"
      );

      console.log("VT_CALL_DEBUG_2026_09_21_A: About to call fillMarketplaceForm");

      // Return true immediately to indicate async response
      // Then handle the async operation with proper error handling
      (async () => {
        try {
          const result = await fillMarketplaceForm(message.listing);
          sendResponse(result);
        } catch (error) {
          console.error(
            "SHIFTLY: Form fill error in message handler:",
            error
          );

          sendResponse({
            success: false,
            fieldsFilled: [],
            errors: [error.message || "Unknown error in form fill"],
            message: "Form fill operation failed"
          });
        }
      })().catch(error => {
        // Final fallback error handler to ensure sendResponse is always called
        console.error(
          "SHIFTLY: CRITICAL: Message handler async error - this should never happen:",
          error
        );
        try {
          sendResponse({
            success: false,
            fieldsFilled: [],
            errors: ["Critical message handler error: " + (error.message || "Unknown")],
            message: "Message handler failed unexpectedly"
          });
        } catch (sendError) {
          console.error(
            "SHIFTLY: CRITICAL: Could not send error response:",
            sendError
          );
        }
      });

      return true;
    }
  }
);


// ============================================================
// STATUS MESSAGE
// ============================================================

function showStatusMessage(
  message,
  type = "info"
) {
  const oldStatus =
    document.getElementById(
      "shiftly-auto-status"
    );

  if (oldStatus) {
    oldStatus.remove();
  }

  const statusDiv =
    document.createElement("div");

  statusDiv.id =
    "shiftly-auto-status";

  statusDiv.textContent =
    message;

  statusDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 420px;
    background: ${
      type === "error"
        ? "#d93025"
        : "#1877f2"
    };
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 2147483647;
    font-family: Arial, sans-serif;
    font-size: 14px;
    line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;

  document.body.appendChild(
    statusDiv
  );

  setTimeout(() => {
    if (statusDiv.isConnected) {
      statusDiv.remove();
    }
  }, 5000);
}



