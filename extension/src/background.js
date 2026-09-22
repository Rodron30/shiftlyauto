// extension/src/background.js

console.log("Shiftly Auto service worker loaded");

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
      world: "MAIN",

      func: async () => {
        /* ---------------------------------------------------
           VIN PATTERN
        --------------------------------------------------- */
        const VIN_PATTERN =
          /\b[A-HJ-NPR-Z0-9]{17}\b/g;

        /* ---------------------------------------------------
           NORMALIZATION
        --------------------------------------------------- */
        function normalizeWhitespace(value) {
          return String(value ?? "")
            .replace(/\u00a0/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        }

        function clean(value) {
          const result = normalizeWhitespace(value);
          return result || null;
        }

        function normalizeLocation(value) {
          if (!value) return null;
          
          // Convert <br> and <br/> to separators
          let cleaned = String(value)
            .replace(/<br\s*\/?>/gi, ", ")
            .replace(/\s+/g, " ")
            .trim();
          
          // Extract City, ST pattern
          const locationMatches = [...cleaned.matchAll(/([A-Za-z][A-Za-z .'-]*,\s*[A-Z]{2})\b/g)];
          if (locationMatches.length) {
            return locationMatches[locationMatches.length - 1][1].trim();
          }
        }

        function toNumber(value) {
          if (value == null) return null;
          const match = String(value).replace(/,/g, "").match(/\d+(?:\.\d+)?/);
          return match ? Number(match[0]) : null;
        }

        /* ---------------------------------------------------
           MAIN SCAN
        --------------------------------------------------- */
        const text =
          document.body?.innerText || "";

        const facebookText = normalizeWhitespace(text);

        /* VIN extraction */
        const vinMatches =
          text
            .toUpperCase()
            .match(VIN_PATTERN) || [];

        const vins = Array.from(new Set(vinMatches));

        /* Facebook Marketplace vehicle extraction */
        let vehicle = null;

        if (
          location.hostname === "www.facebook.com" &&
          location.pathname.includes("/marketplace/")
        ) {
          vehicle = {
            vin: vins.length === 1 ? vins[0] : null,
            year: null,
            make: null,
            model: null,
            trim: null,
            body: null,
            engine: null,
            drivetrain: null,
            transmission: null,
            fuel: null,
            price: null,
            currency: null,
            mileage: null,
            mileageUnit: null,
            location: null,
            images: [],
            description: null,
            sourceUrl: location.href,
          };

          /* Vehicle title (year, make, model) */
          if (!vehicle.year || !vehicle.make || !vehicle.model) {
            const facebookTitleMatch = facebookText.match(
              /\b((?:19|20)\d{2})\b\s+([A-Za-z][A-Za-z0-9-]{1,20})(?:\s+)([A-Za-z0-9][A-Za-z0-9 .&/'-]{0,50}?)(?=\s+(?:\$|PHP|USD|CA\$|in\s+[A-Za-z]|California|Texas|Florida|New York)\b|$)/i
            );

            if (facebookTitleMatch) {
              const candidateModel = clean(facebookTitleMatch[3])
                .replace(/\s*[��]\s*/g, " ")
                .replace(/\s+/g, " ");

              const candidateMake = clean(facebookTitleMatch[2]);
              const capitalizedMake = candidateMake 
                ? candidateMake.charAt(0).toUpperCase() + candidateMake.slice(1)
                : null;

              const capitalizedModel = candidateModel
                ? candidateModel.charAt(0).toUpperCase() + candidateModel.slice(1)
                : null;

              if (
                candidateModel &&
                candidateModel.length <= 50 &&
                !/\$\s*[\d,]+/.test(candidateModel) &&
                !/\b(?:California|Texas|Florida|New York|Lancaster|Palmdale|Adelanto|Ridgecrest)\b/i.test(candidateModel)
              ) {
                vehicle.year = vehicle.year || Number(facebookTitleMatch[1]);
                vehicle.make = vehicle.make || capitalizedMake;
                vehicle.model = vehicle.model || capitalizedModel;
              }
            }
          }

          /* Price */
          /* PHP Price - authoritative for Philippine Facebook listings */
          const phpPriceMatch = facebookText.match(/PHP\s*([\d,]+(?:\.\d+)?)/i);
          if (phpPriceMatch) {
            vehicle.price = Number(phpPriceMatch[1].replace(/,/g, ""));
            vehicle.currency = "PHP";
          }

          /* USD Price fallback */
          if (vehicle.price == null) {
            const priceMatch = facebookText.match(/[$]\s*([\d,]+(?:\.\d+)?)/i);
            if (priceMatch) {
              vehicle.price = Number(priceMatch[1].replace(/,/g, ""));
              vehicle.currency = "USD";
            }
          }

          /* Mileage */
          if (vehicle.mileage == null) {
            const mileageMatch = facebookText.match(/Driven\s+([\d,]+(?:\.\d+)?)\s*(km|mi|miles?)/i);
            if (mileageMatch) {
              vehicle.mileage = Number(mileageMatch[1].replace(/,/g, ""));
              vehicle.mileageUnit = /km/i.test(mileageMatch[2]) ? "km" : "mi";
            }
          }

          /* Transmission */
          if (!vehicle.transmission) {
            const transmissionMatch = facebookText.match(/\b(Automatic|Manual)\s+transmission\b/i);
            if (transmissionMatch) {
              vehicle.transmission = clean(transmissionMatch[1]);
            }
          }

          /* Fuel */
          if (!vehicle.fuel) {
            const fuelMatch = facebookText.match(/Fuel\s+type:\s*([^\n]+)/i);
            if (fuelMatch) {
              vehicle.fuel = clean(fuelMatch[1]);
            }
          }
          /* Location */
          if (!vehicle.location) {
            const listedLocationMatch = facebookText.match(/(?:^|\b(?:in|at)\s+)([A-Za-z][A-Za-z .'-]*,\s*[A-Z]{2})\b/i);
            if (listedLocationMatch) {
              vehicle.location = listedLocationMatch[1].trim();
            }
          }


          /* Description */
          if (!vehicle.description) {
            const descriptionMatch = facebookText.match(
              /Seller's\s+description\s*([\s\S]*?)(?=\s*(?:See more|Listed|Details|Public|Seller information|Location is approximate|\b[A-Za-z .'-]+,\s*[A-Z]{2}\s*·)\b|$)/i
            );
            if (descriptionMatch) {
              let description = clean(descriptionMatch[1]);
              description = description
                .replace(/\s*Asking\s+\$[\d,]+(?:\s*obo)?\s*$/i, '')
                .replace(/\s*See more.*$/i, '')
                .replace(/\s+[A-Za-z .'-]+,\s*[A-Z]{2}(?:-\d+)?\s*·.*$/i, '')
                .replace(/\s*Location is approximate.*$/i, '')
                .trim();
              if (description) {
                vehicle.description = description;
              }
            }
          }

          /* Images */
          if (vehicle.images.length === 0) {
            try {
              const imageUrls = new Set();
              const galleryImages = document.querySelectorAll('img[src*="fbcdn.net"], img[src*="fbsbx.com"]');

              console.log(
                "FACEBOOK PHOTO EXTRACTION: Found",
                galleryImages.length,
                "potential gallery images"
              );

              for (const img of galleryImages) {
                const src = img.src || img.getAttribute('data-src');
                if (!src) continue;
                if (img.width < 100 || img.height < 100) continue;
                if (src.includes('profile') || src.includes('avatar')) continue;
                if (src.includes('icon') || src.includes('button') || src.includes('logo')) continue;

                if (src.match(/\.(jpg|jpeg|png|webp)$/i) || src.includes('fbcdn') || src.includes('fbsbx')) {
                  imageUrls.add(src);
                }
              }

              const ogImage = document.querySelector('meta[property="og:image"]');
              if (ogImage && ogImage.content) {
                imageUrls.add(ogImage.content);
              }

              console.log(
                "FACEBOOK PHOTO EXTRACTION: Extracted",
                imageUrls.size,
                "unique image URLs"
              );

              if (imageUrls.size > 0) {
                vehicle.images = Array.from(imageUrls);
                console.log(
                  "FACEBOOK PHOTO EXTRACTION: Assigned ALL",
                  vehicle.images.length,
                  "images to vehicle.images (no truncation)"
                );
              }
            } catch (e) {
              console.error("FACEBOOK PHOTO EXTRACTION: Error:", e);
            }
          } else {
            console.log(
              "FACEBOOK PHOTO EXTRACTION: vehicle.images already has",
              vehicle.images.length,
              "images"
            );
          }
        }

        /* DealerInspire vehicle extraction */
        if (location.hostname.includes("dealerinspire.com")) {
          vehicle = {
            vin: vins.length === 1 ? vins[0] : null,
            year: null,
            make: null,
            model: null,
            trim: null,
            body: null,
            engine: null,
            drivetrain: null,
            transmission: null,
            fuel: null,
            price: null,
            currency: null,
            mileage: null,
            mileageUnit: null,
            location: null,
            images: [],
            description: null,
            sourceUrl: location.href,
          };

          /* Vehicle details from DealerInspire data layer */
          try {
            // Primary source: utag_data.vehicles with timing fallback
            // Small polling mechanism for utag_data availability (max 2 seconds, 20 attempts)
            let utagVehicle = null;
            let attempts = 0;
            const maxAttempts = 20;
            const pollInterval = 100; // 100ms
            
            while (attempts < maxAttempts && !utagVehicle) {
              if (window.utag_data && window.utag_data.vehicles && window.utag_data.vehicles.length > 0) {
                utagVehicle = window.utag_data.vehicles[0];
                break;
              }
              await new Promise(resolve => setTimeout(resolve, pollInterval));
              attempts++;
            }
            
            if (utagVehicle) {
              // Primary extraction from utag_data
              if (utagVehicle.price !== undefined && utagVehicle.price !== null) {
                vehicle.price = Number(utagVehicle.price);

                // DealerInspire prices are displayed in USD ($).
                // Keep an explicit currency if the source provides one.
                if (!vehicle.currency) {
                  vehicle.currency = "USD";
                }
              }
              
              if (window.utag_data.cc) {
                vehicle.currency = String(window.utag_data.cc).toUpperCase();
              }
              if (utagVehicle.model_year) {
                vehicle.year = Number(utagVehicle.model_year);
              }
              if (utagVehicle.nameplate) {
                const nameplateParts = utagVehicle.nameplate.split(/\s+/);
                if (nameplateParts.length >= 2) {
                  vehicle.make = nameplateParts[0];
                  vehicle.model = nameplateParts.slice(1).join(" ");
                }
              }
              
              if (utagVehicle.trim) {
                vehicle.trim = String(utagVehicle.trim);
              }

              // Check utagVehicle for additional spec fields
              console.log("utagVehicle keys:", Object.keys(utagVehicle));
              if (utagVehicle.mileage !== undefined && utagVehicle.mileage !== null) {
                vehicle.mileage = Number(utagVehicle.mileage);
                console.log("Found mileage in utagVehicle:", vehicle.mileage);
              }
              if (utagVehicle.mileage_unit) {
                vehicle.mileageUnit = String(utagVehicle.mileage_unit).toUpperCase();
                console.log("Found mileage_unit in utagVehicle:", vehicle.mileageUnit);
              }
              if (utagVehicle.body) {
                vehicle.body = String(utagVehicle.body);
                console.log("Found body in utagVehicle:", vehicle.body);
              }
              if (utagVehicle.engine) {
                vehicle.engine = String(utagVehicle.engine);
                console.log("Found engine in utagVehicle:", vehicle.engine);
              }
              if (utagVehicle.drivetrain) {
                vehicle.drivetrain = String(utagVehicle.drivetrain);
                console.log("Found drivetrain in utagVehicle:", vehicle.drivetrain);
              }
              if (utagVehicle.transmission) {
                vehicle.transmission = String(utagVehicle.transmission);
                console.log("Found transmission in utagVehicle:", vehicle.transmission);
              }
              if (utagVehicle.fuel) {
                vehicle.fuel = String(utagVehicle.fuel);
                console.log("Found fuel in utagVehicle:", vehicle.fuel);
              }
            }

            // PRIMARY DEALERINSPIRE SOURCE:
            // Use DealerInspire's own search-service listing for complete vehicle data.
            try {
              const dealerInspireVin = vehicle.vin
                ? String(vehicle.vin).trim().toUpperCase()
                : "";

              if (
                dealerInspireVin &&
                window.IDPSearchServiceHelper &&
                typeof window.IDPSearchServiceHelper.getListing === "function"
              ) {
                const listing =
                  await window.IDPSearchServiceHelper.getListing(
                    dealerInspireVin
                  );

                console.log(
                  "DealerInspire search-service listing:",
                  listing
                );

                console.log(
                  "DealerInspire description_text_vdp:",
                  listing?.extra_fields?.description_text_vdp
                );

                console.log(
                  "DealerInspire description_text:",
                  listing?.extra_fields?.description_text
                );

                console.log(
                  "DealerInspire media structure:",
                  listing?.media ? Object.keys(listing.media) : "none"
                );

                const mechanical = listing?.mechanical || {};

    // Check all possible image sources in the API response
    let dealerInspireImages = [];

    if (Array.isArray(listing?.media?.images)) {
      dealerInspireImages = listing.media.images
        .map((image) => String(image || "").trim())
        .filter((image) => /^https?:\/\//i.test(image));
      console.log("DEALERINSPIRE PHOTO TRACE: Found images in media.images:", dealerInspireImages.length);
    }

    if (Array.isArray(listing?.media?.gallery)) {
      const galleryImages = listing.media.gallery
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item?.url) return item.url;
          if (item?.src) return item.src;
          return null;
        })
        .filter((image) => image && /^https?:\/\//i.test(image));
      console.log("DEALERINSPIRE PHOTO TRACE: Found images in media.gallery:", galleryImages.length);
      dealerInspireImages = [...dealerInspireImages, ...galleryImages];
    }

    if (Array.isArray(listing?.images)) {
      const directImages = listing.images
        .map((image) => {
          if (typeof image === 'string') return image;
          if (image?.url) return image.url;
          if (image?.src) return image.src;
          return null;
        })
        .filter((image) => image && /^https?:\/\//i.test(image));
      console.log("DEALERINSPIRE PHOTO TRACE: Found images in images array:", directImages.length);
      dealerInspireImages = [...dealerInspireImages, ...directImages];
    }

    // Deduplicate while preserving order
    const uniqueImages = [...new Set(dealerInspireImages)];

    console.log(
      "DEALERINSPIRE PHOTO TRACE: Total unique API images found:",
      uniqueImages.length
    );

    // Try to detect gallery count from the page
    let galleryCount = uniqueImages.length;
    const photoCountElements = document.querySelectorAll('[class*="photo"], [class*="gallery"], [class*="image-count"], .photo-count, .gallery-count');
    for (const element of photoCountElements) {
      const countText = element.textContent || "";
      const countMatch = countText.match(/\d+/);
      if (countMatch) {
        const detectedCount = parseInt(countMatch[0]);
        if (detectedCount > galleryCount) {
          galleryCount = detectedCount;
        }
      }
    }

    console.log(
      "SHIFTLY PHOTO EXTRACTION: Gallery count =",
      galleryCount
    );

    if (uniqueImages.length > 0) {
      // Assign ALL images, not just first 20
      vehicle.images = uniqueImages;
      console.log("SHIFTLY PHOTO EXTRACTION: Images found =", vehicle.images.length);
      console.log("DEALERINSPIRE PHOTO TRACE: Assigned ALL API images to vehicle.images (no truncation):", vehicle.images.length);
      console.log("DEALERINSPIRE PHOTO TRACE: First 3 image URLs:", vehicle.images.slice(0, 3));
    } else {
      console.log("DEALERINSPIRE PHOTO TRACE: No API images found, falling back to DOM extraction");
    }
                const bodyDetails = listing?.body_details || {};

                // DealerInspire VDP description
                if (!vehicle.description) {
                  const dealerInspireDescription =
                    listing?.extra_fields?.description_text_vdp ||
                    listing?.extra_fields?.description_text ||
                    null;

                  if (dealerInspireDescription) {
                    vehicle.description = String(
                      dealerInspireDescription
                    )
                      .replace(/<br\s*\/?>/gi, "\n")
                      .replace(/<[^>]*>/g, "")
                      .replace(/\n{3,}/g, "\n\n")
                      .trim();
                  }
                }

                // Preserve valid zero mileage.
                if (
                  vehicle.mileage === null &&
                  listing?.mileage !== undefined &&
                  listing?.mileage !== null &&
                  listing?.mileage !== ""
                ) {
                  const numericMileage = Number(
                    String(listing.mileage).replace(/,/g, "")
                  );

                  if (Number.isFinite(numericMileage)) {
                    vehicle.mileage = numericMileage;
                  }
                }

                // DealerInspire search-service mileage is in miles.
                if (
                  vehicle.mileageUnit === null &&
                  vehicle.mileage !== null
                ) {
                  vehicle.mileageUnit = "MI";
                }

                if (
                  vehicle.body === null &&
                  bodyDetails?.type
                ) {
                  vehicle.body = String(bodyDetails.type);
                }

                if (
                  vehicle.engine === null &&
                  mechanical?.engine
                ) {
                  vehicle.engine = String(mechanical.engine);
                }

                if (
                  vehicle.drivetrain === null &&
                  mechanical?.drivetrain
                ) {
                  vehicle.drivetrain = String(
                    mechanical.drivetrain
                  );
                }

                if (
                  vehicle.transmission === null &&
                  mechanical?.transmission
                ) {
                  vehicle.transmission = String(
                    mechanical.transmission
                  );
                }

                if (
                  vehicle.fuel === null &&
                  mechanical?.fuel_type
                ) {
                  vehicle.fuel = String(
                    mechanical.fuel_type
                  );
                }

                // Extract exterior color from DealerInspire
                console.log("DEALERINSPIRE COLOR TRACE: Checking for exterior color in source data");
                console.log("DEALERINSPIRE COLOR TRACE: bodyDetails.exterior_color =", bodyDetails?.exterior_color);
                console.log("DEALERINSPIRE COLOR TRACE: bodyDetails.exteriorColor =", bodyDetails?.exteriorColor);
                console.log("DEALERINSPIRE COLOR TRACE: listing.exterior_color =", listing?.exterior_color);
                console.log("DEALERINSPIRE COLOR TRACE: listing.exteriorColor =", listing?.exteriorColor);
                console.log("DEALERINSPIRE COLOR TRACE: Current vehicle.exteriorColor =", vehicle.exteriorColor);
                
                if (
                  vehicle.exteriorColor === null &&
                  (bodyDetails?.exterior_color || bodyDetails?.exteriorColor || listing?.exterior_color || listing?.exteriorColor)
                ) {
                  vehicle.exteriorColor = String(
                    bodyDetails?.exterior_color || bodyDetails?.exteriorColor || listing?.exterior_color || listing?.exteriorColor
                  );
                  console.log("DEALERINSPIRE COLOR TRACE: Extracted exterior color:", vehicle.exteriorColor);
                } else {
                  console.log("DEALERINSPIRE COLOR TRACE: No exterior color found in source data");
                }

                // Extract interior color from DealerInspire
                console.log("DEALERINSPIRE COLOR TRACE: Checking for interior color in source data");
                console.log("DEALERINSPIRE COLOR TRACE: bodyDetails.interior_color =", bodyDetails?.interior_color);
                console.log("DEALERINSPIRE COLOR TRACE: bodyDetails.interiorColor =", bodyDetails?.interiorColor);
                console.log("DEALERINSPIRE COLOR TRACE: listing.interior_color =", listing?.interior_color);
                console.log("DEALERINSPIRE COLOR TRACE: listing.interiorColor =", listing?.interiorColor);
                console.log("DEALERINSPIRE COLOR TRACE: Current vehicle.interiorColor =", vehicle.interiorColor);
                
                if (
                  vehicle.interiorColor === null &&
                  (bodyDetails?.interior_color || bodyDetails?.interiorColor || listing?.interior_color || listing?.interiorColor)
                ) {
                  vehicle.interiorColor = String(
                    bodyDetails?.interior_color || bodyDetails?.interiorColor || listing?.interior_color || listing?.interiorColor
                  );
                  console.log("DEALERINSPIRE COLOR TRACE: Extracted interior color:", vehicle.interiorColor);
                } else {
                  console.log("DEALERINSPIRE COLOR TRACE: No interior color found in source data");
                }

                // Extract clean title status from DealerInspire
                // Check for clean title indicators in the listing
                console.log("DEALERINSPIRE TITLE TRACE: Checking listing.title_status:", listing?.title_status);
                console.log("DEALERINSPIRE TITLE TRACE: Checking listing.has_clean_title:", listing?.has_clean_title);
                console.log("DEALERINSPIRE TITLE TRACE: Current vehicle.hasCleanTitle:", vehicle.hasCleanTitle);
                
                if (
                  vehicle.hasCleanTitle === null &&
                  (listing?.title_status === "clean" || listing?.title_status === "Clean" || listing?.has_clean_title === true)
                ) {
                  vehicle.hasCleanTitle = true;
                  console.log("DEALERINSPIRE TITLE TRACE: Set hasCleanTitle = true based on listing data");
                } else if (listing?.title_status === "salvage" || listing?.title_status === "Salvage" || listing?.title_status === "rebuilt") {
                  vehicle.hasCleanTitle = false;
                  console.log("DEALERINSPIRE TITLE TRACE: Set hasCleanTitle = false based on listing data");
                }

                // Location from DealerInspire search-service
                if (vehicle.location === null) {
                  const dealerLocation = listing?.dealer?.location || listing?.location || listing?.dealer_address;
                  if (dealerLocation) {
                    vehicle.location = normalizeLocation(String(dealerLocation));
                  }
                }

                console.log(
                  "========== DEALERINSPIRE SCANNER FINAL VEHICLE OBJECT =========="
                );
                console.log("DEALERINSPIRE SCANNER: make =", vehicle.make);
                console.log("DEALERINSPIRE SCANNER: model =", vehicle.model);
                console.log("DEALERINSPIRE SCANNER: year =", vehicle.year);
                console.log("DEALERINSPIRE SCANNER: body =", vehicle.body);
                console.log("DEALERINSPIRE SCANNER: exteriorColor =", vehicle.exteriorColor);
                console.log("DEALERINSPIRE SCANNER: interiorColor =", vehicle.interiorColor);
                console.log("DEALERINSPIRE SCANNER: hasCleanTitle =", vehicle.hasCleanTitle);
                console.log("DEALERINSPIRE SCANNER: condition =", vehicle.condition);
                console.log("DEALERINSPIRE SCANNER: mileage =", vehicle.mileage);
                console.log("DEALERINSPIRE SCANNER: fuel =", vehicle.fuel);
                console.log("DEALERINSPIRE SCANNER: transmission =", vehicle.transmission);
                console.log("DEALERINSPIRE SCANNER: location =", vehicle.location);
                console.log("DEALERINSPIRE SCANNER: images.length =", vehicle.images?.length || 0);
                console.log("DEALERINSPIRE SCANNER: vin =", vehicle.vin);
                console.log("=========================================================");
              } else {
                console.warn(
                  "DealerInspire search-service helper unavailable."
                );
              }
            } catch (error) {
              console.warn(
                "DealerInspire search-service extraction failed:",
                error
              );
            }

            // FALLBACK: use DealerInspire DOM fields if the search-service
            // did not provide a particular specification.
            try {
              const getBasicInfo = (label) => {
                const item = [
                  ...document.querySelectorAll(".basic-info-item"),
                ].find((el) => {
                  const labelText =
                    el
                      .querySelector(".basic-info-item__label")
                      ?.textContent || "";

                  return (
                    clean(labelText).toLowerCase() ===
                    String(label).toLowerCase()
                  );
                });

                return (
                  item
                    ?.querySelector(".basic-info-item__value")
                    ?.textContent
                    ?.trim() || null
                );
              };

              if (vehicle.drivetrain === null) {
                const drivetrain = getBasicInfo("Drivetrain:");

                if (drivetrain) {
                  vehicle.drivetrain = drivetrain;
                }
              }

              if (vehicle.transmission === null) {
                const transmission =
                  getBasicInfo("Transmission:");

                if (transmission) {
                  vehicle.transmission = transmission;
                }
              }

              if (vehicle.engine === null) {
                const engine = getBasicInfo("Engine:");

                if (engine) {
                  vehicle.engine = engine;
                }
              }

              if (vehicle.body === null) {
                const bodyText = [
                  ...document.querySelectorAll("body *"),
                ]
                  .map((el) => clean(el.textContent))
                  .find((text) =>
                    /^Body Style:\s*/i.test(text)
                  );

                if (bodyText) {
                  vehicle.body = bodyText
                    .replace(/^Body Style:\s*/i, "")
                    .trim();
                }
              }

              if (vehicle.fuel === null) {
                const fuelText = [
                  ...document.querySelectorAll("body *"),
                ]
                  .map((el) => clean(el.textContent))
                  .find((text) =>
                    /^Gasoline Fuel$/i.test(text)
                  );

                if (fuelText) {
                  vehicle.fuel = fuelText;
                }
              }

              console.log(
                "DealerInspire DOM fallback specs:",
                {
                  mileage: vehicle.mileage,
                  mileageUnit: vehicle.mileageUnit,
                  body: vehicle.body,
                  engine: vehicle.engine,
                  drivetrain: vehicle.drivetrain,
                  transmission: vehicle.transmission,
                  fuel: vehicle.fuel,
                }
              );
            } catch (error) {
              console.warn(
                "DealerInspire DOM fallback extraction failed:",
                error
              );
            }

            // Fallback to DOM extraction for fields not in data sources.
            if (!vehicle.year || !vehicle.make || !vehicle.model) {
              const titleElement = document.querySelector("h1");

              if (titleElement) {
                const titleText = clean(titleElement.textContent);
                const titleMatch = titleText.match(
                  /(\d{4})\s+([A-Za-z]+)\s+([A-Za-z0-9]+)/
                );

                if (titleMatch) {
                  vehicle.year =
                    vehicle.year || Number(titleMatch[1]);

                  vehicle.make =
                    vehicle.make || clean(titleMatch[2]);

                  vehicle.model =
                    vehicle.model || clean(titleMatch[3]);
                }
              }
            }

            if (!vehicle.trim) {
              const trimElement = document.querySelector(
                '[data-field="trim"], .trim, .vehicle-trim'
              );

              if (trimElement) {
                vehicle.trim = clean(trimElement.textContent);
              }
            }

            // Fallback price only if no authoritative price was found.
            if (vehicle.price === null) {
              const salePriceElement = document.querySelector(
                '[data-field="sale-price"], .sale-price, .final-price, .asking-price, .selling-price'
              );

              const priceElement = document.querySelector(
                '[data-field="price"], .price, .vehicle-price'
              );

              const msrpElement = document.querySelector(
                '[data-field="msrp"], .msrp, .original-price'
              );

              const priceSource =
                salePriceElement ||
                priceElement ||
                msrpElement;

              if (priceSource) {
                const priceText = clean(priceSource.textContent);

                const priceMatch = priceText.match(
                  /[$]?\s*([\d,]+(?:\.\d+)?)/
                );

                if (priceMatch) {
                  vehicle.price = Number(
                    priceMatch[1].replace(/,/g, "")
                  );

                  vehicle.currency =
                    vehicle.currency || "USD";
                }
              }
            }

            // Location from confirmed DealerInspire source.
            if (vehicle.location === null) {
              const locationElement =
                document.querySelector(".dealer-address");

              if (locationElement) {
                vehicle.location = normalizeLocation(
                  locationElement.textContent
                );

                console.log(
                  "Extracted location from .dealer-address:",
                  vehicle.location
                );
              }
            }


            // Images from gallery - enhanced extraction
            console.log("DEALERINSPIRE PHOTO TRACE: Starting DOM gallery extraction");

            // More comprehensive selector for gallery images
            const imageElements = document.querySelectorAll(
              '.vehicle-gallery img, .gallery img, .vehicle-images img, img[src*="inventory"], ' +
              '.vdp-gallery img, .carousel img, .slider img, .photo-gallery img, ' +
              'img[src*="vehicles"], img[src*="dealer"], img[data-src], ' +
              '.thumbnail img, .gallery-item img, .photo-item img'
            );

            const imageUrls = new Set();
            console.log("DEALERINSPIRE PHOTO TRACE: img elements found:", imageElements.length);

            for (const img of imageElements) {
              // Try multiple sources for the image URL
              let src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original');

              // Try srcset for higher resolution versions
              if (!src && img.srcset) {
                const srcsetUrls = img.srcset.split(',').map(s => s.trim().split(' ')[0]);
                src = srcsetUrls[srcsetUrls.length - 1]; // Get the highest resolution
              }

              // Try parent elements for data attributes
              if (!src) {
                const parent = img.closest('[data-src], [data-original], [data-image]');
                if (parent) {
                  src = parent.getAttribute('data-src') || parent.getAttribute('data-original') || parent.getAttribute('data-image');
                }
              }

              if (src && (src.match(/\.(jpg|jpeg|png|webp|gif)$/i) || src.includes('inventory') || src.includes('vehicle') || src.includes('dealer'))) {
                // Convert thumbnail URLs to full-size URLs when possible
                let fullSizeUrl = src;
                if (src.includes('thumbnail') || src.includes('thumb') || src.includes('_small') || src.includes('_medium')) {
                  fullSizeUrl = src
                    .replace(/thumbnail/g, 'full')
                    .replace(/thumb/g, 'full')
                    .replace(/_small\./g, '_large.')
                    .replace(/_medium\./g, '_large.')
                    .replace(/\/thumbs\//g, '/full/')
                    .replace(/\/small\//g, '/large/');
                }

                imageUrls.add(fullSizeUrl);
              }
            }

            console.log("DEALERINSPIRE PHOTO TRACE: data-src found:", imageElements.length, "elements checked");
            console.log("DEALERINSPIRE PHOTO TRACE: extracted image URLs:", imageUrls.size);
            console.log("DEALERINSPIRE PHOTO TRACE: first 3 image URLs:", Array.from(imageUrls).slice(0, 3));

            if (imageUrls.size > 0 && vehicle.images.length === 0) {
              vehicle.images = Array.from(imageUrls);
              console.log("DEALERINSPIRE PHOTO TRACE: unique valid images (ALL, no truncation):", vehicle.images.length);
              console.log("SHIFTLY PHOTO EXTRACTION: Gallery count =", imageUrls.size);
              console.log("SHIFTLY PHOTO EXTRACTION: Images found =", vehicle.images.length);
            } else if (vehicle.images.length > 0) {
              console.log("DEALERINSPIRE PHOTO TRACE: vehicle.images already has", vehicle.images.length, "images from API, preserving ALL of them");
            } else {
              console.log("DEALERINSPIRE PHOTO TRACE: No images found in DOM or API");
            }
          } catch (e) {
            console.error("DealerInspire extraction error:", e);
          }
        }

        // Normalize mileage for downstream AI/posting: KM only.
        if (
          vehicle.mileage !== null &&
          Number.isFinite(Number(vehicle.mileage))
        ) {
          const mileageUnit = String(vehicle.mileageUnit || "").toUpperCase();

          if (mileageUnit === "MI" || mileageUnit === "MILES") {
            vehicle.mileage = Math.round(Number(vehicle.mileage) * 1.609344);
          }

          vehicle.mileageUnit = "KM";
        }
        return {
          vins,
          vehicle
        };
      },
    });

  const scanResult =
    results?.[0]?.result || { vins: [], vehicle: null };

  const vins = scanResult.vins || [];
  const vehicle = scanResult.vehicle || null;

  if (vehicle?.images) {
    console.log("scanTab - vehicle.images.length:", vehicle.images.length);
    console.log("scanTab - vehicle.images[0:3]:", vehicle.images.slice(0, 3));
    console.log("scanTab - IMPORTANT: Vehicle record preserves ALL", vehicle.images.length, "photos (no truncation)");
  }

  tabVins.set(tabId, {
    vins,
    vehicle,
    url: tabUrl,
  });

  return {
    vins,
    vehicle,
    url: tabUrl,
  };
}

/* -------------------------------------------------------
   POST TO MARKETPLACE (NEW FLOW FROM SHIFTLY WEB APP)
------------------------------------------------------- */

async function handlePostToMarketplace(listing) {
  console.log("Shiftly: Opening Facebook Marketplace with listing data");

  try {
    if (!listing) {
      return {
        success: false,
        error: "No Marketplace listing data was provided."
      };
    }

    // ============================================================
    // FACEBOOK PHOTO DOWNLOAD � BACKGROUND CONTEXT
    // ============================================================

    const imageUrls =
      Array.isArray(listing.images) && listing.images.length
        ? listing.images
        : Array.isArray(listing.photos)
          ? listing.photos
          : [];

    console.log(
      "FACEBOOK PHOTO TRACE: HANDLE POST SOURCE IMAGES:",
      imageUrls.length
    );

    console.log(
      "FACEBOOK PHOTO TRACE: First 3 image URLs:",
      imageUrls.slice(0, 3)
    );

    const downloadedImages = [];

    // Facebook Marketplace limits to 20 photos
    // IMPORTANT: This limit applies ONLY to Facebook upload, not to vehicle record
    const maxFacebookPhotos = 20;
    const photosToDownload = Math.min(imageUrls.length, maxFacebookPhotos);

    console.log(
      "FACEBOOK PHOTO TRACE: Source vehicle has",
      imageUrls.length,
      "photos (FULL ARRAY PRESERVED in vehicle record)"
    );
    console.log(
      "FACEBOOK PHOTO TRACE: Downloading",
      photosToDownload,
      "photos for Facebook upload (Facebook max: 20)"
    );

    for (
      let i = 0;
      i < photosToDownload;
      i++
    ) {
      const imageUrl = imageUrls[i];

      try {
        console.log(
          "FACEBOOK PHOTO TRACE: HANDLE POST DOWNLOADING:",
          i + 1,
          imageUrl
        );

        const response = await fetch(imageUrl);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();

        if (!blob.type.startsWith("image/")) {
          throw new Error(
            `Invalid image MIME type: ${blob.type}`
          );
        }

        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        let binary = "";

        for (let j = 0; j < bytes.length; j++) {
          binary += String.fromCharCode(bytes[j]);
        }

        const base64 = btoa(binary);

        let extension = "jpg";

        if (blob.type === "image/png") {
          extension = "png";
        } else if (blob.type === "image/webp") {
          extension = "webp";
        } else if (blob.type === "image/jpeg") {
          extension = "jpg";
        }

        downloadedImages.push({
          data: base64,
          mimeType: blob.type,
          extension,
          name: `vehicle_${i + 1}.${extension}`
        });

        console.log(
          "FACEBOOK PHOTO TRACE: HANDLE POST DOWNLOADED:",
          i + 1
        );
      } catch (error) {
        console.error(
          "FACEBOOK PHOTO TRACE: HANDLE POST DOWNLOAD FAILED:",
          i + 1,
          error?.message || String(error)
        );
      }
    }

    console.log(
      "FACEBOOK PHOTO TRACE: HANDLE POST DOWNLOADED TOTAL:",
      downloadedImages.length
    );

    console.log(
      "FACEBOOK PHOTO TRACE: IMPORTANT: Source listing.images still has",
      listing.images?.length || 0,
      "photos (FULL ARRAY PRESERVED)"
    );

    listing.downloadedImages = downloadedImages;
    await chrome.storage.local.set({
      facebookListing: listing,
      shiftlyFacebookListing: listing
    });

    console.log("Shiftly: Marketplace listing saved to extension storage");

    const marketplaceUrl =
      "https://www.facebook.com/marketplace/create/vehicle";

    const tab = await chrome.tabs.create({
      url: marketplaceUrl
    });

    if (!tab?.id) {
      return {
        success: false,
        error: "Unable to open Facebook Marketplace."
      };
    }

    console.log(
      "Shiftly: Facebook Marketplace tab opened, ID:",
      tab.id
    );

    await new Promise((resolve) => {
      let resolved = false;

      const listener = (tabId, changeInfo) => {
        if (
          tabId === tab.id &&
          changeInfo.status === "complete"
        ) {
          if (!resolved) {
            resolved = true;
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        }
      };

      chrome.tabs.onUpdated.addListener(listener);

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }, 15000);
    });

    console.log("Shiftly: Marketplace page finished loading");

    await new Promise((resolve) =>
      setTimeout(resolve, 4000)
    );

    console.log(
      "Shiftly: Sending listing to Marketplace content script"
    );

    console.log(
      "Shiftly: Listing currency value:",
      listing.currency
    );

const response = await new Promise((resolve) => {
  let finished = false;

  const finish = (result) => {
    if (finished) {
      return;
    }

    finished = true;

    console.log(
      "Shiftly: Marketplace request finished:",
      result
    );

    resolve(
      result || {
        success: false,
        error:
          "Marketplace content script returned no response."
      }
    );
  };

  console.log(
    "Shiftly: Sending SHIFTLY_FILL_MARKETPLACE_FORM message..."
  );
  console.log("FM_HANDLER_DEBUG_2026_09_21_A: background.js sending message to tab", tab.id);

  chrome.tabs.sendMessage(
    tab.id,
    {
      type: "SHIFTLY_FILL_MARKETPLACE_FORM",
      listing
    },
    (result) => {
      if (chrome.runtime.lastError) {
        const errorMessage =
          chrome.runtime.lastError.message || "";

        console.error(
          "Shiftly: Content script communication error:",
          errorMessage
        );

        finish({
          success: false,
          error:
            "Could not communicate with the Facebook Marketplace page. " +
            "Make sure the Marketplace page is fully loaded and the Shiftly Auto extension is enabled."
        });

        return;
      }

      console.log(
        "Shiftly: Marketplace content script response:",
        result
      );
      console.log(
        "SHIFTLY ACTUAL FORM ERROR:",
        result?.errors?.[0] || result?.error || "NO ERROR MESSAGE"
      );

      finish(
        result || {
          success: false,
          error:
            "Marketplace content script returned no response."
        }
      );
    }
  );

  /*
   * Marketplace can take longer than 15 seconds because
   * Facebook may need time to render fields, autocomplete
   * menus, and process uploaded photos.
   *
   * Give the content script enough time to finish.
   */
  setTimeout(() => {
    if (finished) {
      return;
    }

    console.warn(
      "Shiftly: Marketplace filler is still running after 60 seconds."
    );

    finish({
      success: false,
      error:
        "Marketplace form filler timed out after 60 seconds. " +
        "The Facebook Marketplace form may still be processing."
    });
  }, 60000);
});

    console.log(
      "Shiftly: Final Marketplace result:",
      response
    );

    if (!response?.success) {
      return {
        success: false,
        error:
          response?.error ||
          "Marketplace form could not be filled.",
        fieldsFilled:
          response?.fieldsFilled || [],
        errors:
          response?.errors || []
      };
    }

    return {
      success: true,
      message:
        response.message ||
        "Facebook Marketplace form was filled. Please review the listing and publish manually.",
      fieldsFilled:
        response.fieldsFilled || [],
      errors:
        response.errors || []
    };

  } catch (error) {
    console.error(
      "Shiftly: Marketplace post error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : String(error)
    };
  }
}
/* -------------------------------------------------------
   EXTERNAL MESSAGE HANDLER (from Shiftly web app)
------------------------------------------------------- */

chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    console.log("Shiftly: External message received from:", sender.url);

    if (message?.type === "SHIFTLY_POST_TO_MARKETPLACE") {
      console.log("Shiftly: Processing Marketplace listing request");
      
      handlePostToMarketplace(message.listing)
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          console.error("Shiftly: Marketplace post error:", error);
          sendResponse({
            success: false,
            error: error.message
          });
        });

      return true;
    }

    return true;
  }
);

/* -------------------------------------------------------
   INTERNAL MESSAGE HANDLER (from extension components)
------------------------------------------------------- */

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {

    if (message?.type === "SHIFTLY_SCAN_TAB") {
      const tabId = Number(message.tabId);

      scanTab(tabId)
        .then((result) => {
          sendResponse({
            ok: true,
            vins: result.vins,
            vehicle: result.vehicle,
            url: tabVins.get(tabId)?.url || null,
          });
        })
        .catch((error) => {
          console.error("SHIFTLY SCAN FAILED:", error);
          sendResponse({
            ok: false,
            vins: [],
            error: error?.message || String(error),
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
          vehicle: null,
          url: null,
        }
      );

      return true;
    }

    if (message?.type === "SHIFTLY_START_FACEBOOK_LISTING") {
      console.log(
        "FACEBOOK BACKGROUND: HANDLER ENTERED",
        message
      );
      console.log("FACEBOOK BACKGROUND: ========== RECEIVED SHIFTLY_START_FACEBOOK_LISTING MESSAGE ==========");

      chrome.storage.local.get(["facebookListing"], (stored) => {
        const listing = stored?.facebookListing || null;

        console.log("FACEBOOK BACKGROUND: Retrieved listing from storage:", !!listing);
        if (listing) {
          console.log("FACEBOOK BACKGROUND: ===== FULL FACEBOOK LISTING DATA =====");
console.log("FACEBOOK BACKGROUND: title:", listing.title);
console.log("FACEBOOK BACKGROUND: price_cad:", listing.price_cad);
console.log("FACEBOOK BACKGROUND: mileage_km:", listing.mileage_km);
console.log("FACEBOOK BACKGROUND: mileage:", listing.mileage);
console.log("FACEBOOK BACKGROUND: location:", listing.location);
console.log("FACEBOOK BACKGROUND: address:", listing.address);
console.log("FACEBOOK BACKGROUND: ALL KEYS:", Object.keys(listing));
console.log("FACEBOOK BACKGROUND: FULL LISTING:", listing);
          console.log("FACEBOOK BACKGROUND: facebookListing.images.length:", listing.images?.length || 0);
          console.log("FACEBOOK BACKGROUND: facebookListing.images[0:3]:", listing.images?.slice(0, 3) || []);
        }

        if (!listing) {
          console.error("FACEBOOK BACKGROUND: NO LISTING FOUND IN STORAGE");
          sendResponse({
            ok: false,
            error: "No Facebook listing is saved. Generate the Facebook listing first."
          });
          return;
        }

        console.log("FACEBOOK BACKGROUND: Creating Facebook Marketplace tab");
        chrome.tabs.create({
          url: "https://www.facebook.com/marketplace/create/vehicle"
        }).then(tab => {
          if (!tab?.id) {
            console.error("FACEBOOK BACKGROUND: TAB CREATION FAILED - No tab ID returned");
            sendResponse({
              ok: false,
              error: "Facebook tab was not created."
            });
            return;
          }

          console.log("FACEBOOK BACKGROUND: TAB CREATED SUCCESSFULLY");
          console.log("FACEBOOK BACKGROUND: Tab ID:", tab.id);
          console.log("FACEBOOK BACKGROUND: Initial Tab URL:", tab.url);
          console.log("FACEBOOK BACKGROUND: Tab pending URL:", tab.pendingUrl);

          // Wait for Facebook page to complete loading using tabs.onUpdated
          new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              chrome.tabs.onUpdated.removeListener(listener);
              console.error("FACEBOOK BACKGROUND: PAGE LOADING TIMEOUT after 30 seconds for tab:", tab.id);
              reject(new Error("Facebook page loading timeout after 30 seconds"));
            }, 30000);

            const listener = (updatedTabId, changeInfo, updatedTab) => {
              console.log("FACEBOOK BACKGROUND: TAB UPDATE EVENT - tabId:", updatedTabId, "status:", changeInfo.status, "target tab:", tab.id);
              console.log("FACEBOOK BACKGROUND: UPDATE DETAILS - url:", updatedTab.url, "pendingUrl:", updatedTab.pendingUrl);

              if (updatedTabId === tab.id) {
                console.log("FACEBOOK BACKGROUND: UPDATE MATCHES OUR TAB - changeInfo:", JSON.stringify(changeInfo));

                if (changeInfo.status === 'complete') {
                  clearTimeout(timeout);
                  chrome.tabs.onUpdated.removeListener(listener);
                  console.log("FACEBOOK BACKGROUND: PAGE LOADING COMPLETE for tab:", tab.id);
                  console.log("FACEBOOK BACKGROUND: FINAL URL:", updatedTab.url);
                  console.log("FACEBOOK BACKGROUND: FINAL PENDING URL:", updatedTab.pendingUrl);

                  // Check if we're on the expected Facebook page
                  if (updatedTab.url && updatedTab.url.includes("facebook.com/marketplace/create")) {
                    console.log("FACEBOOK BACKGROUND: SUCCESS - Tab is on Facebook Marketplace create page");
                  } else {
                    console.error("FACEBOOK BACKGROUND: WARNING - Tab is NOT on expected Facebook page");
                    console.error("FACEBOOK BACKGROUND: Expected: https://www.facebook.com/marketplace/create/vehicle");
                    console.error("FACEBOOK BACKGROUND: Actual:", updatedTab.url);
                  }

                  resolve();
                }
              }
            };

            chrome.tabs.onUpdated.addListener(listener);
          }).then(async () => {
            console.log("FACEBOOK BACKGROUND: ========== PAGE LOAD COMPLETE - EXECUTING SCRIPT INJECTION ==========");
            console.log("FACEBOOK BACKGROUND: Target tab ID:", tab.id);
            console.log("FACEBOOK BACKGROUND: Script world: MAIN");

            console.log("FACEBOOK BACKGROUND: BEFORE executeScript CALL");

            // Diagnostic: Log function reference before executeScript
            console.log("FACEBOOK BACKGROUND: DIAGNOSTIC - About to pass inline function to executeScript");

            // FIX #1: Download images in extension context to avoid Facebook CSP
            console.log("FACEBOOK PHOTO TRACE: remote image fetch context: extension/background");
            console.log("FACEBOOK PHOTO TRACE: downloading images:", listing.images?.length || 0);
            
            const downloadedImages = [];
let failedDownloads = 0;

const imageUrls =
  Array.isArray(listing.images) && listing.images.length
    ? listing.images
    : Array.isArray(listing.photos)
      ? listing.photos
      : [];

console.log(
  "FACEBOOK PHOTO TRACE: source image URLs:",
  imageUrls.length
);

if (imageUrls.length > 0) {
  for (
    let i = 0;
    i < Math.min(imageUrls.length, 20);
    i++
  ) {
    const imageUrl = imageUrls[i];

    try {
      console.log(
        "FACEBOOK PHOTO TRACE: downloading image",
        i + 1,
        ":",
        imageUrl
      );

      const response = await fetch(imageUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();

      if (!blob.type.startsWith("image/")) {
        throw new Error(
          `Invalid image MIME type: ${blob.type}`
        );
      }

      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      let binaryString = "";

      for (let j = 0; j < uint8Array.length; j++) {
        binaryString += String.fromCharCode(
          uint8Array[j]
        );
      }

      const base64 = btoa(binaryString);

      let extension = "jpg";

      if (blob.type === "image/png") {
        extension = "png";
      } else if (blob.type === "image/webp") {
        extension = "webp";
      } else if (blob.type === "image/jpeg") {
        extension = "jpg";
      }

      downloadedImages.push({
        data: base64,
        mimeType: blob.type,
        extension,
        name: `vehicle_${i + 1}.${extension}`
      });

      console.log(
        "FACEBOOK PHOTO TRACE: successfully downloaded image",
        i + 1
      );
    } catch (error) {
      console.error(
        "FACEBOOK PHOTO TRACE: failed to download image",
        i + 1,
        ":",
        error?.message || String(error)
      );

      failedDownloads++;
    }
  }
}

console.log(
  "FACEBOOK PHOTO TRACE: downloaded images:",
  downloadedImages.length
);

console.log(
  "FACEBOOK PHOTO TRACE: failed downloads:",
  failedDownloads
);

listing.downloadedImages = downloadedImages;

            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              world: "MAIN",

              func: async (listingData) => {
                console.error("SHIFTLY INJECTED FUNCTION ACTUALLY STARTED");

                try {
                  const result = {
                    page: true,
                    fields: {},
                    diagnostics: {},
                  };

                  console.log("FACEBOOK INJECTED SCRIPT: STARTED");
                  console.log("FACEBOOK INJECTED SCRIPT: ========== SCRIPT EXECUTION STARTED ==========");
                  console.log("FACEBOOK INJECTED SCRIPT: Received listingData:", !!listingData);
                  if (listingData) {
                    console.log("FACEBOOK INJECTED SCRIPT: Listing data keys:", Object.keys(listingData));
                    console.log("FACEBOOK INJECTED SCRIPT: listingData.images.length:", listingData.images?.length || 0);
                    console.log("FACEBOOK INJECTED SCRIPT: listingData.images[0:3]:", listingData.images?.slice(0, 3) || []);
                    console.log("FACEBOOK PHOTO TRACE: listingData.downloadedImages.length:", listingData.downloadedImages?.length || 0);
                  }
                  console.log("FACEBOOK INJECTED SCRIPT: LISTING DATA RECEIVED");

                  console.log("FACEBOOK INJECTED SCRIPT: Current page URL:", location.href);
                  console.log("FACEBOOK INJECTED SCRIPT: Current hostname:", location.hostname);
                  console.log("FACEBOOK INJECTED SCRIPT: Current pathname:", location.pathname);

                  const sleep = (ms) =>
                    new Promise((resolve) => setTimeout(resolve, ms));

                  const started = Date.now();

                  const snapshot = () => ({
                    href: location.href,
                    hostname: location.hostname,
                    pathname: location.pathname,
                    readyState: document.readyState,
                    title: document.title,
                    inputs: document.querySelectorAll("input").length,
                    textareas: document.querySelectorAll("textarea").length,
                    comboboxes: document.querySelectorAll(
                      '[role="combobox"]'
                    ).length,
                    labels: document.querySelectorAll("label").length,
                    options: document.querySelectorAll(
                      '[role="option"]'
                    ).length,
                    buttons: document.querySelectorAll("button").length,
                    bodyText:
                      document.body?.innerText
                        ?.replace(/\s+/g, " ")
                        .trim()
                        .slice(0, 2500) || "",
                  });

                  const isFacebookMarketplacePage = () =>
                    location.hostname === "www.facebook.com" &&
                    location.pathname.includes("/marketplace/create");

                  console.log("FACEBOOK INJECTED SCRIPT: PAGE CHECK - hostname:", location.hostname, "pathname:", location.pathname);
                  console.log("FACEBOOK INJECTED SCRIPT: Is Facebook Marketplace page:", isFacebookMarketplacePage());
                  console.log("FACEBOOK INJECTED SCRIPT: Full URL:", location.href);
                  console.log("FACEBOOK INJECTED SCRIPT: Document readyState:", document.readyState);
                  console.log("FACEBOOK INJECTED SCRIPT: PAGE CHECK - Starting page check loop");

                  /*
                   * Facebook Marketplace is dynamic.
                   * Wait up to 20 seconds for the actual create page.
                   */
                  let waitCount = 0;
                  console.log("FACEBOOK INJECTED SCRIPT: PAGE CHECK - Entering wait loop for Marketplace page");
                  while (
                    !isFacebookMarketplacePage() &&
                    Date.now() - started < 20000
                  ) {
                    waitCount++;
                    if (waitCount % 10 === 0) {
                      console.log("FACEBOOK INJECTED SCRIPT: Still waiting for Marketplace page, count:", waitCount);
                    }
                    await sleep(500);
                  }
                  console.log("FACEBOOK INJECTED SCRIPT: PAGE CHECK - Wait loop completed, waitCount:", waitCount);

                  const page = isFacebookMarketplacePage();
                  console.log("FACEBOOK INJECTED SCRIPT: Final page check result:", page, "elapsed:", Date.now() - started, "ms");

                  if (!page) {
                    console.error("FACEBOOK INJECTED SCRIPT: EARLY RETURN - PAGE FALSE");
                    console.error("FACEBOOK INJECTED SCRIPT: FACEBOOK MARKETPLACE PAGE DID NOT LOAD");
                    console.error("FACEBOOK INJECTED SCRIPT: Current URL:", location.href);
                    console.error("FACEBOOK INJECTED SCRIPT: Expected URL pattern: https://www.facebook.com/marketplace/create/*");
                    console.error("FACEBOOK INJECTED SCRIPT: Snapshot:", JSON.stringify(snapshot()));
                    return {
                      ok: false,
                      error:
                        "Facebook Marketplace create page did not finish loading.",
                      result: {
                        page: false,
                        snapshot: snapshot(),
                      },
                    };
                  }
                  console.log("FACEBOOK INJECTED SCRIPT: PAGE CHECK - Page is true, continuing");

                  /*
                   * Wait until Facebook actually renders form controls.
                   */
                  console.log("FACEBOOK INJECTED SCRIPT: FORM CONTROLS - Starting wait loop for form controls");
                  let formWaitCount = 0;
                  while (
                    document.querySelectorAll("input, textarea, [role='combobox']")
                      .length === 0 &&
                    Date.now() - started < 30000
                  ) {
                    formWaitCount++;
                    if (formWaitCount % 10 === 0) {
                      console.log("FACEBOOK INJECTED SCRIPT: Still waiting for form controls, count:", formWaitCount);
                    }
                    await sleep(500);
                  }
                  console.log("FACEBOOK INJECTED SCRIPT: FORM CONTROLS - Wait loop completed, formWaitCount:", formWaitCount);

                  const formElements = document.querySelectorAll("input, textarea, [role='combobox']");
                  console.log("FACEBOOK INJECTED SCRIPT: Form controls detected:", formElements.length, "elapsed:", Date.now() - started, "ms");

                  console.log("FACEBOOK INJECTED SCRIPT: REACHED VEHICLE SECTION");
                  const vehicle = listingData?.vehicle || {};
                  console.log("FACEBOOK INJECTED SCRIPT: Vehicle data from listing:", vehicle);
                  console.log("FACEBOOK INJECTED SCRIPT: VEHICLE SECTION PASSED");
                  
                  // CRITICAL DIAGNOSTIC: Print actual values being passed for mandatory fields
                  console.log("FACEBOOK INJECTED SCRIPT: ========== SOURCE DATA DIAGNOSTIC ==========");
                  console.log("FACEBOOK INJECTED SCRIPT: vehicle.make =", vehicle.make);
                  console.log("FACEBOOK INJECTED SCRIPT: vehicle.body =", vehicle.body);
                  console.log("FACEBOOK INJECTED SCRIPT: vehicle.exteriorColor =", vehicle.exteriorColor);
                  console.log("FACEBOOK INJECTED SCRIPT: vehicle.interiorColor =", vehicle.interiorColor);
                  console.log("FACEBOOK INJECTED SCRIPT: vehicle.hasCleanTitle =", vehicle.hasCleanTitle);
                  console.log("FACEBOOK INJECTED SCRIPT: vehicle.condition =", vehicle.condition);
                  console.log("FACEBOOK INJECTED SCRIPT: vehicle.year =", vehicle.year);
                  console.log("FACEBOOK INJECTED SCRIPT: vehicle.model =", vehicle.model);
                  console.log("FACEBOOK INJECTED SCRIPT: vehicle.mileage =", vehicle.mileage);
                  console.log("FACEBOOK INJECTED SCRIPT: vehicle.fuel =", vehicle.fuel);
                  console.log("FACEBOOK INJECTED SCRIPT: vehicle.transmission =", vehicle.transmission);
                  console.log("FACEBOOK INJECTED SCRIPT: ========== END SOURCE DATA DIAGNOSTIC ==========");

                  console.log("FACEBOOK PHOTO UPLOAD: ENTERING PHOTO UPLOAD SECTION", listingData?.images?.length);

                  /*
                   * PHOTO UPLOAD
                   */
                  console.log("FACEBOOK PHOTO UPLOAD: ========== STARTING PHOTO UPLOAD ==========");
                  console.log("FACEBOOK PHOTO UPLOAD: Images received:", listingData.images?.length || 0);
                  console.log("FACEBOOK PHOTO UPLOAD: Image URLs:", listingData.images?.slice(0, 3) || []);
                  console.log("FACEBOOK PHOTO TRACE: images received:", listingData.images?.length || 0);

                  const downloadedImages = listingData.downloadedImages || [];
                  console.log("FACEBOOK PHOTO TRACE: downloaded images received:", downloadedImages.length);

                  if (downloadedImages.length > 0) {
                    // Wait for Facebook photo upload file input to become available
                    console.log("FACEBOOK PHOTO UPLOAD: Waiting for photo upload file input...");
                    let photoFileInput = null;
                    let pollCount = 0;
                    const maxPolls = 30; // 30 * 500ms = 15 seconds max

                    while (pollCount < maxPolls && !photoFileInput) {
                      await sleep(500);
                      pollCount++;

                      const fileInputs = document.querySelectorAll('input[type="file"]');
                      console.log(`FACEBOOK PHOTO UPLOAD: Poll ${pollCount}: Total file inputs found:`, fileInputs.length);

                      for (const input of fileInputs) {
                        const accept = input.getAttribute('accept') || '';
                        const multiple = input.hasAttribute('multiple');
                        const ariaLabel = input.getAttribute('aria-label') || '';
                        const parentText = input.parentElement?.innerText || '';

                        console.log("FACEBOOK PHOTO UPLOAD: File input details:", {
                          accept,
                          multiple,
                          ariaLabel,
                          parentText: parentText.slice(0, 100)
                        });

                        // Look for file input that accepts images and allows multiple
                        if (accept.includes('image') && multiple) {
                          photoFileInput = input;
                          console.log("FACEBOOK PHOTO UPLOAD: Found suitable file input at poll", pollCount);
                          console.log("FACEBOOK PHOTO TRACE: file input found: true");
                          break;
                        }
                      }

                      if (photoFileInput) break;
                    }

                    if (photoFileInput) {
                      console.log("FACEBOOK PHOTO UPLOAD: File input found, creating files from downloaded data...");

                      try {
                        const files = [];
                        
                        for (let i = 0; i < downloadedImages.length; i++) {
                          const imgData = downloadedImages[i];
                          console.log("FACEBOOK PHOTO UPLOAD: Creating file", i + 1, "from downloaded data:", imgData.name);

                          try {
                            // Convert base64 back to binary
                            const binaryString = atob(imgData.data);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let j = 0; j < binaryString.length; j++) {
                              bytes[j] = binaryString.charCodeAt(j);
                            }
                            const blob = new Blob([bytes], { type: imgData.mimeType });
                          
                            const file = new File([blob], imgData.name, { type: imgData.mimeType });
                            files.push(file);
                            console.log("FACEBOOK PHOTO UPLOAD: Successfully created file", i + 1);
                          } catch (error) {
                            console.error("FACEBOOK PHOTO UPLOAD: Failed to create file from downloaded data", i + 1, ":", error);
                          }
                        }

                        console.log("FACEBOOK PHOTO UPLOAD: Files created:", files.length);
                        console.log("FACEBOOK PHOTO TRACE: files created in Facebook context:", files.length);

                        if (files.length > 0) {
                          // Create DataTransfer and add files
                          const dataTransfer = new DataTransfer();
                          files.forEach(file => dataTransfer.items.add(file));

                          // Assign files to input
                          photoFileInput.files = dataTransfer.files;
                          console.log("FACEBOOK PHOTO UPLOAD: Files assigned to input:", photoFileInput.files.length);
                          console.log("FACEBOOK PHOTO TRACE: DataTransfer files:", photoFileInput.files.length);

                          // Dispatch change event
                          const changeEvent = new Event('change', { bubbles: true });
                          photoFileInput.dispatchEvent(changeEvent);
                          console.log("FACEBOOK PHOTO UPLOAD: Change event dispatched");
                          console.log("FACEBOOK PHOTO TRACE: change event dispatched");

                          // Wait for Facebook to process the upload
                          console.log("FACEBOOK PHOTO TRACE: waiting for previews");
                          await sleep(3000);

                          // Verify UI changed - check for actual photo previews
                          const photoPreviews = document.querySelectorAll('img[src*="fbcdn"], img[src*="fbsbx"], .photo-preview, .upload-preview');
                          console.log("FACEBOOK PHOTO UPLOAD: Photo preview elements found:", photoPreviews.length);
                          
                          const photosText = document.body.innerText.match(/Photos (\d+)\/20/);
                          if (photosText) {
                            const photoCount = parseInt(photosText[1]);
                            console.log("FACEBOOK PHOTO UPLOAD: Photo count after upload:", photoCount);
                            console.log("FACEBOOK PHOTO TRACE: Facebook preview count:", photoCount);
                            console.log("FACEBOOK PHOTO TRACE: upload verified:", photoCount > 0);
                            result.fields.photos = photoCount > 0;
                          } else {
                            console.log("FACEBOOK PHOTO UPLOAD: Could not detect photo count in UI");
                            // Fallback: check if any files are in the input
                            console.log("FACEBOOK PHOTO UPLOAD: Files in input after upload:", photoFileInput.files.length);
                            console.log("FACEBOOK PHOTO TRACE: upload verified:", photoFileInput.files.length > 0);
                            result.fields.photos = photoFileInput.files.length > 0;
                          }

                          console.log("FACEBOOK PHOTO UPLOAD: ✓ UPLOAD COMPLETED");
                        } else {
                          console.error("FACEBOOK PHOTO UPLOAD: No files were created");
                          result.fields.photos = false;
                        }
                      } catch (error) {
                        console.error("FACEBOOK PHOTO UPLOAD: Upload failed:", error);
                        result.fields.photos = false;
                      }
                    } else {
                      console.error("FACEBOOK PHOTO UPLOAD: File input not found after polling");
                      console.log("FACEBOOK PHOTO TRACE: file input found: false");
                      result.fields.photos = false;
                    }
                  } else {
                    console.log("FACEBOOK PHOTO UPLOAD: No downloaded images to upload");
                    result.fields.photos = false;
                  }

                  console.log("FACEBOOK PHOTO UPLOAD: ========== PHOTO UPLOAD COMPLETE ==========");

                  const normalize = (value) =>
                    String(value ?? "")
                      .trim()
                      .toLowerCase();

                  const visible = (el) => {
                    if (!el) return false;

                    const style = window.getComputedStyle(el);

                    return (
                      style.display !== "none" &&
                      style.visibility !== "hidden" &&
                      el.getBoundingClientRect().width > 0 &&
                      el.getBoundingClientRect().height > 0
                    );
                  };

                  const elements = (selector) =>
                    [...document.querySelectorAll(selector)].filter(visible);

                  const findTextElement = (text) => {
                    const wanted = normalize(text);

                    return elements(
                      "label, div, span, button"
                    ).find((el) =>
                      normalize(el.innerText) === wanted
                    );
                  };

                  const findInputByLabel = async (text, fieldName = "unknown") => {
                    const wanted = normalize(text);

                    const inputs = elements(
                      "input, textarea"
                    );

                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Looking for input with label/placeholder: "${text}"`);
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Total inputs found:`, inputs.length);

                    for (const input of inputs) {
                      const aria = normalize(
                        input.getAttribute("aria-label")
                      );

                      const placeholder = normalize(
                        input.getAttribute("placeholder")
                      );

                      if (
                        aria === wanted ||
                        placeholder === wanted
                      ) {
                        console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Input found via aria-label/placeholder:`, aria || placeholder);
                        return input;
                      }
                    }

                    // Find label by text and get contained input (for Make/Model/Price)
                    const label = elements("label").find(
                      (el) => normalize(el.innerText) === wanted
                    );

                    if (label) {
                      const associatedInput = label.querySelector(
                        "input, textarea"
                      );
                      if (associatedInput) {
                        console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Input found via label with contained input:`, label.innerText);
                        return associatedInput;
                      }
                    }

                    // Additional fallback: look for labels that contain the text (not exact match)
                    const partialLabel = elements("label").find(
                      (el) => normalize(el.innerText).includes(wanted)
                    );

                    if (partialLabel) {
                      const associatedInput = partialLabel.querySelector(
                        "input, textarea"
                      );
                      if (associatedInput) {
                        console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Input found via partial label match:`, partialLabel.innerText);
                        return associatedInput;
                      }
                    }

                    // Additional fallback: look for input next to text elements
                    const allLabels = elements("label");
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Available labels:`, allLabels.map(l => l.innerText.substring(0, 30)));
                    
                    for (const lbl of allLabels) {
                      const labelText = normalize(lbl.innerText);
                      if (labelText.includes(wanted) || wanted.includes(labelText)) {
                        const associatedInput = lbl.querySelector("input, textarea");
                        if (associatedInput) {
                          console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Input found via reciprocal label match:`, lbl.innerText);
                          return associatedInput;
                        }
                      }
                    }

                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Input NOT found for "${text}"`);
                    return null;
                  };

                  const findDescriptionTextarea = async (fieldName = "Description") => {
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Looking for Description textarea`);

                    // Find container with "Description" text and textarea
                    const allElements = document.querySelectorAll("*");
                    for (const el of allElements) {
                      if (el.innerText && normalize(el.innerText) === "description") {
                        const textarea = el.querySelector("textarea");
                        if (textarea && visible(textarea)) {
                          console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Description textarea found via container text`);
                          return textarea;
                        }
                      }
                    }

                    // Fallback: find any visible textarea
                    const textareas = elements("textarea");
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Total textareas found:`, textareas.length);

                    if (textareas.length > 0) {
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Using first visible textarea as Description`);
                      return textareas[0];
                    }

                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Description textarea NOT found`);
                    return null;
                  };

                  const findCombobox = async (text, fieldName = "unknown") => {
                    const wanted = normalize(text);

                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Looking for combobox with text: "${text}"`);

                    // Target label[role="combobox"] elements with matching inner text
                    const found = elements(
                      'label[role="combobox"]'
                    ).find((el) => {
                      const textValue = normalize(el.innerText);
                      const aria = normalize(
                        el.getAttribute("aria-label")
                      );

                      return (
                        textValue === wanted ||
                        textValue.startsWith(wanted) ||
                        aria === wanted
                      );
                    });

                    if (found) {
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Combobox found:`, found.innerText);
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Combobox tag:`, found.tagName);
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Combobox role:`, found.getAttribute('role'));
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Combobox aria-label:`, found.getAttribute('aria-label'));
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Combobox id:`, found.id);
                      return found;
                    }

                    // Fallback: Try to find by aria-label directly on any element
                    const allElements = document.querySelectorAll('*');
                    for (const el of allElements) {
                      const aria = normalize(el.getAttribute('aria-label') || '');
                      if (aria === wanted || aria.startsWith(wanted)) {
                        const parentRole = el.getAttribute('role');
                        if (parentRole === 'combobox' || el.closest('[role="combobox"]')) {
                          console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Combobox found via aria-label fallback:`, aria);
                          console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Element tag:`, el.tagName);
                          console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Element role:`, parentRole);
                          return el.closest('[role="combobox"]') || el;
                        }
                      }
                    }

                    // Fallback: Look for elements with role="combobox" and check their labels
                    const allComboboxes = elements('[role="combobox"]');
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Total comboboxes on page:`, allComboboxes.length);
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Combobox labels:`, allComboboxes.map(cb => ({
                      text: cb.innerText?.substring(0, 30),
                      aria: cb.getAttribute('aria-label')?.substring(0, 30),
                      id: cb.id
                    })));

                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Combobox NOT found for "${text}"`);
                    return null;
                  };

                  const findScopedDropdownOptions = (combobox, fieldName = "unknown") => {
                    // Find the active dropdown associated with this combobox
                    // Look for listbox or dropdown container near the combobox
                    let dropdownContainer = null;
                    
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Starting dropdown search for combobox`);
                    
                    // Try to find a listbox in the parent hierarchy
                    let parent = combobox.parentElement;
                    let depth = 0;
                    while (parent && !dropdownContainer && depth < 10) {
                      const listbox = parent.querySelector('[role="listbox"]');
                      if (listbox && visible(listbox)) {
                        dropdownContainer = listbox;
                        console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Found listbox at depth ${depth}`);
                        break;
                      }
                      parent = parent.parentElement;
                      depth++;
                    }
                    
                    // If no listbox found, look for a nearby dropdown/div with options
                    if (!dropdownContainer) {
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] No listbox found, checking siblings`);
                      // Check siblings and nearby elements
                      const siblings = Array.from(combobox.parentElement?.children || []);
                      for (const sibling of siblings) {
                        if (sibling !== combobox && sibling.querySelector('[role="option"]')) {
                          dropdownContainer = sibling;
                          console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Found dropdown via sibling check`);
                          break;
                        }
                      }
                    }
                    
                    // If still no dropdown, try the combobox's parent itself
                    if (!dropdownContainer && combobox.parentElement) {
                      const optionsInParent = combobox.parentElement.querySelectorAll('[role="option"]');
                      if (optionsInParent.length > 0) {
                        dropdownContainer = combobox.parentElement;
                        console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Found dropdown in parent`);
                      }
                    }
                    
                    // Last resort: look for any visible listbox on the page
                    if (!dropdownContainer) {
                      const allListboxes = document.querySelectorAll('[role="listbox"]');
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Total listboxes on page:`, allListboxes.length);
                      for (const lb of allListboxes) {
                        if (visible(lb)) {
                          dropdownContainer = lb;
                          console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Using visible listbox as fallback`);
                          break;
                        }
                      }
                    }
                    
                    if (dropdownContainer) {
                      const scopedOptions = Array.from(dropdownContainer.querySelectorAll('[role="option"], [role="menuitem"]')).filter(el => visible(el));
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Active dropdown found: true`);
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Scoped options count: ${scopedOptions.length}`);
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Scoped option texts:`, scopedOptions.map(o => o.innerText));
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Dropdown container tag:`, dropdownContainer.tagName);
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Dropdown container role:`, dropdownContainer.getAttribute('role'));
                      return scopedOptions;
                    } else {
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Active dropdown found: false`);
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] DOM diagnostic - checking for any visible options`);
                      const allOptions = document.querySelectorAll('[role="option"], [role="menuitem"]');
                      const visibleOptions = Array.from(allOptions).filter(el => visible(el));
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Total visible options on page:`, visibleOptions.length);
                      if (visibleOptions.length > 0) {
                        console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Visible option texts:`, visibleOptions.map(o => o.innerText));
                      }
                      return [];
                    }
                  };

                  const findOption = async (values, fieldName = "unknown") => {
                    const wanted = values
                      .filter(
                        (value) =>
                          value !== undefined &&
                          value !== null
                      )
                      .map(normalize);

                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Looking for option with values:`, wanted);

                    const allOptions = elements(
                      '[role="option"], [role="menuitem"]'
                    );
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Total options available:`, allOptions.length);
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Option texts:`, allOptions.map(opt => opt.innerText));

                    const found = allOptions.find((el) => {
                      const text = normalize(el.innerText);

                      return wanted.some(
                        (value) =>
                          text === value ||
                          text.startsWith(value)
                      );
                    });

                    if (found) {
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Option found:`, found.innerText);
                    } else {
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Option NOT found for values:`, wanted);
                    }

                    return found;
                  };

                  const waitFor = async (
                    finder,
                    timeout = 15000
                  ) => {
                    const start = Date.now();

                    while (Date.now() - start < timeout) {
                      const found = await finder();

                      if (found) {
                        return found;
                      }

                      await sleep(300);
                    }

                    return null;
                  };

                  const setValue = async (element, value, fieldName = "unknown", requireAutocomplete = false) => {
                    if (!element) {
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] No element found to set value`);
                      return false;
                    }

                    const stringValue = String(value ?? "");
                    const previousValue = element.value;

                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Setting value`);
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Element type:`, element.tagName);
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Element selector:`, element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.getAttribute('name') || 'unknown');
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Previous value:`, previousValue);
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Attempted value:`, stringValue);
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Requires autocomplete:`, requireAutocomplete);

                    element.focus();

                    // For React-controlled components, we need to use the native setter and dispatch events
                    // with proper event properties to trigger React's state updates
                    const proto =
                      element instanceof HTMLTextAreaElement
                        ? HTMLTextAreaElement.prototype
                        : HTMLInputElement.prototype;

                    const setter =
                      Object.getOwnPropertyDescriptor(
                        proto,
                        "value"
                      )?.set;

                    if (!setter) {
                      console.error(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Could not get native value setter`);
                      return false;
                    }

                    // Use native setter to update the value
                    setter.call(element, stringValue);
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Native setter called successfully`);

                    // Create and dispatch input event with proper properties for React
                    const inputEvent = new InputEvent('input', {
                      bubbles: true,
                      cancelable: true,
                      data: stringValue,
                      inputType: 'insertText',
                    });
                    element.dispatchEvent(inputEvent);
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] InputEvent dispatched with data:`, stringValue);

                    // Create and dispatch change event with proper properties
                    const changeEvent = new Event('change', {
                      bubbles: true,
                      cancelable: true,
                    });
                    element.dispatchEvent(changeEvent);
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Change event dispatched`);

                    // Also dispatch blur event to trigger form validation/state updates
                    const blurEvent = new Event('blur', {
                      bubbles: true,
                      cancelable: true,
                    });
                    element.dispatchEvent(blurEvent);
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Blur event dispatched`);

                    // Handle autocomplete fields (Make/Model/Location)
                    if (requireAutocomplete) {
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Waiting for autocomplete options...`);
                      await sleep(1000);

                      // Look for autocomplete options/listbox
                      const listbox = document.querySelector('[role="listbox"]');
                      if (listbox) {
                        console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Autocomplete listbox found`);
                        const options = listbox.querySelectorAll('[role="option"]');
                        console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Options count:`, options.length);
                        console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Option texts:`, Array.from(options).map(opt => opt.innerText));

                        // Field-specific diagnostics
                        if (fieldName === "Make") {
                          console.log(`FACEBOOK MAKE TRACE: active dropdown found: true`);
                          console.log(`FACEBOOK MAKE TRACE: scoped options:`, Array.from(options).map(opt => opt.innerText));
                        }
                        if (fieldName === "Location") {
                          console.log(`FACEBOOK LOCATION TRACE: dropdown found: true`);
                          console.log(`FACEBOOK LOCATION TRACE: dropdown options:`, Array.from(options).map(opt => opt.innerText));
                        }

                        if (options.length > 0) {
                          // Try to find matching option
                          const wanted = normalize(stringValue);
                          
                          // Field-specific option filtering
                          let matchingOption = null;
                          
                          if (fieldName === "Make") {
                            // Filter out non-vehicle options (business pages, Facebook pages, etc.)
                            const vehicleOptions = Array.from(options).filter(opt => {
                              const optText = normalize(opt.innerText);
                              // Reject options that look like Facebook pages/businesses
                              const nonVehiclePatterns = [
                                /followers/,
                                /followers$/,
                                /\. ·/,
                                /motor philippines/i,
                                /wholesaler/i,
                                /dealer/i,
                                /automotive/i,
                                /facebook/i,
                                /page/i
                              ];
                              return !nonVehiclePatterns.some(pattern => pattern.test(optText));
                            });
                            
                            console.log("FACEBOOK MAKE TRACE: dropdown options with roles:", vehicleOptions.map(opt => ({
                              text: opt.innerText,
                              role: opt.getAttribute('role')
                            })));
                            
                            matchingOption = vehicleOptions.find(opt => {
                              const optText = normalize(opt.innerText);
                              return optText === wanted || optText.startsWith(wanted);
                            });
                            
                            if (matchingOption) {
                              console.log("FACEBOOK MAKE TRACE: candidate option text:", matchingOption.innerText);
                              console.log("FACEBOOK MAKE TRACE: candidate option type: vehicle Make");
                            } else {
                              console.log("FACEBOOK MAKE TRACE: rejected non-vehicle options available");
                              // Fallback to first vehicle option
                              if (vehicleOptions.length > 0) {
                                matchingOption = vehicleOptions[0];
                                console.log("FACEBOOK MAKE TRACE: using fallback vehicle option:", matchingOption.innerText);
                              }
                            }
                          } else {
                            // Standard matching for other fields
                            matchingOption = Array.from(options).find(opt => {
                              const optText = normalize(opt.innerText);
                              return optText === wanted || optText.startsWith(wanted);
                            });
                          }

                          if (matchingOption) {
                            console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Selecting matching autocomplete option:`, matchingOption.innerText);
                            // Field-specific diagnostics
                            if (fieldName === "Make") {
                              console.log(`FACEBOOK MAKE TRACE: exact option:`, matchingOption.innerText);
                              console.log(`FACEBOOK MAKE TRACE: clicking option:`, matchingOption.innerText);
                            }
                            if (fieldName === "Location") {
                              console.log(`FACEBOOK LOCATION TRACE: clicking option:`, matchingOption.innerText);
                            }
                            
                            // Click the option to trigger Facebook's selection handler
                            matchingOption.click();
                            
                            // Wait for Facebook's state to update
                            await sleep(700);
                            
                            // Refocus the input to ensure proper state
                            element.focus();
                            await sleep(200);
                            
                            // Dispatch blur again to trigger final state update
                            element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                            await sleep(300);
                          } else {
                            console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] No matching autocomplete option found, using first option`);
                            // Field-specific diagnostics
                            if (fieldName === "Make") {
                              console.log(`FACEBOOK MAKE TRACE: clicking option:`, options[0].innerText, "(fallback - no match)");
                            }
                            if (fieldName === "Location") {
                              console.log(`FACEBOOK LOCATION TRACE: clicking option:`, options[0].innerText, "(fallback - no match)");
                            }
                            options[0].click();
                            await sleep(700);
                            element.focus();
                            await sleep(200);
                            element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                            await sleep(300);
                          }
                        } else {
                          console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] No autocomplete options available`);
                          // Field-specific diagnostics
                          if (fieldName === "Make") {
                            console.log(`FACEBOOK MAKE TRACE: scoped options: [] (no options available)`);
                          }
                          if (fieldName === "Location") {
                            console.log(`FACEBOOK LOCATION TRACE: dropdown options: [] (no options available)`);
                          }
                        }
                      } else {
                        console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] No autocomplete listbox found`);
                        // Field-specific diagnostics
                        if (fieldName === "Make") {
                          console.log(`FACEBOOK MAKE TRACE: active dropdown found: false`);
                        }
                        if (fieldName === "Location") {
                          console.log(`FACEBOOK LOCATION TRACE: dropdown found: false`);
                        }
                      }
                    }

                    element.blur();

                    // Field-specific selection commitment verification
                    if (fieldName === "Make") {
                      const finalValue = element.value;
                      const selectionCommitted = finalValue.toLowerCase().includes(stringValue.toLowerCase());
                      console.log(`FACEBOOK MAKE TRACE: selection verified:`, selectionCommitted);
                      console.log(`FACEBOOK MAKE TRACE: final verification - desired:`, stringValue, "actual:", finalValue);
                    }
                    if (fieldName === "Location") {
                      const finalValue = element.value;
                      const selectionCommitted = finalValue.toLowerCase().includes(stringValue.toLowerCase());
                      console.log(`FACEBOOK LOCATION TRACE: selection verified:`, selectionCommitted);
                      console.log(`FACEBOOK LOCATION TRACE: final verification - desired:`, stringValue, "actual:", finalValue);
                    }

                    const finalValue = element.value;
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Final value after events:`, finalValue);
                    
                    // For price, compare normalized numeric values to handle currency formatting
                    let valueAccepted = finalValue === stringValue;
                    if (!valueAccepted && fieldName === "Price") {
                      const normalizedFinal = String(finalValue).replace(/[^0-9.-]/g, '');
                      const normalizedString = String(stringValue).replace(/[^0-9.-]/g, '');
                      valueAccepted = normalizedFinal === normalizedString;
                      console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Numeric comparison: "${normalizedFinal}" === "${normalizedString}" =`, valueAccepted);
                    }
                    console.log(`FACEBOOK INJECTED SCRIPT: [${fieldName}] Value accepted:`, valueAccepted);

                    return valueAccepted;
                  };

                  result.diagnostics.before = snapshot();
                  console.log("FACEBOOK INJECTED SCRIPT: Before snapshot - inputs:", result.diagnostics.before.inputs, "comboboxes:", result.diagnostics.before.comboboxes);

                  /*
                   * VEHICLE TYPE
                   * Dynamic selection based on vehicle body type
                   */
                  console.log("FACEBOOK INJECTED SCRIPT: ========== FILLING VEHICLE TYPE ==========");
                  console.log("VT_CALL_DEBUG_2026_09_21_A: background.js injected script Vehicle Type handler");
                  console.log("VEHICLE TYPE DEBUG: background.js Vehicle Type VERSION = BG_DEBUG_2026_09_21_A");

                  // Generic vehicle type - use source body type directly
                  const sourceBodyType = vehicle.body || "";
                  const bodyLower = sourceBodyType.toLowerCase();

                  console.log("VEHICLE TYPE DEBUG: source =", sourceBodyType);
                  console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] Source body type:", sourceBodyType);

                  if (!sourceBodyType) {
                    console.warn("FACEBOOK INJECTED SCRIPT: [Vehicle Type] No source body type provided");
                    result.fields.vehicleType = false;
                  } else {
                    const vehicleType = await waitFor(
                      async () => findCombobox("Vehicle type", "Vehicle Type"),
                      10000
                    );

                    if (vehicleType) {
                      console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] Clicking combobox");
                      vehicleType.click();

                      await sleep(800);

                      // Inspect actual Facebook options
                      let option = null;
                      let pollCount = 0;
                      const maxPolls = 40;

                      while (pollCount < maxPolls && !option) {
                        await sleep(200);
                        pollCount++;

                        const scopedOptions = findScopedDropdownOptions(vehicleType, "Vehicle Type");
                        if (scopedOptions.length > 0) {
                          console.log(`FACEBOOK INJECTED SCRIPT: [Vehicle Type] Options appeared at poll ${pollCount}`);
                          console.log("FACEBOOK VEHICLE TYPE TRACE: dropdown options:", scopedOptions.map(opt => opt.innerText));
                          console.log("VEHICLE TYPE DEBUG: candidate options =", scopedOptions.map((opt, index) => ({
                            index: index,
                            textContent: opt.innerText,
                            tagName: opt.tagName,
                            role: opt.getAttribute('role'),
                            className: opt.className
                          })));

                          // Dynamic matching - try to match source body type against actual Facebook options
                          option = scopedOptions.find(opt => {
                            const optText = normalize(opt.innerText);
                            const sourceNorm = normalize(sourceBodyType);

                            console.log(`FACEBOOK VEHICLE TYPE TRACE: Testing option "${optText}" against source "${sourceBodyType}"`);

                            // Try exact match
                            if (optText === sourceNorm) {
                              console.log(`FACEBOOK VEHICLE TYPE TRACE: Exact match found`);
                              return true;
                            }

                            // Try case-insensitive match
                            if (optText.toLowerCase() === sourceNorm.toLowerCase()) {
                              console.log(`FACEBOOK VEHICLE TYPE TRACE: Case-insensitive match found`);
                              return true;
                            }

                            // Try includes match
                            if (optText.toLowerCase().includes(sourceNorm.toLowerCase()) ||
                                sourceNorm.toLowerCase().includes(optText.toLowerCase())) {
                              console.log(`FACEBOOK VEHICLE TYPE TRACE: Includes match found`);
                              return true;
                            }

                            // Try partial match for common body types
                            if (bodyLower.includes("suv") && optText.toLowerCase().includes("suv")) {
                              console.log(`FACEBOOK VEHICLE TYPE TRACE: SUV partial match found`);
                              return true;
                            }
                            if (bodyLower.includes("truck") && optText.toLowerCase().includes("truck")) {
                              console.log(`FACEBOOK VEHICLE TYPE TRACE: Truck partial match found`);
                              return true;
                            }
                            if (bodyLower.includes("sedan") && optText.toLowerCase().includes("sedan")) {
                              console.log(`FACEBOOK VEHICLE TYPE TRACE: Sedan partial match found`);
                              return true;
                            }
                            if (bodyLower.includes("car") && optText.toLowerCase().includes("car")) {
                              console.log(`FACEBOOK VEHICLE TYPE TRACE: Car partial match found`);
                              return true;
                            }
                            if (bodyLower.includes("van") && optText.toLowerCase().includes("van")) {
                              console.log(`FACEBOOK VEHICLE TYPE TRACE: Van partial match found`);
                              return true;
                            }

                            // Fallback: SUV/Crossover/Van are all types of Cars, so if Facebook only has "Cars", use that
                            if ((bodyLower.includes("suv") || bodyLower.includes("crossover") || bodyLower.includes("van")) && optText.toLowerCase().includes("car")) {
                              console.log(`FACEBOOK VEHICLE TYPE TRACE: SUV/Crossover/Van ? Cars fallback match found`);
                              return true;
                            }

                            console.log(`FACEBOOK VEHICLE TYPE TRACE: No match for option "${optText}"`);
                            return false;
                          });

                          if (option) {
                            console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] Matching option found:", option.innerText);
                            console.log("VEHICLE TYPE DEBUG: matched option =", option.innerText);
                          } else {
                            console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] Options available but no match for:", sourceBodyType);
                            console.log("VEHICLE TYPE DEBUG: no match found for source =", sourceBodyType);
                          }
                        }
                      }

                      if (!option) {
                        console.log("VEHICLE TYPE DEBUG: no option found after polling all attempts");
                        console.log("VEHICLE TYPE DEBUG: global document search for vehicle type options...");

                        // Global search for options in case they're rendered in a portal/overlay
                        const globalOptionSelectors = [
                          '[role="option"]',
                          '[role="menuitem"]',
                          '[role="listbox"] [role="button"]',
                          '[role="listbox"] button',
                          '[role="listbox"] [tabindex="0"]'
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
                            className: item.className,
                            visible: rect.width > 0 && rect.height > 0
                          };
                        }));
                      }

                      if (option) {
                        console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] Clicking option");
                        option.click();
                        await sleep(500);

                        // Verify the selection with multiple methods
                        const comboboxText = vehicleType.innerText || vehicleType.value;
                        const comboboxInput = vehicleType.querySelector('input');
                        const inputValue = comboboxInput ? comboboxInput.value : '';

                        console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] Combobox text after selection:", comboboxText);
                        console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] Input value after selection:", inputValue);
                        console.log("FACEBOOK VEHICLE TYPE TRACE: selection verified - text:", comboboxText, "input:", inputValue);

                        // Verify selection committed to Facebook state
                        const textMatch = comboboxText.toLowerCase().includes(sourceBodyType.toLowerCase());
                        const inputMatch = inputValue.toLowerCase().includes(sourceBodyType.toLowerCase());
                        const verified = textMatch || inputMatch;

                        if (verified) {
                          console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] Selection verified");
                          result.fields.vehicleType = true;
                          console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] FILLED SUCCESSFULLY");
                          console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] Source:", sourceBodyType, "? Facebook:", comboboxText);
                          console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] COMMITTED STATE - text:", comboboxText, "input:", inputValue);
                        } else {
                          console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] Selection verification failed");
                          result.fields.vehicleType = false;
                          console.error("FACEBOOK INJECTED SCRIPT: [Vehicle Type] SELECTION VERIFICATION FAILED");
                          console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] Expected:", sourceBodyType);
                          console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] Actual text:", comboboxText);
                          console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] Actual input:", inputValue);
                          console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] COMMITTED STATE - FAILED");
                        }
                      } else {
                        result.fields.vehicleType = false;
                        console.error("FACEBOOK INJECTED SCRIPT: [Vehicle Type] OPTION NOT FOUND after polling");
                        console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] Source was:", sourceBodyType);
                        console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] Available options:", scopedOptions.map(opt => opt.innerText));
                        console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Type] COMMITTED STATE - FAILED - No matching option");
                      }

                      await sleep(1000);
                    } else {
                      result.fields.vehicleType = false;
                      console.error("FACEBOOK INJECTED SCRIPT: [Vehicle Type] COMBOBOX NOT FOUND");
                    }
                  }

                  // SEQUENTIAL STATE VERIFICATION: Verify Vehicle Type still committed
                  console.log("FACEBOOK INJECTED SCRIPT: ========== SEQUENTIAL STATE CHECK AFTER VEHICLE TYPE ==========");
                  const vehicleTypeCheck = await waitFor(
                    async () => findCombobox("Vehicle type", "Vehicle Type"),
                    5000
                  );
                  if (vehicleTypeCheck) {
                    const vehicleTypeCheckText = vehicleTypeCheck.innerText || vehicleTypeCheck.value;
                    const vehicleTypeCheckInput = vehicleTypeCheck.querySelector('input');
                    const vehicleTypeCheckInputValue = vehicleTypeCheckInput ? vehicleTypeCheckInput.value : '';
                    const vehicleTypeStillCommitted = vehicleTypeCheckText.toLowerCase().includes(sourceBodyType.toLowerCase()) ||
                                               vehicleTypeCheckInputValue.toLowerCase().includes(sourceBodyType.toLowerCase());
                    console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Vehicle Type still committed:", vehicleTypeStillCommitted);
                    console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Vehicle Type text:", vehicleTypeCheckText);
                    console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Vehicle Type input:", vehicleTypeCheckInputValue);
                    if (!vehicleTypeStillCommitted) {
                      console.error("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] SEQUENTIAL_STATE_FAIL - Vehicle Type was reset");
                    }
                  }

                  /*
                   * YEAR
                   */
                  if (vehicle.year) {
                    console.log("FACEBOOK INJECTED SCRIPT: ========== FILLING YEAR ==========");
                    console.log("FACEBOOK INJECTED SCRIPT: [Year] Value to fill:", vehicle.year);

                    // Diagnostic: Trace Year execution path
                    console.log("FACEBOOK YEAR TRACE: entered Year block");
                    console.log("FACEBOOK YEAR TRACE: findScopedDropdownOptions reference:", typeof findScopedDropdownOptions);
                    console.log("FACEBOOK YEAR TRACE: findOption reference:", typeof findOption);

                    const year = await waitFor(
                      async () => findCombobox("Year", "Year"),
                      10000
                    );

                    if (year) {
                      console.log("FACEBOOK YEAR TRACE: combobox found = true");
                      console.log("FACEBOOK INJECTED SCRIPT: [Year] Clicking combobox");
                      year.click();

                      // Poll for dropdown options to appear (Facebook renders them asynchronously)
                      console.log("FACEBOOK INJECTED SCRIPT: [Year] Waiting for dropdown options to render...");
                      console.log("FACEBOOK YEAR TRACE: about to call findScopedDropdownOptions");
                      console.log("FACEBOOK YEAR TRACE: findScopedDropdownOptions.toString():", findScopedDropdownOptions.toString().substring(0, 200));
                      console.log("FACEBOOK YEAR TRACE: findOption.toString():", findOption.toString().substring(0, 200));
                      console.log("FACEBOOK INJECTED SCRIPT: [Year] USING SCOPED DROPDOWN LOOKUP");
                      let option = null;
                      let pollCount = 0;
                      const maxPolls = 40; // 40 * 200ms = 8 seconds max
                      
                      while (pollCount < maxPolls && !option) {
                        await sleep(200);
                        pollCount++;
                        
                        // Check for scoped options associated with this combobox
                        const scopedOptions = findScopedDropdownOptions(year, "Year");
                        if (scopedOptions.length > 0) {
                          console.log(`FACEBOOK INJECTED SCRIPT: [Year] Options appeared at poll ${pollCount}`);
                          
                          // Try to find the matching year option
                          const yearValue = String(vehicle.year);
                          option = scopedOptions.find(opt => {
                            const optText = normalize(opt.innerText);
                            return optText === normalize(yearValue) || optText.startsWith(normalize(yearValue));
                          });
                          
                          if (option) {
                            console.log("FACEBOOK INJECTED SCRIPT: [Year] Matching option found:", option.innerText);
                          } else {
                            console.log("FACEBOOK INJECTED SCRIPT: [Year] Options available but no match for:", yearValue);
                          }
                        }
                      }

                      if (option) {
                        console.log("FACEBOOK INJECTED SCRIPT: [Year] Clicking option");
                        option.click();
                        await sleep(700); // Increased wait time for React state update
                        
                        // Verify the selection
                        const yearText = year.innerText || year.value;
                        console.log("FACEBOOK INJECTED SCRIPT: [Year] Combobox text after selection:", yearText);
                        
                        if (yearText.includes(String(vehicle.year))) {
                          console.log("FACEBOOK INJECTED SCRIPT: [Year] Selection verified");
                          result.fields.year = true;
                          console.log("FACEBOOK INJECTED SCRIPT: [Year] FILLED SUCCESSFULLY");
                          
                          // Blur to trigger final state commit
                          year.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                          await sleep(300);
                        } else {
                          console.log("FACEBOOK INJECTED SCRIPT: [Year] Selection verification failed");
                          result.fields.year = false;
                          console.error("FACEBOOK INJECTED SCRIPT: [Year] SELECTION VERIFICATION FAILED");
                        }
                      } else {
                        result.fields.year = false;
                        console.error("FACEBOOK INJECTED SCRIPT: [Year] OPTION NOT FOUND after polling");
                      }

                      await sleep(1000);
                    } else {
                      result.fields.year = false;
                      console.error("FACEBOOK INJECTED SCRIPT: [Year] COMBOBOX NOT FOUND");
                    }
                  } else {
                    console.log("FACEBOOK INJECTED SCRIPT: [Year] No vehicle year provided, skipping");
                  }

                  // SEQUENTIAL STATE VERIFICATION: Verify Vehicle Type + Year still committed
                  console.log("FACEBOOK INJECTED SCRIPT: ========== SEQUENTIAL STATE CHECK AFTER YEAR ==========");
                  const vehicleTypeCheck2 = await waitFor(
                    async () => findCombobox("Vehicle type", "Vehicle Type"),
                    5000
                  );
                  if (vehicleTypeCheck2) {
                    const vehicleTypeCheckText2 = vehicleTypeCheck2.innerText || vehicleTypeCheck2.value;
                    const vehicleTypeCheckInput2 = vehicleTypeCheck2.querySelector('input');
                    const vehicleTypeCheckInputValue2 = vehicleTypeCheckInput2 ? vehicleTypeCheckInput2.value : '';
                    const vehicleTypeStillCommitted2 = vehicleTypeCheckText2.toLowerCase().includes(sourceBodyType.toLowerCase()) ||
                                                vehicleTypeCheckInputValue2.toLowerCase().includes(sourceBodyType.toLowerCase());
                    console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Vehicle Type still committed after Year:", vehicleTypeStillCommitted2);
                    if (!vehicleTypeStillCommitted2) {
                      console.error("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] SEQUENTIAL_STATE_FAIL - Vehicle Type was reset by Year operation");
                    }
                  }

                  const yearCheck = await waitFor(
                    async () => findCombobox("Year", "Year"),
                    5000
                  );
                  if (yearCheck) {
                    const yearCheckText = yearCheck.innerText || yearCheck.value;
                    const yearCheckInput = yearCheck.querySelector('input');
                    const yearCheckInputValue = yearCheckInput ? yearCheckInput.value : '';
                    const yearStillCommitted = yearCheckText.includes(String(vehicle.year)) || yearCheckInputValue.includes(String(vehicle.year));
                    console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Year still committed:", yearStillCommitted);
                    console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Year text:", yearCheckText);
                    console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Year input:", yearCheckInputValue);
                    if (!yearStillCommitted) {
                      console.error("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] SEQUENTIAL_STATE_FAIL - Year was reset immediately");
                    }
                  }

                  /*
                   * MAKE
                   */
                  if (vehicle.make) {
                    console.log("FACEBOOK INJECTED SCRIPT: ========== FILLING MAKE ==========");
                    console.log("FACEBOOK INJECTED SCRIPT: [Make] Value to fill:", vehicle.make);
                    console.log("FACEBOOK MAKE TRACE: Source make value:", vehicle.make);
                    console.log("[MAKE] Opening Make field");

                    // Try combobox first, then fallback to input
                    const makeCombobox = await waitFor(
                      async () => findCombobox("Make", "Make"),
                      10000
                    );

                    console.log("FACEBOOK INJECTED SCRIPT: [Make] makeCombobox found:", !!makeCombobox);
                    if (makeCombobox) {
                      console.log("FACEBOOK INJECTED SCRIPT: [Make] makeCombobox tagName:", makeCombobox.tagName);
                      console.log("FACEBOOK INJECTED SCRIPT: [Make] makeCombobox role:", makeCombobox.getAttribute('role'));
                      console.log("FACEBOOK INJECTED SCRIPT: [Make] makeCombobox aria-label:", makeCombobox.getAttribute('aria-label'));
                    }

                    if (makeCombobox) {
                      console.log("[MAKE] Clicking combobox to open dropdown");
                      makeCombobox.click();
                      await sleep(800);

                      // Poll for scoped dropdown options
                      console.log("[MAKE] Looking for option:", vehicle.make);
                      let makeOption = null;
                      let pollCount = 0;
                      const maxPolls = 60; // Increased to 60 (12 seconds)
                      let scopedOptions = [];
                      
                      while (pollCount < maxPolls && !makeOption) {
                        await sleep(200);
                        pollCount++;
                        
                        scopedOptions = findScopedDropdownOptions(makeCombobox, "Make");
                        if (scopedOptions.length > 0) {
                          console.log(`FACEBOOK INJECTED SCRIPT: [Make] Options appeared at poll ${pollCount}`);
                          console.log("FACEBOOK MAKE TRACE: dropdown options:", scopedOptions.map(opt => opt.innerText));
                          
                          makeOption = scopedOptions.find(opt => {
                            const optText = normalize(opt.innerText);
                            const wanted = normalize(vehicle.make);
                            // Try exact match first, then case-insensitive, then starts-with
                            return optText === wanted || 
                                   optText.toLowerCase() === wanted.toLowerCase() ||
                                   optText.startsWith(wanted) ||
                                   optText.toLowerCase().startsWith(wanted.toLowerCase());
                          });
                          
                          if (makeOption) {
                            console.log("[MAKE] Matching option found:", makeOption.innerText);
                            console.log("FACEBOOK MAKE TRACE: Selected option text:", makeOption.innerText);
                            console.log("FACEBOOK MAKE TRACE: Selected option role:", makeOption.getAttribute('role'));
                          } else {
                            console.log("FACEBOOK INJECTED SCRIPT: [Make] Options available but no match for:", vehicle.make);
                            console.log("FACEBOOK MAKE TRACE: Wanted:", normalize(vehicle.make));
                            console.log("FACEBOOK MAKE TRACE: Available:", scopedOptions.map(opt => normalize(opt.innerText)));
                          }
                        }
                      }

                      if (makeOption) {
                        console.log("[MAKE] Clicking option:", makeOption.innerText);
                        makeOption.click();
                        await sleep(700); // Increased wait time for React state update
                        
                        // Verify the selection with multiple methods
                        const comboboxText = makeCombobox.innerText || makeCombobox.value;
                        const comboboxInput = makeCombobox.querySelector('input');
                        const inputValue = comboboxInput ? comboboxInput.value : '';
                        
                        console.log("[MAKE] Selected value (innerText):", comboboxText);
                        console.log("[MAKE] Selected value (input.value):", inputValue);
                        console.log("FACEBOOK INJECTED SCRIPT: [Make] Combobox text after selection:", comboboxText);
                        console.log("FACEBOOK MAKE TRACE: Verification - wanted:", vehicle.make.toLowerCase());
                        console.log("FACEBOOK MAKE TRACE: Verification - comboboxText:", comboboxText.toLowerCase());
                        console.log("FACEBOOK MAKE TRACE: Verification - inputValue:", inputValue.toLowerCase());
                        
                        // Check both combobox text and input value
                        const textMatch = comboboxText.toLowerCase().includes(vehicle.make.toLowerCase());
                        const inputMatch = inputValue.toLowerCase().includes(vehicle.make.toLowerCase());
                        const verified = textMatch || inputMatch;
                        
                        if (verified) {
                          console.log("FACEBOOK INJECTED SCRIPT: [Make] Selection verified");
                          result.fields.make = true;
                          console.log("[MAKE] SUCCESS");
                          console.log("FACEBOOK INJECTED SCRIPT: [Make] FILLED SUCCESSFULLY");
                          console.log("FACEBOOK MAKE VERIFICATION: TARGET =", vehicle.make);
                          console.log("FACEBOOK MAKE VERIFICATION: COMBO TEXT =", comboboxText);
                          console.log("FACEBOOK MAKE VERIFICATION: INPUT VALUE =", inputValue);
                          console.log("FACEBOOK MAKE VERIFICATION: SELECTED OPTION =", makeOption ? makeOption.innerText : "NONE");
                          console.log("FACEBOOK MAKE VERIFICATION: RESULT = PASS");
                          
                          // Additional state stabilization: blur the combobox to trigger final state commit
                          makeCombobox.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                          await sleep(300);
                        } else {
                          console.log("FACEBOOK INJECTED SCRIPT: [Make] Selection verification failed");
                          result.fields.make = false;
                          console.error("FACEBOOK INJECTED SCRIPT: [Make] SELECTION VERIFICATION FAILED");
                          console.log("FACEBOOK MAKE VERIFICATION: TARGET =", vehicle.make);
                          console.log("FACEBOOK MAKE VERIFICATION: COMBO TEXT =", comboboxText);
                          console.log("FACEBOOK MAKE VERIFICATION: INPUT VALUE =", inputValue);
                          console.log("FACEBOOK MAKE VERIFICATION: RESULT = FAIL");
                        }
                      } else {
                        result.fields.make = false;
                        console.error("FACEBOOK INJECTED SCRIPT: [Make] OPTION NOT FOUND after polling");
                        console.log("FACEBOOK INJECTED SCRIPT: [Make] Visible dropdown options:", scopedOptions.map(opt => opt.innerText));
                        console.log("FACEBOOK MAKE VERIFICATION: TARGET =", vehicle.make);
                        console.log("FACEBOOK MAKE VERIFICATION: AVAILABLE OPTIONS =", scopedOptions.map(opt => opt.innerText));
                        console.log("FACEBOOK MAKE VERIFICATION: RESULT = FAIL (no matching option)");
                      }
                      await sleep(1000);
                    } else {
                      console.log("FACEBOOK INJECTED SCRIPT: [Make] Combobox not found, trying as input with autocomplete");
                      // Fallback: Try as input with autocomplete
                      const makeInput = await waitFor(
                        async () => findInputByLabel("Make", "Make"),
                        5000
                      );
                      
                      if (makeInput) {
                        console.log("FACEBOOK INJECTED SCRIPT: [Make] Make input found, using autocomplete");
                        result.fields.make = await setValue(
                          makeInput,
                          vehicle.make,
                          "Make",
                          true // requires autocomplete handling
                        );
                        
                        if (result.fields.make) {
                          console.log("FACEBOOK INJECTED SCRIPT: [Make] FILLED SUCCESSFULLY via input");
                        } else {
                          console.error("FACEBOOK INJECTED SCRIPT: [Make] FILL FAILED via input");
                        }
                      } else {
                        result.fields.make = false;
                        console.error("FACEBOOK INJECTED SCRIPT: [Make] INPUT NOT FOUND");
                      }
                    }
                  } else {
                    console.log("FACEBOOK INJECTED SCRIPT: [Make] No vehicle make provided, skipping");
                  }

                  // SEQUENTIAL STATE VERIFICATION: Verify Vehicle Type + Year + Make still committed
                  console.log("FACEBOOK INJECTED SCRIPT: ========== SEQUENTIAL STATE CHECK AFTER MAKE ==========");
                  const vehicleTypeCheck3 = await waitFor(
                    async () => findCombobox("Vehicle type", "Vehicle Type"),
                    5000
                  );
                  if (vehicleTypeCheck3) {
                    const vehicleTypeCheckText3 = vehicleTypeCheck3.innerText || vehicleTypeCheck3.value;
                    const vehicleTypeCheckInput3 = vehicleTypeCheck3.querySelector('input');
                    const vehicleTypeCheckInputValue3 = vehicleTypeCheckInput3 ? vehicleTypeCheckInput3.value : '';
                    const vehicleTypeStillCommitted3 = vehicleTypeCheckText3.toLowerCase().includes(sourceBodyType.toLowerCase()) ||
                                                vehicleTypeCheckInputValue3.toLowerCase().includes(sourceBodyType.toLowerCase());
                    console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Vehicle Type still committed after Make:", vehicleTypeStillCommitted3);
                    if (!vehicleTypeStillCommitted3) {
                      console.error("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] SEQUENTIAL_STATE_FAIL - Vehicle Type was reset by Make operation");
                    }
                  }

                  const yearCheck2 = await waitFor(
                    async () => findCombobox("Year", "Year"),
                    5000
                  );
                  if (yearCheck2) {
                    const yearCheckText2 = yearCheck2.innerText || yearCheck2.value;
                    const yearCheckInput2 = yearCheck2.querySelector('input');
                    const yearCheckInputValue2 = yearCheckInput2 ? yearCheckInput2.value : '';
                    const yearStillCommitted2 = yearCheckText2.includes(String(vehicle.year)) || yearCheckInputValue2.includes(String(vehicle.year));
                    console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Year still committed after Make:", yearStillCommitted2);
                    if (!yearStillCommitted2) {
                      console.error("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] SEQUENTIAL_STATE_FAIL - Year was reset by Make operation");
                    }
                  }

                  const makeCheck = await waitFor(
                    async () => findCombobox("Make", "Make"),
                    5000
                  );
                  if (makeCheck) {
                    const makeCheckText = makeCheck.innerText || makeCheck.value;
                    const makeCheckInput = makeCheck.querySelector('input');
                    const makeCheckInputValue = makeCheckInput ? makeCheckInput.value : '';
                    const makeStillCommitted = makeCheckText.toLowerCase().includes(vehicle.make.toLowerCase()) ||
                                          makeCheckInputValue.toLowerCase().includes(vehicle.make.toLowerCase());
                    console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Make still committed:", makeStillCommitted);
                    console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Make text:", makeCheckText);
                    console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Make input:", makeCheckInputValue);
                    if (!makeStillCommitted) {
                      console.error("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] SEQUENTIAL_STATE_FAIL - Make was reset immediately");
                    }
                  }

                /*
                 * MODEL
                 */
                if (vehicle.model) {
                  console.log("FACEBOOK INJECTED SCRIPT: ========== FILLING MODEL ==========");
                  console.log("FACEBOOK INJECTED SCRIPT: [Model] Value to fill:", vehicle.model);

                  // Model is a text input with autocomplete, not a combobox
                  const modelInput = await waitFor(
                    async () => findInputByLabel("Model", "Model"),
                    10000
                  );

                  result.fields.model = await setValue(
                    modelInput,
                    vehicle.model,
                    "Model",
                    true // requires autocomplete handling
                  );

                  if (result.fields.model) {
                    console.log("FACEBOOK INJECTED SCRIPT: [Model] ✓ FILLED SUCCESSFULLY");
                  } else {
                    console.error("FACEBOOK INJECTED SCRIPT: [Model] ✗ FILL FAILED");
                  }

                  await sleep(500);
                } else {
                  console.log("FACEBOOK INJECTED SCRIPT: [Model] No vehicle model provided, skipping");
                }

                // SEQUENTIAL STATE VERIFICATION: Verify Vehicle Type + Year + Make + Model still committed
                console.log("FACEBOOK INJECTED SCRIPT: ========== SEQUENTIAL STATE CHECK AFTER MODEL ==========");
                const vehicleTypeCheck4 = await waitFor(
                  async () => findCombobox("Vehicle type", "Vehicle Type"),
                  5000
                );
                if (vehicleTypeCheck4) {
                  const vehicleTypeCheckText4 = vehicleTypeCheck4.innerText || vehicleTypeCheck4.value;
                  const vehicleTypeCheckInput4 = vehicleTypeCheck4.querySelector('input');
                  const vehicleTypeCheckInputValue4 = vehicleTypeCheckInput4 ? vehicleTypeCheckInput4.value : '';
                  const vehicleTypeStillCommitted4 = vehicleTypeCheckText4.toLowerCase().includes(sourceBodyType.toLowerCase()) ||
                                              vehicleTypeCheckInputValue4.toLowerCase().includes(sourceBodyType.toLowerCase());
                  console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Vehicle Type still committed after Model:", vehicleTypeStillCommitted4);
                  if (!vehicleTypeStillCommitted4) {
                    console.error("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] SEQUENTIAL_STATE_FAIL - Vehicle Type was reset by Model operation");
                  }
                }

                const yearCheck3 = await waitFor(
                  async () => findCombobox("Year", "Year"),
                  5000
                );
                if (yearCheck3) {
                  const yearCheckText3 = yearCheck3.innerText || yearCheck3.value;
                  const yearCheckInput3 = yearCheck3.querySelector('input');
                  const yearCheckInputValue3 = yearCheckInput3 ? yearCheckInput3.value : '';
                  const yearStillCommitted3 = yearCheckText3.includes(String(vehicle.year)) || yearCheckInputValue3.includes(String(vehicle.year));
                  console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Year still committed after Model:", yearStillCommitted3);
                  if (!yearStillCommitted3) {
                    console.error("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] SEQUENTIAL_STATE_FAIL - Year was reset by Model operation");
                  }
                }

                const makeCheck2 = await waitFor(
                  async () => findCombobox("Make", "Make"),
                  5000
                );
                if (makeCheck2) {
                  const makeCheckText2 = makeCheck2.innerText || makeCheck2.value;
                  const makeCheckInput2 = makeCheck2.querySelector('input');
                  const makeCheckInputValue2 = makeCheckInput2 ? makeCheckInput2.value : '';
                  const makeStillCommitted2 = makeCheckText2.toLowerCase().includes(vehicle.make.toLowerCase()) ||
                                        makeCheckInputValue2.toLowerCase().includes(vehicle.make.toLowerCase());
                  console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Make still committed after Model:", makeStillCommitted2);
                  if (!makeStillCommitted2) {
                    console.error("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] SEQUENTIAL_STATE_FAIL - Make was reset by Model operation");
                  }
                }

                const modelCheck = await waitFor(
                  async () => findInputByLabel("Model", "Model"),
                  5000
                );
                if (modelCheck) {
                  const modelCheckValue = modelCheck.value;
                  const modelStillCommitted = modelCheckValue.toLowerCase().includes(vehicle.model.toLowerCase());
                  console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Model still committed:", modelStillCommitted);
                  console.log("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] Model value:", modelCheckValue);
                  if (!modelStillCommitted) {
                    console.error("FACEBOOK INJECTED SCRIPT: [SEQUENTIAL] SEQUENTIAL_STATE_FAIL - Model was reset immediately");
                  }
                }

                /*
                 * LOCATION
                 */
                console.log("FACEBOOK INJECTED SCRIPT: ========== FILLING LOCATION ==========");
                console.log("FACEBOOK INJECTED SCRIPT: [Location] vehicle.location received:", vehicle.location);
                console.log("FACEBOOK LOCATION TRACE: raw location:", vehicle.location);
                
                let cleanLocation = vehicle.location || "";

                // Normalize location to City, ST format
                cleanLocation = String(cleanLocation)
                  .replace(/<br\s*\/?>/gi, ", ")
                  .replace(/\s+/g, " ")
                  .trim();

                // Try to extract City, ST pattern
                const locationMatch = cleanLocation.match(
                  /([A-Za-z .'-]+,\s*[A-Z]{2})\b/
                );

                if (locationMatch) {
                  cleanLocation = locationMatch[1];
                } else {
                  // Fallback: try to extract last comma-separated part as likely city/state
                  const parts = cleanLocation.split(',').map(p => p.trim());
                  if (parts.length >= 2) {
                    // Take the last two parts and rejoin
                    cleanLocation = parts.slice(-2).join(', ');
                  }
                }
                
                console.log("FACEBOOK LOCATION TRACE: normalized location:", cleanLocation);
                console.log("FACEBOOK INJECTED SCRIPT: [Location] cleanLocation after processing:", cleanLocation);
                console.log("FACEBOOK INJECTED SCRIPT: [Location] Value to fill:", cleanLocation);
                
                if (cleanLocation) {
                  // Location uses input[aria-label="Location"] specifically
                  const locationInput = await waitFor(
                    async () => document.querySelector('input[aria-label="Location"]'),
                    10000
                  );

                  console.log("FACEBOOK INJECTED SCRIPT: [Location] locationInput found:", !!locationInput);
                  if (locationInput) {
                    console.log("FACEBOOK INJECTED SCRIPT: [Location] locationInput tagName:", locationInput.tagName);
                    console.log("FACEBOOK INJECTED SCRIPT: [Location] locationInput type:", locationInput.type);
                    console.log("FACEBOOK INJECTED SCRIPT: [Location] locationInput role:", locationInput.getAttribute('role'));
                    console.log("FACEBOOK INJECTED SCRIPT: [Location] locationInput aria-label:", locationInput.getAttribute('aria-label'));
                    console.log("FACEBOOK INJECTED SCRIPT: [Location] locationInput value before:", locationInput.value);
                  }

                  if (locationInput) {
                    console.log("[LOCATION] Focusing Location field");
                    locationInput.focus();
                    await sleep(200);

                    console.log("[LOCATION] Typing:", cleanLocation);
                    
                    // Set the value using native setter
                    const proto = HTMLInputElement.prototype;
                    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
                    if (setter) {
                      setter.call(locationInput, cleanLocation);
                      
                      // Dispatch input event to trigger autocomplete
                      const inputEvent = new Event("input", { bubbles: true, cancelable: true });
                      locationInput.dispatchEvent(inputEvent);
                      console.log("[LOCATION] Waiting for suggestions");
                      await sleep(1000);
                    }

                    // Wait for location suggestions dropdown to appear
                    console.log("[LOCATION] Waiting for location suggestions");
                    let locationOption = null;
                    let pollCount = 0;
                    const maxPolls = 40;
                    let scopedOptions = [];
                    
                    while (pollCount < maxPolls && !locationOption) {
                      await sleep(200);
                      pollCount++;

                      // Facebook Location autocomplete can use different DOM structures.
                      // Check listbox/options first, then fall back to visible text elements.
                      const listboxes = document.querySelectorAll('[role="listbox"]');
                      scopedOptions = [];

                      for (const listbox of listboxes) {
                        const options = listbox.querySelectorAll('[role="option"]');
                        if (options.length > 0) {
                          scopedOptions = Array.from(options);
                          break;
                        }
                      }

                      if (scopedOptions.length > 0) {
                        console.log(`FACEBOOK INJECTED SCRIPT: [Location] Options appeared at poll ${pollCount}`);
                        console.log("FACEBOOK LOCATION TRACE: suggestions count:", scopedOptions.length);
                        console.log("FACEBOOK LOCATION TRACE: suggestion texts:", scopedOptions.map(opt => opt.innerText));

                        const wanted = normalize(cleanLocation);

                        locationOption = scopedOptions.find(opt => {
                          const text = normalize(opt.innerText);
                          return text === wanted ||
                                 text.startsWith(wanted) ||
                                 wanted.startsWith(text);
                        });

                        if (locationOption) {
                          console.log("[LOCATION] Selecting suggestion:", locationOption.innerText);
                        }
                      }

                      // Fallback: Facebook may render suggestions without role="option".
                      if (!locationOption) {
                        const candidates = Array.from(document.querySelectorAll('div[role="button"], li, div'))
                          .filter(el => {
                            const text = normalize(el.innerText || "");
                            if (!text || text.length > 250) return false;
                            if (el === locationInput || el.contains(locationInput)) return false;
                            const rect = el.getBoundingClientRect();
                            return rect.width > 0 && rect.height > 0;
                          });

                        const wanted = normalize(cleanLocation);

                        locationOption = candidates.find(el => {
                          const text = normalize(el.innerText || "");
                          return text === wanted ||
                                 text.startsWith(wanted) ||
                                 text.includes(wanted);
                        }) || null;

                        if (locationOption) {
                          console.log("[LOCATION] Fallback suggestion found:", locationOption.innerText);
                        }
                      }
                    }

                    if (locationOption) {
                      console.log("[LOCATION] Clicking suggestion:", locationOption.innerText);
                      locationOption.click();
                      await sleep(700);

                      // Verify the value after Facebook accepts the suggestion
                      const locationValue = locationInput.value || "";

                      // Check only the Location field for an actual invalid state.
                      const locationInvalid =
                        locationInput.getAttribute("aria-invalid") === "true" ||
                        locationInput.closest('[aria-invalid="true"]') !== null;

                      const normalizedSelected = normalize(locationValue);
                      const normalizedWanted = normalize(cleanLocation);

                      // Facebook may format the selected location differently
                      // from the text we originally typed.
                      const locationCommitted =
                        normalizedSelected === normalizedWanted ||
                        normalizedSelected.startsWith(normalizedWanted) ||
                        normalizedWanted.startsWith(normalizedSelected);

                      console.log("FACEBOOK LOCATION TRACE: location input invalid:", locationInvalid);
                      console.log("[LOCATION] Selected value:", locationValue);
                      console.log("FACEBOOK LOCATION TRACE: selected suggestion:", locationValue);
                      console.log("FACEBOOK LOCATION TRACE: desired:", cleanLocation);
                      console.log("FACEBOOK LOCATION TRACE: selection committed:", locationCommitted);
                      console.log("FACEBOOK LOCATION TRACE: selection verified:", locationCommitted && !locationInvalid);

                      if (locationCommitted && !locationInvalid) {
                        result.fields.location = true;
                        console.log("FACEBOOK INJECTED SCRIPT: [Location] SELECTION COMMITTED");
                      } else {
                        result.fields.location = false;
                        console.error("FACEBOOK INJECTED SCRIPT: [Location] SELECTION NOT COMMITTED");
                      }
                    } else {
                      result.fields.location = false;
                      console.error("FACEBOOK INJECTED SCRIPT: [Location] ✗ NO SUGGESTION FOUND");
                      console.log("FACEBOOK INJECTED SCRIPT: [Location] Visible suggestions:", scopedOptions.length > 0 ? Array.from(scopedOptions).map(opt => opt.innerText) : 'none');
                    }

                    await sleep(500);
                  } else {
                    result.fields.location = false;
                    console.error("FACEBOOK INJECTED SCRIPT: [Location] ✗ INPUT NOT FOUND");
                  }
                } else {
                  console.log("FACEBOOK INJECTED SCRIPT: [Location] No location provided, skipping");
                }

                /*
                 * DESCRIPTION
                 */
                console.log("FACEBOOK INJECTED SCRIPT: ========== FILLING DESCRIPTION ==========");
                if (listingData?.description) {
                  console.log("FACEBOOK INJECTED SCRIPT: [Description] Length:", listingData.description.length);
                  console.log("FACEBOOK INJECTED SCRIPT: [Description] Value preview:", listingData.description.substring(0, 100) + "...");

                  const descriptionInput = await waitFor(
                    async () => findDescriptionTextarea("Description"),
                    10000
                  );

                  result.fields.description = await setValue(
                    descriptionInput,
                    listingData.description,
                    "Description"
                  );

                  if (result.fields.description) {
                    console.log("FACEBOOK INJECTED SCRIPT: [Description] ✓ FILLED SUCCESSFULLY");
                  } else {
                    console.error("FACEBOOK INJECTED SCRIPT: [Description] ✗ FILL FAILED");
                  }

                  await sleep(500);
                } else {
                  console.log("FACEBOOK INJECTED SCRIPT: [Description] No description provided, skipping");
                }

                /*
                 * MILEAGE
                 */
                console.log("FACEBOOK INJECTED SCRIPT: ========== FILLING MILEAGE ==========");
                console.log("FACEBOOK INJECTED SCRIPT: [Mileage] Raw vehicle.mileage:", vehicle.mileage);
                console.log("FACEBOOK INJECTED SCRIPT: [Mileage] vehicle.mileage !== null:", vehicle.mileage !== null);
                console.log("FACEBOOK INJECTED SCRIPT: [Mileage] vehicle.mileage !== undefined:", vehicle.mileage !== undefined);
                console.log("FACEBOOK INJECTED SCRIPT: [Mileage] Number.isFinite(Number(vehicle.mileage)):", Number.isFinite(Number(vehicle.mileage)));
                
                if (vehicle.mileage !== null && vehicle.mileage !== undefined && Number.isFinite(Number(vehicle.mileage))) {
                  // FIX #4: Format mileage with commas (e.g., 23000 -> 23,000)
                  const rawNumeric = Number(vehicle.mileage);
                  const formattedMileage = rawNumeric.toLocaleString();
                  console.log("FACEBOOK MILEAGE TRACE: raw numeric:", rawNumeric);
                  console.log("FACEBOOK MILEAGE TRACE: formatted display:", formattedMileage);
                  console.log("FACEBOOK INJECTED SCRIPT: [Mileage] Value to fill:", vehicle.mileage);
                  console.log("FACEBOOK INJECTED SCRIPT: [Mileage] Formatted value:", formattedMileage);

                  const mileageInput = await waitFor(
                    async () =>
                      findInputByLabel("Mileage", "Mileage") ||
                      findInputByLabel("Odometer", "Mileage") ||
                      document.querySelector('input[aria-label="Mileage"]') ||
                      document.querySelector('input[aria-label="Odometer"]'),
                    10000
                  );

                  if (mileageInput) {
                    result.fields.mileage = await setValue(
                      mileageInput,
                      formattedMileage,
                      "Mileage"
                    );

                    // Verify final displayed value
                    const finalMileage = mileageInput.value;
                    console.log("FACEBOOK MILEAGE TRACE: final displayed value:", finalMileage);
                    
                    // Verify the formatted value actually appears
                    const hasComma = finalMileage.includes(',');
                    console.log("FACEBOOK MILEAGE TRACE: comma present in display:", hasComma);

                    if (result.fields.mileage && hasComma) {
                      console.log("FACEBOOK INJECTED SCRIPT: [Mileage] FILLED SUCCESSFULLY");
                      
                      // Blur to trigger final state commit
                      mileageInput.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                      await sleep(300);
                    } else if (!hasComma) {
                      console.error("FACEBOOK INJECTED SCRIPT: [Mileage] FORMATTING FAILED - no comma in display");
                      result.fields.mileage = false;
                    } else {
                      console.error("FACEBOOK INJECTED SCRIPT: [Mileage] FILL FAILED");
                    }

                    await sleep(500);
                  } else {
                    result.fields.mileage = false;
                    console.error("FACEBOOK INJECTED SCRIPT: [Mileage] ✗ INPUT NOT FOUND");
                  }
                } else if (vehicle.mileage === 0) {
                  // Handle zero mileage explicitly
                  console.log("FACEBOOK INJECTED SCRIPT: [Mileage] Mileage is 0, will fill with 0");
                  const formattedMileage = "0";
                  console.log("FACEBOOK MILEAGE TRACE: raw numeric: 0");
                  console.log("FACEBOOK MILEAGE TRACE: formatted display: 0");
                  console.log("FACEBOOK INJECTED SCRIPT: [Mileage] Formatted value:", formattedMileage);

                  const mileageInput = await waitFor(
                    async () =>
                      findInputByLabel("Mileage", "Mileage") ||
                      findInputByLabel("Odometer", "Mileage") ||
                      document.querySelector('input[aria-label="Mileage"]') ||
                      document.querySelector('input[aria-label="Odometer"]'),
                    10000
                  );

                  if (mileageInput) {
                    result.fields.mileage = await setValue(
                      mileageInput,
                      formattedMileage,
                      "Mileage"
                    );

                    const finalMileage = mileageInput.value;
                    console.log("FACEBOOK MILEAGE TRACE: final displayed value:", finalMileage);

                    if (result.fields.mileage) {
                      console.log("FACEBOOK INJECTED SCRIPT: [Mileage] ✓ FILLED SUCCESSFULLY");
                    } else {
                      console.error("FACEBOOK INJECTED SCRIPT: [Mileage] ✗ FILL FAILED");
                    }

                    await sleep(500);
                  } else {
                    result.fields.mileage = false;
                    console.error("FACEBOOK INJECTED SCRIPT: [Mileage] ✗ INPUT NOT FOUND");
                  }
                } else {
                  result.fields.mileage = null; // null/undefined - leave blank
                  console.log("FACEBOOK INJECTED SCRIPT: [Mileage] Mileage is null/undefined, skipping");
                }

                /*
                 * FUEL
                 * Note: Fuel may appear dynamically after other selections
                 */
                if (vehicle.fuel) {
                  console.log("FACEBOOK INJECTED SCRIPT: ========== FILLING FUEL ==========");
                  console.log("FACEBOOK INJECTED SCRIPT: [Fuel] Original value:", vehicle.fuel);

                  // Normalize fuel value for Facebook option matching
                  let normalizedFuel = String(vehicle.fuel).trim();
                  if (normalizedFuel === "Gasoline Fuel") {
                    normalizedFuel = "Gasoline";
                  }
                  console.log("FACEBOOK INJECTED SCRIPT: [Fuel] Normalized value:", normalizedFuel);

                  const fuelCombobox = await waitFor(
                    async () => findCombobox("Fuel type", "Fuel") || findCombobox("Fuel", "Fuel"),
                    10000
                  );

                  if (fuelCombobox) {
                    console.log("FACEBOOK FUEL TRACE: combobox clicked");
                    console.log("FACEBOOK INJECTED SCRIPT: [Fuel] Combobox found, clicking to open dropdown");
                    fuelCombobox.click();
                    await sleep(800);

                    // FIX #5: Wait for dropdown to actually render
                    console.log("FACEBOOK FUEL TRACE: waiting for dropdown");
                    console.log("FACEBOOK INJECTED SCRIPT: [Fuel] Waiting for dropdown options to render...");
                    let fuelOption = null;
                    let pollCount = 0;
                    const maxPolls = 60; // Increased from 40 to 60 (12 seconds max)
                    
                    while (pollCount < maxPolls && !fuelOption) {
                      await sleep(200);
                      pollCount++;
                      
                      const scopedOptions = findScopedDropdownOptions(fuelCombobox, "Fuel");
                      if (scopedOptions.length > 0) {
                        console.log(`FACEBOOK INJECTED SCRIPT: [Fuel] Options appeared at poll ${pollCount}`);
                        console.log("FACEBOOK FUEL TRACE: active dropdown found: true");
                        console.log("FACEBOOK FUEL TRACE: options count:", scopedOptions.length);
                        console.log("FACEBOOK FUEL TRACE: option texts:", scopedOptions.map(opt => opt.innerText));
                        
                        fuelOption = scopedOptions.find(opt => {
                          const optText = normalize(opt.innerText);
                          return optText === normalize(normalizedFuel) || optText.startsWith(normalize(normalizedFuel));
                        });
                        
                        if (fuelOption) {
                          console.log("FACEBOOK INJECTED SCRIPT: [Fuel] Matching option found:", fuelOption.innerText);
                          console.log("FACEBOOK FUEL TRACE: selected option:", fuelOption.innerText);
                          console.log("FACEBOOK FUEL TRACE: clicking option:", fuelOption.innerText);
                        } else {
                          console.log("FACEBOOK INJECTED SCRIPT: [Fuel] Options available but no match for:", normalizedFuel);
                        }
                      } else if (pollCount % 10 === 0) {
                        console.log(`FACEBOOK FUEL TRACE: still waiting for dropdown at poll ${pollCount}`);
                      }
                    }

                    if (fuelOption) {
                      console.log("FACEBOOK INJECTED SCRIPT: [Fuel] Clicking option");
                      fuelOption.click();
                      await sleep(700); // Increased wait time for React state update
                      
                      // Verify the selection
                      const comboboxText = fuelCombobox.innerText || fuelCombobox.value;
                      console.log("FACEBOOK INJECTED SCRIPT: [Fuel] Combobox text after selection:", comboboxText);
                      console.log("FACEBOOK FUEL TRACE: final displayed value:", comboboxText);
                      console.log("FACEBOOK FUEL TRACE: selection verified:", comboboxText.toLowerCase().includes(normalizedFuel.toLowerCase()));
                      
                      if (comboboxText.toLowerCase().includes(normalizedFuel.toLowerCase())) {
                        console.log("FACEBOOK INJECTED SCRIPT: [Fuel] Selection verified");
                        result.fields.fuel = true;
                        console.log("FACEBOOK INJECTED SCRIPT: [Fuel] FILLED SUCCESSFULLY");
                        
                        // Blur to trigger final state commit
                        fuelCombobox.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                        await sleep(300);
                      } else {
                        console.log("FACEBOOK INJECTED SCRIPT: [Fuel] Selection verification failed");
                        result.fields.fuel = false;
                        console.error("FACEBOOK INJECTED SCRIPT: [Fuel] SELECTION VERIFICATION FAILED");
                      }
                    } else {
                      result.fields.fuel = false;
                      console.error("FACEBOOK INJECTED SCRIPT: [Fuel] OPTION NOT FOUND after polling");
                    }
                    await sleep(1000);
                  } else {
                    console.log("FACEBOOK FUEL TRACE: dropdown found: false");
                    result.fields.fuel = false;
                    console.error("FACEBOOK INJECTED SCRIPT: [Fuel] ✗ COMBOBOX NOT FOUND (may appear dynamically)");
                  }
                } else {
                  console.log("FACEBOOK INJECTED SCRIPT: [Fuel] No vehicle fuel provided, skipping");
                }

                /*
                 * TRANSMISSION
                 * Note: Transmission may appear dynamically after other selections
                 */
                if (vehicle.transmission) {
                  console.log("FACEBOOK INJECTED SCRIPT: ========== FILLING TRANSMISSION ==========");
                  console.log("FACEBOOK INJECTED SCRIPT: [Transmission] Original value:", vehicle.transmission);

                  // Normalize transmission value for Facebook option matching
                  let normalizedTransmission = String(vehicle.transmission).trim();
                  // Map CVT/automatic variants to "Automatic" for Facebook
                  if (normalizedTransmission.toLowerCase().includes("cvt") || 
                      normalizedTransmission.toLowerCase().includes("automatic") ||
                      normalizedTransmission.toLowerCase().includes("1-speed")) {
                    normalizedTransmission = "Automatic";
                  }
                  console.log("FACEBOOK INJECTED SCRIPT: [Transmission] Normalized value:", normalizedTransmission);

                  const transmissionCombobox = await waitFor(
                    async () => findCombobox("Transmission", "Transmission"),
                    10000
                  );

                  if (transmissionCombobox) {
                    console.log("FACEBOOK TRANSMISSION TRACE: dropdown found: true");
                    console.log("FACEBOOK INJECTED SCRIPT: [Transmission] Clicking combobox");
                    transmissionCombobox.click();
                    await sleep(800);

                    // Poll for scoped dropdown options
                    console.log("FACEBOOK INJECTED SCRIPT: [Transmission] Waiting for dropdown options to render...");
                    let transmissionOption = null;
                    let pollCount = 0;
                    const maxPolls = 40;
                    
                    while (pollCount < maxPolls && !transmissionOption) {
                      await sleep(200);
                      pollCount++;
                      
                      const scopedOptions = findScopedDropdownOptions(transmissionCombobox, "Transmission");
                      if (scopedOptions.length > 0) {
                        console.log(`FACEBOOK INJECTED SCRIPT: [Transmission] Options appeared at poll ${pollCount}`);
                        console.log("FACEBOOK TRANSMISSION TRACE: dropdown options:", scopedOptions.map(opt => opt.innerText));
                        
                        transmissionOption = scopedOptions.find(opt => {
                          const optText = normalize(opt.innerText);
                          return optText === normalize(normalizedTransmission) || optText.startsWith(normalize(normalizedTransmission));
                        });
                        
                        if (transmissionOption) {
                          console.log("FACEBOOK INJECTED SCRIPT: [Transmission] Matching option found:", transmissionOption.innerText);
                          console.log("FACEBOOK TRANSMISSION TRACE: clicking option:", transmissionOption.innerText);
                        } else {
                          console.log("FACEBOOK INJECTED SCRIPT: [Transmission] Options available but no match for:", normalizedTransmission);
                        }
                      }
                    }

                    if (transmissionOption) {
                      console.log("FACEBOOK INJECTED SCRIPT: [Transmission] Clicking option");
                      transmissionOption.click();
                      await sleep(700);
                      
                      // Verify the selection
                      const comboboxText = transmissionCombobox.innerText || transmissionCombobox.value;
                      console.log("FACEBOOK INJECTED SCRIPT: [Transmission] Combobox text after selection:", comboboxText);
                      console.log("FACEBOOK TRANSMISSION TRACE: selection verified:", comboboxText.toLowerCase().includes(normalizedTransmission.toLowerCase()));
                      
                      if (comboboxText.toLowerCase().includes(normalizedTransmission.toLowerCase())) {
                        console.log("FACEBOOK INJECTED SCRIPT: [Transmission] Selection verified");
                        result.fields.transmission = true;
                        console.log("FACEBOOK INJECTED SCRIPT: [Transmission] ✓ FILLED SUCCESSFULLY");
                        
                        // Blur to trigger final state commit
                        transmissionCombobox.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                        await sleep(300);
                      } else {
                        console.log("FACEBOOK INJECTED SCRIPT: [Transmission] Selection verification failed");
                        result.fields.transmission = false;
                        console.error("FACEBOOK INJECTED SCRIPT: [Transmission] ✗ SELECTION VERIFICATION FAILED");
                      }
                    } else {
                      result.fields.transmission = false;
                      console.error("FACEBOOK INJECTED SCRIPT: [Transmission] ✗ OPTION NOT FOUND after polling");
                    }
                    await sleep(1000);
                  } else {
                    console.log("FACEBOOK TRANSMISSION TRACE: dropdown found: false");
                    result.fields.transmission = false;
                    console.error("FACEBOOK INJECTED SCRIPT: [Transmission] ✗ COMBOBOX NOT FOUND (may appear dynamically)");
                  }
                } else {
                  console.log("FACEBOOK INJECTED SCRIPT: [Transmission] No vehicle transmission provided, skipping");
                }

                /*
                 * BODY STYLE
                 */
                if (vehicle.body) {
                  console.log("FACEBOOK INJECTED SCRIPT: ========== FILLING BODY STYLE ==========");
                  console.log("FACEBOOK INJECTED SCRIPT: [Body Style] Value to fill:", vehicle.body);
                  console.log("FACEBOOK BODY STYLE TRACE: Source body value:", vehicle.body);

                  // Normalize body style for Facebook option matching
                  let normalizedBody = String(vehicle.body).trim();
                  console.log("FACEBOOK INJECTED SCRIPT: [Body Style] Normalized value:", normalizedBody);

                  const bodyCombobox = await waitFor(
                    async () => findCombobox("Body type", "Body Style") || findCombobox("Body", "Body Style"),
                    10000
                  );

                  if (bodyCombobox) {
                    console.log("FACEBOOK BODY STYLE TRACE: combobox found: true");
                    console.log("FACEBOOK INJECTED SCRIPT: [Body Style] Clicking combobox");
                    bodyCombobox.click();
                    await sleep(800);

                    // Poll for scoped dropdown options
                    console.log("FACEBOOK INJECTED SCRIPT: [Body Style] Waiting for dropdown options to render...");
                    let bodyOption = null;
                    let pollCount = 0;
                    const maxPolls = 60; // Increased to 60
                    
                    while (pollCount < maxPolls && !bodyOption) {
                      await sleep(200);
                      pollCount++;
                      
                      const scopedOptions = findScopedDropdownOptions(bodyCombobox, "Body Style");
                      if (scopedOptions.length > 0) {
                        console.log(`FACEBOOK INJECTED SCRIPT: [Body Style] Options appeared at poll ${pollCount}`);
                        console.log("FACEBOOK BODY STYLE TRACE: dropdown options:", scopedOptions.map(opt => opt.innerText));
                        
                        bodyOption = scopedOptions.find(opt => {
                          const optText = normalize(opt.innerText);
                          const wanted = normalize(normalizedBody);
                          return optText === wanted || 
                                 optText.toLowerCase() === wanted.toLowerCase() ||
                                 optText.startsWith(wanted) ||
                                 optText.toLowerCase().startsWith(wanted.toLowerCase());
                        });
                        
                        if (bodyOption) {
                          console.log("FACEBOOK INJECTED SCRIPT: [Body Style] Matching option found:", bodyOption.innerText);
                          console.log("FACEBOOK BODY STYLE TRACE: Selected option:", bodyOption.innerText);
                        } else {
                          console.log("FACEBOOK INJECTED SCRIPT: [Body Style] Options available but no match for:", normalizedBody);
                          console.log("FACEBOOK BODY STYLE TRACE: Wanted:", wanted);
                          console.log("FACEBOOK BODY STYLE TRACE: Available:", scopedOptions.map(opt => normalize(opt.innerText)));
                        }
                      }
                    }

                    if (bodyOption) {
                      console.log("FACEBOOK INJECTED SCRIPT: [Body Style] Clicking option:", bodyOption.innerText);
                      bodyOption.click();
                      await sleep(700); // Increased wait time for React state update
                      
                      // Verify the selection with multiple methods
                      const comboboxText = bodyCombobox.innerText || bodyCombobox.value;
                      const comboboxInput = bodyCombobox.querySelector('input');
                      const inputValue = comboboxInput ? comboboxInput.value : '';
                      
                      console.log("FACEBOOK INJECTED SCRIPT: [Body Style] Combobox text after selection:", comboboxText);
                      console.log("FACEBOOK BODY STYLE TRACE: Selection text:", comboboxText);
                      console.log("FACEBOOK BODY STYLE TRACE: Selection input value:", inputValue);
                      console.log("FACEBOOK BODY STYLE TRACE: Verification - wanted:", normalizedBody.toLowerCase());
                      
                      const textMatch = comboboxText.toLowerCase().includes(normalizedBody.toLowerCase());
                      const inputMatch = inputValue.toLowerCase().includes(normalizedBody.toLowerCase());
                      const verified = textMatch || inputMatch;
                      
                      if (verified) {
                        console.log("FACEBOOK INJECTED SCRIPT: [Body Style] Selection verified");
                        result.fields.bodyStyle = true;
                        console.log("FACEBOOK BODY STYLE VERIFICATION: TARGET =", normalizedBody);
                        console.log("FACEBOOK BODY STYLE VERIFICATION: COMBO TEXT =", comboboxText);
                        console.log("FACEBOOK BODY STYLE VERIFICATION: INPUT VALUE =", inputValue);
                        console.log("FACEBOOK BODY STYLE VERIFICATION: SELECTED OPTION =", bodyOption ? bodyOption.innerText : "NONE");
                        console.log("FACEBOOK BODY STYLE VERIFICATION: RESULT = PASS");
                        
                        // Blur to trigger final state commit
                        bodyCombobox.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                        await sleep(300);
                      } else {
                        console.log("FACEBOOK INJECTED SCRIPT: [Body Style] Selection verification failed");
                        result.fields.bodyStyle = false;
                        console.error("FACEBOOK INJECTED SCRIPT: [Body Style] SELECTION VERIFICATION FAILED");
                        console.log("FACEBOOK BODY STYLE VERIFICATION: TARGET =", normalizedBody);
                        console.log("FACEBOOK BODY STYLE VERIFICATION: COMBO TEXT =", comboboxText);
                        console.log("FACEBOOK BODY STYLE VERIFICATION: INPUT VALUE =", inputValue);
                        console.log("FACEBOOK BODY STYLE VERIFICATION: RESULT = FAIL");
                      }
                    } else {
                      result.fields.bodyStyle = false;
                      console.error("FACEBOOK INJECTED SCRIPT: [Body Style] OPTION NOT FOUND after polling");
                      console.log("FACEBOOK BODY STYLE VERIFICATION: TARGET =", normalizedBody);
                      console.log("FACEBOOK BODY STYLE VERIFICATION: AVAILABLE OPTIONS =", scopedOptions.map(opt => opt.innerText));
                      console.log("FACEBOOK BODY STYLE VERIFICATION: RESULT = FAIL (no matching option)");
                    }
                    await sleep(1000);
                  } else {
                    console.log("FACEBOOK BODY STYLE TRACE: combobox found: false");
                    result.fields.bodyStyle = false;
                    console.error("FACEBOOK INJECTED SCRIPT: [Body Style] ✓ COMBOBOX NOT FOUND (may appear dynamically)");
                  }
                } else {
                  console.log("FACEBOOK INJECTED SCRIPT: [Body Style] No vehicle body provided, skipping");
                }

                /*
                 * EXTERIOR COLOR
                 */
                if (vehicle.exteriorColor) {
                  console.log("FACEBOOK INJECTED SCRIPT: ========== FILLING EXTERIOR COLOR ==========");
                  console.log("FACEBOOK INJECTED SCRIPT: [Exterior Color] Value to fill:", vehicle.exteriorColor);
                  console.log("FACEBOOK EXTERIOR COLOR TRACE: Source exterior color value:", vehicle.exteriorColor);

                  const normalizedExteriorColor = String(vehicle.exteriorColor).trim();
                  console.log("FACEBOOK INJECTED SCRIPT: [Exterior Color] Normalized value:", normalizedExteriorColor);

                  const exteriorColorCombobox = await waitFor(
                    async () => findCombobox("Exterior color", "Exterior Color") || findCombobox("Color", "Exterior Color"),
                    10000
                  );

                  if (exteriorColorCombobox) {
                    console.log("FACEBOOK EXTERIOR COLOR TRACE: combobox found: true");
                    console.log("FACEBOOK INJECTED SCRIPT: [Exterior Color] Clicking combobox");
                    exteriorColorCombobox.click();
                    await sleep(800);

                    // Poll for scoped dropdown options
                    console.log("FACEBOOK INJECTED SCRIPT: [Exterior Color] Waiting for dropdown options to render...");
                    let exteriorColorOption = null;
                    let pollCount = 0;
                    const maxPolls = 60; // Increased to 60
                    
                    while (pollCount < maxPolls && !exteriorColorOption) {
                      await sleep(200);
                      pollCount++;
                      
                      const scopedOptions = findScopedDropdownOptions(exteriorColorCombobox, "Exterior Color");
                      if (scopedOptions.length > 0) {
                        console.log(`FACEBOOK INJECTED SCRIPT: [Exterior Color] Options appeared at poll ${pollCount}`);
                        console.log("FACEBOOK EXTERIOR COLOR TRACE: dropdown options:", scopedOptions.map(opt => opt.innerText));
                        
                        exteriorColorOption = scopedOptions.find(opt => {
                          const optText = normalize(opt.innerText);
                          const wanted = normalize(normalizedExteriorColor);
                          return optText === wanted || 
                                 optText.toLowerCase() === wanted.toLowerCase() ||
                                 optText.startsWith(wanted) ||
                                 optText.toLowerCase().startsWith(wanted.toLowerCase());
                        });
                        
                        if (exteriorColorOption) {
                          console.log("FACEBOOK INJECTED SCRIPT: [Exterior Color] Matching option found:", exteriorColorOption.innerText);
                          console.log("FACEBOOK EXTERIOR COLOR TRACE: Selected option:", exteriorColorOption.innerText);
                        } else {
                          console.log("FACEBOOK INJECTED SCRIPT: [Exterior Color] Options available but no match for:", normalizedExteriorColor);
                          console.log("FACEBOOK EXTERIOR COLOR TRACE: Wanted:", wanted);
                          console.log("FACEBOOK EXTERIOR COLOR TRACE: Available:", scopedOptions.map(opt => normalize(opt.innerText)));
                        }
                      }
                    }

                    if (exteriorColorOption) {
                      console.log("FACEBOOK INJECTED SCRIPT: [Exterior Color] Clicking option:", exteriorColorOption.innerText);
                      exteriorColorOption.click();
                      await sleep(700); // Increased wait time for React state update
                      
                      // Verify the selection with multiple methods
                      const comboboxText = exteriorColorCombobox.innerText || exteriorColorCombobox.value;
                      const comboboxInput = exteriorColorCombobox.querySelector('input');
                      const inputValue = comboboxInput ? comboboxInput.value : '';
                      
                      console.log("FACEBOOK INJECTED SCRIPT: [Exterior Color] Combobox text after selection:", comboboxText);
                      console.log("FACEBOOK EXTERIOR COLOR TRACE: Selection text:", comboboxText);
                      console.log("FACEBOOK EXTERIOR COLOR TRACE: Selection input value:", inputValue);
                      console.log("FACEBOOK EXTERIOR COLOR TRACE: Verification - wanted:", normalizedExteriorColor.toLowerCase());
                      
                      const textMatch = comboboxText.toLowerCase().includes(normalizedExteriorColor.toLowerCase());
                      const inputMatch = inputValue.toLowerCase().includes(normalizedExteriorColor.toLowerCase());
                      const verified = textMatch || inputMatch;
                      
                      if (verified) {
                        console.log("FACEBOOK INJECTED SCRIPT: [Exterior Color] Selection verified");
                        result.fields.exteriorColor = true;
                        console.log("FACEBOOK EXTERIOR COLOR VERIFICATION: TARGET =", normalizedExteriorColor);
                        console.log("FACEBOOK EXTERIOR COLOR VERIFICATION: COMBO TEXT =", comboboxText);
                        console.log("FACEBOOK EXTERIOR COLOR VERIFICATION: INPUT VALUE =", inputValue);
                        console.log("FACEBOOK EXTERIOR COLOR VERIFICATION: SELECTED OPTION =", exteriorColorOption ? exteriorColorOption.innerText : "NONE");
                        console.log("FACEBOOK EXTERIOR COLOR VERIFICATION: RESULT = PASS");
                        
                        // Blur to trigger final state commit
                        exteriorColorCombobox.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                        await sleep(300);
                      } else {
                        console.log("FACEBOOK INJECTED SCRIPT: [Exterior Color] Selection verification failed");
                        result.fields.exteriorColor = false;
                        console.error("FACEBOOK INJECTED SCRIPT: [Exterior Color] SELECTION VERIFICATION FAILED");
                        console.log("FACEBOOK EXTERIOR COLOR VERIFICATION: TARGET =", normalizedExteriorColor);
                        console.log("FACEBOOK EXTERIOR COLOR VERIFICATION: COMBO TEXT =", comboboxText);
                        console.log("FACEBOOK EXTERIOR COLOR VERIFICATION: INPUT VALUE =", inputValue);
                        console.log("FACEBOOK EXTERIOR COLOR VERIFICATION: RESULT = FAIL");
                      }
                    } else {
                      result.fields.exteriorColor = false;
                      console.error("FACEBOOK INJECTED SCRIPT: [Exterior Color] OPTION NOT FOUND after polling");
                      console.log("FACEBOOK EXTERIOR COLOR VERIFICATION: TARGET =", normalizedExteriorColor);
                      console.log("FACEBOOK EXTERIOR COLOR VERIFICATION: AVAILABLE OPTIONS =", scopedOptions.map(opt => opt.innerText));
                      console.log("FACEBOOK EXTERIOR COLOR VERIFICATION: RESULT = FAIL (no matching option)");
                    }
                    await sleep(1000);
                  } else {
                    console.log("FACEBOOK EXTERIOR COLOR TRACE: combobox found: false");
                    result.fields.exteriorColor = false;
                    console.error("FACEBOOK INJECTED SCRIPT: [Exterior Color] ✓ COMBOBOX NOT FOUND (may appear dynamically)");
                  }
                } else {
                  console.log("FACEBOOK INJECTED SCRIPT: [Exterior Color] No vehicle exterior color provided, skipping");
                }

                /*
                 * INTERIOR COLOR
                 */
                if (vehicle.interiorColor) {
                  console.log("FACEBOOK INJECTED SCRIPT: ========== FILLING INTERIOR COLOR ==========");
                  console.log("FACEBOOK INJECTED SCRIPT: [Interior Color] Value to fill:", vehicle.interiorColor);
                  console.log("FACEBOOK INTERIOR COLOR TRACE: Source interior color value:", vehicle.interiorColor);

                  const normalizedInteriorColor = String(vehicle.interiorColor).trim();
                  console.log("FACEBOOK INJECTED SCRIPT: [Interior Color] Normalized value:", normalizedInteriorColor);

                  const interiorColorCombobox = await waitFor(
                    async () => findCombobox("Interior color", "Interior Color") || findCombobox("Interior", "Interior Color"),
                    10000
                  );

                  if (interiorColorCombobox) {
                    console.log("FACEBOOK INTERIOR COLOR TRACE: combobox found: true");
                    console.log("FACEBOOK INJECTED SCRIPT: [Interior Color] Clicking combobox");
                    interiorColorCombobox.click();
                    await sleep(800);

                    // Poll for scoped dropdown options
                    console.log("FACEBOOK INJECTED SCRIPT: [Interior Color] Waiting for dropdown options to render...");
                    let interiorColorOption = null;
                    let pollCount = 0;
                    const maxPolls = 60; // Increased to 60
                    
                    while (pollCount < maxPolls && !interiorColorOption) {
                      await sleep(200);
                      pollCount++;
                      
                      const scopedOptions = findScopedDropdownOptions(interiorColorCombobox, "Interior Color");
                      if (scopedOptions.length > 0) {
                        console.log(`FACEBOOK INJECTED SCRIPT: [Interior Color] Options appeared at poll ${pollCount}`);
                        console.log("FACEBOOK INTERIOR COLOR TRACE: dropdown options:", scopedOptions.map(opt => opt.innerText));
                        
                        interiorColorOption = scopedOptions.find(opt => {
                          const optText = normalize(opt.innerText);
                          const wanted = normalize(normalizedInteriorColor);
                          return optText === wanted || 
                                 optText.toLowerCase() === wanted.toLowerCase() ||
                                 optText.startsWith(wanted) ||
                                 optText.toLowerCase().startsWith(wanted.toLowerCase());
                        });
                        
                        if (interiorColorOption) {
                          console.log("FACEBOOK INJECTED SCRIPT: [Interior Color] Matching option found:", interiorColorOption.innerText);
                          console.log("FACEBOOK INTERIOR COLOR TRACE: Selected option:", interiorColorOption.innerText);
                        } else {
                          console.log("FACEBOOK INJECTED SCRIPT: [Interior Color] Options available but no match for:", normalizedInteriorColor);
                          console.log("FACEBOOK INTERIOR COLOR TRACE: Wanted:", wanted);
                          console.log("FACEBOOK INTERIOR COLOR TRACE: Available:", scopedOptions.map(opt => normalize(opt.innerText)));
                        }
                      }
                    }

                    if (interiorColorOption) {
                      console.log("FACEBOOK INJECTED SCRIPT: [Interior Color] Clicking option:", interiorColorOption.innerText);
                      interiorColorOption.click();
                      await sleep(700); // Increased wait time for React state update
                      
                      // Verify the selection with multiple methods
                      const comboboxText = interiorColorCombobox.innerText || interiorColorCombobox.value;
                      const comboboxInput = interiorColorCombobox.querySelector('input');
                      const inputValue = comboboxInput ? comboboxInput.value : '';
                      
                      console.log("FACEBOOK INJECTED SCRIPT: [Interior Color] Combobox text after selection:", comboboxText);
                      console.log("FACEBOOK INTERIOR COLOR TRACE: Selection text:", comboboxText);
                      console.log("FACEBOOK INTERIOR COLOR TRACE: Selection input value:", inputValue);
                      console.log("FACEBOOK INTERIOR COLOR TRACE: Verification - wanted:", normalizedInteriorColor.toLowerCase());
                      
                      const textMatch = comboboxText.toLowerCase().includes(normalizedInteriorColor.toLowerCase());
                      const inputMatch = inputValue.toLowerCase().includes(normalizedInteriorColor.toLowerCase());
                      const verified = textMatch || inputMatch;
                      
                      if (verified) {
                        console.log("FACEBOOK INJECTED SCRIPT: [Interior Color] Selection verified");
                        result.fields.interiorColor = true;
                        console.log("FACEBOOK INTERIOR COLOR VERIFICATION: TARGET =", normalizedInteriorColor);
                        console.log("FACEBOOK INTERIOR COLOR VERIFICATION: COMBO TEXT =", comboboxText);
                        console.log("FACEBOOK INTERIOR COLOR VERIFICATION: INPUT VALUE =", inputValue);
                        console.log("FACEBOOK INTERIOR COLOR VERIFICATION: SELECTED OPTION =", interiorColorOption ? interiorColorOption.innerText : "NONE");
                        console.log("FACEBOOK INTERIOR COLOR VERIFICATION: RESULT = PASS");
                        
                        // Blur to trigger final state commit
                        interiorColorCombobox.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                        await sleep(300);
                      } else {
                        console.log("FACEBOOK INJECTED SCRIPT: [Interior Color] Selection verification failed");
                        result.fields.interiorColor = false;
                        console.error("FACEBOOK INJECTED SCRIPT: [Interior Color] SELECTION VERIFICATION FAILED");
                        console.log("FACEBOOK INTERIOR COLOR VERIFICATION: TARGET =", normalizedInteriorColor);
                        console.log("FACEBOOK INTERIOR COLOR VERIFICATION: COMBO TEXT =", comboboxText);
                        console.log("FACEBOOK INTERIOR COLOR VERIFICATION: INPUT VALUE =", inputValue);
                        console.log("FACEBOOK INTERIOR COLOR VERIFICATION: RESULT = FAIL");
                      }
                    } else {
                      result.fields.interiorColor = false;
                      console.error("FACEBOOK INJECTED SCRIPT: [Interior Color] OPTION NOT FOUND after polling");
                      console.log("FACEBOOK INTERIOR COLOR VERIFICATION: TARGET =", normalizedInteriorColor);
                      console.log("FACEBOOK INTERIOR COLOR VERIFICATION: AVAILABLE OPTIONS =", scopedOptions.map(opt => opt.innerText));
                      console.log("FACEBOOK INTERIOR COLOR VERIFICATION: RESULT = FAIL (no matching option)");
                    }
                    await sleep(1000);
                  } else {
                    console.log("FACEBOOK INTERIOR COLOR TRACE: combobox found: false");
                    result.fields.interiorColor = false;
                    console.error("FACEBOOK INJECTED SCRIPT: [Interior Color] ✓ COMBOBOX NOT FOUND (may appear dynamically)");
                  }
                } else {
                  console.log("FACEBOOK INJECTED SCRIPT: [Interior Color] No vehicle interior color provided, skipping");
                }

                /*
                 * CLEAN TITLE
                 */
                console.log("FACEBOOK INJECTED SCRIPT: ========== CHECKING CLEAN TITLE ==========");
                console.log("FACEBOOK CLEAN TITLE TRACE: Source hasCleanTitle value:", vehicle.hasCleanTitle);
                // Check if the vehicle has a clean title based on history data
                const hasCleanTitle = vehicle.hasCleanTitle === true;
                console.log("FACEBOOK INJECTED SCRIPT: [Clean Title] Vehicle has clean title:", hasCleanTitle);

                if (hasCleanTitle) {
                  // Find the "This vehicle has a clean title" checkbox
                  const cleanTitleCheckbox = await waitFor(
                    async () => {
                      const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
                      console.log("FACEBOOK CLEAN TITLE TRACE: Total checkboxes found:", allCheckboxes.length);
                      for (const checkbox of allCheckboxes) {
                        const labelText = normalize(checkbox.parentElement?.innerText || "");
                        if (labelText.includes("clean title")) {
                          console.log("FACEBOOK CLEAN TITLE TRACE: Found checkbox with text:", labelText);
                          return checkbox;
                        }
                      }
                      return null;
                    },
                    5000
                  );

                  if (cleanTitleCheckbox) {
                    console.log("FACEBOOK INJECTED SCRIPT: [Clean Title] Checkbox found, checking if already checked");
                    console.log("FACEBOOK CLEAN TITLE TRACE: Checkbox current state:", cleanTitleCheckbox.checked);
                    if (!cleanTitleCheckbox.checked) {
                      console.log("FACEBOOK INJECTED SCRIPT: [Clean Title] Checking the checkbox");
                      cleanTitleCheckbox.click();
                      await sleep(500); // Increased wait time
                      
                      // Verify the checkbox state
                      const isChecked = cleanTitleCheckbox.checked;
                      console.log("FACEBOOK CLEAN TITLE TRACE: Checkbox state after click:", isChecked);
                      
                      if (isChecked) {
                        result.fields.cleanTitle = true;
                        console.log("FACEBOOK CLEAN TITLE VERIFICATION: TARGET = CHECKED");
                        console.log("FACEBOOK CLEAN TITLE VERIFICATION: CHECKBOX STATE =", isChecked);
                        console.log("FACEBOOK CLEAN TITLE VERIFICATION: RESULT = PASS");
                        console.log("FACEBOOK INJECTED SCRIPT: [Clean Title] CHECKED SUCCESSFULLY");
                      } else {
                        result.fields.cleanTitle = false;
                        console.error("FACEBOOK CLEAN TITLE VERIFICATION: TARGET = CHECKED");
                        console.error("FACEBOOK CLEAN TITLE VERIFICATION: CHECKBOX STATE =", isChecked);
                        console.error("FACEBOOK CLEAN TITLE VERIFICATION: RESULT = FAIL");
                        console.error("FACEBOOK INJECTED SCRIPT: [Clean Title] CHECKBOX VERIFICATION FAILED");
                      }
                    } else {
                      console.log("FACEBOOK INJECTED SCRIPT: [Clean Title] Already checked");
                      result.fields.cleanTitle = true;
                      console.log("FACEBOOK CLEAN TITLE VERIFICATION: TARGET = CHECKED");
                      console.log("FACEBOOK CLEAN TITLE VERIFICATION: CHECKBOX STATE = ALREADY CHECKED");
                      console.log("FACEBOOK CLEAN TITLE VERIFICATION: RESULT = PASS");
                    }
                  } else {
                    console.log("FACEBOOK INJECTED SCRIPT: [Clean Title] Checkbox not found, may not be applicable");
                    result.fields.cleanTitle = null;
                    console.log("FACEBOOK CLEAN TITLE VERIFICATION: TARGET = CHECKED");
                    console.log("FACEBOOK CLEAN TITLE VERIFICATION: CHECKBOX = NOT FOUND");
                    console.log("FACEBOOK CLEAN TITLE VERIFICATION: RESULT = SKIPPED");
                  }
                } else {
                  console.log("FACEBOOK INJECTED SCRIPT: [Clean Title] Vehicle does not have clean title, skipping");
                  result.fields.cleanTitle = null;
                  console.log("FACEBOOK CLEAN TITLE VERIFICATION: TARGET = NOT CHECKED (hasCleanTitle not true)");
                  console.log("FACEBOOK CLEAN TITLE VERIFICATION: RESULT = SKIPPED");
                }

                /*
                 * VEHICLE CONDITION
                 */
                if (vehicle.condition) {
                  console.log("FACEBOOK INJECTED SCRIPT: ========== FILLING VEHICLE CONDITION ==========");
                  console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Condition] Value to fill:", vehicle.condition);
                  console.log("FACEBOOK VEHICLE CONDITION TRACE: Source condition value:", vehicle.condition);

                  const normalizedCondition = String(vehicle.condition).trim();
                  console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Condition] Normalized value:", normalizedCondition);

                  const conditionCombobox = await waitFor(
                    async () => findCombobox("Condition", "Vehicle Condition") || findCombobox("Vehicle condition", "Vehicle Condition"),
                    10000
                  );

                  if (conditionCombobox) {
                    console.log("FACEBOOK VEHICLE CONDITION TRACE: combobox found: true");
                    console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Condition] Clicking combobox");
                    conditionCombobox.click();
                    await sleep(800);

                    // Poll for scoped dropdown options
                    console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Condition] Waiting for dropdown options to render...");
                    let conditionOption = null;
                    let pollCount = 0;
                    const maxPolls = 60; // Increased to 60
                    
                    while (pollCount < maxPolls && !conditionOption) {
                      await sleep(200);
                      pollCount++;
                      
                      const scopedOptions = findScopedDropdownOptions(conditionCombobox, "Vehicle Condition");
                      if (scopedOptions.length > 0) {
                        console.log(`FACEBOOK INJECTED SCRIPT: [Vehicle Condition] Options appeared at poll ${pollCount}`);
                        console.log("FACEBOOK VEHICLE CONDITION TRACE: dropdown options:", scopedOptions.map(opt => opt.innerText));
                        
                        conditionOption = scopedOptions.find(opt => {
                          const optText = normalize(opt.innerText);
                          const wanted = normalize(normalizedCondition);
                          return optText === wanted || 
                                 optText.toLowerCase() === wanted.toLowerCase() ||
                                 optText.startsWith(wanted) ||
                                 optText.toLowerCase().startsWith(wanted.toLowerCase());
                        });
                        
                        if (conditionOption) {
                          console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Condition] Matching option found:", conditionOption.innerText);
                          console.log("FACEBOOK VEHICLE CONDITION TRACE: Selected option:", conditionOption.innerText);
                        } else {
                          console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Condition] Options available but no match for:", normalizedCondition);
                          console.log("FACEBOOK VEHICLE CONDITION TRACE: Wanted:", wanted);
                          console.log("FACEBOOK VEHICLE CONDITION TRACE: Available:", scopedOptions.map(opt => normalize(opt.innerText)));
                        }
                      }
                    }

                    if (conditionOption) {
                      console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Condition] Clicking option:", conditionOption.innerText);
                      conditionOption.click();
                      await sleep(700); // Increased wait time for React state update
                      
                      // Verify the selection with multiple methods
                      const comboboxText = conditionCombobox.innerText || conditionCombobox.value;
                      const comboboxInput = conditionCombobox.querySelector('input');
                      const inputValue = comboboxInput ? comboboxInput.value : '';
                      
                      console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Condition] Combobox text after selection:", comboboxText);
                      console.log("FACEBOOK VEHICLE CONDITION TRACE: Selection text:", comboboxText);
                      console.log("FACEBOOK VEHICLE CONDITION TRACE: Selection input value:", inputValue);
                      console.log("FACEBOOK VEHICLE CONDITION TRACE: Verification - wanted:", normalizedCondition.toLowerCase());
                      
                      const textMatch = comboboxText.toLowerCase().includes(normalizedCondition.toLowerCase());
                      const inputMatch = inputValue.toLowerCase().includes(normalizedCondition.toLowerCase());
                      const verified = textMatch || inputMatch;
                      
                      if (verified) {
                        console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Condition] Selection verified");
                        result.fields.condition = true;
                        console.log("FACEBOOK CONDITION VERIFICATION: TARGET =", normalizedCondition);
                        console.log("FACEBOOK CONDITION VERIFICATION: COMBO TEXT =", comboboxText);
                        console.log("FACEBOOK CONDITION VERIFICATION: INPUT VALUE =", inputValue);
                        console.log("FACEBOOK CONDITION VERIFICATION: SELECTED OPTION =", conditionOption ? conditionOption.innerText : "NONE");
                        console.log("FACEBOOK CONDITION VERIFICATION: RESULT = PASS");
                        console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Condition] FILLED SUCCESSFULLY");
                        
                        // Blur to trigger final state commit
                        conditionCombobox.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                        await sleep(300);
                      } else {
                        console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Condition] Selection verification failed");
                        result.fields.condition = false;
                        console.error("FACEBOOK CONDITION VERIFICATION: TARGET =", normalizedCondition);
                        console.error("FACEBOOK CONDITION VERIFICATION: COMBO TEXT =", comboboxText);
                        console.error("FACEBOOK CONDITION VERIFICATION: INPUT VALUE =", inputValue);
                        console.error("FACEBOOK CONDITION VERIFICATION: RESULT = FAIL");
                        console.error("FACEBOOK INJECTED SCRIPT: [Vehicle Condition] SELECTION VERIFICATION FAILED");
                      }
                    } else {
                      result.fields.condition = false;
                      console.error("FACEBOOK INJECTED SCRIPT: [Vehicle Condition] OPTION NOT FOUND after polling");
                      console.log("FACEBOOK CONDITION VERIFICATION: TARGET =", normalizedCondition);
                      console.log("FACEBOOK CONDITION VERIFICATION: AVAILABLE OPTIONS =", scopedOptions.map(opt => opt.innerText));
                      console.log("FACEBOOK CONDITION VERIFICATION: RESULT = FAIL (no matching option)");
                    }
                    await sleep(1000);
                  } else {
                    console.log("FACEBOOK VEHICLE CONDITION TRACE: combobox found: false");
                    result.fields.condition = false;
                    console.error("FACEBOOK INJECTED SCRIPT: [Vehicle Condition] COMBOBOX NOT FOUND (may appear dynamically)");
                  }
                } else {
                  console.log("FACEBOOK INJECTED SCRIPT: [Vehicle Condition] No vehicle condition provided, skipping");
                }

                /*
                 * PRICE
                 *
                 * Fill with CAD price, preserve currency
                 */
                console.log("FACEBOOK INJECTED SCRIPT: ========== FILLING PRICE ==========");
                if (listingData?.price_cad && listingData.price_cad > 0) {
                  console.log("FACEBOOK INJECTED SCRIPT: [Price] CAD price available:", listingData.price_cad);

                  // Price is a text input inside a label, similar to Make/Model
                  const priceInput = await waitFor(
                    async () => findInputByLabel("Price", "Price"),
                    10000
                  );

                  if (priceInput) {
                    console.log("FACEBOOK PRICE TRACE: price input found: true");
                    
                    // Check for currency selector
                    const currencySelectors = document.querySelectorAll('[role="combobox"], [role="listbox"]');
                    console.log("FACEBOOK PRICE TRACE: currency control found:", currencySelectors.length);
                    
                    // Look for currency-specific controls
                    const currencyControl = document.querySelector('[aria-label*="currency"], [aria-label*="Currency"], .currency-selector, [data-currency]');
                    if (currencyControl) {
                      console.log("FACEBOOK PRICE TRACE: currency control element found");
                      const availableCurrencies = Array.from(currencyControl.querySelectorAll('[role="option"]')).map(opt => opt.innerText);
                      console.log("FACEBOOK PRICE TRACE: available currencies:", availableCurrencies);
                    }

                    // Format as "$29,995 CAD" to preserve CAD currency
                    const formattedPrice = `$${Math.round(listingData.price_cad).toLocaleString()} CAD`;
                    console.log("FACEBOOK INJECTED SCRIPT: [Price] Formatted value to fill:", formattedPrice);
                    console.log("FACEBOOK PRICE TRACE: CAD numeric value:", Math.round(listingData.price_cad));

                    result.fields.price = await setValue(
                      priceInput,
                      formattedPrice,
                      "Price",
                      false // no autocomplete for price
                    );

                    // Verify final displayed value
                    const finalPrice = priceInput.value;
                    console.log("FACEBOOK PRICE TRACE: final displayed value:", finalPrice);
                    console.log("FACEBOOK PRICE TRACE: CAD verification:", finalPrice.includes('CAD') || finalPrice.includes('$'));

                    if (result.fields.price) {
                      console.log("FACEBOOK INJECTED SCRIPT: [Price] ✓ FILLED SUCCESSFULLY");
                    } else {
                      console.error("FACEBOOK INJECTED SCRIPT: [Price] ✓ FILL FAILED");
                    }

                    await sleep(500);
                  } else {
                    console.log("FACEBOOK PRICE TRACE: price input found: false");
                    result.fields.price = false;
                    console.error("FACEBOOK INJECTED SCRIPT: [Price] ✓ INPUT NOT FOUND");
                  }
                } else {
                  console.log("FACEBOOK INJECTED SCRIPT: [Price] No CAD price available, skipping");
                  result.fields.price = null;
                }

                result.diagnostics.after = snapshot();

                result.diagnostics.elapsedMs =
                  Date.now() - started;

                console.log("FACEBOOK INJECTED SCRIPT: ========== FORM FILLING COMPLETE ==========");
                console.log("FACEBOOK INJECTED SCRIPT: Total fields attempted:", Object.keys(result.fields).length);
                console.log("FACEBOOK INJECTED SCRIPT: Successful fills:", Object.values(result.fields).filter(v => v === true).length);
                console.log("FACEBOOK INJECTED SCRIPT: Failed fills:", Object.values(result.fields).filter(v => v === false).length);
                console.log("FACEBOOK INJECTED SCRIPT: Skipped fills:", Object.values(result.fields).filter(v => v === null).length);

                console.log("FACEBOOK INJECTED SCRIPT: FIELD RESULTS:");
                Object.entries(result.fields).forEach(([field, success]) => {
                  const status = success === true ? "SUCCESS" : success === false ? "FAILED" : "SKIPPED";
                  console.log(`FACEBOOK INJECTED SCRIPT:   ${field}: ${status}`);
                });

                // FINAL FACEBOOK FORM STATE VERIFICATION
                console.log("========== FACEBOOK FINAL FORM STATE ==========");
                
                // Helper to get committed value from combobox
                const getCommittedValue = (label) => {
                  const wanted = normalize(label);
                  const found = elements('label[role="combobox"]').find((el) => {
                    const textValue = normalize(el.innerText);
                    const aria = normalize(el.getAttribute("aria-label"));
                    return textValue === wanted || textValue.startsWith(wanted) || aria === wanted;
                  });
                  if (found) {
                    const comboboxText = found.innerText || found.value;
                    const comboboxInput = found.querySelector('input');
                    const inputValue = comboboxInput ? comboboxInput.value : '';
                    return { text: comboboxText, input: inputValue };
                  }
                  return { text: null, input: null };
                };

                // Helper to get input value
                const getInputValue = (label) => {
                  const wanted = normalize(label);
                  const inputs = elements("input, textarea");
                  for (const input of inputs) {
                    const aria = normalize(input.getAttribute("aria-label"));
                    const placeholder = normalize(input.getAttribute("placeholder"));
                    if (aria === wanted || placeholder === wanted) {
                      return input.value;
                    }
                  }
                  return null;
                };

                // Helper to get checkbox state
                const getCheckboxState = (label) => {
                  const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
                  for (const checkbox of allCheckboxes) {
                    const labelText = normalize(checkbox.parentElement?.innerText || "");
                    if (labelText.includes(normalize(label))) {
                      return checkbox.checked;
                    }
                  }
                  return null;
                };

                // Log each field's actual committed state
                const finalVehicleTypeValue = getCommittedValue("Vehicle type");
                console.log("Vehicle Type:", finalVehicleTypeValue.text || "NOT FOUND", "(input:", finalVehicleTypeValue.input || "N/A", ")");

                const finalYearValue = getCommittedValue("Year");
                console.log("Year:", finalYearValue.text || "NOT FOUND", "(input:", finalYearValue.input || "N/A", ")");

                const finalMakeValue = getCommittedValue("Make");
                console.log("Make:", finalMakeValue.text || "NOT FOUND", "(input:", finalMakeValue.input || "N/A", ")");

                const finalModelValue = getInputValue("Model");
                console.log("Model:", finalModelValue || "NOT FOUND");

                const finalMileageValue = getInputValue("Mileage");
                console.log("Mileage:", finalMileageValue || "NOT FOUND");

                const finalPriceValue = getInputValue("Price");
                console.log("Price:", finalPriceValue || "NOT FOUND");

                const finalLocationValue = getInputValue("Location");
                console.log("Location:", finalLocationValue || "NOT FOUND");

                const finalBodyValue = getCommittedValue("Body type") || getCommittedValue("Body");
                console.log("Body Style:", finalBodyValue.text || "NOT FOUND", "(input:", finalBodyValue.input || "N/A", ")");

                const finalExteriorColorValue = getCommittedValue("Exterior color") || getCommittedValue("Color");
                console.log("Exterior Color:", finalExteriorColorValue.text || "NOT FOUND", "(input:", finalExteriorColorValue.input || "N/A", ")");

                const finalInteriorColorValue = getCommittedValue("Interior color") || getCommittedValue("Interior");
                console.log("Interior Color:", finalInteriorColorValue.text || "NOT FOUND", "(input:", finalInteriorColorValue.input || "N/A", ")");

                const finalFuelValue = getCommittedValue("Fuel type") || getCommittedValue("Fuel");
                console.log("Fuel:", finalFuelValue.text || "NOT FOUND", "(input:", finalFuelValue.input || "N/A", ")");

                const finalTransmissionValue = getCommittedValue("Transmission");
                console.log("Transmission:", finalTransmissionValue.text || "NOT FOUND", "(input:", finalTransmissionValue.input || "N/A", ")");

                const finalCleanTitleState = getCheckboxState("clean title");
                console.log("Clean Title:", finalCleanTitleState !== null ? (finalCleanTitleState ? "CHECKED" : "UNCHECKED") : "NOT FOUND");

                const finalConditionValue = getCommittedValue("Condition") || getCommittedValue("Vehicle condition");
                console.log("Vehicle Condition:", finalConditionValue.text || "NOT FOUND", "(input:", finalConditionValue.input || "N/A", ")");

                const descriptionTextarea = elements("textarea")[0];
                console.log("Description:", descriptionTextarea ? (descriptionTextarea.value ? "FILLED" : "EMPTY") : "NOT FOUND");

                const photoCountMatch = document.body.innerText.match(/Photos (\d+)\/20/);
                const photoCount = photoCountMatch ? parseInt(photoCountMatch[1]) : 0;
                console.log("Photos:", photoCount, "uploaded");

                console.log("======================================================");

                  return {
                    ok: true,
                    result,
                  };
                } catch (error) {
                  console.error("FACEBOOK INJECTED SCRIPT: FATAL ERROR", error);
                  console.error("FACEBOOK INJECTED SCRIPT: Error message:", error?.message);
                  console.error("FACEBOOK INJECTED SCRIPT: Error stack:", error?.stack);
                  return {
                    ok: false,
                    error: error?.message || String(error),
                    stack: error?.stack || null,
                  };
                }
              },

              args: [listing],
            })
            .then((results) => {
              console.log("FACEBOOK BACKGROUND: executeScript RESOLVED");
              console.log("FACEBOOK BACKGROUND: RAW EXECUTESCRIPT RESULTS", JSON.stringify(results, null, 2));
              console.log("FACEBOOK BACKGROUND: RAW RESULT[0]", JSON.stringify(results?.[0], null, 2));

              const injectionResult = results?.[0]?.result || null;

              if (!injectionResult) {
                console.error("FACEBOOK BACKGROUND: INJECTION RETURNED NO RESULT");
              }

              console.log("FACEBOOK BACKGROUND: ========== SCRIPT EXECUTION COMPLETED ==========");
              console.log("FACEBOOK BACKGROUND: Result:", injectionResult);
              
              // Check if this is an error from the catch block (has stack property)
              if (injectionResult?.stack) {
                // Error from catch block in injected function
                console.error("FACEBOOK BACKGROUND: Injected function threw error:", injectionResult.error);
                console.error("FACEBOOK BACKGROUND: Injected function stack:", injectionResult.stack);
                sendResponse({
                  ok: false,
                  result: null,
                  error: injectionResult?.error || "Injected script error",
                });
              } else {
                // Normal result structure
                console.log("FACEBOOK BACKGROUND: Result ok:", injectionResult?.ok);
                if (injectionResult?.result) {
                  console.log("FACEBOOK BACKGROUND: Fields filled:", Object.keys(injectionResult.result.fields).length);
                  console.log("FACEBOOK BACKGROUND: Field results:", injectionResult.result.fields);
                }
                if (injectionResult?.error) {
                  console.error("FACEBOOK BACKGROUND: Error:", injectionResult.error);
                }
                sendResponse({
                  ok: Boolean(injectionResult?.ok),
                  result: injectionResult?.result || null,
                  error: injectionResult?.ok
                    ? null
                    : injectionResult?.error ||
                      "Facebook Marketplace form could not be detected.",
                });
              }
            })
            .catch((error) => {
              console.error("FACEBOOK BACKGROUND: EXECUTESCRIPT REJECTED", error?.message, error?.stack);
              console.log("FACEBOOK BACKGROUND: executeScript REJECTED");
              console.log("FACEBOOK BACKGROUND: executeScript error:", error);
              console.log("FACEBOOK BACKGROUND: executeScript error message:", error?.message);
              console.error("FACEBOOK BACKGROUND: ========== EXCEPTION DURING SCRIPT EXECUTION ==========");
              console.error("FACEBOOK BACKGROUND: Error:", error);
              console.error("FACEBOOK BACKGROUND: Error message:", error?.message);
              console.error("FACEBOOK BACKGROUND: Error stack:", error?.stack);

              // Check if it's a scripting-specific error
              if (error?.message?.includes("Cannot access")) {
                console.error("FACEBOOK BACKGROUND: Script access error - tab may be invalid or URL restricted");
              }

              sendResponse({
                ok: false,
                result: null,
                error: error?.message || String(error),
              });
            });
          }).catch(error => {
            console.error("FACEBOOK BACKGROUND: TAB CREATION ERROR:", error);
            sendResponse({
              ok: false,
              error: error?.message || String(error),
            });
          });
        }).catch(error => {
          console.error("FACEBOOK BACKGROUND: TAB CREATION ERROR:", error);
          sendResponse({
            ok: false,
            error: error?.message || String(error),
          });
        });
      });

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









