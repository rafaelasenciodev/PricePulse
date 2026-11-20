import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AlertQuery, ApiClient, Listing, Page, PriceAlert } from "../../src/api";
import { failures, screens } from "../../src/texts";
import { formatInstant } from "../../src/ui/format";
import { answer, fakeClient, network, ok, renderApp, sessionEnded, signedInClient } from "./support";

/** Tests of feature 10: each one names the scenario (SC-nn) or the rule (BR-nn) of feature 10. */

const HEADPHONES: Listing = {
  id: "headphones-shop-a",
  title: "Wireless headphones",
  retailer: "Shop A",
  currency: "EUR",
  currentPrice: { amount: "100.00", currency: "EUR", observedAt: "2026-11-19T10:00:00Z" },
};

const alertOf = (n: number, extra: Partial<PriceAlert> = {}): PriceAlert => ({
  id: `alert-${String(n).padStart(2, "0")}`,
  listingId: HEADPHONES.id,
  targetAmount: "80.00",
  currency: "EUR",
  status: "active",
  createdAt: "2026-11-19T10:00:00Z",
  ...extra,
});

/** A list of alerts that answers as the API does: by state, and one page at a time. */
function alertsOf(all: readonly PriceAlert[]): ApiClient["alerts"] {
  return vi.fn(async ({ status, limit, offset }: AlertQuery) => {
    const matching = status === undefined ? all : all.filter((a) => a.status === status);
    return ok({ items: matching.slice(offset, offset + limit), total: matching.length, limit, offset } satisfies Page<PriceAlert>);
  });
}

/** A Catalogue that has these Listings, and a read of one that finds them too. */
const catalogueWith = (...listings: Listing[]): Pick<ApiClient, "listings" | "listing"> => ({
  listings: vi.fn(async ({ limit, offset }) => ok({ items: listings.slice(offset, offset + limit), total: listings.length, limit, offset })),
  listing: vi.fn(async (id: string) => {
    const found = listings.find((l) => l.id === id);
    return found === undefined ? answer(404, "LISTING_NOT_FOUND") : ok(found);
  }),
});

const clientWith = (alerts: ApiClient["alerts"], overrides: Partial<ApiClient> = {}) =>
  signedInClient({ alerts, ...catalogueWith(HEADPHONES), ...overrides });

const entries = () => screen.getAllByRole("listitem");
const headings = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("who sees my alerts and my notifications (SC-01, SC-02, BR-01)", () => {
  it.each(["/alerts", "/notifications"])("SC-01 / BR-01: a person who is not signed in who opens %s sees the sign-in screen", async (address) => {
    renderApp(fakeClient(), address);
    await screen.findByRole("heading", { name: screens.signIn.title });
  });

  it("SC-02 / BR-01: the navigation has a link to the Catalogue, to my alerts and to my notifications", async () => {
    renderApp(clientWith(alertsOf([])), "/catalogue");
    const nav = await screen.findByRole("navigation", { name: screens.nav.label });
    expect(within(nav).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      [screens.nav.catalogue, "/catalogue"],
      [screens.nav.alerts, "/alerts"],
      [screens.nav.notifications, "/notifications"],
    ]);
  });

  it("SC-02: the navigation is on the screens of alerts and of notifications too, with the current one marked", async () => {
    renderApp(clientWith(alertsOf([])), "/alerts");
    const nav = await screen.findByRole("navigation", { name: screens.nav.label });
    expect(within(nav).getByRole("link", { name: screens.nav.alerts }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: screens.nav.catalogue }).getAttribute("aria-current")).toBeNull();
  });
});

describe("my alerts show what is needed to recognise each one (SC-03, SC-04, SC-05, BR-02, BR-03)", () => {
  it("SC-03 / BR-03: title, Retailer, Target Price with its currency, state and creation moment, and the title leads to the Listing", async () => {
    renderApp(clientWith(alertsOf([alertOf(1)])), "/alerts");
    await screen.findByText(HEADPHONES.title);
    const item = entries()[0]!;
    expect(within(item).getByText(HEADPHONES.title).closest("a")?.getAttribute("href")).toBe(`/listings/${HEADPHONES.id}`);
    expect(within(item).getByText(screens.listing.retailer("Shop A"))).toBeTruthy();
    expect(within(item).getByText(screens.alerts.targetPrice("80.00 EUR"))).toBeTruthy();
    expect(within(item).getByText(screens.alerts.state(screens.alerts.status.active))).toBeTruthy();
    expect(within(item).getByText(screens.alerts.createdAt(formatInstant("2026-11-19T10:00:00Z")))).toBeTruthy();
  });

  it("SC-04 / BR-02: keeps the order of the answer and does not sort again", async () => {
    const alerts = [alertOf(3, { targetAmount: "30.00" }), alertOf(1, { targetAmount: "10.00" }), alertOf(2, { targetAmount: "20.00" })];
    renderApp(clientWith(alertsOf(alerts)), "/alerts");
    await screen.findAllByText(HEADPHONES.title);
    expect(entries().map((e) => within(e).getByText(/Precio objetivo/).textContent)).toEqual(["Precio objetivo: 30.00 EUR", "Precio objetivo: 10.00 EUR", "Precio objetivo: 20.00 EUR"]);
  });

  it("SC-05 / BR-02: a person with no alerts is told so and is offered the Catalogue", async () => {
    renderApp(clientWith(alertsOf([])), "/alerts");
    await screen.findByText(screens.alerts.empty);
    expect(screen.getByRole("link", { name: screens.alerts.toCatalogue }).getAttribute("href")).toBe("/catalogue");
    expect(screen.queryByRole("listitem")).toBeNull();
  });
});

describe("the filter and the page are in the address (SC-06, SC-07, BR-02)", () => {
  const three = [alertOf(1, { status: "active" }), alertOf(2, { status: "triggered" }), alertOf(3, { status: "cancelled" })];
  const states = (): string[] => entries().map((e) => within(e).getByText(/^Estado: /).textContent ?? "");

  it.each([
    ["", ["Estado: Activa", "Estado: Disparada", "Estado: Cancelada"], undefined],
    ["?status=active", ["Estado: Activa"], "active"],
    ["?status=triggered", ["Estado: Disparada"], "triggered"],
    ["?status=cancelled", ["Estado: Cancelada"], "cancelled"],
  ])("SC-06: the address %j shows %j", async (search, shown, status) => {
    const alerts = alertsOf(three);
    renderApp(clientWith(alerts), `/alerts${search}`);
    await screen.findAllByText(HEADPHONES.title);
    expect(states()).toEqual(shown);
    expect(alerts).toHaveBeenCalledWith({ ...(status === undefined ? {} : { status }), limit: 20, offset: 0 });
  });

  it("SC-06: choosing a filter changes the address, and it starts at the first page", async () => {
    const user = renderApp(clientWith(alertsOf(three)), "/alerts?page=2");
    // Page 2 does not exist for 3 alerts, so the list leads to the last page, which is the first one.
    await screen.findAllByText(HEADPHONES.title);
    await user.click(screen.getByRole("link", { name: screens.alerts.filters.triggered }));
    await screen.findAllByText(HEADPHONES.title);
    expect(states()).toEqual(["Estado: Disparada"]);
    const triggered = screen.getByRole("link", { name: screens.alerts.filters.triggered });
    expect(triggered.getAttribute("href")).toBe("/alerts?status=triggered");
    expect(triggered.getAttribute("aria-current")).toBe("true");
  });

  it("SC-06: a state that is not one, or a page that is not a number, is read as every state and the first page", async () => {
    const alerts = alertsOf(three);
    renderApp(clientWith(alerts), "/alerts?status=paused&page=abc");
    await screen.findAllByText(HEADPHONES.title);
    expect(alerts).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    expect(entries()).toHaveLength(3);
  });

  it("SC-06: a filter with no alerts says so, and does not offer the Catalogue as if the person had none", async () => {
    renderApp(clientWith(alertsOf([alertOf(1)])), "/alerts?status=cancelled");
    await screen.findByText(screens.alerts.emptyFiltered);
    expect(screen.queryByRole("link", { name: screens.alerts.toCatalogue })).toBeNull();
  });

  it("SC-07 / BR-02: 20 of 25 and a way on, then the other 5 and a way back, with the page in the address and the filter kept", async () => {
    const all = Array.from({ length: 25 }, (_, i) => alertOf(i + 1));
    const user = renderApp(clientWith(alertsOf(all)), "/alerts?status=active");
    await screen.findAllByText(HEADPHONES.title);
    expect(entries()).toHaveLength(20);
    expect(screen.getByText(screens.paging.range(1, 20, 25))).toBeTruthy();
    expect(screen.queryByRole("link", { name: screens.paging.previous })).toBeNull();
    const next = screen.getByRole("link", { name: screens.paging.next });
    expect(next.getAttribute("href")).toBe("/alerts?status=active&page=2");
    await user.click(next);
    await screen.findByText(screens.paging.range(21, 25, 25));
    expect(entries()).toHaveLength(5);
    expect(screen.getByRole("link", { name: screens.paging.previous }).getAttribute("href")).toBe("/alerts?status=active&page=1");
    expect(screen.queryByRole("link", { name: screens.paging.next })).toBeNull();
  });

  it("SC-07: a page past the end leads to the last one", async () => {
    const all = Array.from({ length: 25 }, (_, i) => alertOf(i + 1));
    renderApp(clientWith(alertsOf(all)), "/alerts?page=9");
    await screen.findByText(screens.paging.range(21, 25, 25));
  });
});

describe("the titles come from the Catalogue (SC-08, SC-09, BR-03)", () => {
  const other: Listing = { ...HEADPHONES, id: "far-away", title: "A product far down the Catalogue" };

  it("SC-08: a Listing that is not among the first 100 of the Catalogue is asked for by its identifier", async () => {
    const catalogue = catalogueWith(HEADPHONES, other);
    const listings = vi.fn(async ({ limit, offset }: { limit: number; offset: number }) => ok({ items: [HEADPHONES], total: 101, limit, offset }));
    renderApp(clientWith(alertsOf([alertOf(1, { listingId: "far-away" })]), { listings, listing: catalogue.listing }), "/alerts");
    await screen.findByText(other.title);
    expect(listings).toHaveBeenCalledTimes(1);
    expect(listings).toHaveBeenCalledWith({ limit: 100, offset: 0 });
    expect(catalogue.listing).toHaveBeenCalledWith("far-away");
    expect(within(entries()[0]!).getByText(screens.listing.retailer("Shop A"))).toBeTruthy();
  });

  it("SC-08: reads the Catalogue once and asks only once for a Listing that two alerts share", async () => {
    const listing = vi.fn(async () => ok(other));
    const listings = vi.fn(async ({ limit, offset }: { limit: number; offset: number }) => ok({ items: [], total: 0, limit, offset }));
    renderApp(clientWith(alertsOf([alertOf(1, { listingId: "far-away" }), alertOf(2, { listingId: "far-away" })]), { listings, listing }), "/alerts");
    await screen.findAllByText(other.title);
    expect(listings).toHaveBeenCalledTimes(1);
    expect(listing).toHaveBeenCalledTimes(1);
  });

  it("the Listings of the Catalogue are not asked for again one by one", async () => {
    const catalogue = catalogueWith(HEADPHONES);
    renderApp(clientWith(alertsOf([alertOf(1), alertOf(2)]), catalogue), "/alerts");
    await screen.findAllByText(HEADPHONES.title);
    expect(catalogue.listing).not.toHaveBeenCalled();
  });

  it.each([
    ["the application cannot find that Listing", { listings: async () => ok({ items: [], total: 0, limit: 100, offset: 0 }), listing: async () => answer(404, "LISTING_NOT_FOUND") }],
    ["the read of the Catalogue fails, and so does the read of the Listing", { listings: async () => network, listing: async () => network }],
  ])("SC-09 / BR-03: when %s, the entry shows the identifier and the rest of it is complete", async (_cause, override: Partial<ApiClient>) => {
    renderApp(clientWith(alertsOf([alertOf(1)]), override), "/alerts");
    await screen.findByText(HEADPHONES.id);
    const item = entries()[0]!;
    expect(within(item).getByText(HEADPHONES.id).closest("a")?.getAttribute("href")).toBe(`/listings/${HEADPHONES.id}`);
    expect(within(item).getByText(screens.alerts.targetPrice("80.00 EUR"))).toBeTruthy();
    expect(within(item).getByText(screens.alerts.state(screens.alerts.status.active))).toBeTruthy();
    expect(within(item).queryByText(/^Tienda:/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("SC-09: the entry shows the identifier at first, and the title when it arrives", async () => {
    let release: (value: ReturnType<typeof ok<Page<Listing>>>) => void = () => {};
    const listings = vi.fn(() => new Promise<ReturnType<typeof ok<Page<Listing>>>>((resolve) => (release = resolve)));
    renderApp(clientWith(alertsOf([alertOf(1)]), { listings }), "/alerts");
    await screen.findByText(HEADPHONES.id);
    release(ok({ items: [HEADPHONES], total: 1, limit: 100, offset: 0 }));
    await screen.findByText(HEADPHONES.title);
    expect(headings()).toEqual([HEADPHONES.title]);
  });
});

describe("what was created is in the list (SC-10)", () => {
  it("SC-10 / BR-02: a Price Alert created from the Listing is in my alerts when the person opens them", async () => {
    const stored: PriceAlert[] = [];
    const client = signedInClient({
      ...catalogueWith(HEADPHONES),
      alerts: vi.fn(async ({ limit, offset }: AlertQuery) => ok({ items: stored.slice(offset, offset + limit), total: stored.length, limit, offset })),
      createAlert: vi.fn(async (listingId: string, targetAmount: string) => {
        const alert = alertOf(1, { listingId, targetAmount });
        stored.push(alert);
        return ok({ alert, created: true });
      }),
    });
    const user = renderApp(client, `/listings/${HEADPHONES.id}`);
    await user.type(await screen.findByLabelText(screens.alertForm.amount("EUR")), "75.00");
    await user.click(screen.getByRole("button", { name: screens.alertForm.submit }));
    await screen.findByText(screens.alertForm.created("75.00 EUR"));
    await user.click(screen.getByRole("link", { name: screens.nav.alerts }));
    await screen.findByText(screens.alerts.targetPrice("75.00 EUR"));
    expect(entries()).toHaveLength(1);
  });
});

describe("when reading my alerts goes wrong (SC-25, SC-26, BR-11)", () => {
  it("SC-25 / BR-11: a Session that ended takes the person to sign in and says so", async () => {
    renderApp(clientWith(async () => sessionEnded), "/alerts");
    await screen.findByRole("heading", { name: screens.signIn.title });
    expect(screen.getByRole("status").textContent).toBe(failures.sessionEnded);
  });

  it.each([
    ["does not answer", network],
    ["answers with an unexpected failure", answer(500, "INTERNAL_ERROR")],
  ])("SC-26 / BR-11: when the application %s, says that something failed, and trying again shows the alerts", async (_name, failure) => {
    const page = ok({ items: [alertOf(1)], total: 1, limit: 20, offset: 0 });
    const alerts = vi.fn<ApiClient["alerts"]>().mockResolvedValueOnce(failure).mockResolvedValueOnce(page);
    const user = renderApp(clientWith(alerts), "/alerts");
    expect((await screen.findByRole("alert")).textContent).toBe(failures.readAlerts.other);
    await user.click(screen.getByRole("button", { name: screens.retry }));
    await screen.findByText(HEADPHONES.title);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

