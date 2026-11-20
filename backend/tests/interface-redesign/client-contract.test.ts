/**
 * The operation of the client that belongs to feature 13 (the Price History) against the real application, listening
 * on a port of its own. If the API changes what it answers, or the client expects something that the API does not
 * give, a test here breaks. Each test names the scenario (SC-nn) or the rule (BR-nn) of feature 13.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiClient, type ApiClient } from "../../../frontend/src/api";
import { FAST_SCRYPT_PARAMETERS, ScryptPasswordHasher } from "../../src/accounts/adapters";
import { composeInMemoryApp } from "../../src/composition-root";
import { ProviderId } from "../../src/price-observations/domain";
import { ListingId } from "../../src/shared/domain";
import { browserFor, freePort } from "../web-interface/client-support";

const PASSWORD = "first-password-1";

let application: ReturnType<typeof composeInMemoryApp>;
let base: string;
let person: ApiClient;

async function observe(listingId: string, observedAt: string, price: { amount: string; currency: string } | null): Promise<void> {
  const response = await fetch(`${base}/listings/${listingId}/price-observations`, {
    method: "POST",
    headers: { authorization: "Bearer provider-token", "content-type": "application/json" },
    body: JSON.stringify({ observedAt, price }),
  });
  expect(response.status).toBe(201);
}

beforeAll(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  application = composeInMemoryApp({
    passwordHasher: new ScryptPasswordHasher(FAST_SCRYPT_PARAMETERS),
    onEvaluation: () => {},
    sessionCookie: { origin: base },
  });
  application.providerAuthenticator.addProvider("provider-token", ProviderId("simulator"));
  await application.app.listen({ port, host: "127.0.0.1" });
  application.catalogue.addListing(ListingId("headphones-shop-a"), "EUR", { title: "Wireless headphones", retailer: "Shop A" });
  application.catalogue.addListing(ListingId("monitor-shop-a"), "EUR", { title: "27-inch monitor", retailer: "Shop A" });
  await observe("headphones-shop-a", "2026-11-19T09:00:00Z", { amount: "100.00", currency: "EUR" });
  await observe("headphones-shop-a", "2026-11-19T10:00:00Z", null);
  await observe("headphones-shop-a", "2026-11-19T11:00:00Z", { amount: "79.90", currency: "EUR" });
  await application.registerAccount.execute({ email: "history@example.com", password: PASSWORD });
  person = createApiClient({ fetch: browserFor(base) });
  await person.signIn("history@example.com", PASSWORD);
});

afterAll(async () => {
  await application.app.close();
});

describe("the Price History", () => {
  it("SC-05 / SC-06 / BR-03: gives the observations newest first, one of them with no price", async () => {
    const result = await person.priceHistory("headphones-shop-a", { limit: 100, offset: 0 });
    expect(result).toEqual({
      ok: true,
      data: {
        items: [
          { observedAt: "2026-11-19T11:00:00.000Z", price: { amount: "79.90", currency: "EUR" } },
          { observedAt: "2026-11-19T10:00:00.000Z", price: null },
          { observedAt: "2026-11-19T09:00:00.000Z", price: { amount: "100.00", currency: "EUR" } },
        ],
        total: 3,
        limit: 100,
        offset: 0,
      },
    });
  });

  it("SC-07 / BR-04: a Listing that was never observed has an empty history", async () => {
    const result = await person.priceHistory("monitor-shop-a", { limit: 100, offset: 0 });
    expect(result.ok && result.data).toMatchObject({ items: [], total: 0 });
  });

  it("SC-13: a Listing that does not exist answers 404 LISTING_NOT_FOUND", async () => {
    const result = await person.priceHistory("nope", { limit: 100, offset: 0 });
    expect(result.ok === false && result.failure.kind === "answer" && [result.failure.status, result.failure.code]).toEqual([404, "LISTING_NOT_FOUND"]);
  });

  it("a person who is not signed in is answered 401", async () => {
    const stranger = createApiClient({ fetch: browserFor(base) });
    const result = await stranger.priceHistory("headphones-shop-a", { limit: 100, offset: 0 });
    expect(result.ok === false && result.failure.kind === "answer" && result.failure.status).toBe(401);
  });
});
