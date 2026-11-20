import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ApiClient, Result } from "../../src/api";
import { SessionProvider, useSession } from "../../src/session";

const ended: Result<never> = { ok: false, failure: { kind: "answer", status: 401, code: "UNAUTHENTICATED", message: "x" } };

function Probe() {
  const { state, api } = useSession();
  return (
    <div>
      <p data-testid="state">{state.status === "signedOut" && state.reason ? `${state.status}:${state.reason}` : state.status}</p>
      <button onClick={() => void api.alerts({ limit: 20, offset: 0 })}>alerts</button>
      <button onClick={() => void api.changeTarget("x", "1.00")}>change</button>
      <button onClick={() => void api.cancelAlert("x")}>cancel</button>
      <button onClick={() => void api.notifications({ limit: 20, offset: 0 })}>notifications</button>
    </div>
  );
}

describe("an ended Session in the operations of feature 10", () => {
  it.each(["alerts", "change", "cancel", "notifications"])("SC-25 / BR-11: the operation behind the button %s ends the Session", async (button) => {
    const client: ApiClient = {
      signIn: vi.fn(),
      register: vi.fn(),
      signOut: vi.fn(),
      account: vi.fn(async () => ({ ok: true as const, data: { id: "a1", email: "eve@example.com" } })),
      listings: vi.fn(),
      listing: vi.fn(),
      createAlert: vi.fn(),
      alerts: vi.fn(async () => ended),
      changeTarget: vi.fn(async () => ended),
      cancelAlert: vi.fn(async () => ended),
      notifications: vi.fn(async () => ended),
    };
    render(
      <SessionProvider client={client}>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("signedIn"));
    await userEvent.setup().click(screen.getByText(button));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("signedOut:ended"));
  });
});
