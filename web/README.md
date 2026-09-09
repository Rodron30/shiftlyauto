# Shiftly Auto — V1

Dealership vehicle-intelligence application based on the Shiftly Auto V1 Blueprint.

## V1 workflow

VIN entry/detection → VIN validation → VIN decode → vehicle profile → vehicle history → theft + odometer analysis → AI explanation → customer report → share link / PDF.

The V1 deliberately does **not** include accident/damage, rollover, registration, CRM, financing, pricing, trade appraisal, or inventory-suite features.

## Project structure

- `web/` — Next.js + React + TypeScript web application
- `database/migrations/` — Supabase/PostgreSQL migrations
- `extension/` — Chrome Manifest V3 VIN detector

## Requirements

- Node.js 20+
- Supabase project with Auth enabled
- Perplexity API key for AI summaries
- A legitimate/commercial vehicle-history data provider for automated history lookup

VIN decoding uses the public NHTSA vPIC decoder. Until a commercial history provider is configured, history can be recorded as clearly labeled manual dealer entries; the application never treats missing history as a confirmed clean history.

## Setup

1. Copy `web/.env.local.example` to `web/.env.local`.
2. Put your real Supabase URL and publishable key in `web/.env.local`.
3. Add your `PERPLEXITY_API_KEY`.
4. Run the SQL migrations in `database/migrations/` in numeric order (`0002` through `0007`) in the Supabase SQL editor.
5. In `web/`, run:

```powershell
npm install
npm run dev
```

6. Open `http://localhost:3000`.

## Supabase Auth

The signup flow creates a dealership and admin profile. Team invites allow an admin to create manager/salesperson invite links. Email confirmation is handled by Supabase Auth.

## Chrome extension

Load the `extension/` folder as an unpacked extension in Chrome. In the extension options, explicitly approve inventory-site origins. The extension only detects VINs on approved origins and sends no private vehicle-history provider key to the browser.

Before using a deployed environment, update `extension/src/config.js` and the extension manifest host permissions to the deployed web-app origin.

## Security boundary

- Dealer data is isolated with PostgreSQL RLS.
- Provider/AI secrets stay server-side.
- Public report links expose the customer-report snapshot only.
- Share links can be revoked without deleting the internal report.
- VIN/history/AI APIs use authenticated Supabase sessions where dealer data is involved.
- Rate limiting is applied to AI/report creation endpoints.

## V1 data boundary

History events are limited to `THEFT`, `ODOMETER`, and `OTHER`; the V1 schema intentionally does not add accident, rollover, or registration event types.
