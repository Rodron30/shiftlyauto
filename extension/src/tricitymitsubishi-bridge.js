(() => {
  const ALLOWED_ORIGIN = window.location.origin;

  let finalForwarded = false;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== ALLOWED_ORIGIN) return;

    const message = event.data;

    if (!message || message.type !== "TRICITY_INVENTORY_RESULT") {
      return;
    }

    const payload = message.payload;

    if (!payload || typeof payload !== "object") {
      console.warn(
        "Shiftly: Invalid Tri-City inventory payload"
      );
      return;
    }

    const vehicles = Array.isArray(payload.vehicles)
      ? payload.vehicles
      : [];

    const complete = payload.complete === true;
    const incomplete = payload.incomplete === true;
    const allPagesLoaded = payload.allPagesLoaded === true;

    const totalVehicles = Number(payload.totalVehicles || 0);
    const vehicleCount = Number(payload.vehicleCount || 0);
    const uniqueVehicleCount = Number(
      payload.uniqueVehicleCount || 0
    );

    const loadedPages = Array.isArray(payload.loadedPages)
      ? payload.loadedPages
      : [];

    const failedPages = Array.isArray(payload.failedPages)
      ? payload.failedPages
      : [];

    /*
     * Ignore intermediate page-progress events.
     *
     * The injector emits both:
     *   - individual page results
     *   - one final aggregate result
     *
     * Only the final aggregate should cross the extension
     * boundary as the inventory result.
     */
    if (!complete) {
      console.log(
        "Shiftly: Tri-City progress event ignored",
        {
          page: payload.page,
          vehicleCount,
          loadedPages: loadedPages.length,
          failedPages: failedPages.length,
        }
      );
      return;
    }

    /*
     * Never forward an explicitly incomplete collection.
     */
    if (incomplete) {
      console.warn(
        "Shiftly: Tri-City complete event marked incomplete; ignoring"
      );
      return;
    }

    /*
     * Final collection must have every page loaded and no failures.
     */
    if (!allPagesLoaded) {
      console.warn(
        "Shiftly: Tri-City final payload rejected: not all pages loaded",
        {
          loadedPages: loadedPages.length,
          totalPages: payload.totalPages,
        }
      );
      return;
    }

    if (failedPages.length > 0) {
      console.warn(
        "Shiftly: Tri-City final payload rejected: failed pages detected",
        failedPages
      );
      return;
    }

    /*
     * Validate the aggregate counts before forwarding.
     */
    if (
      totalVehicles <= 0 ||
      vehicleCount !== totalVehicles ||
      uniqueVehicleCount !== totalVehicles ||
      vehicles.length !== totalVehicles
    ) {
      console.warn(
        "Shiftly: Tri-City final payload rejected: count mismatch",
        {
          totalVehicles,
          vehicleCount,
          uniqueVehicleCount,
          vehiclesLength: vehicles.length,
        }
      );
      return;
    }

    /*
     * Prevent duplicate final forwarding.
     */
    if (finalForwarded) {
      console.warn(
        "Shiftly: Duplicate Tri-City final payload ignored"
      );
      return;
    }

    finalForwarded = true;

    console.log(
      "Shiftly: Tri-City FINAL inventory bridge accepted",
      {
        totalVehicles,
        vehicleCount,
        uniqueVehicleCount,
        loadedPages: loadedPages.length,
        failedPages: failedPages.length,
      }
    );

    try {
      if (typeof chrome === "undefined" ||
          !chrome.runtime ||
          typeof chrome.runtime.sendMessage !== "function") {
        finalForwarded = false;
        console.error(
          "Shiftly: Tri-City bridge cannot access extension runtime. Check the content-script execution context."
        );
        return;
      }

      chrome.runtime.sendMessage(
        {
          type: "SHIFTLY_TRICITY_INVENTORY_RESULT",
          payload,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            finalForwarded = false;
            console.error(
              "Shiftly: Tri-City inventory handoff failed:",
              chrome.runtime.lastError.message
            );
            return;
          }

          console.log(
            "Shiftly: Tri-City inventory handoff response:",
            response
          );

          if (!response || response.ok !== true) {
            finalForwarded = false;
            console.error(
              "Shiftly: Background did not accept final inventory",
              response
            );
          }
        }
      );
    } catch (error) {
      finalForwarded = false;
      console.error(
        "Shiftly: Tri-City inventory handoff threw an error:",
        error
      );
    }
  });

  console.log(
    "Shiftly: Tri-City bridge loaded"
  );
})();
