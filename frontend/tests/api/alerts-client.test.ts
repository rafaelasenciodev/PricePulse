/**
 * The operations of the client that belong to feature 10 (my alerts and my notifications), with a fake `fetch`.
 * Each test names the scenario (SC-nn) or the rule (BR-nn) of feature 10. They live in a file of their own,
 * and not in `client.test.ts`, because the scenarios of the two features are numbered apart.
 */

import { describe, expect, it } from "vitest";
import { createApiClient } from "../../src/api";
import { ALERT, NOTIFICATION, answer, fakeFetch, json } from "./support";

const clientWith = (...replies: Parameters<typeof fakeFetch>) => {
  const fake = fakeFetch(...replies);
  return { client: createApiClient({ fetch: fake.fetch }), calls: fake.calls };
};

describe("my alerts (feature 10)", () => {
  const page = (items: unknown[], total = items.length, offset = 0) => json({ items, total, limit: 20, offset });

  it("SC-03 / BR-02: asks for a page of alerts, with no state when none is given", async () => {
    const { client, calls } = clientWith(page([ALERT]));
    expect(await client.alerts({ limit: 20, offset: 40 })).toEqual({ ok: true, data: { items: [ALERT], total: 1, limit: 20, offset: 0 } });
    expect(calls[0]?.input).toBe("/price-alerts?limit=20&offset=40");
    expect(calls[0]?.init.method).toBe("GET");
  });

  it.each(["active", "triggered", "cancelled"] as const)("SC-06 / BR-02: asks for the alerts that are %s", async (status) => {
    const { client, calls } = clientWith(page([]));
    await client.alerts({ status, limit: 20, offset: 0 });
    expect(calls[0]?.input).toBe(`/price-alerts?status=${status}&limit=20&offset=0`);
  });

  it.each([
    ["an item that is not an alert", page([{ ...ALERT, status: "paused" }])],
    ["no total", json({ items: [], limit: 20, offset: 0 })],
    ["an answer 201", json({ items: [], total: 0, limit: 20, offset: 0 }, 201)],
  ])("is not what the API gives: %s", async (_what, reply) => {
    const { client } = clientWith(reply);
    expect(await client.alerts({ limit: 20, offset: 0 })).toEqual({ ok: false, failure: { kind: "unexpected" } });
  });
});

describe("changing a Target Price and cancelling (feature 10)", () => {
  const changed = { ...ALERT, targetAmount: "70.00" };

  it("SC-12 / BR-05: sends PATCH with the amount as the text that it is, and gives the alert after the change", async () => {
    const { client, calls } = clientWith(json(changed));
    expect(await client.changeTarget("alert-1", " 70.00 ")).toEqual({ ok: true, data: changed });
    expect(calls[0]?.input).toBe("/price-alerts/alert-1");
    expect(calls[0]?.init.method).toBe("PATCH");
    expect(String(calls[0]?.init.body)).toBe(JSON.stringify({ targetAmount: " 70.00 " }));
  });

  it("SC-18: cancelling sends PATCH with the state cancelled and nothing else", async () => {
    const { client, calls } = clientWith(json({ ...ALERT, status: "cancelled" }));
    const result = await client.cancelAlert("alert-1");
    expect(result.ok && result.data.status).toBe("cancelled");
    expect(calls[0]?.init.method).toBe("PATCH");
    expect(String(calls[0]?.init.body)).toBe(JSON.stringify({ status: "cancelled" }));
  });

  it("writes the identifier of the alert so that it cannot change the address", async () => {
    const { client, calls } = clientWith(json(ALERT));
    await client.cancelAlert("a/b?c#d");
    expect(calls[0]?.input).toBe("/price-alerts/a%2Fb%3Fc%23d");
  });

  it.each([
    [422, "INVALID_TARGET_PRICE"],
    [409, "TARGET_ALREADY_REACHED"],
    [409, "ALERT_NOT_ACTIVE"],
    [409, "ALERT_CONFLICT"],
    [404, "ALERT_NOT_FOUND"],
  ])("SC-15 / SC-19 / BR-07: an answer %i %s is a failure with its code", async (status, code) => {
    for (const run of [(c: ReturnType<typeof createApiClient>) => c.changeTarget("alert-1", "70.00"), (c: ReturnType<typeof createApiClient>) => c.cancelAlert("alert-1")]) {
      const { client } = clientWith(answer(status, code));
      const result = await run(client);
      expect(result.ok === false && result.failure.kind === "answer" && [result.failure.status, result.failure.code]).toEqual([status, code]);
    }
  });

  it("is not what the API gives: an answer 201, or a body that is not an alert", async () => {
    for (const reply of [json(ALERT, 201), json({ ...ALERT, id: undefined })]) {
      const { client } = clientWith(reply);
      expect(await client.cancelAlert("alert-1")).toEqual({ ok: false, failure: { kind: "unexpected" } });
    }
  });
});

describe("my notifications (feature 10)", () => {
  it("SC-21 / BR-09: gives the Notifications of a page, without the owner that the API also sends", async () => {
    const { client, calls } = clientWith(json({ items: [{ ...NOTIFICATION, owner: "user-1" }], total: 1, limit: 20, offset: 0 }));
    const result = await client.notifications({ limit: 20, offset: 0 });
    expect(result).toEqual({ ok: true, data: { items: [NOTIFICATION], total: 1, limit: 20, offset: 0 } });
    expect(JSON.stringify(result)).not.toContain("owner");
    expect(calls[0]?.input).toBe("/notifications?limit=20&offset=0");
  });

  it.each([
    ["a price that is a number", { ...NOTIFICATION, currentPrice: 79.5 }],
    ["no Listing", { ...NOTIFICATION, listingId: undefined }],
    ["no moment", { ...NOTIFICATION, observedAt: undefined }],
  ])("is not what the API gives: %s", async (_what, item) => {
    const { client } = clientWith(json({ items: [item], total: 1, limit: 20, offset: 0 }));
    expect(await client.notifications({ limit: 20, offset: 0 })).toEqual({ ok: false, failure: { kind: "unexpected" } });
  });
});
