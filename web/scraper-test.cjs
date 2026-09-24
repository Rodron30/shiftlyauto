require("tsx/cjs");

const { crawlInventory } = require("./lib/scraper/inventory-crawler.ts");

crawlInventory(
  "https://www.hyundaidemo.dealerinspire.com/new-vehicles/",
  {
    maxVehicles: 5,
    delayMs: 500
  }
)
.then(r => {
  console.log(
    JSON.stringify(
      {
        vehicles: r.vehicles.map(v => ({
          vin: v.vin,
          title: v.title,
          images: v.imageUrls?.length,
          source: v.sourceUrl
        })),
        errors: r.errors
      },
      null,
      2
    )
  );
})
.catch(e => {
  console.error(e);
});
