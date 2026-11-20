import type { FetchLike } from "../../src/api";

export interface Call {
  readonly input: string;
  readonly init: RequestInit;
}

type Reply = Response | Error | (() => never);

/** A `fetch` that answers what it is told, in order, and remembers what it was asked. */
export function fakeFetch(...replies: Reply[]): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  let next = 0;
  const send: FetchLike = async (input, init) => {
    calls.push({ input, init });
    const reply = replies[Math.min(next++, replies.length - 1)];
    if (reply === undefined) throw new Error("the fake has no reply");
    if (reply instanceof Error) throw reply;
    if (typeof reply === "function") return reply();
    return reply;
  };
  return { fetch: send, calls };
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

export const noContent = (): Response => new Response(null, { status: 204 });

export const answer = (status: number, code: string, message = "a message for people who read the API", headers: Record<string, string> = {}): Response =>
  json({ code, message }, status, headers);

export const ANA = { id: "user-1", email: "ana@example.com" };
export const HEADPHONES = {
  id: "headphones-shop-a",
  title: "Wireless headphones",
  retailer: "Shop A",
  currency: "EUR",
  currentPrice: { amount: "100.00", currency: "EUR", observedAt: "2026-11-19T10:00:00.000Z" },
};
export const ALERT = {
  id: "alert-1",
  listingId: "headphones-shop-a",
  targetAmount: "80.00",
  currency: "EUR",
  status: "active",
  createdAt: "2026-11-19T10:00:00.000Z",
};
