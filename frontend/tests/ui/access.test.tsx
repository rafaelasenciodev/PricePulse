import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Result } from "../../src/api";
import { failures, screens } from "../../src/texts";
import { answer, fakeClient, network, ok, eve, renderApp, sessionEnded, signedInClient } from "./support";

const heading = (name: string) => screen.findByRole("heading", { name });
const button = (name: string) => screen.getByRole("button", { name });

async function fill(user: UserEvent, email: string, password: string) {
  if (email) await user.type(screen.getByLabelText(screens.email), email);
  if (password) await user.type(screen.getByLabelText(screens.password), password);
}

describe("who sees what (SC-01, SC-02)", () => {
  it("shows the session is being checked until the Account answers", async () => {
    let release: (r: Result<typeof eve>) => void = () => {};
    renderApp(fakeClient({ account: () => new Promise((resolve) => (release = resolve)) }));
    expect(screen.getByRole("status").textContent).toBe(screens.checkingSession);
    release(ok(eve));
    await heading(screens.catalogue.title);
  });

  it.each(["/", "/catalogue", "/listings/headphones-shop-a", "/an/address/that/is/not/one"])(
    "SC-01: %s shows the sign-in screen to a person who is not signed in, with a way to register",
    async (address) => {
      renderApp(fakeClient(), address);
      await heading(screens.signIn.title);
      expect(screen.getByRole("link", { name: screens.signIn.toRegister }).getAttribute("href")).toBe("/register");
    },
  );

  it("SC-02: a person who is signed in is taken from the sign-in screen to the Catalogue", async () => {
    renderApp(signedInClient(), "/sign-in");
    await heading(screens.catalogue.title);
  });

  it("an address that is none leads to the Catalogue for a person who is signed in", async () => {
    renderApp(signedInClient(), "/nothing/here");
    await heading(screens.catalogue.title);
  });

  it("says that the session could not be checked, when it could not, and still lets the person sign in", async () => {
    renderApp(fakeClient({ account: async () => network }));
    await heading(screens.signIn.title);
    expect(screen.getByRole("status").textContent).toBe(failures.session.other);
  });
});

describe("signing in (SC-03, SC-04, SC-05, BR-03)", () => {
  it("SC-03: the right email and password lead to the Catalogue, with a way to sign out", async () => {
    const client = fakeClient();
    const user = renderApp(client, "/sign-in");
    await heading(screens.signIn.title);
    await fill(user, "demo1@example.com", "demo-password-1");
    await user.click(button(screens.signIn.submit));
    await heading(screens.catalogue.title);
    expect(client.signIn).toHaveBeenCalledWith("demo1@example.com", "demo-password-1");
    expect(button(screens.signOut.submit)).toBeTruthy();
  });

  it("SC-04: a wrong password and an email with no Account say the same, and the person stays", async () => {
    const messages: string[] = [];
    for (const email of ["demo1@example.com", "nobody@example.com"]) {
      const client = fakeClient({ signIn: vi.fn(async () => answer(401, "INVALID_CREDENTIALS")) });
      const user = renderApp(client, "/sign-in");
      await heading(screens.signIn.title);
      await fill(user, email, "wrong-password");
      await user.click(button(screens.signIn.submit));
      const alert = await screen.findByRole("alert");
      messages.push(alert.textContent ?? "");
      expect(screen.getByRole("heading", { name: screens.signIn.title })).toBeTruthy();
      document.body.innerHTML = "";
    }
    expect(messages[0]).toBe(failures.signIn.invalid);
    expect(messages[1]).toBe(failures.signIn.invalid);
  });

  it("SC-05: a locked email shows the seconds to wait, as the application answered", async () => {
    const client = fakeClient({ signIn: async () => answer(429, "TOO_MANY_ATTEMPTS", { retryAfterSeconds: 30 }) });
    const user = renderApp(client, "/sign-in");
    await heading(screens.signIn.title);
    await fill(user, "demo1@example.com", "demo-password-1");
    await user.click(button(screens.signIn.submit));
    expect((await screen.findByRole("alert")).textContent).toBe(failures.signIn.locked(30));
    expect(screen.getByRole("heading", { name: screens.signIn.title })).toBeTruthy();
  });

  it("says that something failed, and nothing of the cause, when there is no connection (BR-12)", async () => {
    const user = renderApp(fakeClient({ signIn: async () => network }), "/sign-in");
    await heading(screens.signIn.title);
    await fill(user, "demo1@example.com", "demo-password-1");
    await user.click(button(screens.signIn.submit));
    expect((await screen.findByRole("alert")).textContent).toBe(failures.signIn.other);
  });
});

describe("a form with an empty field is not sent (SC-06, BR-14)", () => {
  it.each([
    ["sign-in", "/sign-in", screens.signIn.submit, "signIn"],
    ["registration", "/register", screens.register.submit, "register"],
  ] as const)("the %s screen says which field is missing, and makes no request", async (_name, address, submit, call) => {
    const client = fakeClient();
    const user = renderApp(client, address);
    await screen.findByRole("heading");

    await fill(user, "", "a-password");
    await user.click(button(submit));
    expect((await screen.findByRole("alert")).textContent).toBe(screens.emailMissing);

    await user.clear(screen.getByLabelText(screens.password));
    await fill(user, "eve@example.com", "");
    await user.click(button(submit));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(screens.passwordMissing));

    await user.clear(screen.getByLabelText(screens.email));
    await user.click(button(submit));
    await waitFor(() => expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual([screens.emailMissing, screens.passwordMissing]));

    expect(client[call]).not.toHaveBeenCalled();
  });
});

describe("registering (SC-08, SC-09, SC-10, SC-11, BR-04)", () => {
  it("SC-08: registers, signs in with the same email and password, and shows the Catalogue", async () => {
    const client = fakeClient();
    const user = renderApp(client, "/register");
    await heading(screens.register.title);
    await fill(user, "eve@example.com", "valid-password-1");
    await user.click(button(screens.register.submit));
    await heading(screens.catalogue.title);
    expect(client.register).toHaveBeenCalledWith("eve@example.com", "valid-password-1");
    expect(client.signIn).toHaveBeenCalledWith("eve@example.com", "valid-password-1");
  });

  it.each([
    ["the email is not valid", answer(422, "INVALID_REGISTRATION", { reason: "EMAIL_NOT_VALID" }), failures.register.emailInvalid],
    ["the password is too short", answer(422, "INVALID_REGISTRATION", { reason: "PASSWORD_TOO_SHORT" }), failures.register.passwordTooShort],
    ["the password is too long", answer(422, "INVALID_REGISTRATION", { reason: "PASSWORD_TOO_LONG" }), failures.register.passwordTooLong],
    ["the password is the email", answer(422, "INVALID_REGISTRATION", { reason: "PASSWORD_IS_EMAIL" }), failures.register.passwordIsEmail],
    ["the email is registered", answer(409, "EMAIL_ALREADY_REGISTERED"), failures.register.emailTaken],
  ])("SC-09: says that %s, creates no Account and the person stays", async (_name, failure, message) => {
    const client = fakeClient({ register: vi.fn(async () => failure) });
    const user = renderApp(client, "/register");
    await heading(screens.register.title);
    await fill(user, "eve@example.com", "some-password");
    await user.click(button(screens.register.submit));
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(screen.getByRole("heading", { name: screens.register.title })).toBeTruthy();
    expect(client.signIn).not.toHaveBeenCalled();
  });

  it("SC-10: the Account is created and the sign-in fails: the sign-in screen has the email written and says so", async () => {
    const client = fakeClient({ signIn: vi.fn(async () => network) });
    const user = renderApp(client, "/register");
    await heading(screens.register.title);
    await fill(user, "eve@example.com", "valid-password-1");
    await user.click(button(screens.register.submit));
    await heading(screens.signIn.title);
    expect(screen.getByRole("status").textContent).toBe(screens.signIn.accountCreated);
    expect((screen.getByLabelText(screens.email) as HTMLInputElement).value).toBe("eve@example.com");
    expect((screen.getByLabelText(screens.password) as HTMLInputElement).value).toBe("");
  });

  it("SC-11: a form that is sent twice sends one registration, and its button cannot be used until the answer", async () => {
    let release: (r: Result<typeof eve>) => void = () => {};
    const client = fakeClient({ register: vi.fn(() => new Promise<Result<typeof eve>>((resolve) => (release = resolve))) });
    const user = renderApp(client, "/register");
    await heading(screens.register.title);
    await fill(user, "eve@example.com", "valid-password-1");
    const form = button(screens.register.submit).closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect((button(screens.register.submitting) as HTMLButtonElement).disabled).toBe(true));
    expect(client.register).toHaveBeenCalledTimes(1);
    release(ok(eve));
    await heading(screens.catalogue.title);
  });
});

describe("signing out and the end of the Session (SC-12, SC-13, SC-14, BR-05, BR-06)", () => {
  it("SC-12: signing out ends the Session at the application and shows the sign-in screen", async () => {
    const client = signedInClient();
    const user = renderApp(client, "/catalogue");
    await heading(screens.catalogue.title);
    await user.click(button(screens.signOut.submit));
    await heading(screens.signIn.title);
    expect(client.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: screens.catalogue.title })).toBeNull();
  });

  it("SC-12: once signed out, the screens of the signed-in person are not shown again", async () => {
    const user = renderApp(signedInClient(), "/catalogue");
    await heading(screens.catalogue.title);
    await user.click(button(screens.signOut.submit));
    await heading(screens.signIn.title);
    // Going back leads to an address of the signed-in person, and the guard turns it into the sign-in screen.
    expect(screen.queryByRole("button", { name: screens.signOut.submit })).toBeNull();
  });

  it("SC-13: a sign-out that is not confirmed says so and leaves the person where they are", async () => {
    const client = signedInClient({ signOut: vi.fn(async () => network) });
    const user = renderApp(client, "/catalogue");
    await heading(screens.catalogue.title);
    await user.click(button(screens.signOut.submit));
    expect((await screen.findByRole("alert")).textContent).toBe(failures.signOut.other);
    expect(screen.getByRole("heading", { name: screens.catalogue.title })).toBeTruthy();
    expect((button(screens.signOut.submit) as HTMLButtonElement).disabled).toBe(false);
  });

  it("SC-14: an answer that the Session is not valid, on signing out, shows the sign-in screen and says it ended", async () => {
    const user = renderApp(signedInClient({ signOut: async () => sessionEnded }), "/catalogue");
    await heading(screens.catalogue.title);
    await user.click(button(screens.signOut.submit));
    await heading(screens.signIn.title);
    expect(screen.getByRole("status").textContent).toBe(failures.sessionEnded);
    expect((screen.getByLabelText(screens.email) as HTMLInputElement).value).toBe("");
  });
});
