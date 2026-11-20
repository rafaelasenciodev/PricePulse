/** A whole journey gives the same answers in the database as in memory (feature 11, SC-06). */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/composition-root";
import type { Pool } from "../../src/database/connect";
import { testPool, truncateAll } from "../support/database";
import { HEADPHONES, call, createAlert, observe, seedHeadphones, signedIn, startMemory, startPostgres, steppingClock } from "./support";

let pool: Pool;
beforeAll(async () => {
  pool = await testPool();
});
afterAll(async () => {
  await pool.end();
});
beforeEach(async () => {
  await truncateAll(pool);
});

/** Every answer of the journey: status and body, with the identifiers and the tokens replaced by names. */
async function journey(application: Application): Promise<unknown[]> {
  const answers: { status: number; body: unknown }[] = [];
  const names = new Map<string, string>();
  const named = (text: string) => {
    let result = text;
    result = result.replace(/"token":"[^"]*"/g, '"token":"<token>"');
    return result.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (id) => {
      if (!names.has(id)) names.set(id, `<id-${names.size + 1}>`);
      return names.get(id) as string;
    });
  };
  const record = async (response: Promise<{ statusCode: number; body: string }>) => {
    const { statusCode, body } = await response;
    answers.push({ status: statusCode, body: JSON.parse(named(body || "null")) });
    return body ? JSON.parse(body) : null;
  };

  await seedHeadphones(application);
  await application.catalogue.addListing("keyboard-shop-a" as never, "EUR", { title: "Mechanical keyboard", retailer: "Shop A" });
  await record(call(application, "POST", "/accounts", null, { email: "ana@example.com", password: "test-password-1" }));
  const signedInAnswer = await record(call(application, "POST", "/sessions", null, { email: "ana@example.com", password: "test-password-1" }));
  const token = signedInAnswer.token as string;
  await record(call(application, "GET", "/listings", token));
  const first = await record(createAlert(application, token, "80.00"));
  await record(createAlert(application, token, "80.00")); // the same alert again
  const second = await record(createAlert(application, token, "50.00", "keyboard-shop-a"));
  await record(observe(application, "10:00:00", "79.00"));
  await record(call(application, "GET", "/notifications", token));
  await record(call(application, "GET", `/price-alerts/${first.id}`, token));
  await record(call(application, "PATCH", `/price-alerts/${second?.id}`, token, { targetAmount: "40.00" }));
  await record(call(application, "PATCH", `/price-alerts/${second?.id}`, token, { status: "cancelled" }));
  await record(call(application, "GET", "/price-alerts?limit=1", token));
  await record(call(application, "GET", `/listings/${HEADPHONES}/price-observations`, token));
  await record(call(application, "GET", "/listings?limit=1&offset=1", token));
  await record(call(application, "GET", "/accounts/me", "not-a-token"));
  return answers;
}

describe("SC-06 / BR-01: a whole journey gives the same answers as in memory", () => {
  it("SC-06 / BR-01: every status and every body is the same", async () => {
    const memory = startMemory(steppingClock());
    const postgres = startPostgres(pool, steppingClock());
    try {
      const inMemory = await journey(memory);
      const inDatabase = await journey(postgres);
      expect(inDatabase).toEqual(inMemory);
      expect(inMemory.length).toBeGreaterThan(10);
      // The journey did something: it is not two equal lists of errors.
      expect((inMemory as { status: number }[]).filter((a) => a.status >= 500)).toEqual([]);
      expect((inMemory as { status: number }[]).some((a) => a.status === 201)).toBe(true);
    } finally {
      await memory.app.close();
      await postgres.app.close();
    }
  });
});
