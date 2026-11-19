/**
 * Typed identifiers. TypeScript compares types by shape, so a plain string would let
 * a UserId be used where a ListingId is expected. The brand makes the compiler
 * treat them as different types, with no cost at runtime.
 */
export type Brand<Name extends string> = string & { readonly __brand: Name };

/** A Listing, referenced by identifier by every feature that needs it. */
export type ListingId = Brand<"ListingId">;

export const ListingId = (value: string): ListingId => value as ListingId;
