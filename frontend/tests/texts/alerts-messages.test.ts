/**
 * The messages of feature 10. Each test names the scenario (SC-nn) or the rule (BR-nn) of feature 10, and the file is
 * apart from `messages.test.ts` because the scenarios of the two features are numbered apart.
 */

import { describe, expect, it } from "vitest";
import type { Failure } from "../../src/api";
import { failures, messageFor } from "../../src/texts";

const answer = (status: number, code: string): Failure => ({ kind: "answer", status, code, message: "A message of the API, in English" });

describe("the messages of changing and cancelling (feature 10)", () => {
  it.each([
    ["INVALID_TARGET_PRICE", 422, failures.changeTarget.invalidAmount],
    ["TARGET_ALREADY_REACHED", 409, failures.changeTarget.reached],
    ["ALERT_NOT_ACTIVE", 409, failures.changeTarget.notActive],
    ["ALERT_CONFLICT", 409, failures.changeTarget.changed],
    ["ALERT_NOT_FOUND", 404, failures.changeTarget.notFound],
  ])("SC-15 / BR-07: %s has its own message when changing a Target Price", (code, status, text) => {
    expect(messageFor("changeTarget", answer(status, code))).toBe(text);
  });

  it.each([
    ["ALERT_NOT_ACTIVE", 409, failures.cancelAlert.notActive],
    ["ALERT_CONFLICT", 409, failures.cancelAlert.changed],
    ["ALERT_NOT_FOUND", 404, failures.cancelAlert.notFound],
  ])("SC-19 / BR-07: %s has its own message when cancelling", (code, status, text) => {
    expect(messageFor("cancelAlert", answer(status, code))).toBe(text);
  });

  it("SC-15 / BR-07: the six messages of changing a Target Price are different", () => {
    const texts = [
      ...[["INVALID_TARGET_PRICE", 422], ["TARGET_ALREADY_REACHED", 409], ["ALERT_NOT_ACTIVE", 409], ["ALERT_CONFLICT", 409], ["ALERT_NOT_FOUND", 404]].map(([code, status]) =>
        messageFor("changeTarget", answer(status as number, code as string)),
      ),
      messageFor("changeTarget", answer(500, "INTERNAL_ERROR")),
    ];
    expect(new Set(texts).size).toBe(6);
  });

  it("an answer that does not belong to the action says that something failed: a code of changing does not mean anything when reading", () => {
    expect(messageFor("readAlerts", answer(409, "ALERT_NOT_ACTIVE"))).toBe(failures.readAlerts.other);
    expect(messageFor("cancelAlert", answer(422, "INVALID_TARGET_PRICE"))).toBe(failures.cancelAlert.other);
  });
});
