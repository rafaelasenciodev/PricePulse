import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AlertQuery, ApiClient, Listing, PriceAlert, Result } from "../../src/api";
import { failures, screens } from "../../src/texts";
import { answer, network, ok, renderApp, sessionEnded, signedInClient } from "./support";

/** Tests of feature 10: each one names the scenario (SC-nn) or the rule (BR-nn) of feature 10. */

const HEADPHONES: Listing = {
  id: "headphones-shop-a",
  title: "Wireless headphones",
  retailer: "Shop A",
  currency: "EUR",
  currentPrice: { amount: "100.00", currency: "EUR", observedAt: "2026-11-19T10:00:00Z" },
};

const ACTIVE: PriceAlert = {
  id: "alert-01",
  listingId: HEADPHONES.id,
  targetAmount: "80.00",
  currency: "EUR",
  status: "active",
  createdAt: "2026-11-19T10:00:00Z",
};

/**
 * A client of a person with these alerts, that keeps them: a change or a cancel changes what the next read gives, as
 * the application does. The two changes can be given another answer.
 */
function clientWith(initial: readonly PriceAlert[], overrides: Partial<ApiClient> = {}) {
  const stored = initial.map((a) => ({ ...a }));
  const client = signedInClient({
    listings: vi.fn(async ({ limit, offset }) => ok({ items: [HEADPHONES], total: 1, limit, offset })),
    listing: vi.fn(async () => answer(404, "LISTING_NOT_FOUND")),
    alerts: vi.fn(async ({ limit, offset }: AlertQuery) => ok({ items: stored.slice(offset, offset + limit).map((a) => ({ ...a })), total: stored.length, limit, offset })),
    changeTarget: vi.fn(async (id: string, amount: string) => {
      const alert = stored.find((a) => a.id === id)!;
      alert.targetAmount = amount;
      return ok({ ...alert });
    }),
    cancelAlert: vi.fn(async (id: string) => {
      const alert = stored.find((a) => a.id === id)!;
      alert.status = "cancelled";
      return ok({ ...alert });
    }),
    ...overrides,
  });
  return client;
}

const changeButton = () => screen.getByRole("button", { name: screens.alerts.change });
const cancelButton = () => screen.getByRole("button", { name: screens.alerts.cancel });
const field = () => screen.findByLabelText(screens.alerts.changeForm.label("EUR"));
const save = () => screen.getByRole("button", { name: screens.alerts.changeForm.submit });
const confirm = () => screen.getByRole("button", { name: screens.alerts.confirmCancel.yes });
const noButtons = () => {
  expect(screen.queryByRole("button", { name: screens.alerts.change })).toBeNull();
  expect(screen.queryByRole("button", { name: screens.alerts.cancel })).toBeNull();
};

describe("only an Active alert offers to change and to cancel (SC-11, BR-04)", () => {
  it.each([
    ["active", true],
    ["triggered", false],
    ["cancelled", false],
  ] as const)("SC-11 / BR-04: an alert that is %s offers the two actions: %s", async (status, offers) => {
    renderApp(clientWith([{ ...ACTIVE, status }]), "/alerts");
    await screen.findByText(HEADPHONES.title);
    if (offers) {
      expect(changeButton()).toBeTruthy();
      expect(cancelButton()).toBeTruthy();
    } else {
      noButtons();
    }
  });
});

describe("changing the Target Price (SC-12, SC-13, SC-14, BR-05, BR-08)", () => {
  it("SC-12 / BR-05 / BR-08: sends the text that was written, trimmed, reads the list again and shows the new Target Price", async () => {
    const client = clientWith([ACTIVE]);
    const user = renderApp(client, "/alerts");
    await screen.findByText(HEADPHONES.title);
    await user.click(changeButton());
    await user.type(await field(), " 70.00 ");
    await user.click(save());
    await screen.findByText(screens.alerts.targetPrice("70.00 EUR"));
    expect(client.changeTarget).toHaveBeenCalledTimes(1);
    expect(client.changeTarget).toHaveBeenCalledWith("alert-01", "70.00");
    expect(client.alerts).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status").textContent).toBe(screens.alerts.changed("70.00 EUR"));
    // The entry is made anew: the form is gone and the actions are back.
    expect(screen.queryByLabelText(screens.alerts.changeForm.label("EUR"))).toBeNull();
    expect(changeButton()).toBeTruthy();
  });

  it("SC-12 / BR-05: the amount is sent as a text and not as a number, whatever it looks like", async () => {
    const client = clientWith([ACTIVE]);
    const user = renderApp(client, "/alerts");
    await screen.findByText(HEADPHONES.title);
    await user.click(changeButton());
    await user.type(await field(), "070.50");
    await user.click(save());
    await waitFor(() => expect(client.changeTarget).toHaveBeenCalledWith("alert-01", "070.50"));
  });

  it("SC-13 / BR-05: an empty field is not sent, and the message says that the amount is needed", async () => {
    const client = clientWith([ACTIVE]);
    const user = renderApp(client, "/alerts");
    await screen.findByText(HEADPHONES.title);
    await user.click(changeButton());
    await user.click(save());
    expect((await screen.findByRole("alert")).textContent).toBe(screens.alerts.changeForm.missing);
    expect(client.changeTarget).not.toHaveBeenCalled();
    // A field with only spaces is empty too.
    await user.type(await field(), "   ");
    await user.click(save());
    expect(client.changeTarget).not.toHaveBeenCalled();
  });

  it("SC-14: giving up sends nothing, and the alert is as before", async () => {
    const client = clientWith([ACTIVE]);
    const user = renderApp(client, "/alerts");
    await screen.findByText(HEADPHONES.title);
    await user.click(changeButton());
    await user.type(await field(), "70.00");
    await user.click(screen.getByRole("button", { name: screens.alerts.changeForm.giveUp }));
    expect(client.changeTarget).not.toHaveBeenCalled();
    expect(screen.getByText(screens.alerts.targetPrice("80.00 EUR"))).toBeTruthy();
    expect(changeButton()).toBeTruthy();
    expect(screen.queryByLabelText(screens.alerts.changeForm.label("EUR"))).toBeNull();
  });

  it("SC-12: the form of an alert is not the form of another: each field has a label of its own", async () => {
    const other: PriceAlert = { ...ACTIVE, id: "alert-02", targetAmount: "60.00" };
    const user = renderApp(clientWith([ACTIVE, other]), "/alerts");
    await screen.findAllByText(HEADPHONES.title);
    const [first, second] = screen.getAllByRole("button", { name: screens.alerts.change });
    await user.click(first!);
    await user.click(second!);
    const fields = screen.getAllByLabelText(screens.alerts.changeForm.label("EUR"));
    expect(new Set(fields.map((f) => f.id)).size).toBe(2);
  });
});

describe("each answer of changing a Target Price has its own message (SC-15, BR-07)", () => {
  it.each([
    ["that the amount is not valid", answer(422, "INVALID_TARGET_PRICE"), failures.changeTarget.invalidAmount],
    ["that the Current Price already reaches it", answer(409, "TARGET_ALREADY_REACHED"), failures.changeTarget.reached],
  ])("SC-15 / BR-07: when the application answers %s, the message is in the form and what was written stays", async (_what, reply, message) => {
    const client = clientWith([ACTIVE], { changeTarget: vi.fn(async () => reply) });
    const user = renderApp(client, "/alerts");
    await screen.findByText(HEADPHONES.title);
    await user.click(changeButton());
    await user.type(await field(), "abc");
    await user.click(save());
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect((await field() as HTMLInputElement).value).toBe("abc");
    // Nothing changed in the application, so the list is not read again.
    expect(client.alerts).toHaveBeenCalledTimes(1);
    // The person can correct the amount and send it again.
    await user.clear(await field());
    await user.type(await field(), "70.00");
    await user.click(save());
    await waitFor(() => expect(client.changeTarget).toHaveBeenCalledTimes(2));
  });

  it.each([
    ["that the alert is no longer Active", answer(409, "ALERT_NOT_ACTIVE"), failures.changeTarget.notActive],
    ["that the alert changed in the meantime", answer(409, "ALERT_CONFLICT"), failures.changeTarget.changed],
    ["that the alert does not exist", answer(404, "ALERT_NOT_FOUND"), failures.changeTarget.notFound],
  ])("SC-15 / BR-07 / BR-08: when the application answers %s, the screen says so and reads the list again", async (_what, reply, message) => {
    const client = clientWith([ACTIVE], { changeTarget: vi.fn(async () => reply) });
    const user = renderApp(client, "/alerts");
    await screen.findByText(HEADPHONES.title);
    await user.click(changeButton());
    await user.type(await field(), "70.00");
    await user.click(save());
    await waitFor(() => expect(client.alerts).toHaveBeenCalledTimes(2));
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    // The message is the screen's and is said once: the form that was open has been made anew.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByLabelText(screens.alerts.changeForm.label("EUR"))).toBeNull();
  });
});

describe("two sends in the same instant make one request (SC-16, SC-20, BR-08)", () => {
  it("SC-16 / BR-08: a form sent twice sends one request, and its button cannot be used until the answer", async () => {
    let release: (r: Result<PriceAlert>) => void = () => {};
    const client = clientWith([ACTIVE], { changeTarget: vi.fn(() => new Promise<Result<PriceAlert>>((resolve) => (release = resolve))) });
    const user = renderApp(client, "/alerts");
    await screen.findByText(HEADPHONES.title);
    await user.click(changeButton());
    await user.type(await field(), "70.00");
    const form = save().closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect((screen.getByRole("button", { name: screens.alerts.changeForm.submitting }) as HTMLButtonElement).disabled).toBe(true));
    expect(client.changeTarget).toHaveBeenCalledTimes(1);
    release(ok({ ...ACTIVE, targetAmount: "70.00" }));
    await screen.findByRole("status");
  });

  it("SC-20 / BR-08: confirming twice sends one request", async () => {
    let release: (r: Result<PriceAlert>) => void = () => {};
    const client = clientWith([ACTIVE], { cancelAlert: vi.fn(() => new Promise<Result<PriceAlert>>((resolve) => (release = resolve))) });
    const user = renderApp(client, "/alerts");
    await screen.findByText(HEADPHONES.title);
    await user.click(cancelButton());
    const yes = confirm();
    fireEvent.click(yes);
    fireEvent.click(yes);
    await waitFor(() => expect((screen.getByRole("button", { name: screens.alerts.confirmCancel.submitting }) as HTMLButtonElement).disabled).toBe(true));
    expect(client.cancelAlert).toHaveBeenCalledTimes(1);
    release(ok({ ...ACTIVE, status: "cancelled" }));
    await screen.findByRole("status");
  });
});

describe("cancelling (SC-17, SC-18, SC-19, BR-06, BR-07, BR-08)", () => {
  it("SC-17 / BR-06: asks first, with a way to confirm and a way to go back, and sends nothing until it is confirmed", async () => {
    const client = clientWith([ACTIVE]);
    const user = renderApp(client, "/alerts");
    await screen.findByText(HEADPHONES.title);
    await user.click(cancelButton());
    expect(screen.getByText(screens.alerts.confirmCancel.question)).toBeTruthy();
    expect(confirm()).toBeTruthy();
    expect(client.cancelAlert).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: screens.alerts.confirmCancel.no }));
    expect(client.cancelAlert).not.toHaveBeenCalled();
    expect(screen.queryByText(screens.alerts.confirmCancel.question)).toBeNull();
    expect(changeButton()).toBeTruthy();
    expect(screen.getByText(screens.alerts.state(screens.alerts.status.active))).toBeTruthy();
  });

  it("SC-18 / BR-06 / BR-08: confirming cancels the alert, reads the list again and shows it as Cancelled with no actions", async () => {
    const client = clientWith([ACTIVE]);
    const user = renderApp(client, "/alerts");
    await screen.findByText(HEADPHONES.title);
    await user.click(cancelButton());
    await user.click(confirm());
    await screen.findByText(screens.alerts.state(screens.alerts.status.cancelled));
    expect(client.cancelAlert).toHaveBeenCalledWith("alert-01");
    expect(client.alerts).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status").textContent).toBe(screens.alerts.cancelled);
    noButtons();
  });

  it.each([
    ["that the alert is no longer Active", answer(409, "ALERT_NOT_ACTIVE"), failures.cancelAlert.notActive],
    ["that the alert changed in the meantime", answer(409, "ALERT_CONFLICT"), failures.cancelAlert.changed],
    ["that the alert does not exist", answer(404, "ALERT_NOT_FOUND"), failures.cancelAlert.notFound],
  ])("SC-19 / BR-07 / BR-08: when the application answers %s, the screen says so and reads the list again", async (_what, reply, message) => {
    const client = clientWith([ACTIVE], { cancelAlert: vi.fn(async () => reply) });
    const user = renderApp(client, "/alerts");
    await screen.findByText(HEADPHONES.title);
    await user.click(cancelButton());
    await user.click(confirm());
    await waitFor(() => expect(client.alerts).toHaveBeenCalledTimes(2));
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(screen.queryByText(screens.alerts.confirmCancel.question)).toBeNull();
  });

  it("SC-07 / SC-18: cancelling the only alert of the last page leaves that page empty, and the list leads to the one before", async () => {
    const all = Array.from({ length: 21 }, (_, i) => ({ ...ACTIVE, id: `alert-${String(i + 1).padStart(2, "0")}` }));
    const client = clientWith(all, {
      alerts: vi.fn(async ({ status, limit, offset }: AlertQuery) => {
        const matching = all.filter((a) => status === undefined || a.status === status);
        return ok({ items: matching.slice(offset, offset + limit).map((a) => ({ ...a })), total: matching.length, limit, offset });
      }),
      cancelAlert: vi.fn(async (id: string) => {
        const alert = all.find((a) => a.id === id)!;
        alert.status = "cancelled";
        return ok({ ...alert });
      }),
    });
    const user = renderApp(client, "/alerts?status=active&page=2");
    await screen.findByText(screens.paging.range(21, 21, 21));
    await user.click(cancelButton());
    await user.click(confirm());
    await screen.findByText(screens.paging.range(1, 20, 20));
    expect(screen.getAllByRole("listitem")).toHaveLength(20);
    expect(screen.getByRole("status").textContent).toBe(screens.alerts.cancelled);
  });

  it("a notice belongs to the list that it was said on: going to another filter clears it", async () => {
    const client = clientWith([ACTIVE]);
    const user = renderApp(client, "/alerts");
    await screen.findByText(HEADPHONES.title);
    await user.click(cancelButton());
    await user.click(confirm());
    await screen.findByRole("status");
    await user.click(screen.getByRole("link", { name: screens.alerts.filters.active }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });
});

describe("when changing or cancelling goes wrong (SC-25, SC-26, BR-11)", () => {
  it.each([
    ["changing a Target Price", "change"],
    ["cancelling an alert", "cancel"],
  ])("SC-25 / BR-11: a Session that ended while %s takes the person to sign in and says so", async (_what, which) => {
    const client = clientWith([ACTIVE], { changeTarget: vi.fn(async () => sessionEnded), cancelAlert: vi.fn(async () => sessionEnded) });
    const user = renderApp(client, "/alerts");
    await screen.findByText(HEADPHONES.title);
    if (which === "change") {
      await user.click(changeButton());
      await user.type(await field(), "70.00");
      await user.click(save());
    } else {
      await user.click(cancelButton());
      await user.click(confirm());
    }
    await screen.findByRole("heading", { name: screens.signIn.title });
    expect(screen.getByRole("status").textContent).toBe(failures.sessionEnded);
  });

  it.each([
    ["does not answer", network],
    ["answers with an unexpected failure", answer(500, "INTERNAL_ERROR")],
  ])("SC-26 / BR-11: when the application %s while changing a Target Price, says that something failed and nothing of the cause, and the form stays", async (_name, failure) => {
    const client = clientWith([ACTIVE], { changeTarget: vi.fn(async () => failure) });
    const user = renderApp(client, "/alerts");
    await screen.findByText(HEADPHONES.title);
    await user.click(changeButton());
    await user.type(await field(), "70.00");
    await user.click(save());
    expect((await screen.findByRole("alert")).textContent).toBe(failures.changeTarget.other);
    expect((await field() as HTMLInputElement).value).toBe("70.00");
    expect(client.alerts).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["does not answer", network],
    ["answers with an unexpected failure", answer(500, "INTERNAL_ERROR")],
  ])("SC-26 / BR-11: when the application %s while cancelling, says that something failed, and the person can confirm again", async (_name, failure) => {
    const client = clientWith([ACTIVE], { cancelAlert: vi.fn().mockResolvedValueOnce(failure).mockResolvedValue(ok({ ...ACTIVE, status: "cancelled" })) });
    const user = renderApp(client, "/alerts");
    await screen.findByText(HEADPHONES.title);
    await user.click(cancelButton());
    await user.click(confirm());
    const entry = (await screen.findByRole("alert")).closest("li") as HTMLElement;
    expect(within(entry).getByRole("alert").textContent).toBe(failures.cancelAlert.other);
    expect(client.alerts).toHaveBeenCalledTimes(1);
    await user.click(confirm());
    await waitFor(() => expect(client.cancelAlert).toHaveBeenCalledTimes(2));
    expect((await screen.findByRole("status")).textContent).toBe(screens.alerts.cancelled);
  });
});
