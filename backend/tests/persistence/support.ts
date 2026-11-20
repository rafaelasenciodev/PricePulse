/** What the tests of feature 11 at the level of the application share: an application over a database, and calls to it. */

import { composeInMemoryApp, composePostgresApp, type Application } from "../../src/composition-root";
import type { Pool } from "../../src/database/connect";
import { ProviderId } from "../../src/price-observations/domain";
import { ListingId } from "../../src/shared/domain";
import { FAST_HASHER } from "../support/accounts";

export const HEADPHONES = ListingId("headphones-shop-a");
export const PROVIDER_TOKEN = "provider-token";
export const PASSWORD = "test-password-1";
/** The clock of every test: observations are dated before it, so none is "in the future". */
export const NOW = new Date("2026-11-19T12:00:00Z");

/** A clock that moves one millisecond at each reading, so that two things made one after the other never share a moment. */
export function steppingClock(): { now(): Date } {
  let moment = NOW.getTime();
  return { now: () => new Date(moment++) };
}

const options = (clock: { now(): Date }) => ({ clock, passwordHasher: FAST_HASHER, onEvaluation: () => {} });

/** An application over the database, as a server that has just started. Closing it leaves the database as it is. */
export function startPostgres(pool: Pool, clock: { now(): Date } = { now: () => NOW }): Application {
  const application = composePostgresApp(pool, options(clock));
  application.providerAuthenticator.addProvider(PROVIDER_TOKEN, ProviderId("simulator"));
  return application;
}

export function startMemory(clock: { now(): Date } = { now: () => NOW }): Application {
  const application = composeInMemoryApp(options(clock));
  application.providerAuthenticator.addProvider(PROVIDER_TOKEN, ProviderId("simulator"));
  return application;
}

/** The Background of the scenarios: the Listing "headphones-shop-a" in EUR with a Current Price of 100.00. */
export async function seedHeadphones(application: Application): Promise<void> {
  await application.catalogue.addListing(HEADPHONES, "EUR", { title: "Wireless headphones", retailer: "Shop A" });
  await application.recordPriceObservation.execute({
    provider: ProviderId("simulator"),
    listingId: HEADPHONES,
    observedAt: "2026-11-19T09:00:00Z",
    price: { amount: "100.00", currency: "EUR" },
  });
}

export type Method = "GET" | "POST" | "PATCH" | "DELETE";

export function call(application: Application, method: Method, url: string, token: string | null, payload?: object) {
  return application.app.inject({
    method,
    url,
    ...(token === null ? {} : { headers: { authorization: `Bearer ${token}` } }),
    ...(payload ? { payload } : {}),
  });
}

export const register = (application: Application, email: string) => call(application, "POST", "/accounts", null, { email, password: PASSWORD });
export const signIn = async (application: Application, email: string, password = PASSWORD) =>
  call(application, "POST", "/sessions", null, { email, password });

/** Registers and signs in, as a person does. Gives the token. */
export async function signedIn(application: Application, email: string): Promise<string> {
  await register(application, email);
  return (await signIn(application, email)).json().token as string;
}

/** A Provider records a price of "amount" EUR for the Listing at the given hour of 2026-11-19. */
export const observe = (application: Application, hour: string, amount: string | null, listing: string = HEADPHONES) =>
  call(application, "POST", `/listings/${listing}/price-observations`, PROVIDER_TOKEN, {
    observedAt: `2026-11-19T${hour}Z`,
    price: amount === null ? null : { amount, currency: "EUR" },
  });

export const createAlert = (application: Application, token: string, target: string, listing: string = HEADPHONES) =>
  call(application, "POST", `/listings/${listing}/price-alerts`, token, { targetAmount: target });
