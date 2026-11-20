import type { Account, AlertStatus, CreatedAlert, CurrentPrice, Failure, Listing, Money, Notification, Page, PriceAlert, Result } from "./types";

/**
 * The part of `fetch` that the client uses. The page gives its own, and a test gives a fake one.
 */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface ApiClientOptions {
  readonly fetch: FetchLike;
}

export interface PageQuery {
  readonly limit: number;
  readonly offset: number;
}

/** A page of Price Alerts, of one state or of every state when `status` is absent. */
export interface AlertQuery extends PageQuery {
  readonly status?: AlertStatus;
}

/**
 * The eleven operations of the API that the interface uses. None of them throws: each gives a `Result`.
 *
 * The page never holds the token of a Session (BR-01 of feature 09): what the API returns when signing in is
 * read for the Account only, and the token is not copied anywhere. No request carries a header that names a
 * credential, and every address is relative: the browser sends the cookie by itself.
 */
export interface ApiClient {
  signIn(email: string, password: string): Promise<Result<Account>>;
  register(email: string, password: string): Promise<Result<Account>>;
  signOut(): Promise<Result<null>>;
  account(): Promise<Result<Account>>;
  listings(query: PageQuery): Promise<Result<Page<Listing>>>;
  listing(id: string): Promise<Result<Listing>>;
  /** The amount is sent as the text that was given: it is the API that decides whether it is valid (BR-09). */
  createAlert(listingId: string, targetAmount: string): Promise<Result<CreatedAlert>>;
  /** The Price Alerts of the person, newest first (feature 10). */
  alerts(query: AlertQuery): Promise<Result<Page<PriceAlert>>>;
  /** Gives the alert after the change. The amount is sent as the text that was given, as when creating one. */
  changeTarget(alertId: string, targetAmount: string): Promise<Result<PriceAlert>>;
  /** Gives the alert after the change: Cancelled. */
  cancelAlert(alertId: string): Promise<Result<PriceAlert>>;
  /** The Notifications of the person, newest first. */
  notifications(query: PageQuery): Promise<Result<Page<Notification>>>;
}

/** What a reader makes of an answer that went well. `null` means that the body is not what the API gives. */
type Reader<T> = (status: number, body: unknown) => { readonly value: T } | null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string";
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

// Each reader builds a new object with the fields it knows and nothing else, so that a field that the interface
// does not use, such as a token, does not travel on.

function toAccount(value: unknown): Account | null {
  return isRecord(value) && isText(value["id"]) && isText(value["email"]) ? { id: value["id"], email: value["email"] } : null;
}

function toCurrentPrice(value: unknown): CurrentPrice | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !isText(value["amount"]) || !isText(value["currency"]) || !isText(value["observedAt"])) return undefined;
  return { amount: value["amount"], currency: value["currency"], observedAt: value["observedAt"] };
}

function toListing(value: unknown): Listing | null {
  if (!isRecord(value)) return null;
  const { id, title, retailer, currency } = value;
  const currentPrice = toCurrentPrice(value["currentPrice"]);
  if (!isText(id) || !isText(title) || !isText(retailer) || !isText(currency) || currentPrice === undefined) return null;
  return { id, title, retailer, currency, currentPrice };
}

const STATUSES: readonly string[] = ["active", "triggered", "cancelled"];

function toPriceAlert(value: unknown): PriceAlert | null {
  if (!isRecord(value)) return null;
  const { id, listingId, targetAmount, currency, status, createdAt } = value;
  if (!isText(id) || !isText(listingId) || !isText(targetAmount) || !isText(currency) || !isText(createdAt)) return null;
  if (!isText(status) || !STATUSES.includes(status)) return null;
  return { id, listingId, targetAmount, currency, status: status as AlertStatus, createdAt };
}

function toMoney(value: unknown): Money | null {
  return isRecord(value) && isText(value["amount"]) && isText(value["currency"]) ? { amount: value["amount"], currency: value["currency"] } : null;
}

function toNotification(value: unknown): Notification | null {
  if (!isRecord(value)) return null;
  const { alertId, listingId, observedAt } = value;
  const targetPrice = toMoney(value["targetPrice"]);
  const currentPrice = toMoney(value["currentPrice"]);
  if (!isText(alertId) || !isText(listingId) || !isText(observedAt) || targetPrice === null || currentPrice === null) return null;
  return { alertId, listingId, targetPrice, currentPrice, observedAt };
}

function toPage<T>(value: unknown, toItem: (item: unknown) => T | null): Page<T> | null {
  if (!isRecord(value) || !Array.isArray(value["items"])) return null;
  const { total, limit, offset } = value;
  if (!isCount(total) || !isCount(limit) || !isCount(offset)) return null;
  const items: T[] = [];
  for (const raw of value["items"]) {
    const item = toItem(raw);
    if (item === null) return null;
    items.push(item);
  }
  return { items, total, limit, offset };
}

/** The whole seconds of a `Retry-After` header, or null if it is not that. */
function secondsOf(header: string | null): number | null {
  return header !== null && /^\d{1,9}$/.test(header.trim()) ? Number(header.trim()) : null;
}

const fail = (failure: Failure): { readonly ok: false; readonly failure: Failure } => ({ ok: false, failure });

export function createApiClient({ fetch: send }: ApiClientOptions): ApiClient {
  async function call<T>(method: string, path: string, body: unknown, read: Reader<T>): Promise<Result<T>> {
    try {
      const headers: Record<string, string> = { accept: "application/json" };
      if (body !== undefined) headers["content-type"] = "application/json";

      let response: Response;
      try {
        response = await send(path, {
          method,
          headers,
          credentials: "same-origin",
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      } catch {
        return fail({ kind: "network" });
      }

      let json: unknown;
      if (response.status !== 204) {
        try {
          json = await response.json();
        } catch {
          json = undefined;
        }
      }

      if (response.ok) {
        const read_ = read(response.status, json);
        return read_ === null ? fail({ kind: "unexpected" }) : { ok: true, data: read_.value };
      }
      if (isRecord(json) && isText(json["code"]) && isText(json["message"])) {
        const retry = secondsOf(response.headers.get("retry-after"));
        return fail({
          kind: "answer",
          status: response.status,
          code: json["code"],
          message: json["message"],
          ...(retry === null ? {} : { retryAfterSeconds: retry }),
          ...(isText(json["reason"]) ? { reason: json["reason"] } : {}),
        });
      }
      return fail({ kind: "unexpected" });
    } catch {
      // Whatever else goes wrong is not an answer of the API either.
      return fail({ kind: "unexpected" });
    }
  }

  const credentials = (email: string, password: string) => ({ email, password });
  // Every reader asks for the status that the API gives, and not only for a status that went well: a page of HTML
  // answered with a 200 by something that is not the application must not be taken for an answer of the API.
  const accountFrom = (status: number, expected: number, json: unknown) => {
    const account = status === expected ? toAccount(json) : null;
    return account === null ? null : { value: account };
  };

  const alertAfterChange: Reader<PriceAlert> = (status, json) => {
    const alert = status === 200 ? toPriceAlert(json) : null;
    return alert === null ? null : { value: alert };
  };

  return {
    signIn: (email, password) =>
      call("POST", "/sessions", credentials(email, password), (status, json) => {
        // Only the Account is read: the token that the answer also has is not copied.
        const account = status === 201 && isRecord(json) ? toAccount(json["account"]) : null;
        return account === null ? null : { value: account };
      }),

    register: (email, password) => call("POST", "/accounts", credentials(email, password), (status, json) => accountFrom(status, 201, json)),

    signOut: () => call<null>("DELETE", "/sessions/current", undefined, (status) => (status === 204 ? { value: null } : null)),

    account: () => call("GET", "/accounts/me", undefined, (status, json) => accountFrom(status, 200, json)),

    listings: ({ limit, offset }) =>
      call("GET", `/listings?limit=${limit}&offset=${offset}`, undefined, (status, json) => {
        const page = status === 200 ? toPage(json, toListing) : null;
        return page === null ? null : { value: page };
      }),

    listing: (id) =>
      call("GET", `/listings/${encodeURIComponent(id)}`, undefined, (status, json) => {
        const listing = status === 200 ? toListing(json) : null;
        return listing === null ? null : { value: listing };
      }),

    createAlert: (listingId, targetAmount) =>
      call("POST", `/listings/${encodeURIComponent(listingId)}/price-alerts`, { targetAmount }, (status, json) => {
        const alert = status === 201 || status === 200 ? toPriceAlert(json) : null;
        return alert === null ? null : { value: { alert, created: status === 201 } };
      }),

    alerts: ({ status, limit, offset }) =>
      call("GET", `/price-alerts?${status === undefined ? "" : `status=${status}&`}limit=${limit}&offset=${offset}`, undefined, (code, json) => {
        const page = code === 200 ? toPage(json, toPriceAlert) : null;
        return page === null ? null : { value: page };
      }),

    changeTarget: (alertId, targetAmount) => call("PATCH", `/price-alerts/${encodeURIComponent(alertId)}`, { targetAmount }, alertAfterChange),

    cancelAlert: (alertId) => call("PATCH", `/price-alerts/${encodeURIComponent(alertId)}`, { status: "cancelled" }, alertAfterChange),

    notifications: ({ limit, offset }) =>
      call("GET", `/notifications?limit=${limit}&offset=${offset}`, undefined, (status, json) => {
        const page = status === 200 ? toPage(json, toNotification) : null;
        return page === null ? null : { value: page };
      }),
  };
}
