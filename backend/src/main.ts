/** Starts the server with in-memory adapters and a little demo data. Development only. */

import { composeInMemoryApp } from "./composition-root";
import { ListingId, Price, UserId } from "./price-alerts/domain";

// The demo tokens below are public: this server must never run in production.
if (process.env["NODE_ENV"] === "production") {
  console.error("main.ts starts the development server with demo data and must not run in production.");
  process.exit(1);
}

const requestedPort = Number(process.env["PORT"]);
const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 3000;

const { app, listings, authenticator } = composeInMemoryApp({
  logger: true,
  apiDocs: {
    note: [
      "Development server with demo data held in memory.",
      "",
      "- Tokens: `demo-token-1` and `demo-token-2` (two different Users).",
      "- Listings: `headphones-shop-a` (100.00 EUR), `keyboard-shop-b` (50.00 USD) and `monitor-shop-a` (no Current Price).",
    ].join("\n"),
  },
});

// Demo data. The retailers are fictitious: the project uses no real retailer data.
authenticator.addUser("demo-token-1", UserId("demo-user-1"));
authenticator.addUser("demo-token-2", UserId("demo-user-2"));
listings.addListing(ListingId("headphones-shop-a"), "EUR", Price.fromDecimalString("100.00", "EUR"));
listings.addListing(ListingId("keyboard-shop-b"), "USD", Price.fromDecimalString("50.00", "USD"));
listings.addListing(ListingId("monitor-shop-a"), "EUR"); // unavailable: no Current Price

// Listen on the local machine only: the demo tokens must not be reachable from outside.
await app.listen({ port, host: "127.0.0.1" });
app.log.info(`Interactive API documentation: http://127.0.0.1:${port}/docs`);

const stop = async () => {
  await app.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
