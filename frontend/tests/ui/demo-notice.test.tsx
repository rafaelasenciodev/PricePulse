/** The notice that the data is simulated (feature 12, SC-06 and BR-03), with a fake client. */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { screens } from "../../src/texts";
import { DemoNotice } from "../../src/ui/DemoNotice";
import { fakeClient, network, ok } from "./support";

describe("DemoNotice", () => {
  it("SC-06 / BR-03: shows one visible line when the server says that it is a demo", async () => {
    render(<DemoNotice client={fakeClient({ demo: vi.fn(async () => ok({ demo: true })) })} />);
    const notice = await screen.findByRole("note");
    expect(notice.textContent).toBe(screens.demo.notice);
    expect(notice.textContent).toMatch(/simulados/);
  });

  it("BR-03: shows nothing when the server is not a demo", async () => {
    const client = fakeClient({ demo: vi.fn(async () => ok({ demo: false })) });
    render(<DemoNotice client={client} />);
    await waitFor(() => expect(client.demo).toHaveBeenCalled());
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("BR-03: shows nothing when the question fails, and says nothing of the failure", async () => {
    const client = fakeClient({ demo: vi.fn(async () => network) });
    const { container } = render(<DemoNotice client={client} />);
    await waitFor(() => expect(client.demo).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("asks once, not at every change", async () => {
    const client = fakeClient({ demo: vi.fn(async () => ok({ demo: true })) });
    const { rerender } = render(<DemoNotice client={client} />);
    await screen.findByRole("note");
    rerender(<DemoNotice client={client} />);
    expect(client.demo).toHaveBeenCalledTimes(1);
  });
});
