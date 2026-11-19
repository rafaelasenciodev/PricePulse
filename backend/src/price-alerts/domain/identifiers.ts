import type { Brand } from "../../shared/domain";

/** Typed identifiers of the Price Alerts feature. See `Brand` for why they are not plain strings. */
export type AlertId = Brand<"AlertId">;
export type UserId = Brand<"UserId">;

export const AlertId = (value: string): AlertId => value as AlertId;
export const UserId = (value: string): UserId => value as UserId;

// `crypto` is the Web Crypto standard, available in Node and in browsers: the domain
// imports nothing from any platform.
export const newAlertId = (): AlertId => AlertId(crypto.randomUUID());
