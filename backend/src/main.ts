/** Starts the server with in-memory adapters and a little demo data. Development only. */

import { composeInMemoryApp } from "./composition-root";
import { UserId } from "./price-alerts/domain";
import { ProviderId } from "./price-observations/domain";
import { ListingId } from "./shared/domain";

// The demo tokens below are public: this server must never run in production.
if (process.env["NODE_ENV"] === "production") {
  console.error("main.ts starts the development server with demo data and must not run in production.");
  process.exit(1);
}

const requestedPort = Number(process.env["PORT"]);
const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 3000;

const { app, catalogue, authenticator, providerAuthenticator, recordPriceObservation, createPriceAlert } = composeInMemoryApp({
  logger: true,
  apiDocs: {
    note: [
      "Development server with demo data held in memory.",
      "",
      "- Tokens of Users, for the price alerts: `demo-token-1` and `demo-token-2` (two different Users).",
      "- Token of the price provider, for the price observations: `demo-provider-token` (the provider `simulator`). It is not valid for the price alerts, and the tokens of the Users are not valid for the price observations.",
      "- Listings: `headphones-shop-a` (100.00 EUR), `keyboard-shop-b` (50.00 USD) and `monitor-shop-a` (no Current Price).",
      "- The Current Price of a Listing is the price of its latest observation. Record a new one to change it.",
      "- A Price Alert of `demo-user-1` for `headphones-shop-a` with a Target Price of 80.00 EUR. Record an observation of 80.00 or less for that Listing, as the price provider, and the log of the server shows the alert triggered.",
      "- Read and manage the Price Alerts with the token of a User: `GET /price-alerts` lists them, `GET /price-alerts/{alertId}` reads one, and `PATCH /price-alerts/{alertId}` changes its Target Price or cancels it.",
    ].join("\n"),
  },
});

// Demo data. The retailers are fictitious: the project uses no real retailer data.
authenticator.addUser("demo-token-1", UserId("demo-user-1"));
authenticator.addUser("demo-token-2", UserId("demo-user-2"));
providerAuthenticator.addProvider("demo-provider-token", ProviderId("simulator"));

catalogue.addListing(ListingId("headphones-shop-a"), "EUR");
catalogue.addListing(ListingId("keyboard-shop-b"), "USD");
catalogue.addListing(ListingId("monitor-shop-a"), "EUR");

// The first prices are recorded as the simulator would, with the real use case: a Listing has
// a Current Price only because an observation says so.
const demoProvider = ProviderId("simulator");
const observedAt = new Date().toISOString();
await recordPriceObservation.execute({
  provider: demoProvider,
  listingId: ListingId("headphones-shop-a"),
  observedAt,
  price: { amount: "100.00", currency: "EUR" },
});
await recordPriceObservation.execute({
  provider: demoProvider,
  listingId: ListingId("keyboard-shop-b"),
  observedAt,
  price: { amount: "50.00", currency: "USD" },
});
await recordPriceObservation.execute({
  provider: demoProvider,
  listingId: ListingId("monitor-shop-a"),
  observedAt,
  price: null, // unavailable: no Current Price
});

// A demo Price Alert, so that the round trip can be seen: it is triggered when an observation of
// the provider brings the price of the headphones to 80.00 or less, and the log says so.
await createPriceAlert.execute({
  owner: UserId("demo-user-1"),
  listingId: ListingId("headphones-shop-a"),
  targetAmount: "80.00",
});

// Listen on the local machine only: the demo tokens must not be reachable from outside.
await app.listen({ port, host: "127.0.0.1" });
app.log.info(`Interactive API documentation: http://127.0.0.1:${port}/docs`);

const stop = async () => {
  await app.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
