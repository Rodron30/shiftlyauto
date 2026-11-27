import { buildTriCityDryRunPlan } from "./tricity-dry-run";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`PASS: ${message}`);
}

const existing = [
  { vin: "VIN-EXISTING" },
  { vin: "VIN-MISSING" },
];

const scraped = [
  { vin: "VIN-EXISTING" },
  { vin: "VIN-NEW" },
];

const completePlan = buildTriCityDryRunPlan(
  existing,
  scraped,
  true
);

assert(
  completePlan.create.includes("VIN-NEW"),
  "new VIN is planned for CREATE"
);

assert(
  completePlan.update.includes("VIN-EXISTING"),
  "existing VIN is planned for UPDATE"
);

assert(
  completePlan.remove.includes("VIN-MISSING"),
  "missing VIN is removable only after complete scrape"
);

const incompletePlan = buildTriCityDryRunPlan(
  existing,
  scraped,
  false
);

assert(
  incompletePlan.create.includes("VIN-NEW"),
  "incomplete scrape can still identify new VIN"
);

assert(
  incompletePlan.update.includes("VIN-EXISTING"),
  "incomplete scrape can still identify existing VIN"
);

assert(
  incompletePlan.remove.length === 0,
  "incomplete scrape NEVER removes missing VIN"
);

console.log("Tri-City dry-run safety tests PASSED.");
