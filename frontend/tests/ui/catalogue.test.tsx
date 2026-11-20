import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ApiClient, Listing, Page, PageQuery, Result } from "../../src/api";
import { failures, screens } from "../../src/texts";
import { formatInstant } from "../../src/ui/format";
import { answer, network, ok, renderApp, sessionEnded, signedInClient } from "./support";

const listing = (n: number, extra: Partial<Listing> = {}): Listing => ({
  id: `item-${String(n).padStart(2, "0")}`,
  title: `Product ${String(n).padStart(2, "0")}`,
  retailer: "Shop A",
  currency: "EUR",
  currentPrice: { amount: "10.00", currency: "EUR", observedAt: "2026-11-19T10:00:00Z" },
  ...extra,
});

/** A Catalogue of `total` Listings that gives a page as the API does. */
function catalogueOf(total: number): ApiClient["listings"] {
  const all = Array.from({ length: total }, (_, i) => listing(i + 1));
  return vi.fn(async ({ limit, offset }: PageQuery) => ok({ items: all.slice(offset, offset + limit), total, limit, offset }));
}

const clientWith = (listings: ApiClient["listings"]) => signedInClient({ listings });
const titles = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("the Catalogue shows each Listing (SC-15, SC-16, SC-17, BR-07)", () => {
  it("SC-15: title, Retailer, Current Price and the moment it was observed", async () => {
    const headphones = listing(1, { title: "Wireless headphones", retailer: "Shop A", currentPrice: { amount: "100.00", currency: "EUR", observedAt: "2026-11-19T10:00:00Z" } });
    renderApp(clientWith(async () => ok({ items: [headphones], total: 1, limit: 20, offset: 0 })), "/catalogue");
    await screen.findByText("Wireless headphones");
    const item = screen.getByRole("listitem");
    expect(within(item).getByText("Wireless headphones").closest("a")?.getAttribute("href")).toBe("/listings/item-01");
    expect(within(item).getByText(screens.listing.retailer("Shop A"))).toBeTruthy();
    expect(within(item).getByText("100.00 EUR")).toBeTruthy();
    expect(within(item).getByText(screens.listing.observedAt(formatInstant("2026-11-19T10:00:00Z")))).toBeTruthy();
  });

  it("SC-16: a Listing with no Current Price says so, and shows neither 0.00 nor an empty price", async () => {
    const monitor = listing(1, { title: "monitor-shop-a", currentPrice: null });
    renderApp(clientWith(async () => ok({ items: [monitor], total: 1, limit: 20, offset: 0 })), "/catalogue");
    await screen.findByText("monitor-shop-a");
    const item = screen.getByRole("listitem");
    expect(within(item).getByText(screens.listing.noPrice)).toBeTruthy();
    expect(item.textContent).not.toMatch(/0\.00|EUR/);
  });

  it("SC-17: keeps the order of the answer and does not sort again", async () => {
    const items = [listing(3), listing(1), listing(2)];
    renderApp(clientWith(async () => ok({ items, total: 3, limit: 20, offset: 0 })), "/catalogue");
    await screen.findByText("Product 03");
    expect(titles()).toEqual(["Product 03", "Product 01", "Product 02"]);
  });
});

describe("the Catalogue is read one page at a time (SC-18, BR-07)", () => {
  it("SC-18: 20 of 25 and a way on, then the other 5 and a way back", async () => {
    const listings = catalogueOf(25);
    const user = renderApp(clientWith(listings), "/catalogue");
    await screen.findByText("Product 01");
    expect(titles()).toHaveLength(20);
    expect(screen.getByText(screens.catalogue.range(1, 20, 25))).toBeTruthy();
    expect(screen.getByRole("link", { name: screens.catalogue.next }).getAttribute("href")).toBe("/catalogue?page=2");
    expect(screen.queryByRole("link", { name: screens.catalogue.previous })).toBeNull();
    expect(listings).toHaveBeenLastCalledWith({ limit: 20, offset: 0 });

    await user.click(screen.getByRole("link", { name: screens.catalogue.next }));
    await screen.findByText("Product 21");
    expect(titles()).toHaveLength(5);
    expect(screen.getByText(screens.catalogue.range(21, 25, 25))).toBeTruthy();
    expect(screen.getByRole("link", { name: screens.catalogue.previous }).getAttribute("href")).toBe("/catalogue?page=1");
    expect(screen.queryByRole("link", { name: screens.catalogue.next })).toBeNull();
    expect(listings).toHaveBeenLastCalledWith({ limit: 20, offset: 20 });
  });

  it("opens the page that the address asks for", async () => {
    const listings = catalogueOf(25);
    renderApp(clientWith(listings), "/catalogue?page=2");
    await screen.findByText("Product 21");
    expect(listings).toHaveBeenLastCalledWith({ limit: 20, offset: 20 });
  });

  it.each(["abc", "0", "-1", "1.5", ""])("a page that is %j is the first page", async (value) => {
    const listings = catalogueOf(25);
    renderApp(clientWith(listings), `/catalogue?page=${value}`);
    await screen.findByText("Product 01");
    expect(listings).toHaveBeenLastCalledWith({ limit: 20, offset: 0 });
  });

  it("a page past the end leads to the last page", async () => {
    const listings = catalogueOf(25);
    renderApp(clientWith(listings), "/catalogue?page=99");
    await screen.findByText("Product 21");
    expect(titles()).toHaveLength(5);
    expect(listings).toHaveBeenLastCalledWith({ limit: 20, offset: 20 });
  });
});

describe("an empty Catalogue and one that cannot be read (SC-19, SC-20, BR-12)", () => {
  it("SC-19: says that there are no Listings yet", async () => {
    renderApp(clientWith(async () => ok({ items: [], total: 0, limit: 20, offset: 0 })), "/catalogue");
    await screen.findByText(screens.catalogue.empty);
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it.each([
    ["does not answer", network],
    ["answers with an unexpected failure", answer(500, "INTERNAL_ERROR")],
  ])("SC-20: when the application %s, says it could not be read, and trying again shows the Catalogue", async (_name, failure) => {
    const page: Page<Listing> = { items: [listing(1)], total: 1, limit: 20, offset: 0 };
    const listings = vi.fn<ApiClient["listings"]>().mockResolvedValueOnce(failure).mockResolvedValueOnce(ok(page));
    const user = renderApp(clientWith(listings), "/catalogue");
    expect((await screen.findByRole("alert")).textContent).toBe(failures.readCatalogue.other);
    await user.click(screen.getByRole("button", { name: screens.retry }));
    await screen.findByText("Product 01");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows that it is loading until the page arrives", async () => {
    let release: (r: Result<Page<Listing>>) => void = () => {};
    renderApp(clientWith(() => new Promise((resolve) => (release = resolve))), "/catalogue");
    await screen.findByText(screens.loading);
    release(ok({ items: [listing(1)], total: 1, limit: 20, offset: 0 }));
    await screen.findByText("Product 01");
  });
});

describe("an ended Session while reading the Catalogue (SC-14, BR-06)", () => {
  it("opening the Catalogue shows the sign-in screen and says that the session ended", async () => {
    renderApp(clientWith(async () => sessionEnded), "/catalogue");
    await screen.findByRole("heading", { name: screens.signIn.title });
    expect(screen.getByRole("status").textContent).toBe(failures.sessionEnded);
  });

  it("going to the next page does the same", async () => {
    const listings = vi
      .fn<ApiClient["listings"]>()
      .mockImplementation(async ({ limit, offset }) =>
        offset === 0
          ? ok({ items: Array.from({ length: 20 }, (_, i) => listing(i + 1)), total: 25, limit, offset })
          : sessionEnded,
      );
    const user = renderApp(clientWith(listings), "/catalogue");
    await user.click(await screen.findByRole("link", { name: screens.catalogue.next }));
    await screen.findByRole("heading", { name: screens.signIn.title });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(failures.sessionEnded));
  });
});
