import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Account, ApiClient, Failure, Result } from "../../src/api";
import { SessionProvider, useSession, type RegisterOutcome } from "../../src/session";

const eve: Account = { id: "a1", email: "eve@example.com" };
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const answer = (status: number, code: string): Result<never> => ({
  ok: false,
  failure: { kind: "answer", status, code, message: "x" } satisfies Failure,
});
const ended = answer(401, "UNAUTHENTICATED");
const network: Result<never> = { ok: false, failure: { kind: "network" } };

function fakeClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    signIn: vi.fn(async () => ok(eve)),
    register: vi.fn(async () => ok(eve)),
    signOut: vi.fn(async () => ok(null)),
    account: vi.fn(async () => ended),
    listings: vi.fn(async () => ended),
    listing: vi.fn(async () => ended),
    createAlert: vi.fn(async () => ended),
    ...overrides,
  };
}

/** Shows the state and gives a button for each thing the session can do. */
function Probe({ onRegister }: { onRegister?: (outcome: RegisterOutcome) => void }) {
  const session = useSession();
  const { state } = session;
  return (
    <div>
      <p data-testid="state">
        {state.status}
        {state.status === "signedOut" && state.reason ? `:${state.reason}` : ""}
        {state.status === "signedIn" ? `:${state.account.email}` : ""}
      </p>
      <button onClick={() => void session.signIn("eve@example.com", "pw")}>in</button>
      <button onClick={() => void session.register("eve@example.com", "pw").then(onRegister)}>register</button>
      <button onClick={() => void session.signOut()}>out</button>
      <button onClick={() => void session.api.listings({ limit: 6, offset: 0 })}>read</button>
    </div>
  );
}

function setup(client: ApiClient, onRegister?: (outcome: RegisterOutcome) => void) {
  render(
    <SessionProvider client={client}>
      <Probe {...(onRegister ? { onRegister } : {})} />
    </SessionProvider>,
  );
  return userEvent.setup();
}

const state = () => screen.getByTestId("state").textContent;

describe("session at the start (SC-01, SC-02)", () => {
  it("is checking until the Account answers", async () => {
    let release: (r: Result<Account>) => void = () => {};
    setup(fakeClient({ account: () => new Promise((resolve) => (release = resolve)) }));
    expect(state()).toBe("checking");
    release(ok(eve));
    await waitFor(() => expect(state()).toBe("signedIn:eve@example.com"));
  });

  it("is signed out when the answer is that there is no Session", async () => {
    setup(fakeClient());
    await waitFor(() => expect(state()).toBe("signedOut"));
  });

  it("is signed out, with its own reason, when the check itself fails", async () => {
    setup(fakeClient({ account: async () => network }));
    await waitFor(() => expect(state()).toBe("signedOut:check-failed"));
  });
});

describe("signing in (SC-03, SC-04)", () => {
  it("is signed in after the right credentials", async () => {
    const user = setup(fakeClient());
    await waitFor(() => expect(state()).toBe("signedOut"));
    await user.click(screen.getByText("in"));
    await waitFor(() => expect(state()).toBe("signedIn:eve@example.com"));
  });

  it("stays signed out after a failed sign-in, and a wrong password is not an ended Session", async () => {
    const user = setup(fakeClient({ signIn: async () => answer(401, "INVALID_CREDENTIALS") }));
    await waitFor(() => expect(state()).toBe("signedOut"));
    await user.click(screen.getByText("in"));
    await waitFor(() => expect(state()).toBe("signedOut"));
  });
});

describe("registering (SC-08, SC-10)", () => {
  it("registers and then signs in with the same email and password", async () => {
    const client = fakeClient();
    const user = setup(client);
    await waitFor(() => expect(state()).toBe("signedOut"));
    await user.click(screen.getByText("register"));
    await waitFor(() => expect(state()).toBe("signedIn:eve@example.com"));
    expect(client.register).toHaveBeenCalledWith("eve@example.com", "pw");
    expect(client.signIn).toHaveBeenCalledWith("eve@example.com", "pw");
  });

  it("does not sign in when the registration fails", async () => {
    const client = fakeClient({ register: async () => answer(409, "EMAIL_ALREADY_REGISTERED") });
    const outcomes: RegisterOutcome[] = [];
    const user = setup(client, (o) => outcomes.push(o));
    await waitFor(() => expect(state()).toBe("signedOut"));
    await user.click(screen.getByText("register"));
    await waitFor(() => expect(outcomes).toHaveLength(1));
    expect(outcomes[0]).toMatchObject({ ok: false, accountCreated: false });
    expect(client.signIn).not.toHaveBeenCalled();
  });

  it("says that the Account was created when the sign-in that follows fails", async () => {
    const client = fakeClient({ signIn: async () => network });
    const outcomes: RegisterOutcome[] = [];
    const user = setup(client, (o) => outcomes.push(o));
    await waitFor(() => expect(state()).toBe("signedOut"));
    await user.click(screen.getByText("register"));
    await waitFor(() => expect(outcomes).toHaveLength(1));
    expect(outcomes[0]).toMatchObject({ ok: false, accountCreated: true });
    expect(state()).toBe("signedOut");
  });
});

describe("signing out (SC-12, SC-13)", () => {
  async function signedIn(client: ApiClient) {
    const user = setup(client);
    await waitFor(() => expect(state()).toBe("signedIn:eve@example.com"));
    return user;
  }

  it("is signed out once the server has confirmed", async () => {
    const user = await signedIn(fakeClient({ account: async () => ok(eve) }));
    await user.click(screen.getByText("out"));
    await waitFor(() => expect(state()).toBe("signedOut"));
  });

  it("stays signed in when the sign-out is not confirmed", async () => {
    const client = fakeClient({ account: async () => ok(eve), signOut: vi.fn(async () => network) });
    const user = await signedIn(client);
    await user.click(screen.getByText("out"));
    await waitFor(() => expect(client.signOut).toHaveBeenCalled());
    expect(state()).toBe("signedIn:eve@example.com");
  });
});

describe("an ended Session anywhere (SC-14, BR-06)", () => {
  it.each([
    ["a read", "read", {}],
    ["signing out", "out", { signOut: async () => ended }],
  ])("signs out with the reason ended after %s", async (_name, button, override: Partial<ApiClient>) => {
    const user = setup(fakeClient({ account: async () => ok(eve), ...override }));
    await waitFor(() => expect(state()).toBe("signedIn:eve@example.com"));
    await user.click(screen.getByText(button));
    await waitFor(() => expect(state()).toBe("signedOut:ended"));
  });

  it("does not sign out for a failure that is not an ended Session", async () => {
    const user = setup(fakeClient({ account: async () => ok(eve), listings: async () => network }));
    await waitFor(() => expect(state()).toBe("signedIn:eve@example.com"));
    await user.click(screen.getByText("read"));
    await waitFor(() => expect(state()).toBe("signedIn:eve@example.com"));
  });
});
