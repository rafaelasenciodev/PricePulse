/**
 * The Composition Root connects the real parts. These tests check the wiring, not the
 * rules: that a request travels through the HTTP layer, the use case and both adapters.
 */

import { afterEach, describe, expect, it } from "vitest";
import { composeInMemoryApp } from "../src/composition-root";
import { UserId } from "../src/price-alerts/domain";
import { ListingId, Price } from "../src/shared/domain";

const HEADPHONES = ListingId("headphones-shop-a");

let application: ReturnType<typeof composeInMemoryApp>;

afterEach(async () => {
  await application.app.close();
});

function compose() {
  application = composeInMemoryApp();
  application.authenticator.addUser("token-1", UserId("user-1"));
  application.listings.addListing(HEADPHONES, "EUR", Price.fromDecimalString("100.00", "EUR"));
  return application;
}

const create = (targetAmount: string, token = "token-1") =>
  application.app.inject({
    method: "POST",
    url: `/listings/${HEADPHONES}/price-alerts`,
    headers: { authorization: `Bearer ${token}` },
    payload: { targetAmount },
  });

describe("composeInMemoryApp", () => {
  it("connects the HTTP layer, the use case and the adapters", async () => {
    compose();
    const response = await create("80.00");
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ listingId: HEADPHONES, targetAmount: "80.00", status: "active" });
  });

  it("shares one repository between requests: a repeated request returns the same Price Alert", async () => {
    compose();
    const first = await create("80.00");
    const second = await create("80.00");
    expect(second.statusCode).toBe(200);
    expect(second.json().id).toBe(first.json().id);
  });

  it("uses the catalogue it was given: an unknown Listing is a 404", async () => {
    compose();
    const response = await application.app.inject({
      method: "POST",
      url: "/listings/unknown/price-alerts",
      headers: { authorization: "Bearer token-1" },
      payload: { targetAmount: "80.00" },
    });
    expect(response.statusCode).toBe(404);
  });

  it("uses the authenticator it was given: an unknown token is a 401", async () => {
    compose();
    expect((await create("80.00", "other-token")).statusCode).toBe(401);
  });

  it("each composition has its own state", async () => {
    compose();
    await create("80.00");
    await application.app.close();
    compose();
    expect((await create("80.00")).statusCode).toBe(201);
  });
});
