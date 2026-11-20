/**
 * The screen of a Listing with its Price History (feature 13). Each test names the scenario (SC-nn) or the rule (BR-nn)
 * of feature 13. The points are checked on the text alternative of the chart, which is made from the same data (D3), and
 * a single test checks that the chart draws an `svg`: a simulated page has no layout to go further.
 */

import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ApiClient, Listing, Page, PriceObservation } from "../../src/api";
import { failures, screens } from "../../src/texts";
import { formatInstant } from "../../src/ui/format";
import { answer, network, ok, renderApp, signedInClient } from "./support";

const headphones: Listing = {
  id: "headphones-shop-a",
  title: "Wireless headphones",
  retailer: "Shop A",
  currency: "EUR",
  currentPrice: { amount: "100.00", currency: "EUR", observedAt: "2026-11-19T12:00:00Z" },
};

const at = (hour: number, amount: string | null): PriceObservation => ({
  observedAt: `2026-11-19T${String(hour).padStart(2, "0")}:00:00Z`,
  price: amount === null ? null : { amount, currency: "EUR" },
});

/** What the API gives for a history: the newest first. */
const history = (...items: PriceObservation[]): Page<PriceObservation> => ({ items, total: items.length, limit: 100, offset: 0 });

const clientWith = (priceHistory: ApiClient["priceHistory"], overrides: Partial<ApiClient> = {}) =>
  signedInClient({ listing: vi.fn(async () => ok(headphones)), priceHistory, ...overrides });
const withHistory = (page: Page<PriceObservation>) => clientWith(vi.fn(async () => ok(page)));

const ADDRESS = `/listings/${headphones.id}`;
const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const open = async (client: ApiClient) => {
  const user = renderApp(client, ADDRESS);
  await screen.findByRole("heading", { level: 1, name: "Wireless headphones" });
  return user;
};

describe("the Listing makes its price prominent (BR-02, BR-05)", () => {
  it("SC-04: shows the title, the Retailer and the price with its currency before the history, and the form beside it", async () => {
    await open(withHistory(history(at(12, "100.00"), at(11, "95.00"))));
    const price = screen.getAllByText("100.00 EUR")[0] as HTMLElement;
    expect(screen.getByText(screens.listing.retailer("Shop A"))).toBeTruthy();
    const section = await screen.findByRole("heading", { level: 2, name: screens.history.title });
    // The price comes before the history in the page, and the form of the alert is on the same screen.
    expect(price.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: screens.alertForm.submit })).toBeTruthy();
  });
});

describe("the Price History is a chart (BR-02, BR-03, BR-07)", () => {
  it("SC-05: draws the observations, oldest first, with the prices that the API wrote", async () => {
    // A simulated page has no layout, so the container of the chart is told that it measures 600 by 288.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly report: ResizeObserverCallback) {}
        observe(target: Element) {
          this.report([{ target, contentRect: { width: 600, height: 288 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    try {
      await open(withHistory(history(at(12, "90.00"), at(11, "95.00"), at(10, "100.00"))));
      await screen.findByRole("table");
      expect(rows().map((r) => r.textContent)).toEqual([
        `${formatInstant("2026-11-19T10:00:00Z")}100.00 EUR`,
        `${formatInstant("2026-11-19T11:00:00Z")}95.00 EUR`,
        `${formatInstant("2026-11-19T12:00:00Z")}90.00 EUR`,
      ]);
      // As far as a simulated page can see: the chart draws a line, and it is hidden from a screen reader (the table says it).
      const svg = await vi.waitFor(() => {
        const found = document.querySelector("svg");
        if (found === null) throw new Error("the chart is not drawn");
        return found;
      });
      expect(svg.closest("[aria-hidden='true']")).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("SC-06: an observation with no price is not a point, and no point has the price zero", async () => {
    await open(withHistory(history(at(12, "90.00"), at(11, null), at(10, "100.00"))));
    await screen.findByRole("table");
    expect(rows().map((r) => r.lastElementChild?.textContent)).toEqual(["100.00 EUR", "90.00 EUR"]);
  });

  it.each([
    ["no observation", history()],
    ["one observation", history(at(10, "100.00"))],
    ["one observation with a price and one without", history(at(11, null), at(10, "100.00"))],
  ])("SC-07 / BR-04: with %s no chart is drawn, and a note says that there is not enough history", async (_what, page) => {
    await open(withHistory(page));
    await screen.findByText(screens.history.notEnough);
    expect(document.querySelector("svg")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("SC-08 / BR-07: shows the lowest and the highest price of the period shown, and says so", async () => {
    await open(withHistory(history(at(12, "90.00"), at(11, "79.90"), at(10, "110.00"))));
    const lowest = (await screen.findByText(screens.history.lowest)).parentElement as HTMLElement;
    const highest = screen.getByText(screens.history.highest).parentElement as HTMLElement;
    expect(within(lowest).getByText("79.90 EUR")).toBeTruthy();
    expect(within(highest).getByText("110.00 EUR")).toBeTruthy();
  });

  it("SC-09 / BR-07: the content of the chart can be read as text, with the moment and the price of each point", async () => {
    await open(withHistory(history(at(11, "95.00"), at(10, "100.00"))));
    const table = await screen.findByRole("table", { name: screens.history.tableCaption });
    expect(within(table).getByRole("columnheader", { name: screens.history.moment })).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: screens.history.price })).toBeTruthy();
    expect(within(table).getByText(formatInstant("2026-11-19T10:00:00Z"))).toBeTruthy();
    expect(within(table).getByText("100.00 EUR")).toBeTruthy();
  });

  it("SC-05: two observations of the same moment are two points, and the table has no repeated key", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await open(withHistory(history(at(10, "90.00"), at(10, "95.00"), at(9, "100.00"))));
      await screen.findByRole("table");
      expect(rows()).toHaveLength(3);
      expect(errors.mock.calls.flat().join(" ")).not.toMatch(/same key|unique "key"/);
    } finally {
      errors.mockRestore();
    }
  });

  it("SC-10: asks for the newest 100 observations, which is what the chart draws", async () => {
    const priceHistory = vi.fn(async () => ok(history(at(11, "95.00"), at(10, "100.00"))));
    await open(clientWith(priceHistory));
    await screen.findByRole("table");
    expect(priceHistory).toHaveBeenCalledWith("headphones-shop-a", { limit: 100, offset: 0 });
  });
});

describe("when the history cannot be read (BR-06)", () => {
  it.each([
    ["does not answer", network],
    ["answers with an unexpected failure", answer(500, "INTERNAL_ERROR")],
  ])("SC-11: when the application %s, says so, and the Listing and its form are still there and work", async (_name, failure) => {
    const createAlert = vi.fn(async () => ok({ created: true, alert: { id: "al1", listingId: headphones.id, targetAmount: "80.00", currency: "EUR", status: "active" as const, createdAt: "2026-11-19T10:05:00Z" } }));
    const user = await open(clientWith(vi.fn(async () => failure), { createAlert }));
    expect((await screen.findByRole("alert")).textContent).toBe(failures.readHistory.other);
    expect(screen.getByText("100.00 EUR")).toBeTruthy();
    await user.type(screen.getByLabelText(screens.alertForm.amount("EUR")), "80.00");
    await user.click(screen.getByRole("button", { name: screens.alertForm.submit }));
    expect(createAlert).toHaveBeenCalledWith("headphones-shop-a", "80.00");
  });

  it("SC-12: trying again reads the history and shows the chart", async () => {
    const priceHistory = vi.fn<ApiClient["priceHistory"]>().mockResolvedValueOnce(network).mockResolvedValueOnce(ok(history(at(11, "95.00"), at(10, "100.00"))));
    const user = await open(clientWith(priceHistory));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: screens.retry }));
    await screen.findByRole("table");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(priceHistory).toHaveBeenCalledTimes(2);
  });

  it("SC-13 / BR-08: a Listing that does not exist keeps its message, and no history is asked for", async () => {
    const priceHistory = vi.fn(async () => ok(history()));
    renderApp(clientWith(priceHistory, { listing: vi.fn(async () => answer(404, "LISTING_NOT_FOUND")) }), "/listings/nope");
    expect((await screen.findByRole("alert")).textContent).toBe(failures.readListing.notFound);
    expect(screen.getByRole("link", { name: screens.listing.toCatalogue }).getAttribute("href")).toBe("/catalogue");
    expect(priceHistory).not.toHaveBeenCalled();
  });
});
