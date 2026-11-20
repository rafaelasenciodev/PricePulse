/**
 * What the interface knows of the API: the answers it reads and the failures it can have. They are written by
 * hand (Q5 of feature 09), and a test runs the client against the real application to show any drift.
 * Money is text, such as "80.00", and instants are UTC text: the interface never turns them into numbers.
 */

export interface Account {
  readonly id: string;
  readonly email: string;
}

/** The Current Price of a Listing and the moment at which it was observed. */
export interface CurrentPrice {
  readonly amount: string;
  readonly currency: string;
  readonly observedAt: string;
}

export interface Listing {
  readonly id: string;
  readonly title: string;
  readonly retailer: string;
  readonly currency: string;
  /** null when the Listing has no Current Price. */
  readonly currentPrice: CurrentPrice | null;
}

/** A page of a list, and how many items the whole list has. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export type AlertStatus = "active" | "triggered" | "cancelled";

export interface PriceAlert {
  readonly id: string;
  readonly listingId: string;
  readonly targetAmount: string;
  readonly currency: string;
  readonly status: AlertStatus;
  readonly createdAt: string;
}

/** An amount as text, such as "80.00", with its currency. */
export interface Money {
  readonly amount: string;
  readonly currency: string;
}

/**
 * The record of a Price Alert that reached its Target Price. It is stored, not delivered, and it has no read state.
 * The `owner` that the API also sends is not copied: it is always the person who asks.
 */
export interface Notification {
  readonly alertId: string;
  readonly listingId: string;
  readonly targetPrice: Money;
  readonly currentPrice: Money;
  readonly observedAt: string;
}

/** The result of asking for a Price Alert: `created` is false when the one that already existed was returned. */
export interface CreatedAlert {
  readonly alert: PriceAlert;
  readonly created: boolean;
}

/**
 * Why a request did not give what was asked. An `answer` is one that the API gives, with its status and its
 * stable `code`. The `message` of the API is for people who read the API, and the interface never shows it.
 * The other two are not answers: there was no connection, or what came back is not what the API gives.
 */
export type Failure =
  | {
      readonly kind: "answer";
      readonly status: number;
      readonly code: string;
      readonly message: string;
      /** The seconds to wait, when the API says so. */
      readonly retryAfterSeconds?: number;
      /** What is wrong, as a stable identifier, when the API says so: a registration that is not valid has four possible reasons. */
      readonly reason?: string;
    }
  | { readonly kind: "network" }
  | { readonly kind: "unexpected" };

/** What every operation of the client gives. It is a value: no operation throws. */
export type Result<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly failure: Failure };
