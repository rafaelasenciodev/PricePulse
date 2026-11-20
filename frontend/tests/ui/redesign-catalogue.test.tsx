/**
 * The Catalogue as cards (feature 13). Each test names the scenario (SC-nn) or the rule (BR-nn) of feature 13. The
 * behaviour of reading, paging and failing is the one of feature 09 and is tested there (BR-08).
 */

import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Listing, PageQuery } from "../../src/api";
import { screens } from "../../src/texts";
import { formatInstant } from "../../src/ui/format";
import { ok, renderApp, signedInClient } from "./support";

const headphones: Listing = {
  id: "headphones-shop-a",
  title: "Wireless headphones",
  retailer: "Shop A",
  currency: "EUR",
  currentPrice: { amount: "100.00", currency: "EUR", observedAt: "2026-11-19T10:00:00Z" },
};
const monitor: Listing = { id: "monitor-shop-a", title: "27-inch monitor", retailer: "Shop A", currency: "EUR", currentPrice: null };

const catalogue = (items: Listing[], total = items.length) =>
  signedInClient({ listings: vi.fn(async ({ limit, offset }: PageQuery) => ok({ items: items.slice(offset, offset + limit), total, limit, offset })) });

describe("each Listing is a card (BR-01)", () => {
  it("SC-01 / BR-05: shows the title, the Retailer and the price with its currency, and leads to the Listing", async () => {
    renderApp(catalogue([headphones]), "/catalogue");
    await screen.findByText("Wireless headphones");
    const card = screen.getByRole("listitem");
    expect(within(card).getByRole("heading", { level: 2, name: "Wireless headphones" })).toBeTruthy();
    expect(within(card).getByText(screens.listing.retailer("Shop A"))).toBeTruthy();
    expect(within(card).getByText("100.00 EUR")).toBeTruthy();
    expect(within(card).getByText(screens.listing.observedAt(formatInstant("2026-11-19T10:00:00Z")))).toBeTruthy();
    expect(within(card).getByRole("link", { name: "Wireless headphones" }).getAttribute("href")).toBe("/listings/headphones-shop-a");
  });

  it("SC-02: a Listing with no Current Price says so, shows no amount, and still leads to the Listing", async () => {
    renderApp(catalogue([monitor]), "/catalogue");
    await screen.findByText("27-inch monitor");
    const card = screen.getByRole("listitem");
    expect(within(card).getByText(screens.listing.noPrice)).toBeTruthy();
    expect(card.textContent).not.toMatch(/\d\.\d\d|EUR/);
    expect(within(card).getByRole("link", { name: "27-inch monitor" }).getAttribute("href")).toBe("/listings/monitor-shop-a");
  });

  it("SC-02: the identifier of a Listing is encoded in the address", async () => {
    renderApp(catalogue([{ ...monitor, id: "a b/c" }]), "/catalogue");
    await screen.findByText("27-inch monitor");
    expect(screen.getByRole("link", { name: "27-inch monitor" }).getAttribute("href")).toBe("/listings/a%20b%2Fc");
  });
});

describe("the Catalogue keeps its order and its pages (BR-08)", () => {
  it("SC-03: the cards are in the order that the application gives, and there is a way on to the next page", async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ ...monitor, id: `item-${i + 1}`, title: `Product ${String(i + 1).padStart(2, "0")}` }));
    const [first, second, third] = [many[2], many[0], many[1]] as [Listing, Listing, Listing];
    const ordered = [first, second, third, ...many.slice(3)];
    const user = renderApp(catalogue(ordered), "/catalogue");
    await screen.findByText("Product 03");
    expect(screen.getAllByRole("heading", { level: 2 }).slice(0, 3).map((h) => h.textContent)).toEqual(["Product 03", "Product 01", "Product 02"]);
    await user.click(screen.getByRole("link", { name: screens.paging.next }));
    await screen.findByText("Product 25");
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });
});
