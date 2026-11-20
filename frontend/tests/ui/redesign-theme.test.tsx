/**
 * The choice of the appearance (feature 13). Each test names the scenario (SC-nn) or the rule (BR-nn). A simulated page
 * does not evaluate the media query of the system, so what is checked is the attribute `data-theme` of the page, which the
 * tokens of the style sheet read: the colours themselves are looked at by hand, as D6 of the design says.
 */

import { cleanup, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Listing } from "../../src/api";
import { screens } from "../../src/texts";
import { fakeClient, ok, renderApp, signedInClient } from "./support";

const headphones: Listing = { id: "headphones-shop-a", title: "Wireless headphones", retailer: "Shop A", currency: "EUR", currentPrice: null };

const theme = () => document.documentElement.getAttribute("data-theme");
const selector = () => screen.findByRole("combobox", { name: screens.theme.label }) as Promise<HTMLSelectElement>;
const signedIn = () => signedInClient({ listings: vi.fn(async () => ok({ items: [headphones], total: 1, limit: 20, offset: 0 })), listing: vi.fn(async () => ok(headphones)) });

describe("the person chooses the appearance (BR-10, BR-09)", () => {
  it.each([
    ["light", screens.theme.light],
    ["dark", screens.theme.dark],
  ])("SC-17: choosing %s applies at once, and the selector says which one is chosen", async (mode, label) => {
    const user = renderApp(signedIn(), "/catalogue");
    const choice = await selector();
    expect(choice.value).toBe("system");
    expect(theme()).toBeNull();
    await user.selectOptions(choice, label);
    expect(theme()).toBe(mode);
    expect(choice.value).toBe(mode);
    expect((choice.selectedOptions[0] as HTMLOptionElement).textContent).toBe(label);
  });

  it("SC-17: the selector offers the system, light and dark, with the system first", async () => {
    renderApp(signedIn(), "/catalogue");
    const options = Array.from((await selector()).options).map((o) => o.textContent);
    expect(options).toEqual([screens.theme.system, screens.theme.light, screens.theme.dark]);
  });

  it("SC-18: choosing the system goes back to following it", async () => {
    const user = renderApp(signedIn(), "/catalogue");
    const choice = await selector();
    await user.selectOptions(choice, screens.theme.light);
    expect(theme()).toBe("light");
    await user.selectOptions(choice, screens.theme.system);
    expect(theme()).toBeNull();
  });

  it("SC-19: the choice stays while the person moves between screens", async () => {
    const user = renderApp(signedIn(), "/catalogue");
    await user.selectOptions(await selector(), screens.theme.light);
    await user.click(screen.getByRole("link", { name: screens.nav.alerts }));
    await screen.findByRole("heading", { level: 1, name: screens.alerts.title });
    expect(theme()).toBe("light");
    await user.click(screen.getByRole("link", { name: screens.nav.notifications }));
    await screen.findByRole("heading", { level: 1, name: screens.notifications.title });
    expect(theme()).toBe("light");
    await user.click(screen.getByRole("link", { name: screens.nav.catalogue }));
    await user.click(await screen.findByRole("link", { name: "Wireless headphones" }));
    await screen.findByRole("heading", { level: 1, name: "Wireless headphones" });
    expect(theme()).toBe("light");
    expect((await selector()).value).toBe("light");
  });
});

describe("the screens of access (BR-10)", () => {
  it.each([
    ["/sign-in", screens.signIn.title],
    ["/register", screens.register.title],
  ])("SC-20: %s has the selector", async (address, title) => {
    renderApp(fakeClient(), address);
    await screen.findByRole("heading", { level: 1, name: title });
    expect(await selector()).toBeTruthy();
  });

  it("SC-20: choosing light before signing in applies, and stays after signing in", async () => {
    const user = renderApp(fakeClient({ listings: vi.fn(async () => ok({ items: [], total: 0, limit: 20, offset: 0 })) }), "/sign-in");
    await user.selectOptions(await selector(), screens.theme.light);
    expect(theme()).toBe("light");
    await user.type(screen.getByLabelText(screens.email), "eve@example.com");
    await user.type(screen.getByLabelText(screens.password), "a password");
    await user.click(screen.getByRole("button", { name: screens.signIn.submit }));
    await screen.findByRole("heading", { level: 1, name: screens.catalogue.title });
    expect(theme()).toBe("light");
    expect((await selector()).value).toBe("light");
  });
});

describe("the choice is not kept (BR-10)", () => {
  it("SC-21: a page that is loaded again follows the system (that nothing is stored is checked by `sources.test.ts`)", async () => {
    const user = renderApp(signedIn(), "/catalogue");
    await user.selectOptions(await selector(), screens.theme.light);
    expect(theme()).toBe("light");

    // Loading the page again: the interface goes away, and a new one is made.
    cleanup();
    expect(theme()).toBeNull();
    renderApp(signedIn(), "/catalogue");
    expect((await selector()).value).toBe("system");
    expect(theme()).toBeNull();
  });
});
