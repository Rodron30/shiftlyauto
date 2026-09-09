const STORAGE_KEY = "allowedOrigins";

const form =
  document.getElementById("add-form");

const input =
  document.getElementById("domain-input");

const list =
  document.getElementById("domain-list");

const errorEl =
  document.getElementById("error");

const emptyState =
  document.getElementById("empty-state");

/* -------------------------------------------------------
   ERROR
------------------------------------------------------- */

function showError(message) {
  if (!errorEl) return;

  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  if (!errorEl) return;

  errorEl.textContent = "";
  errorEl.hidden = true;
}

/* -------------------------------------------------------
   NORMALIZE
------------------------------------------------------- */

function normalizeDomain(raw) {
  let value =
    String(raw || "")
      .trim()
      .toLowerCase();

  value =
    value.replace(
      /^https?:\/\//,
      ""
    );

  value =
    value.split("/")[0];

  value =
    value.split("?")[0];

  value =
    value.split("#")[0];

  return value;
}

/* -------------------------------------------------------
   VALIDATE ORIGIN
------------------------------------------------------- */

function isValidOrigin(origin) {
  try {
    const url =
      new URL(origin);

    return (
      (url.protocol === "https:" ||
        url.protocol === "http:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

/* -------------------------------------------------------
   GET ORIGINS
------------------------------------------------------- */

async function getAllowedOrigins() {
  const result =
    await chrome.storage.sync.get({
      [STORAGE_KEY]: [],
    });

  const stored =
    Array.isArray(result[STORAGE_KEY])
      ? result[STORAGE_KEY]
      : [];

  const valid =
    Array.from(
      new Set(
        stored
          .map((value) => {
            try {
              return new URL(
                String(value)
              ).origin;
            } catch {
              return null;
            }
          })
          .filter(isValidOrigin)
      )
    );

  if (
    valid.length !==
    stored.length
  ) {
    await chrome.storage.sync.set({
      [STORAGE_KEY]: valid,
    });
  }

  return valid;
}

/* -------------------------------------------------------
   SAVE ORIGINS
------------------------------------------------------- */

async function setAllowedOrigins(
  origins
) {
  const valid =
    Array.from(
      new Set(
        origins
          .map((origin) => {
            try {
              return new URL(
                String(origin)
              ).origin;
            } catch {
              return null;
            }
          })
          .filter(isValidOrigin)
      )
    );

  await chrome.storage.sync.set({
    [STORAGE_KEY]: valid,
  });

  console.log(
    "SHIFTLY SAVED ALLOWED ORIGINS:",
    valid
  );

  await chrome.runtime.sendMessage({
    type:
      "SHIFTLY_SYNC_CONTENT_SCRIPTS",
  });
}

/* -------------------------------------------------------
   RENDER
------------------------------------------------------- */

async function renderList() {
  const origins =
    await getAllowedOrigins();

  list.innerHTML = "";

  emptyState.hidden =
    origins.length > 0;

  for (const origin of origins) {
    const li =
      document.createElement("li");

    const label =
      document.createElement("span");

    label.textContent =
      origin.replace(
        /^https?:\/\//,
        ""
      );

    li.appendChild(label);

    const removeBtn =
      document.createElement("button");

    removeBtn.type = "button";
    removeBtn.textContent =
      "Remove";

    removeBtn.className =
      "remove-btn";

    removeBtn.addEventListener(
      "click",
      async () => {
        const permissionPattern =
          `${origin}/*`;

        try {
          await chrome.permissions.remove({
            origins: [
              permissionPattern,
            ],
          });
        } catch (error) {
          console.warn(
            "Could not remove browser permission:",
            error
          );
        }

        const current =
          await getAllowedOrigins();

        const updated =
          current.filter(
            (item) =>
              item !== origin
          );

        await setAllowedOrigins(
          updated
        );

        await renderList();
      }
    );

    li.appendChild(
      removeBtn
    );

    list.appendChild(li);
  }
}

/* -------------------------------------------------------
   ADD SITE
------------------------------------------------------- */

form.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    clearError();

    const domain =
      normalizeDomain(
        input.value
      );

    if (
      !domain ||
      !domain.includes(".")
    ) {
      showError(
        "Enter a valid domain, e.g. inventory.yourdealership.com"
      );
      return;
    }

    const origin =
      `https://${domain}`;

    const permissionPattern =
      `${origin}/*`;

    if (
      !isValidOrigin(origin)
    ) {
      showError(
        "Enter a valid HTTP or HTTPS domain."
      );
      return;
    }

    try {
      console.log(
        "SHIFTLY REQUESTING PERMISSION:",
        permissionPattern
      );

      const granted =
        await chrome.permissions.request({
          origins: [
            permissionPattern,
          ],
        });

      console.log(
        "SHIFTLY PERMISSION GRANTED:",
        granted
      );

      if (!granted) {
        showError(
          "Permission was not granted for that site."
        );
        return;
      }

      const current =
        await getAllowedOrigins();

      if (
        !current.includes(origin)
      ) {
        await setAllowedOrigins([
          ...current,
          origin,
        ]);
      } else {
        await setAllowedOrigins(
          current
        );
      }

      input.value = "";

      await renderList();
    } catch (error) {
      console.error(
        "SHIFTLY ADD SITE FAILED:",
        error
      );

      showError(
        "Could not request permission for that domain."
      );
    }
  }
);

/* -------------------------------------------------------
   INITIALIZE
------------------------------------------------------- */

renderList();