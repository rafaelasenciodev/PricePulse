/**
 * Typed identifiers. TypeScript compares types by shape, so a plain string would let
 * a UserId be used where a ListingId is expected. The brand makes the compiler
 * treat them as different types, with no cost at runtime.
 */
export type Brand<Name extends string> = string & { readonly __brand: Name };

/** A Listing, referenced by identifier by every feature that needs it. */
export type ListingId = Brand<"ListingId">;

export const ListingId = (value: string): ListingId => value as ListingId;

/**
 * A User. The identifier of a User and of the Account that registered them are the same, so the
 * module of Accounts and the ones that have Users as owners share it without importing each other.
 */
export type UserId = Brand<"UserId">;

export const UserId = (value: string): UserId => value as UserId;
