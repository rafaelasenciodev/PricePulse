/**
 * A demo server in process, with the data of the demo and the origin of an https address, and what a Reviewer does with it
 * (feature 12, SC-09 to SC-14 and SC-18). It builds nothing new: it says that what exists still holds in the demo.
 */

import { afterEach, describe, expect, it } from "vitest";
import { composeInMemoryApp } from "../../src/composition-root";
import { DEMO_PROVIDER_TOKEN, seedDemoData } from "../../src/demo-data";
import { FAST_HASHER } from "../support/accounts";

const ORIGIN = "https://demo.example";
const PASSWORD = "reviewer-password-1";

let application: ReturnType<typeof composeInMemoryApp>;
afterEach(async () => {
  await application.app.close();
});

async function startDemo(origin = ORIGIN): Promise<void> {
  application = composeInMemoryApp({
    demo: true,
    passwordHasher: FAST_HASHER,
    onEvaluation: () => {},
    sessionCookie: { origin, secure: origin.startsWith("https:") },
  });
  await seedDemoData(application);
}

const send = (method: "GET" | "POST" | "PATCH", url: string, token: string | null, payload?: object, headers: Record<string, string> = {}) =>
  application.app.inject({
    method,
    url,
    headers: { ...(token === null ? {} : { authorization: `Bearer ${token}` }), ...headers },
    ...(payload ? { payload } : {}),
  });

const signIn = async (email: string, password: string) => send("POST", "/sessions", null, { email, password });

/** What a Reviewer does first: registers an Account of their own and signs in. Gives their token. */
async function reviewer(email = "rev@example.com"): Promise<string> {
  expect((await send("POST", "/accounts", null, { email, password: PASSWORD })).statusCode).toBe(201);
  return (await signIn(email, PASSWORD)).json().token as string;
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("the cookie of the Session in the public demo", () => {
  it("SC-09 / BR-05: is Secure for an https origin and not for an http one", async () => {
    await startDemo("https://demo.example");
    const secure = String((await signIn("demo1@example.com", "demo-password-1")).headers["set-cookie"]);
    expect(secure).toMatch(/; Secure/);
    await application.app.close();

    await startDemo("http://127.0.0.1:3000");
    const plain = String((await signIn("demo1@example.com", "demo-password-1")).headers["set-cookie"]);
    expect(plain).toMatch(/^pricepulse_session=/);
    expect(plain).not.toMatch(/Secure/);
  });

  it("SC-10 / BR-05: a change that the cookie authenticates is refused when it comes from another origin, and nothing changes", async () => {
    await startDemo();
    const cookie = String((await signIn("demo1@example.com", "demo-password-1")).headers["set-cookie"]).split(";")[0] as string;
    const create = (origin: string) =>
      application.app.inject({
        method: "POST",
        url: "/listings/keyboard-shop-a/price-alerts",
        headers: { cookie, origin },
        payload: { targetAmount: "40.00" },
      });

    const refused = await create("https://other.example");
    expect(refused.statusCode).toBe(403);
    expect(refused.json().code).toBe("FORBIDDEN_ORIGIN");
    expect(application.alerts.all()).toHaveLength(1); // only the demo alert

    expect((await create(ORIGIN)).statusCode).toBe(201);
  });
});

describe("what a Reviewer does in the public demo", () => {
  it("SC-11 / BR-06: registers an Account of their own and sees only their own data", async () => {
    await startDemo();
    const demo1 = (await signIn("demo1@example.com", "demo-password-1")).json().token as string;
    const demoAlert = (await send("GET", "/price-alerts", demo1)).json().items[0];
    const mine = await reviewer();

    expect((await send("GET", "/price-alerts", mine)).json().total).toBe(0);
    expect((await send("GET", `/price-alerts/${demoAlert.id}`, mine)).statusCode).toBe(404);
  });

  it("SC-12 / BR-06: registration is not limited", async () => {
    await startDemo();
    for (let i = 0; i < 20; i += 1) {
      expect((await send("POST", "/accounts", null, { email: `visitor${i}@example.com`, password: PASSWORD })).statusCode).toBe(201);
    }
  });

  it("SC-13 / BR-07: makes a price fall as the Provider and sees the alert reach its target", async () => {
    await startDemo();
    const token = await reviewer();
    const created = await send("POST", "/listings/headphones-shop-a/price-alerts", token, { targetAmount: "80.00" });
    expect(created.statusCode).toBe(201);
    await pause();

    const recorded = await send("POST", "/listings/headphones-shop-a/price-observations", DEMO_PROVIDER_TOKEN, {
      observedAt: new Date().toISOString(),
      price: { amount: "79.00", currency: "EUR" },
    });
    expect(recorded.statusCode).toBe(201);

    expect((await send("GET", `/price-alerts/${created.json().id}`, token)).json().status).toBe("triggered");
    const [notification] = (await send("GET", "/notifications", token)).json().items;
    expect(notification).toMatchObject({ targetPrice: { amount: "80.00" }, currentPrice: { amount: "79.00" } });
    const history = (await send("GET", "/listings/headphones-shop-a/price-observations", token)).json();
    expect(history.items[0]).toMatchObject({ provider: "simulator", price: { amount: "79.00" } });
  });

  it("SC-14 / BR-07: cannot record a price with their own token", async () => {
    await startDemo();
    const token = await reviewer();
    const attempt = await send("POST", "/listings/headphones-shop-a/price-observations", token, {
      observedAt: new Date().toISOString(),
      price: { amount: "1.00", currency: "EUR" },
    });
    expect(attempt.statusCode).toBe(401);
    expect((await send("GET", "/listings/headphones-shop-a", token)).json().currentPrice.amount).toBe("100.00");
  });
});

describe("what the demo does not change", () => {
  it("SC-18 / BR-09: the limit on sign-in still protects an Account of the demo", async () => {
    await startDemo();
    for (let i = 0; i < 5; i += 1) expect((await signIn("demo1@example.com", "wrong-password")).statusCode).toBe(401);
    const locked = await signIn("demo1@example.com", "demo-password-1");
    expect(locked.statusCode).toBe(429);
    expect(locked.json().code).toBe("TOO_MANY_ATTEMPTS");
    expect(Number(locked.headers["retry-after"])).toBeGreaterThan(0);
  });
});
