import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ApiClient, Listing, Notification, PageQuery } from "../../src/api";
import { failures, screens } from "../../src/texts";
import { formatInstant } from "../../src/ui/format";
import { answer, network, ok, renderApp, sessionEnded, signedInClient } from "./support";

/** Tests of feature 10: each one names the scenario (SC-nn) or the rule (BR-nn) of feature 10. */

const HEADPHONES: Listing = {
  id: "headphones-shop-a",
  title: "Wireless headphones",
  retailer: "Shop A",
  currency: "EUR",
  currentPrice: null,
};

const notificationOf = (n: number, extra: Partial<Notification> = {}): Notification => ({
  alertId: `alert-${String(n).padStart(2, "0")}`,
  listingId: HEADPHONES.id,
  targetPrice: { amount: "80.00", currency: "EUR" },
  currentPrice: { amount: "79.50", currency: "EUR" },
  observedAt: "2026-11-19T11:00:00Z",
  ...extra,
});

function notificationsOf(all: readonly Notification[]): ApiClient["notifications"] {
  return vi.fn(async ({ limit, offset }: PageQuery) => ok({ items: all.slice(offset, offset + limit), total: all.length, limit, offset }));
}

const clientWith = (notifications: ApiClient["notifications"], overrides: Partial<ApiClient> = {}) =>
  signedInClient({
    notifications,
    listings: vi.fn(async ({ limit, offset }: PageQuery) => ok({ items: [HEADPHONES], total: 1, limit, offset })),
    listing: vi.fn(async () => answer(404, "LISTING_NOT_FOUND")),
    ...overrides,
  });

const entries = () => screen.getAllByRole("listitem");

describe("my notifications (SC-21, SC-22, SC-23, SC-24, BR-09, BR-10)", () => {
  it("SC-21 / BR-09: a Notification shows the title and Retailer of its Listing, the Target Price, the Current Price and when it was observed", async () => {
    renderApp(clientWith(notificationsOf([notificationOf(1)])), "/notifications");
    await screen.findByText(HEADPHONES.title);
    const item = entries()[0]!;
    expect(within(item).getByText(screens.listing.retailer("Shop A"))).toBeTruthy();
    expect(within(item).getByText(screens.notifications.targetPrice("80.00 EUR"))).toBeTruthy();
    expect(within(item).getByText(screens.notifications.currentPrice("79.50 EUR"))).toBeTruthy();
    expect(within(item).getByText(screens.notifications.observedAt(formatInstant("2026-11-19T11:00:00Z")))).toBeTruthy();
  });

  it("SC-22 / BR-09: keeps the order of the answer, and reads 20 of 25 and then the other 5", async () => {
    const all = Array.from({ length: 25 }, (_, i) => notificationOf(i + 1));
    const user = renderApp(clientWith(notificationsOf(all)), "/notifications");
    await screen.findAllByText(HEADPHONES.title);
    expect(entries()).toHaveLength(20);
    expect(screen.getByText(screens.paging.range(1, 20, 25))).toBeTruthy();
    expect(screen.getByRole("link", { name: screens.paging.next }).getAttribute("href")).toBe("/notifications?page=2");
    await user.click(screen.getByRole("link", { name: screens.paging.next }));
    await screen.findByText(screens.paging.range(21, 25, 25));
    expect(entries()).toHaveLength(5);
    expect(screen.getByRole("link", { name: screens.paging.previous }).getAttribute("href")).toBe("/notifications?page=1");
  });

  it("SC-23 / BR-10: a person with no Notifications is told so", async () => {
    renderApp(clientWith(notificationsOf([])), "/notifications");
    await screen.findByText(screens.notifications.empty);
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it.each([[[]], [[notificationOf(1)]]])("SC-24 / BR-10: says that Notifications are stored and not sent anywhere, with %j", async (all) => {
    renderApp(clientWith(notificationsOf(all)), "/notifications");
    await screen.findByRole("heading", { level: 1, name: screens.notifications.title });
    expect(screen.getByText(screens.notifications.note)).toBeTruthy();
    expect(screens.notifications.note).toMatch(/no se envían a ningún otro sitio/);
  });

  it("SC-24 / BR-10: no Notification has a mark of read, and the navigation shows no count", async () => {
    renderApp(clientWith(notificationsOf([notificationOf(1), notificationOf(2)])), "/notifications");
    await screen.findAllByText(HEADPHONES.title);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /leíd/i })).toBeNull();
    const nav = screen.getByRole("navigation", { name: screens.nav.label });
    expect(nav.textContent).not.toMatch(/\d/);
  });

  it("SC-09 / BR-03: when the title cannot be found, the identifier is shown and the rest of the Notification is complete", async () => {
    renderApp(
      clientWith(notificationsOf([notificationOf(1)]), { listings: async () => network, listing: async () => answer(404, "LISTING_NOT_FOUND") }),
      "/notifications",
    );
    await screen.findByText(HEADPHONES.id);
    const item = entries()[0]!;
    expect(within(item).getByText(screens.notifications.currentPrice("79.50 EUR"))).toBeTruthy();
    expect(within(item).queryByText(/^Tienda:/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("when reading my notifications goes wrong (SC-25, SC-26, BR-11)", () => {
  it("SC-25 / BR-11: a Session that ended takes the person to sign in and says so", async () => {
    renderApp(clientWith(async () => sessionEnded), "/notifications");
    await screen.findByRole("heading", { name: screens.signIn.title });
    expect(screen.getByRole("status").textContent).toBe(failures.sessionEnded);
  });

  it.each([
    ["does not answer", network],
    ["answers with an unexpected failure", answer(500, "INTERNAL_ERROR")],
  ])("SC-26 / BR-11: when the application %s, says that something failed, and trying again shows the Notifications", async (_name, failure) => {
    const page = ok({ items: [notificationOf(1)], total: 1, limit: 20, offset: 0 });
    const notifications = vi.fn<ApiClient["notifications"]>().mockResolvedValueOnce(failure).mockResolvedValueOnce(page);
    const user = renderApp(clientWith(notifications), "/notifications");
    expect((await screen.findByRole("alert")).textContent).toBe(failures.readNotifications.other);
    await user.click(screen.getByRole("button", { name: screens.retry }));
    await screen.findByText(HEADPHONES.title);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
