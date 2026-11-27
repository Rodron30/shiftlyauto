(() => {
  console.log("Shiftly Auto: Tri-City safe pagination collector loaded");

  const host = window.location.hostname.toLowerCase();

  if (
    host !== "www.tricitymits.com" &&
    host !== "tricitymits.com"
  ) {
    return;
  }

  const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const getVm = () => {
    const el = [...document.querySelectorAll("*")].find((node) => {
      const vm = node.__vue__;

      const vehicles = Array.isArray(vm?.vehicles)
        ? vm.vehicles
        : [];

      const totalVehicles = Number(
        vm?.summary?.total_vehicles || 0
      );

      return (
        vm &&
        typeof vm.updatePage === "function" &&
        typeof vm.pageLimit === "number" &&
        vehicles.length > 0 &&
        totalVehicles > 0
      );
    });

    return el?.__vue__ || null;
  };

  const normalizeImage = (image) => {
    if (!image || typeof image !== "object") {
      return null;
    }

    return {
      original: image.image_original || null,
      large: image.image_lg || null,
      medium: image.image_md || null,
      small: image.image_sm || null,
      extraSmall: image.image_xs || null,
    };
  };

  const normalizeVehicle = (vehicle) => {
    if (!vehicle || typeof vehicle !== "object") {
      return null;
    }

    const images = Array.isArray(vehicle.image)
      ? vehicle.image.map(normalizeImage).filter(Boolean)
      : [];

    const imageUrls = images
      .map((image) =>
        image.original ||
        image.large ||
        image.medium ||
        image.small ||
        image.extraSmall
      )
      .filter(Boolean);

    return {
      vehicleId: vehicle.vehicle_id ?? null,
      vin: vehicle.vin || null,
      stockNumber: vehicle.stock_number || null,
      year: vehicle.year ?? null,
      make: vehicle.make || null,
      model: vehicle.model || null,
      trim: vehicle.trim || null,
      modelCode: vehicle.model_code || null,
      packageCode: vehicle.package_code || null,
      bodyStyle: vehicle.body_style || null,
      saleClass: vehicle.sale_class || null,
      vehicleClass:
        vehicle.vehicle_class_en ||
        vehicle.vehicle_class ||
        null,
      drivetrain: vehicle.drive_train || null,
      engine: vehicle.engine || null,
      fuelType: vehicle.fuel_type || null,
      transmission: vehicle.transmission || null,
      exteriorColor: vehicle.exterior_color || null,
      manufacturerExteriorColor:
        vehicle.manu_exterior_color || null,
      interiorColor: vehicle.interior_color || null,
      odometer: vehicle.odometer ?? null,
      initialPrice: vehicle.initial_price ?? null,
      finalPrice: vehicle.final_price ?? null,
      calculatedFinalPrice:
        vehicle.final_price_calculated ?? null,
      vdpUrl: vehicle.vdp_url || null,
      youtubeUrl: vehicle.yt_url || null,
      hasImages: Boolean(vehicle.has_images),
      images,
      imageUrls,
      imageCount: imageUrls.length,
      description: vehicle.description || null,
      source: "tricitymits",
      sourceVehicleId: vehicle.vehicle_id ?? null,
      sourceUrl: vehicle.vdp_url || null,
    };
  };

  const getVehicleKey = (vehicle) => {
    return (
      vehicle.vin ||
      vehicle.vehicleId ||
      vehicle.stockNumber ||
      vehicle.vdpUrl ||
      `${vehicle.year || ""}-${vehicle.make || ""}-${vehicle.model || ""}-${vehicle.trim || ""}`
    );
  };

  const emit = (payload) => {
    window.__SHIFTLY_TRICITY_LAST_RESULT = payload;

    window.postMessage(
      {
        source: "shiftly-auto",
        type: "TRICITY_INVENTORY_RESULT",
        payload,
      },
      window.location.origin
    );

    console.log(
      "Shiftly Auto: Tri-City inventory result",
      {
        page: payload.page,
        pageSize: payload.pageSize,
        totalPages: payload.totalPages,
        totalVehicles: payload.totalVehicles,
        vehicleCount: payload.vehicleCount,
        uniqueVehicleCount: payload.uniqueVehicleCount,
        complete: payload.complete,
      }
    );
  };

  const waitForVm = async () => {
    for (let i = 0; i < 120; i++) {
      const vm = getVm();

      if (vm) {
        return vm;
      }

      await sleep(500);
    }

    return null;
  };

  const waitForPageData = async (
    vm,
    targetPage,
    previousSignature
  ) => {
    const started = Date.now();
    let observedSignature = "";
    let stablePolls = 0;
    let observedTargetPage = false;

    while (Date.now() - started < 30000) {
      const currentPage = Number(vm.currentPage);
      const currentVehicles = Array.isArray(vm.vehicles)
        ? vm.vehicles
        : [];

      if (currentPage === Number(targetPage)) {
        observedTargetPage = true;

        const signature = currentVehicles
          .map(getVehicleKey)
          .filter(Boolean)
          .join("|");

        if (
          currentVehicles.length > 0 &&
          signature &&
          signature !== previousSignature
        ) {
          if (signature === observedSignature) {
            stablePolls += 1;
          } else {
            observedSignature = signature;
            stablePolls = 1;
          }

          if (stablePolls >= 3) {
            return {
              vehicles: [...currentVehicles],
              signature,
              observedPage: currentPage,
            };
          }
        } else {
          observedSignature = "";
          stablePolls = 0;
        }
      } else {
        observedSignature = "";
        stablePolls = 0;
      }

      await sleep(250);
    }

    return {
      vehicles: [],
      signature: "",
      timeout: true,
      targetPage,
      observedPage: vm.currentPage ?? null,
      observedTargetPage,
    };
  };
  const collectAllPages = async () => {
    if (window.__SHIFTLY_TRICITY_COLLECTING) {
      console.log(
        "Shiftly Auto: Tri-City collector already running"
      );
      return;
    }

    window.__SHIFTLY_TRICITY_COLLECTING = true;

    try {
      const vm = await waitForVm();

      if (!vm) {
        console.warn(
          "Shiftly Auto: Tri-City Vue VM not found"
        );
        return;
      }

      const summary = vm.summary || {};

      const totalVehicles = Number(
        summary.total_vehicles || 0
      );

      const pageSize = Number(
        vm.pageLimit || 15
      );

      if (!totalVehicles || !pageSize) {
        console.warn(
          "Shiftly Auto: Missing pagination totals",
          {
            totalVehicles,
            pageSize,
          }
        );

        return;
      }

      const totalPages = Math.ceil(
        totalVehicles / pageSize
      );

      console.log(
        "Shiftly Auto: Starting safe pagination",
        {
          totalVehicles,
          pageSize,
          totalPages,
        }
      );

      const collected = new Map();
      const loadedPages = new Set();
      const failedPages = [];

      let previousSignature = "";

      for (
        let page = 1;
        page <= totalPages;
        page++
      ) {
        console.log(
          `Shiftly Auto: Loading page ${page}/${totalPages}`
        );

        let result;

        if (page === 1) {
          const currentVehicles = Array.isArray(vm.vehicles)
            ? vm.vehicles
            : [];

          const currentSignature = currentVehicles
            .map(getVehicleKey)
            .filter(Boolean)
            .slice(-50)
            .join("|");

          if (
            vm.currentPage !== 1 ||
            currentVehicles.length === 0 ||
            !currentSignature
          ) {
            console.log(
              "Shiftly Auto: Requesting page 1 before collection",
              {
                currentPage: vm.currentPage,
                currentVehicleCount: currentVehicles.length,
              }
            );

            if (vm.currentPage !== 1) {
              vm.updatePage(1);
            }

            result = await waitForPageData(
              vm,
              1,
              vm.currentPage !== 1 ? currentSignature : ""
            );
          } else {
            result = {
              vehicles: currentVehicles,
              signature: currentSignature,
            };
          }
        } else {
          const beforePageVehicles = Array.isArray(vm.vehicles)
            ? vm.vehicles
            : [];

          const beforePageSignature = beforePageVehicles
            .map(getVehicleKey)
            .filter(Boolean)
            .slice(-50)
            .join("|");

          vm.updatePage(page);

          result = await waitForPageData(
            vm,
            page,
            beforePageSignature || previousSignature
          );
        }

        if (result.timeout) {
          console.warn(
            "Shiftly Auto: Page request timeout",
            page
          );

          failedPages.push(page);

          emit({
            source: "tricitymits",
            page,
            pageSize,
            totalPages,
            totalVehicles,
            vehicles: [],
            vehicleCount: 0,
            uniqueVehicleCount: collected.size,
            complete: false,
            incomplete: true,
            error: "PAGE_TIMEOUT",
            capturedAt: new Date().toISOString(),
          });

          break;
        }

        if (
          page > 1 &&
          result.signature === previousSignature
        ) {
          console.warn(
            "Shiftly Auto: Duplicate/stale page data detected",
            {
              page,
              previousPage: page - 1,
            }
          );

          failedPages.push(page);

          emit({
            source: "tricitymits",
            requestUrl: null,
            page,
            pageSize,
            totalPages,
            totalVehicles,
            vehicles: [],
            vehicleCount: 0,
            uniqueVehicleCount: collected.size,
            loadedPages: [...loadedPages],
            failedPages: [...failedPages],
            allPagesLoaded: false,
            complete: false,
            incomplete: true,
            error: "DUPLICATE_PAGE_DATA",
            capturedAt: new Date().toISOString(),
          });

          break;
        }

        previousSignature = result.signature;
        loadedPages.add(page);

        const pageVehicles = result.vehicles
          .map(normalizeVehicle)
          .filter(Boolean);

        for (const vehicle of pageVehicles) {
          const key = getVehicleKey(vehicle);

          if (key) {
            collected.set(String(key), vehicle);
          }
        }

        const allVehicles = [...collected.values()];

        const allPagesLoaded =
          loadedPages.size === totalPages &&
          failedPages.length === 0;

        // Progress events must never be treated as final inventory.
        const complete = false;

        emit({
          source: "tricitymits",
          requestUrl: null,
          page,
          pageSize,
          totalPages,
          totalVehicles,
          vehicles: pageVehicles,
          vehicleCount: pageVehicles.length,
          uniqueVehicleCount: allVehicles.length,
          loadedPages: [...loadedPages],
          failedPages: [...failedPages],
          allPagesLoaded,
          complete,
          incomplete: !complete,
          capturedAt: new Date().toISOString(),
        });

        console.log(
          "Shiftly Auto: Pagination progress",
          {
            page,
            pageVehicles: pageVehicles.length,
            uniqueVehicles: allVehicles.length,
            totalVehicles,
            complete,
          }
        );

        if (complete) {
          break;
        }

        await sleep(500);
      }

      const finalVehicles = [...collected.values()];

      const allPagesLoaded =
        loadedPages.size === totalPages &&
        failedPages.length === 0;

      const complete =
        allPagesLoaded &&
        finalVehicles.length === totalVehicles;

      console.log(
        "Shiftly Auto: Tri-City collection finished",
        {
          totalVehicles,
          collectedVehicles: finalVehicles.length,
          loadedPages: [...loadedPages],
          failedPages: [...failedPages],
          allPagesLoaded,
          complete,
        }
      );

      emit({
        source: "tricitymits",
        requestUrl: null,
        page: totalPages,
        pageSize,
        totalPages,
        totalVehicles,
        vehicles: finalVehicles,
        vehicleCount: finalVehicles.length,
        uniqueVehicleCount: finalVehicles.length,
        loadedPages: [...loadedPages],
        failedPages: [...failedPages],
        allPagesLoaded,
        complete,
        incomplete: !complete,
        capturedAt: new Date().toISOString(),
      });
    } finally {
      window.__SHIFTLY_TRICITY_COLLECTING = false;
    }
  };

  window.__SHIFTLY_TRICITY_COLLECT_ALL = collectAllPages;

  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      event.origin !== window.location.origin
    ) {
      return;
    }

    if (
      event.data?.source === "shiftly-auto" &&
      event.data?.type === "TRICITY_START_INVENTORY_SCAN"
    ) {
      collectAllPages();
    }
  });

  console.log(
    "Shiftly Auto: Tri-City safe collector ready"
  );
})();


