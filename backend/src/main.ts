/** Starts the server with in-memory adapters and a little demo data. Development only. */

import { composeInMemoryApp } from "./composition-root";
import { ListingId, Price, UserId } from "./price-alerts/domain";

const requestedPort = Number(process.env["PORT"]);
const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 3000;

const { app, listings, authenticator } = composeInMemoryApp({ logger: true });

// Demo data. The retailers are fictitious: the project uses no real retailer data.
authenticator.addUser("demo-token-1", UserId("demo-user-1"));
authenticator.addUser("demo-token-2", UserId("demo-user-2"));
listings.addListing(ListingId("headphones-shop-a"), "EUR", Price.fromDecimalString("100.00", "EUR"));
listings.addListing(ListingId("keyboard-shop-b"), "USD", Price.fromDecimalString("50.00", "USD"));
listings.addListing(ListingId("monitor-shop-a"), "EUR"); // unavailable: no Current Price

// Listen on the local machine only: the demo tokens must not be reachable from outside.
await app.listen({ port, host: "127.0.0.1" });

const stop = async () => {
  await app.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
