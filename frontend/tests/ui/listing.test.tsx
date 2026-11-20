import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ApiClient, CreatedAlert, Listing, Result } from "../../src/api";
import { failures, screens } from "../../src/texts";
import { formatInstant } from "../../src/ui/format";
import { answer, network, ok, renderApp, sessionEnded, signedInClient } from "./support";

const headphones: Listing = {
  id: "headphones-shop-a",
  title: "Wireless headphones",
  retailer: "Shop A",
  currency: "EUR",
  currentPrice: { amount: "100.00", currency: "EUR", observedAt: "2026-11-19T10:00:00Z" },
};

const alertFor = (targetAmount: string, created = true): Result<CreatedAlert> =>
  ok({ created, alert: { id: "al1", listingId: headphones.id, targetAmount, currency: "EUR", status: "active", createdAt: "2026-11-19T10:05:00Z" } });

const ADDRESS = `/listings/${headphones.id}`;

/** A client on whose Listing the person is, with the answers that the test changes. */
const clientOn = (overrides: Partial<ApiClient> = {}) =>
  signedInClient({ listing: vi.fn(async () => ok(headphones)), createAlert: vi.fn(async (_id, amount) => alertFor(amount)), ...overrides });

const field = () => screen.findByLabelText(screens.alertForm.amount("EUR")) as Promise<HTMLInputElement>;
const createButton = () => screen.getByRole("button", { name: screens.alertForm.submit });

async function ask(user: UserEvent, written: string) {
  const input = await field();
  await user.clear(input);
  if (written !== "") await user.type(input, written);
  await user.click(createButton());
}

describe("the screen of a Listing (SC-21, SC-22, BR-08)", () => {
  it("SC-21: is reached from the Catalogue and shows its data, a form in its currency and a way back", async () => {
    const client = clientOn({ listings: vi.fn(async () => ok({ items: [headphones], total: 1, limit: 20, offset: 0 })) });
    const user = renderApp(client, "/catalogue");
    await user.click(await screen.findByRole("link", { name: "Wireless headphones" }));
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Wireless headphones");
    expect(client.listing).toHaveBeenCalledWith("headphones-shop-a");
    expect(screen.getByText(screens.listing.retailer("Shop A"))).toBeTruthy();
    expect(screen.getByText("100.00 EUR")).toBeTruthy();
    expect(screen.getByText(screens.listing.observedAt(formatInstant("2026-11-19T10:00:00Z")))).toBeTruthy();
    expect(await field()).toBeTruthy();
    expect(screen.getByRole("link", { name: screens.listing.backToCatalogue }).getAttribute("href")).toBe("/catalogue");
  });

  it("SC-22: a Listing that is not in the Catalogue says so, and leads to the Catalogue", async () => {
    renderApp(clientOn({ listing: async () => answer(404, "LISTING_NOT_FOUND") }), "/listings/no-such-listing");
    expect((await screen.findByRole("alert")).textContent).toBe(failures.readListing.notFound);
    expect(screen.getByRole("link", { name: screens.listing.toCatalogue }).getAttribute("href")).toBe("/catalogue");
    expect(screen.queryByRole("button", { name: screens.alertForm.submit })).toBeNull();
  });

  it("a Listing that cannot be read says so with nothing of the cause, and can be tried again (BR-12)", async () => {
    const listing = vi.fn<ApiClient["listing"]>().mockResolvedValueOnce(network).mockResolvedValueOnce(ok(headphones));
    const user = renderApp(clientOn({ listing }), ADDRESS);
    expect((await screen.findByRole("alert")).textContent).toBe(failures.readListing.other);
    await user.click(screen.getByRole("button", { name: screens.retry }));
    await screen.findByRole("heading", { name: "Wireless headphones" });
  });

  it("an identifier with characters that need care reaches the API as it is", async () => {
    const client = clientOn();
    renderApp(client, `/listings/${encodeURIComponent("a/b c")}`);
    await screen.findByRole("heading", { name: "Wireless headphones" });
    expect(client.listing).toHaveBeenCalledWith("a/b c");
  });
});

describe("creating a Price Alert (SC-23, SC-24, SC-25, BR-10)", () => {
  it("SC-23: a valid target says that the Price Alert was created, with its target", async () => {
    const client = clientOn();
    const user = renderApp(client, ADDRESS);
    await ask(user, "80.00");
    expect((await screen.findByRole("status")).textContent).toBe(screens.alertForm.created("80.00 EUR"));
    expect(client.createAlert).toHaveBeenCalledWith("headphones-shop-a", "80.00");
  });

  it("SC-24: asking again for the same one says that it already existed, and not that it is new", async () => {
    const user = renderApp(clientOn({ createAlert: async (_id, amount) => alertFor(amount, false) }), ADDRESS);
    await ask(user, "80.00");
    const message = (await screen.findByRole("status")).textContent;
    expect(message).toBe(screens.alertForm.existed("80.00 EUR"));
    expect(message).not.toMatch(/creada/);
  });

  it.each([
    ["there is already an Active Price Alert with another target", answer(409, "DUPLICATE_ALERT"), "80.00", failures.createAlert.duplicate],
    ["the Current Price reaches the target", answer(422, "TARGET_ALREADY_REACHED"), "100.00", failures.createAlert.reached],
    ["the Current Price is below the target", answer(422, "TARGET_ALREADY_REACHED"), "120.00", failures.createAlert.reached],
    ["the Listing no longer exists", answer(404, "LISTING_NOT_FOUND"), "80.00", failures.createAlert.notFound],
  ])("SC-25: when %s, says why, and what was written is still in the form", async (_name, failure, written, message) => {
    const user = renderApp(clientOn({ createAlert: async () => failure }), ADDRESS);
    await ask(user, written);
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect((await field()).value).toBe(written);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("the amount (SC-26, SC-27, BR-09)", () => {
  it.each(["abc", "0", "-5", "80.001", "80,00"])(
    "SC-26: %j is sent as written, and the answer that it is not valid says how an amount is written",
    async (written) => {
      const client = clientOn({ createAlert: vi.fn(async () => answer(422, "INVALID_TARGET_PRICE")) });
      const user = renderApp(client, ADDRESS);
      await ask(user, written);
      const message = (await screen.findByRole("alert")).textContent ?? "";
      expect(message).toBe(failures.createAlert.invalidAmount);
      expect(message).toMatch(/punto/);
      expect(message).toMatch(/80\.00/);
      expect(client.createAlert).toHaveBeenCalledWith("headphones-shop-a", written);
      expect((await field()).value).toBe(written);
    },
  );

  it.each([
    ["80.00", "80.00"],
    ["  80.00  ", "80.00"],
    ["80.50", "80.50"],
    ["80.5", "80.5"],
    ["080.00", "080.00"],
  ])("SC-27: writing %j sends the text %j and not a number", async (written, sent) => {
    const client = clientOn();
    const user = renderApp(client, ADDRESS);
    await ask(user, written);
    await screen.findByRole("status");
    expect(client.createAlert).toHaveBeenCalledWith("headphones-shop-a", sent);
    expect(typeof vi.mocked(client.createAlert).mock.calls[0]?.[1]).toBe("string");
  });

  it.each(["", "   "])("SC-06: an empty target (%j) is not sent, and says that it is needed", async (written) => {
    const client = clientOn();
    const user = renderApp(client, ADDRESS);
    await ask(user, written);
    expect((await screen.findByRole("alert")).textContent).toBe(screens.alertForm.amountMissing);
    expect(client.createAlert).not.toHaveBeenCalled();
  });
});

describe("while it is being created and after (SC-28, SC-29, SC-30, BR-11, BR-12)", () => {
  it("SC-28: a form sent twice sends one request, and its button cannot be used until the answer", async () => {
    let release: (r: Result<CreatedAlert>) => void = () => {};
    const client = clientOn({ createAlert: vi.fn(() => new Promise<Result<CreatedAlert>>((resolve) => (release = resolve))) });
    const user = renderApp(client, ADDRESS);
    await user.type(await field(), "80.00");
    const form = createButton().closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect((screen.getByRole("button", { name: screens.alertForm.submitting }) as HTMLButtonElement).disabled).toBe(true));
    expect(client.createAlert).toHaveBeenCalledTimes(1);
    release(alertFor("80.00"));
    await screen.findByRole("status");
  });

  it("SC-29: after creating it, the Listing is read again and shows the price that the application has now", async () => {
    const listing = vi
      .fn<ApiClient["listing"]>()
      .mockResolvedValueOnce(ok(headphones))
      .mockResolvedValue(ok({ ...headphones, currentPrice: { amount: "79.90", currency: "EUR", observedAt: "2026-11-19T11:00:00Z" } }));
    const user = renderApp(clientOn({ listing }), ADDRESS);
    expect(await screen.findByText("100.00 EUR")).toBeTruthy();
    await ask(user, "80.00");
    expect(await screen.findByText("79.90 EUR")).toBeTruthy();
    expect(screen.queryByText("100.00 EUR")).toBeNull();
    expect(listing).toHaveBeenCalledTimes(2);
    // The message of the result survives the new reading.
    expect(screen.getByRole("status").textContent).toBe(screens.alertForm.created("80.00 EUR"));
  });

  it("does not read the Listing again when the request is refused, so what was written stays", async () => {
    const client = clientOn({ createAlert: async () => answer(422, "TARGET_ALREADY_REACHED") });
    const user = renderApp(client, ADDRESS);
    await ask(user, "100.00");
    await screen.findByRole("alert");
    expect(client.listing).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["does not answer", network],
    ["answers with an unexpected failure", answer(500, "INTERNAL_ERROR")],
  ])("SC-30: when the application %s, says that something failed, keeps what was written and says nothing was created", async (_name, failure) => {
    const user = renderApp(clientOn({ createAlert: async () => failure }), ADDRESS);
    await ask(user, "80.00");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(failures.createAlert.other);
    expect((await field()).value).toBe("80.00");
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("an ended Session on the screen of a Listing (SC-14, BR-06)", () => {
  it("opening the Listing shows the sign-in screen and says that the session ended", async () => {
    renderApp(clientOn({ listing: async () => sessionEnded }), ADDRESS);
    await screen.findByRole("heading", { name: screens.signIn.title });
    expect(screen.getByRole("status").textContent).toBe(failures.sessionEnded);
  });

  it("creating a Price Alert does the same, and nothing that was written is kept", async () => {
    const user = renderApp(clientOn({ createAlert: async () => sessionEnded }), ADDRESS);
    await ask(user, "80.00");
    await screen.findByRole("heading", { name: screens.signIn.title });
    expect(screen.getByRole("status").textContent).toBe(failures.sessionEnded);
    expect(screen.queryByLabelText(screens.alertForm.amount("EUR"))).toBeNull();
    expect(within(document.body).queryByDisplayValue("80.00")).toBeNull();
  });
});
