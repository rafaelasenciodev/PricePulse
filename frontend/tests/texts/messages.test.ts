/** The texts of the interface (feature 09). Each test names the scenario (SC-nn) or the rule (BR-nn). */

import { describe, expect, it } from "vitest";
import type { Failure } from "../../src/api";
import { failures, isSessionEnded, messageFor, vocabulary, type Action } from "../../src/texts";

const answer = (status: number, code: string, extra: { retryAfterSeconds?: number } = {}): Failure => ({
  kind: "answer",
  status,
  code,
  message: "A message of the API, in English, for people who read the API",
  ...extra,
});
const network: Failure = { kind: "network" };
const unexpected: Failure = { kind: "unexpected" };
const ACTIONS: Action[] = ["signIn", "register", "signOut", "session", "readCatalogue", "readListing", "createAlert"];

describe("the message of a failure", () => {
  it("SC-04 / BR-03: a wrong password and an email with no Account have the same message", () => {
    expect(messageFor("signIn", answer(401, "INVALID_CREDENTIALS"))).toBe(failures.signIn.invalid);
    expect(failures.signIn.invalid).not.toMatch(/contraseña (es|era) (incorrecta|errónea)|no existe|no hay ninguna cuenta/i);
  });

  it.each([
    [900, "Demasiados intentos. Espera 900 segundos e inténtalo de nuevo."],
    [1, "Demasiados intentos. Espera 1 segundo e inténtalo de nuevo."],
    [0, "Demasiados intentos. Espera 0 segundos e inténtalo de nuevo."],
  ])("SC-05 / BR-03: a locked email says to wait %i seconds", (seconds, text) => {
    expect(messageFor("signIn", answer(429, "TOO_MANY_ATTEMPTS", { retryAfterSeconds: seconds }))).toBe(text);
  });

  it("SC-05 / BR-03: a locked email with no seconds says to wait, with no number", () => {
    const text = messageFor("signIn", answer(429, "TOO_MANY_ATTEMPTS"));
    expect(text).toBe("Demasiados intentos. Espera un poco e inténtalo de nuevo.");
    expect(text).not.toMatch(/\d/);
  });

  it("SC-09 / BR-04: an email that is registered says so", () => {
    expect(messageFor("register", answer(409, "EMAIL_ALREADY_REGISTERED"))).toBe(failures.register.emailTaken);
  });

  it.each([
    ["EMAIL_NOT_VALID", failures.register.emailInvalid],
    ["PASSWORD_TOO_SHORT", failures.register.passwordTooShort],
    ["PASSWORD_TOO_LONG", failures.register.passwordTooLong],
    ["PASSWORD_IS_EMAIL", failures.register.passwordIsEmail],
  ])("SC-09 / BR-04: a registration that is not valid for the reason %s has its own message", (reason, text) => {
    expect(messageFor("register", { ...answer(422, "INVALID_REGISTRATION"), reason } as Failure)).toBe(text);
  });

  it("SC-09 / BR-04: the five problems of registering have five different messages, none of them the API's", () => {
    const texts = [
      messageFor("register", answer(409, "EMAIL_ALREADY_REGISTERED")),
      ...["EMAIL_NOT_VALID", "PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG", "PASSWORD_IS_EMAIL"].map((reason) =>
        messageFor("register", { ...answer(422, "INVALID_REGISTRATION"), reason } as Failure),
      ),
    ];
    expect(new Set(texts).size).toBe(5);
    for (const text of texts) expect(text).not.toContain("in English");
  });

  it.each([[undefined], ["A_REASON_THAT_NOBODY_KNOWS"]])("SC-30 / BR-12: a registration that is not valid for the reason %j says that something failed", (reason) => {
    const failure = { ...answer(422, "INVALID_REGISTRATION"), ...(reason === undefined ? {} : { reason }) } as Failure;
    expect(messageFor("register", failure)).toBe(failures.register.other);
  });

  it("BR-12: a reason means something only for the code that has it: another answer with a reason says that something failed", () => {
    const failure = { ...answer(400, "BAD_REQUEST"), reason: "EMAIL_NOT_VALID" } as Failure;
    expect(messageFor("register", failure)).toBe(failures.register.other);
  });

  it("SC-22: a Listing that does not exist says so, when reading it and when creating an alert for it", () => {
    expect(messageFor("readListing", answer(404, "LISTING_NOT_FOUND"))).toBe(failures.readListing.notFound);
    expect(messageFor("createAlert", answer(404, "LISTING_NOT_FOUND"))).toBe(failures.createAlert.notFound);
  });

  it.each([
    ["DUPLICATE_ALERT", 409, failures.createAlert.duplicate],
    ["TARGET_ALREADY_REACHED", 409, failures.createAlert.reached],
    ["INVALID_TARGET_PRICE", 422, failures.createAlert.invalidAmount],
  ])("SC-25 / SC-26 / BR-10: %s has its own message", (code, status, text) => {
    expect(messageFor("createAlert", answer(status, code))).toBe(text);
  });

  it("SC-26: the message of an amount that is not valid says that decimals are written with a point", () => {
    expect(failures.createAlert.invalidAmount).toContain("punto");
    expect(failures.createAlert.invalidAmount).toContain("80.00");
  });

  it("SC-25 / BR-10: the five answers of creating an alert have five different messages", () => {
    const texts = [
      messageFor("createAlert", answer(409, "DUPLICATE_ALERT")),
      messageFor("createAlert", answer(409, "TARGET_ALREADY_REACHED")),
      messageFor("createAlert", answer(422, "INVALID_TARGET_PRICE")),
      messageFor("createAlert", answer(404, "LISTING_NOT_FOUND")),
      messageFor("createAlert", answer(500, "INTERNAL_ERROR")),
    ];
    expect(new Set(texts).size).toBe(5);
  });
});

describe("a failure that has no message of its own (BR-12)", () => {
  it.each(ACTIONS)("SC-30 / BR-12: %s says that something failed for a failure that is not an answer", (action) => {
    expect(messageFor(action, network)).toBe(failures[action].other);
    expect(messageFor(action, unexpected)).toBe(failures[action].other);
  });

  it.each(ACTIONS)("SC-20 / SC-30 / BR-12: %s says the same for an unexpected failure of the API, and for a code that it does not know", (action) => {
    expect(messageFor(action, answer(500, "INTERNAL_ERROR"))).toBe(failures[action].other);
    expect(messageFor(action, answer(418, "A_CODE_THAT_NOBODY_KNOWS"))).toBe(failures[action].other);
  });

  it.each(ACTIONS)("BR-12: the message of %s never shows what the API says in its own message, nor a status", (action) => {
    for (const failure of [network, unexpected, answer(500, "INTERNAL_ERROR"), answer(400, "BAD_REQUEST"), answer(403, "FORBIDDEN_ORIGIN")]) {
      const text = messageFor(action, failure);
      expect(text).not.toContain("in English");
      expect(text).not.toMatch(/\b(4|5)\d\d\b|INTERNAL_ERROR|BAD_REQUEST|FORBIDDEN|TypeError|fetch|undefined|null/i);
    }
  });

  it("a code that means something to another action does not mean it here", () => {
    expect(messageFor("signIn", answer(409, "EMAIL_ALREADY_REGISTERED"))).toBe(failures.signIn.other);
    expect(messageFor("register", answer(401, "INVALID_CREDENTIALS"))).toBe(failures.register.other);
    expect(messageFor("readCatalogue", answer(404, "LISTING_NOT_FOUND"))).toBe(failures.readCatalogue.other);
  });
});

describe("the end of the Session", () => {
  it("BR-06: an answer 401 UNAUTHENTICATED is the end of the Session", () => {
    expect(isSessionEnded(answer(401, "UNAUTHENTICATED"))).toBe(true);
  });

  it.each([
    ["a wrong password when signing in", answer(401, "INVALID_CREDENTIALS")],
    ["a 403", answer(403, "FORBIDDEN_ORIGIN")],
    ["a 500", answer(500, "INTERNAL_ERROR")],
    ["no connection", network],
    ["an unexpected failure", unexpected],
  ])("BR-06: %s is not the end of the Session", (_what, failure) => {
    expect(isSessionEnded(failure)).toBe(false);
  });

  it("SC-14 / BR-06: says that the session ended and asks to enter again", () => {
    expect(failures.sessionEnded).toBe("Tu sesión ha terminado. Entra de nuevo.");
  });
});

describe("the words of the interface", () => {
  const everyText = (): string[] => {
    const texts: string[] = [failures.sessionEnded, failures.signIn.locked(7), failures.signIn.locked(undefined)];
    for (const group of [failures.signIn, failures.register, failures.signOut, failures.session, failures.readCatalogue, failures.readListing, failures.createAlert]) {
      for (const value of Object.values(group)) if (typeof value === "string") texts.push(value);
    }
    return texts;
  };

  it("uses the vocabulary of the design: a Listing is a producto, and never an oferta", () => {
    expect(vocabulary.listing).toBe("producto");
    expect(vocabulary.priceAlert).toBe("alerta de precio");
    expect(vocabulary.targetPrice).toBe("precio objetivo");
    expect(vocabulary.currentPrice).toBe("precio actual");
    expect(vocabulary.retailer).toBe("tienda");
    for (const text of everyText()) expect(text).not.toMatch(/oferta/i);
  });

  it("has every text in Spanish: no word of the glossary is left in English", () => {
    for (const text of everyText()) {
      expect(text).not.toMatch(/\b(alert|listing|session|catalogue|price|retailer|account|sign|error|failed|invalid|please)\b/i);
    }
  });

  it("has no text that is empty, and every message ends in a full stop", () => {
    for (const text of everyText()) {
      expect(text.trim()).toBe(text);
      expect(text.length).toBeGreaterThan(10);
      expect(text.endsWith(".")).toBe(true);
    }
  });
});
