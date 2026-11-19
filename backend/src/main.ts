/** Starts the server with in-memory adapters and a little demo data. Development only. */

import { composeInMemoryApp } from "./composition-root";
import { ProviderId } from "./price-observations/domain";
import { ListingId, UserId } from "./shared/domain";

// The demo passwords below are public: this server must never run in production.
if (process.env["NODE_ENV"] === "production") {
  console.error("main.ts starts the development server with demo data and must not run in production.");
  process.exit(1);
}

const requestedPort = Number(process.env["PORT"]);
const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 3000;

const { app, catalogue, registerAccount, providerAuthenticator, recordPriceObservation, createPriceAlert } = composeInMemoryApp({
  logger: true,
  apiDocs: {
    note: [
      "Development server with demo data held in memory.",
      "",
      "- Two Accounts to try: `demo1@example.com` with the password `demo-password-1`, and `demo2@example.com` with `demo-password-2`. They are two different Users. Sign in with `POST /sessions` and paste the `token` of the answer in Authorize: it is the token of a User, and it lasts 7 days. Accounts and Sessions are kept in memory, so a restart loses them and the demo Accounts are created again.",
      "- Token of the price provider, for the price observations: `demo-provider-token` (the provider `simulator`). It is not valid for the price alerts, and the tokens of the Users are not valid for the price observations.",
      "- Listings: `headphones-shop-a` (100.00 EUR), `keyboard-shop-b` (50.00 USD) and `monitor-shop-a` (no Current Price).",
      "- The Current Price of a Listing is the price of its latest observation. Record a new one to change it.",
      "- A Price Alert of `demo1@example.com` for `headphones-shop-a` with a Target Price of 80.00 EUR. Record an observation of 80.00 or less for that Listing, as the price provider, and the log of the server shows the alert triggered.",
      "- Read the Notifications of a User with `GET /notifications`, and the Price History of a Listing with `GET /listings/{listingId}/price-observations`, both with the token of a User. The token of the price provider is not valid for them.",
      "- Read and manage the Price Alerts with the token of a User: `GET /price-alerts` lists them, `GET /price-alerts/{alertId}` reads one, and `PATCH /price-alerts/{alertId}` changes its Target Price or cancels it.",
    ].join("\n"),
  },
});

// Demo data. The retailers are fictitious: the project uses no real retailer data.
// The Accounts are registered with the use case, as anyone would: a password is only ever stored as a hash.
const demoUser = await registerAccount.execute({ email: "demo1@example.com", password: "demo-password-1" });
await registerAccount.execute({ email: "demo2@example.com", password: "demo-password-2" });
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
  owner: UserId(demoUser.id),
  listingId: ListingId("headphones-shop-a"),
  targetAmount: "80.00",
});

// Listen on the local machine only: the demo Accounts must not be reachable from outside.
await app.listen({ port, host: "127.0.0.1" });
app.log.info(`Interactive API documentation: http://127.0.0.1:${port}/docs`);

const stop = async () => {
  await app.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
