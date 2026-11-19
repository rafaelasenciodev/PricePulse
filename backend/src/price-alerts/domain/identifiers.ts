import type { Brand } from "../../shared/domain";

/** Typed identifiers of the Price Alerts feature. See `Brand` for why they are not plain strings. `UserId` is shared. */
export type AlertId = Brand<"AlertId">;

export const AlertId = (value: string): AlertId => value as AlertId;

// `crypto` is the Web Crypto standard, available in Node and in browsers: the domain
// imports nothing from any platform.
export const newAlertId = (): AlertId => AlertId(crypto.randomUUID());
