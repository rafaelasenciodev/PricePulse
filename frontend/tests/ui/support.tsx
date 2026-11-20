import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import type { Account, ApiClient, Failure, Result } from "../../src/api";
import { SessionProvider } from "../../src/session";
import { App } from "../../src/ui/App";

export const eve: Account = { id: "a1", email: "eve@example.com" };

export const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
export const network: Result<never> = { ok: false, failure: { kind: "network" } };

/** An answer of the API that is not what was asked, with its status and its stable code. */
export function answer(status: number, code: string, extra: Partial<Failure & { kind: "answer" }> = {}): Result<never> {
  return { ok: false, failure: { kind: "answer", status, code, message: "not shown", ...extra } };
}

export const sessionEnded = answer(401, "UNAUTHENTICATED");

/** A client that answers as a person who is not signed in, unless the test says otherwise. */
export function fakeClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    signIn: vi.fn(async () => ok(eve)),
    register: vi.fn(async () => ok(eve)),
    signOut: vi.fn(async () => ok(null)),
    account: vi.fn(async () => sessionEnded),
    // What a person reaches after signing in: an empty Catalogue, which is not an ended Session.
    listings: vi.fn(async () => ok({ items: [], total: 0, limit: 20, offset: 0 })),
    listing: vi.fn(async () => sessionEnded),
    createAlert: vi.fn(async () => sessionEnded),
    alerts: vi.fn(async () => ok({ items: [], total: 0, limit: 20, offset: 0 })),
    changeTarget: vi.fn(async () => sessionEnded),
    cancelAlert: vi.fn(async () => sessionEnded),
    notifications: vi.fn(async () => ok({ items: [], total: 0, limit: 20, offset: 0 })),
    priceHistory: vi.fn(async () => ok({ items: [], total: 0, limit: 100, offset: 0 })),
    demo: vi.fn(async () => ok({ demo: false })),
    ...overrides,
  };
}

/** A client of a person who is signed in. */
export const signedInClient = (overrides: Partial<ApiClient> = {}) => fakeClient({ account: vi.fn(async () => ok(eve)), ...overrides });

/** The interface at an address, with the router in memory: the base `/app` belongs to the page. */
export function renderApp(client: ApiClient, address = "/") {
  render(
    <MemoryRouter initialEntries={[address]}>
      <SessionProvider client={client}>
        <App />
      </SessionProvider>
    </MemoryRouter>,
  );
  return userEvent.setup();
}
