/** The route that says whether the server is a demo (feature 12, section 3 of the design). Part of SC-06. */

import { describe, expect, it } from "vitest";
import { composeInMemoryApp } from "../../src/composition-root";

const start = (options: { demo?: boolean; apiDocs?: { note: string } } = {}) => composeInMemoryApp({ onEvaluation: () => {}, ...options });

describe("GET /demo", () => {
  it("SC-06 / BR-03: a server declared a demo says so, and it needs no token", async () => {
    const { app } = start({ demo: true });
    const response = await app.inject({ method: "GET", url: "/demo" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ demo: true });
    await app.close();
  });

  it("SC-06 / BR-03: a server that is not a demo says so, so that the interface shows no notice", async () => {
    for (const options of [{}, { demo: false }]) {
      const { app } = start(options);
      expect((await app.inject({ method: "GET", url: "/demo" })).json()).toEqual({ demo: false });
      await app.close();
    }
  });

  it("holds nothing else: no token, no address, no password", async () => {
    const { app } = start({ demo: true });
    const response = await app.inject({ method: "GET", url: "/demo" });
    expect(Object.keys(response.json())).toEqual(["demo"]);
    await app.close();
  });

  it("is for the interface, so the documentation does not list it", async () => {
    const { app } = start({ demo: true, apiDocs: { note: "a note" } });
    const document = (await app.inject({ method: "GET", url: "/docs/json" })).json();
    expect(Object.keys(document.paths)).not.toContain("/demo");
    expect((await app.inject({ method: "GET", url: "/demo" })).statusCode).toBe(200);
    await app.close();
  });
});
