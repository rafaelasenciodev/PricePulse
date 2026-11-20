/** Starts the development server with demo data. In memory, or in PostgreSQL when `DATABASE_URL` is set. */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEMO_PROVIDER_TOKEN, seedDemoData } from "./demo-data";
import { chooseStorage, StorageRefused, type Storage } from "./storage";
import { readSettings, SettingsRefused, type Settings } from "./settings";

// How the server runs is decided first, from the environment (feature 12): it refuses production unless it is declared a
// demo, because the demo passwords below are public, and in production it also needs a database and its origin.
let settings: Settings;
try {
  settings = readSettings(process.env);
} catch (error) {
  if (error instanceof SettingsRefused) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

// Then where the data is kept.
let storage: Storage;
try {
  storage = await chooseStorage(process.env, { info: (message) => console.log(message), warn: (message) => console.warn(message) });
} catch (error) {
  if (error instanceof StorageRefused) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

// The cookie of the Session (feature 08) is set for one origin: the address at which the browser reaches the
// application. By default it is where this server listens. The interface in development is served by another
// server that forwards the API, and the browser then sees the origin of that one: `WEB_ORIGIN` says it, for
// example `WEB_ORIGIN=http://localhost:5173`. The cookie is `Secure` when that origin is an `https` address.
const { port, origin: webOrigin } = settings;

// The web interface is served when it has been built: `npm run build` in `frontend/` writes `frontend/dist`. Without it
// the server starts as it always did.
const webRoot = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));
const interfaceBuilt = existsSync(`${webRoot}index.html`);

const application = storage.compose({
  logger: true,
  ...(interfaceBuilt ? { webInterface: { root: webRoot } } : {}),
  sessionCookie: { origin: settings.origin, secure: settings.secureCookie },
  demo: settings.demo,
  apiDocs: {
    note: [
      // A demo says what it is. It does not say where its database is: the page is public.
      ...(settings.demo
        ? [
            "**Public demo with simulated data.** The Accounts, the Listings, the Retailers and the prices are fictitious, and the passwords and the token of the price provider below are public, so anyone can change the prices. The data can be reset at any time.",
            "",
          ]
        : []),
      storage.description === "memory"
        ? `${settings.demo ? "Demo" : "Development"} server with demo data held in memory.`
        : settings.demo
          ? "Demo server with its data kept in a PostgreSQL database."
          : `Development server with demo data kept in the PostgreSQL database ${storage.description}.`,
      "",
      `- Signing in also sets the session cookie, for a browser: \`HttpOnly\`, for ${webOrigin} only. Open this page at that address, so that the browser sends the cookie and the origin matches. The token in the body and the header \`Authorization\` work as always.`,
      "- Two Accounts to try: `demo1@example.com` with the password `demo-password-1`, and `demo2@example.com` with `demo-password-2`. They are two different Users. Sign in with `POST /sessions` and paste the `token` of the answer in Authorize: it is the token of a User, and it lasts 7 days. With the data in memory a restart loses it and the demo Accounts are created again; in a database they stay as they were left.",
      `- Token of the price provider, for the price observations: \`${DEMO_PROVIDER_TOKEN}\` (the provider \`simulator\`). It is not valid for the price alerts, and the tokens of the Users are not valid for the price observations.`,
      "- Six Listings with fictitious titles and Retailers, read with `GET /listings` (a page, ordered by title and then by identifier) and `GET /listings/{listingId}`, with the token of a User: `headphones-shop-a` (100.00 EUR), `headphones-shop-b` (104.90 EUR), `keyboard-shop-a` (59.00 EUR), `keyboard-shop-b` (50.00 USD), `webcam-shop-b` (45.00 USD) and `monitor-shop-a` (no Current Price). Choose one, and create a price alert for it.",
      "- The Current Price of a Listing is the price of its latest observation. Record a new one to change it.",
      "- A Price Alert of `demo1@example.com` for `headphones-shop-a` with a Target Price of 80.00 EUR. Record an observation of 80.00 or less for that Listing, as the price provider, and the log of the server shows the alert triggered.",
      "- Read the Notifications of a User with `GET /notifications`, and the Price History of a Listing with `GET /listings/{listingId}/price-observations`, both with the token of a User. The token of the price provider is not valid for them.",
      "- Read and manage the Price Alerts with the token of a User: `GET /price-alerts` lists them, `GET /price-alerts/{alertId}` reads one, and `PATCH /price-alerts/{alertId}` changes its Target Price or cancels it.",
    ].join("\n"),
  },
});
const { app } = application;

// Demo data. In a database it is created once, and a restart finds it as it was left.
const { created } = await seedDemoData(application);
console.log(created ? "Demo data created." : "Demo data was already there.");
if (settings.demo) console.log("Demo mode: this server is a demo with simulated data, and its passwords and the token of the Provider are public.");

// The local machine only, unless `HOST` says another address: the demo Accounts must not be reachable from outside by chance.
await app.listen({ port, host: settings.host });
app.log.info(`Interactive API documentation: http://127.0.0.1:${port}/docs`);
app.log.info(`Session cookie on for the origin ${webOrigin}`);
if (interfaceBuilt) app.log.info(`Web interface: ${webOrigin}/app/`);
else app.log.warn("The web interface is not built, so /app/ is not served. Run `npm run build` in frontend/ to build it.");

const stop = async () => {
  await app.close();
  await storage.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
