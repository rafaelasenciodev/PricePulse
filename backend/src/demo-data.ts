/**
 * The demo data of the development server: two Accounts, six Listings with their first prices, and one Price Alert.
 *
 * The retailers are fictitious: the project uses no real retailer data. The data is made with the use cases, as anyone
 * would, so a password is only ever stored as a hash. With a database that lasts, it must be made once: the Account
 * `demo1` is the mark, and when its registration says that the email exists the data is already there and nothing else
 * is created, so a restart does not undo what a person did to it (BR-12). The token of the demo provider is not data
 * but configuration of the running server, so it is given every time.
 */

import { EmailAlreadyRegistered } from "./accounts/application";
import type { Application } from "./composition-root";
import { ProviderId } from "./price-observations/domain";
import { ListingId, UserId } from "./shared/domain";

/** The passwords are public: this data must never be in a server that anyone can reach. */
export const DEMO_ACCOUNTS = [
  { email: "demo1@example.com", password: "demo-password-1" },
  { email: "demo2@example.com", password: "demo-password-2" },
] as const;

export const DEMO_PROVIDER_TOKEN = "demo-provider-token";

// Two pairs of Listings share a title in different shops, so that the order by title and then by identifier can be seen.
// The first prices are recorded as the simulator would, with the real use case: a Listing has a Current Price only because
// an observation says so, and one of them has none (unavailable).
const DEMO_LISTINGS = [
  { id: "headphones-shop-a", title: "Wireless headphones", retailer: "Shop A", currency: "EUR", price: "100.00" },
  { id: "headphones-shop-b", title: "Wireless headphones", retailer: "Shop B", currency: "EUR", price: "104.90" },
  { id: "keyboard-shop-a", title: "Mechanical keyboard", retailer: "Shop A", currency: "EUR", price: "59.00" },
  { id: "keyboard-shop-b", title: "Mechanical keyboard", retailer: "Shop B", currency: "USD", price: "50.00" },
  { id: "webcam-shop-b", title: "HD webcam", retailer: "Shop B", currency: "USD", price: "45.00" },
  { id: "monitor-shop-a", title: "27-inch monitor", retailer: "Shop A", currency: "EUR", price: null },
] as const;

/** Gives the demo provider its token, and creates the demo data if it is not there. Tells whether it created it. */
export async function seedDemoData(application: Application): Promise<{ created: boolean }> {
  const { registerAccount, catalogue, recordPriceObservation, createPriceAlert, providerAuthenticator } = application;
  const simulator = ProviderId("simulator");
  providerAuthenticator.addProvider(DEMO_PROVIDER_TOKEN, simulator);

  const [first, second] = DEMO_ACCOUNTS;
  let demoUser;
  try {
    demoUser = await registerAccount.execute(first);
  } catch (error) {
    if (error instanceof EmailAlreadyRegistered) return { created: false };
    throw error;
  }
  await registerAccount.execute(second);

  const observedAt = new Date().toISOString();
  for (const { id, title, retailer, currency, price } of DEMO_LISTINGS) {
    await catalogue.addListing(ListingId(id), currency, { title, retailer });
    await recordPriceObservation.execute({
      provider: simulator,
      listingId: ListingId(id),
      observedAt,
      price: price === null ? null : { amount: price, currency },
    });
  }

  // A demo Price Alert, so that the round trip can be seen: it is triggered when an observation of the provider brings
  // the price of the headphones to 80.00 or less, and the log says so.
  await createPriceAlert.execute({ owner: UserId(demoUser.id), listingId: ListingId("headphones-shop-a"), targetAmount: "80.00" });
  return { created: true };
}
