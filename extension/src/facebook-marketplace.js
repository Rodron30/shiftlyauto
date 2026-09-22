console.log(
  "SHIFTLY AUTO: Facebook Marketplace assistant loaded."
);
console.log("VEHICLE TYPE DEBUG: facebook-marketplace.js VERSION = FM_DEBUG_2026_09_21_A");

let shiftlyListing = null;
let isProcessing = false;


/* -------------------------------------------------------
   RECEIVE LISTING FROM BACKGROUND SCRIPT
------------------------------------------------------- */

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {

    if (!message) {
      return;
    }

    if (
      message.type === "SHIFTLY_FACEBOOK_LISTING"
    ) {

      shiftlyListing =
        message.listing || null;

      console.log(
        "SHIFTLY FACEBOOK LISTING RECEIVED:",
        shiftlyListing
      );

      sendResponse({
        success: true
      });
    }

    return true;
  }
);


/* -------------------------------------------------------
   LOAD SAVED LISTING
------------------------------------------------------- */

async function loadShiftlyListing() {

  try {

    const result =
      await chrome.storage.local.get(
        ["shiftlyFacebookListing"]
      );

    if (
      result &&
      result.shiftlyFacebookListing
    ) {

      shiftlyListing =
        result.shiftlyFacebookListing;

      console.log(
        "SHIFTLY SAVED LISTING:",
        shiftlyListing
      );

      return shiftlyListing;
    }

  } catch (error) {

    console.error(
      "SHIFTLY FACEBOOK STORAGE ERROR:",
      error
    );

  }

  return null;
}


/* -------------------------------------------------------
   START
------------------------------------------------------- */

async function initializeShiftlyFacebook() {

  await loadShiftlyListing();

  console.log(
    "SHIFTLY AUTO FACEBOOK READY"
  );

}


initializeShiftlyFacebook();