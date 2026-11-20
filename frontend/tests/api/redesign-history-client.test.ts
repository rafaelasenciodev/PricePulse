/**
 * The operation of the client that belongs to feature 13 (the Price History), with a fake `fetch`. Each test names the
 * scenario (SC-nn) or the rule (BR-nn) of feature 13. It lives in a file of its own because the scenarios of the
 * features are numbered apart.
 */

import { describe, expect, it } from "vitest";
import { createApiClient } from "../../src/api";
import { answer, fakeFetch, json } from "./support";

const clientWith = (...replies: Parameters<typeof fakeFetch>) => {
  const fake = fakeFetch(...replies);
  return { client: createApiClient({ fetch: fake.fetch }), calls: fake.calls };
};

const OBSERVATION = {
  provider: "simulator",
  listingId: "headphones-shop-a",
  observedAt: "2026-11-19T10:00:00.000Z",
  price: { amount: "79.90", currency: "EUR" },
};
const page = (items: unknown[], total = items.length) => json({ items, total, limit: 100, offset: 0 });

describe("the Price History (feature 13)", () => {
  it("SC-05 / SC-10 / BR-02: asks for the newest 100 of the Listing, and keeps only the moment and the price", async () => {
    const { client, calls } = clientWith(page([OBSERVATION]));
    expect(await client.priceHistory("headphones-shop-a", { limit: 100, offset: 0 })).toEqual({
      ok: true,
      data: { items: [{ observedAt: "2026-11-19T10:00:00.000Z", price: { amount: "79.90", currency: "EUR" } }], total: 1, limit: 100, offset: 0 },
    });
    expect(calls[0]?.input).toBe("/listings/headphones-shop-a/price-observations?limit=100&offset=0");
    expect(calls[0]?.init.method).toBe("GET");
  });

  it("encodes the identifier of the Listing in the address", async () => {
    const { client, calls } = clientWith(page([]));
    await client.priceHistory("a b/c", { limit: 100, offset: 0 });
    expect(calls[0]?.input).toBe("/listings/a%20b%2Fc/price-observations?limit=100&offset=0");
  });

  it("SC-06 / BR-03: an observation with no price is read as an observation with no price", async () => {
    const { client } = clientWith(page([{ ...OBSERVATION, price: null }]));
    const result = await client.priceHistory("headphones-shop-a", { limit: 100, offset: 0 });
    expect(result.ok && result.data.items).toEqual([{ observedAt: "2026-11-19T10:00:00.000Z", price: null }]);
  });

  it.each([
    ["an item with no moment", page([{ price: null }])],
    ["a price that is not an amount and a currency", page([{ ...OBSERVATION, price: { amount: 79.9 } }])],
    ["no total", json({ items: [], limit: 100, offset: 0 })],
    ["an answer 201", json({ items: [], total: 0, limit: 100, offset: 0 }, 201)],
  ])("is not what the API gives: %s", async (_what, reply) => {
    const { client } = clientWith(reply);
    expect(await client.priceHistory("headphones-shop-a", { limit: 100, offset: 0 })).toEqual({ ok: false, failure: { kind: "unexpected" } });
  });

  it("SC-11 / BR-06: a failure is a value, with its status and its code, and not a throw", async () => {
    const { client } = clientWith(answer(404, "LISTING_NOT_FOUND"));
    const result = await client.priceHistory("nope", { limit: 100, offset: 0 });
    expect(result.ok === false && result.failure.kind === "answer" && [result.failure.status, result.failure.code]).toEqual([404, "LISTING_NOT_FOUND"]);
  });

  it("SC-11 / BR-06: no connection is a failure of the network", async () => {
    const { client } = clientWith(new Error("offline"));
    expect(await client.priceHistory("headphones-shop-a", { limit: 100, offset: 0 })).toEqual({ ok: false, failure: { kind: "network" } });
  });
});
