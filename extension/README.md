# Shiftly Auto — Chrome Extension (V1)

Implements Blueprint §25-27 (VIN detection + "Run Vehicle Report"),
§29 (Manifest V3 + TypeScript stack — this build uses plain JS to avoid
adding a bundler step; convert to TS later if you want),
§44-45 (security: no provider API key in the extension, extension talks
only to your own backend, never has direct database access).

## How it works

```
Inventory site (approved only)
   → content.js scans page text for 17-char VIN-shaped strings
   → sends matches to background.js (per-tab)
   → popup.js reads them when you click the toolbar icon
   → "Run Report" opens {WEB_APP_URL}/vehicles/{vin} in a new tab
```

The extension never calls a vehicle-history provider or your database
directly — it only opens your already-authenticated web app, which does
all of that server-side. That satisfies Blueprint §44's "never put your
private vehicle-history provider API key directly inside the Chrome
extension" rule by construction: the extension has no API keys at all.

## VIN detection is opt-in per site (Blueprint §27)

The manifest requests **no** upfront access to arbitrary websites
(`optional_host_permissions` only). The content script is not statically
declared in the manifest — `background.js` registers it dynamically via
`chrome.scripting.registerContentScripts()`, and only for origins the
dealer admin explicitly approved through the **Settings** (options) page,
which calls `chrome.permissions.request()` for that one domain. Add only
your own dealership's inventory site(s) there — never a site you don't
control or have permission to integrate with.

## Login / session detection

There's no separate extension login. The popup calls
`GET {WEB_APP_URL}/api/auth/session` with `credentials: "include"`, which
sends the same Supabase auth cookies the web app already set when you
signed in there. If you're logged into the web app in any tab, the
popup shows "Signed in — {Dealership}". The web app's route
(`web/app/api/auth/session/route.ts`, included in this bundle) sets CORS
headers scoped to `chrome-extension://` origins so this works cross-origin
without opening the endpoint to the public web.

## Before loading this for real

1. **Get your extension's actual ID.** Chrome assigns one on install —
   there's no need to hardcode it anywhere in this build (CORS handling
   dynamically echoes back whatever `chrome-extension://` origin sent the
   request), but note it down if you plan to publish to the Chrome Web
   Store later (a published extension gets a permanent ID).
2. **Edit `src/config.js`** — set `WEB_APP_URL` to your deployed app
   (e.g. `https://shiftly-auto.vercel.app`), not `localhost:3000`.
3. **Edit `manifest.json`'s `host_permissions`** — replace
   `https://shiftly-auto.example.com/*` with your real deployed domain (and
   keep `http://localhost:3000/*` only while developing). This is what
   lets the extension send cookies to your own app for the session check
   — separate from the optional per-inventory-site permissions above.
4. Replace the placeholder icons in `icons/` with your real logo (16×48×128 px PNGs).

## Load it for local testing

1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. **Load unpacked** → select this `extension/` folder.
4. Click the toolbar icon → **Settings** → add your inventory site's
   domain → **Add & Allow** (a Chrome permission prompt will appear —
   accept it).
5. Open that inventory page; any 17-character VIN-looking text on it
   should now show up in the popup with a **Run Report** button.

## Not built yet

- Icons are placeholders generated for this bundle — swap them for real
  branding before shipping.
- No visible on-page badge/overlay (Blueprint's mockup only shows the
  toolbar popup, which is what's implemented) — could add later.
- TypeScript + a bundler (per §29's recommended stack) — this build is
  plain JS/ES modules to keep the update self-contained with no new build
  tooling; straightforward to port once you're ready.
