/** The operation of the client that asks whether the server is a demo (feature 12, BR-03), with a fake `fetch`. */

import { describe, expect, it } from "vitest";
import { createApiClient } from "../../src/api";
import { answer, fakeFetch, json } from "./support";

describe("demo", () => {
  it("BR-03: asks GET /demo with no credential, and reads whether the server is a demo", async () => {
    const { fetch, calls } = fakeFetch(json({ demo: true }));
    const result = await createApiClient({ fetch }).demo();
    expect(result).toEqual({ ok: true, data: { demo: true } });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe("/demo");
    expect(calls[0]?.init.method).toBe("GET");
  });

  it("BR-03: reads that the server is not a demo", async () => {
    const { fetch } = fakeFetch(json({ demo: false }));
    expect(await createApiClient({ fetch }).demo()).toEqual({ ok: true, data: { demo: false } });
  });

  it.each([
    ["an answer that has no field demo", json({})],
    ["an answer whose demo is not a boolean", json({ demo: "true" })],
    ["a page that is not JSON", new Response("<html></html>", { status: 200 })],
  ])("BR-03: %s is not taken for an answer of the API", async (_name, reply) => {
    const { fetch } = fakeFetch(reply);
    expect(await createApiClient({ fetch }).demo()).toEqual({ ok: false, failure: { kind: "unexpected" } });
  });

  it("BR-03: a server that cannot be reached is a failure, and an error of the API is its answer", async () => {
    const down = fakeFetch(new TypeError("offline"));
    expect(await createApiClient({ fetch: down.fetch }).demo()).toEqual({ ok: false, failure: { kind: "network" } });
    const refused = fakeFetch(answer(500, "INTERNAL_ERROR"));
    const result = await createApiClient({ fetch: refused.fetch }).demo();
    expect(result.ok).toBe(false);
  });
});
