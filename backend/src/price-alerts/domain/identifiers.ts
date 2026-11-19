/**
 * Typed identifiers. TypeScript compares types by shape, so a plain string would let
 * a UserId be used where a ListingId is expected. The brand makes the compiler
 * treat them as different types, with no cost at runtime.
 */
type Brand<Name extends string> = string & { readonly __brand: Name };

export type AlertId = Brand<"AlertId">;
export type UserId = Brand<"UserId">;
export type ListingId = Brand<"ListingId">;

export const AlertId = (value: string): AlertId => value as AlertId;
export const UserId = (value: string): UserId => value as UserId;
export const ListingId = (value: string): ListingId => value as ListingId;

// `crypto` is the Web Crypto standard, available in Node and in browsers: the domain
// imports nothing from any platform.
export const newAlertId = (): AlertId => AlertId(crypto.randomUUID());
