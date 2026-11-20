/**
 * The operations of the client that belong to feature 10 (my alerts and my notifications) against the real
 * application, listening on a port of its own. If the API changes what it answers, or the client expects something
 * that the API does not give, a test here breaks. Each test names the scenario (SC-nn) or the rule (BR-nn) of
 * feature 10. The file is apart from the one of feature 09 because the scenarios of the two are numbered apart.
 *
 * The `fetch` of the client imitates a browser: it keeps the cookie and adds the `Origin` of the page to a change,
 * so a PATCH here carries both, as the interface does. That a real browser does it too is checked by hand.
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

const person = (): ApiClient => createApiClient({ fetch: browserFor(base) });

async function signedIn(email: string): Promise<ApiClient> {
  const client = person();
  await client.signIn(email, PASSWORD);
  return client;
}

/**
 * A Provider reports a price through the API, so that the Price Alerts of the Listing are evaluated as they are in
 * the running application: the Composition Root hands back a recorder that records and does not evaluate.
 */
async function observe(listingId: string, observedAt: string, amount: string, currency: string): Promise<void> {
  const response = await fetch(`${base}/listings/${listingId}/price-observations`, {
    method: "POST",
    headers: { authorization: "Bearer provider-token", "content-type": "application/json" },
    body: JSON.stringify({ observedAt, price: { amount, currency } }),
  });
  expect(response.status).toBe(201);
}

const answerOf = (result: { ok: boolean; failure?: { kind: string; status?: number; code?: string } }) =>
  result.ok ? "ok" : result.failure?.kind === "answer" ? [result.failure.status, result.failure.code] : result.failure?.kind;

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
  for (const [id, title, retailer, currency, price] of [
    ["headphones-shop-a", "Wireless headphones", "Shop A", "EUR", "100.00"],
    ["keyboard-shop-b", "Mechanical keyboard", "Shop B", "USD", "50.00"],
    ["speaker-shop-c", "Speaker", "Shop C", "EUR", "50.00"],
  ] as const) {
    application.catalogue.addListing(ListingId(id), currency, { title, retailer });
    await observe(id, "2026-11-19T09:00:00Z", price, currency);
  }
  for (const email of ["mine@example.com", "luis@example.com", "notes@example.com"]) {
    await application.registerAccount.execute({ email, password: PASSWORD });
  }
});

afterAll(async () => {
  await application.app.close();
});

describe("my alerts", () => {
  it("SC-03 / SC-06 / SC-07 / BR-02: lists the alerts of the person, filters them by state and reads them one page at a time", async () => {
    const mine = await signedIn("mine@example.com");
    await mine.createAlert("headphones-shop-a", "80.00");
    await mine.createAlert("keyboard-shop-b", "40.00");

    const all = await mine.alerts({ limit: 20, offset: 0 });
    expect(all.ok && [all.data.total, all.data.items.map((a) => a.listingId).sort()]).toEqual([2, ["headphones-shop-a", "keyboard-shop-b"]]);
    expect(all.ok && Object.keys(all.data.items[0]!).sort()).toEqual(["createdAt", "currency", "id", "listingId", "status", "targetAmount"]);

    const active = await mine.alerts({ status: "active", limit: 20, offset: 0 });
    const triggered = await mine.alerts({ status: "triggered", limit: 20, offset: 0 });
    expect(active.ok && active.data.total).toBe(2);
    expect(triggered.ok && triggered.data.total).toBe(0);

    const first = await mine.alerts({ limit: 1, offset: 0 });
    const second = await mine.alerts({ limit: 1, offset: 1 });
    expect(first.ok && second.ok && [first.data.items.length, first.data.total, second.data.items.length]).toEqual([1, 2, 1]);
    expect(first.ok && second.ok && first.data.items[0]?.id).not.toBe(second.ok && second.data.items[0]?.id);
  });

  it("BR-01 / BR-02: the alerts of another person are not in the list", async () => {
    const mine = await (await signedIn("mine@example.com")).alerts({ limit: 20, offset: 0 });
    const luis = await signedIn("luis@example.com");
    await luis.createAlert("speaker-shop-c", "40.00");
    const theirs = await luis.alerts({ limit: 20, offset: 0 });
    const mineIds = new Set(mine.ok ? mine.data.items.map((a) => a.id) : []);
    expect(theirs.ok && [theirs.data.total, theirs.data.items.some((a) => mineIds.has(a.id))]).toEqual([1, false]);
  });

  it("SC-12 / SC-18 / BR-05 / BR-06: changes a Target Price and cancels, with the cookie and the Origin, and gives the alert after each change", async () => {
    const mine = await signedIn("mine@example.com");
    const list = await mine.alerts({ status: "active", limit: 20, offset: 0 });
    const headphones = list.ok ? list.data.items.find((a) => a.listingId === "headphones-shop-a") : undefined;
    expect(headphones).toBeDefined();

    const changed = await mine.changeTarget(headphones!.id, "70.00");
    expect(changed.ok && [changed.data.id, changed.data.targetAmount, changed.data.status]).toEqual([headphones!.id, "70.00", "active"]);

    const cancelled = await mine.cancelAlert(headphones!.id);
    expect(cancelled.ok && cancelled.data.status).toBe("cancelled");
    expect((await mine.cancelAlert(headphones!.id)).ok).toBe(true);
    expect(answerOf(await mine.changeTarget(headphones!.id, "60.00"))).toEqual([409, "ALERT_NOT_ACTIVE"]);
  });

  it.each([
    ["an amount that the Current Price already reaches", "50.00", [409, "TARGET_ALREADY_REACHED"]],
    ["an amount that is not valid", "abc", [422, "INVALID_TARGET_PRICE"]],
    ["an amount that is empty", "", [422, "INVALID_TARGET_PRICE"]],
  ])("SC-15 / BR-07: %s is an answer with its code", async (_what, amount, expected) => {
    const mine = await signedIn("mine@example.com");
    const list = await mine.alerts({ status: "active", limit: 20, offset: 0 });
    // The alert for the keyboard, whose Current Price is 50.00, is Active in this account.
    const keyboard = list.ok ? list.data.items.find((a) => a.listingId === "keyboard-shop-b") : undefined;
    expect(keyboard).toBeDefined();
    expect(answerOf(await mine.changeTarget(keyboard!.id, amount))).toEqual(expected);
  });

  it("SC-15 / SC-19 / BR-01 / BR-07: an alert that does not exist, or is of another person, is an answer 404 ALERT_NOT_FOUND", async () => {
    const mine = await signedIn("mine@example.com");
    const theirs = await (await signedIn("luis@example.com")).alerts({ limit: 20, offset: 0 });
    const someoneElses = theirs.ok ? (theirs.data.items[0]?.id ?? "") : "";
    expect(someoneElses).not.toBe("");
    for (const id of ["no-such-alert", someoneElses]) {
      expect(answerOf(await mine.changeTarget(id, "10.00"))).toEqual([404, "ALERT_NOT_FOUND"]);
      expect(answerOf(await mine.cancelAlert(id))).toEqual([404, "ALERT_NOT_FOUND"]);
    }
  });

  it("SC-25 / BR-11: with no Session, every operation of this feature is an answer 401", async () => {
    const nobody = person();
    for (const result of [
      await nobody.alerts({ limit: 20, offset: 0 }),
      await nobody.changeTarget("x", "1.00"),
      await nobody.cancelAlert("x"),
      await nobody.notifications({ limit: 20, offset: 0 }),
    ]) {
      expect(result.ok === false && result.failure.kind === "answer" && result.failure.status).toBe(401);
    }
  });
});

describe("my notifications", () => {
  it("SC-21 / SC-22 / SC-23 / BR-09: an alert that reached its price is a Notification of its owner, and of nobody else", async () => {
    const notes = await signedIn("notes@example.com");
    const empty = await notes.notifications({ limit: 20, offset: 0 });
    expect(empty.ok && [empty.data.total, empty.data.items.length]).toEqual([0, 0]);

    const created = await notes.createAlert("speaker-shop-c", "45.00");
    await observe("speaker-shop-c", "2026-11-19T12:00:00Z", "44.00", "EUR");

    expect(await notes.notifications({ limit: 20, offset: 0 })).toEqual({
      ok: true,
      data: {
        items: [
          {
            alertId: created.ok ? created.data.alert.id : "",
            listingId: "speaker-shop-c",
            targetPrice: { amount: "45.00", currency: "EUR" },
            currentPrice: { amount: "44.00", currency: "EUR" },
            observedAt: "2026-11-19T12:00:00.000Z",
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const theirs = await (await signedIn("luis@example.com")).notifications({ limit: 20, offset: 0 });
    // The alert of the other person asked for 40.00 and the price of 44.00 does not reach it.
    expect(theirs.ok && theirs.data.total).toBe(0);
  });

  it("SC-11 / BR-04: the alert that reached its price is Triggered, and can be neither changed nor cancelled", async () => {
    const notes = await signedIn("notes@example.com");
    const triggered = await notes.alerts({ status: "triggered", limit: 20, offset: 0 });
    expect(triggered.ok && triggered.data.total).toBe(1);
    const id = triggered.ok ? triggered.data.items[0]!.id : "";
    expect(answerOf(await notes.changeTarget(id, "40.00"))).toEqual([409, "ALERT_NOT_ACTIVE"]);
    expect(answerOf(await notes.cancelAlert(id))).toEqual([409, "ALERT_NOT_ACTIVE"]);
  });
});
