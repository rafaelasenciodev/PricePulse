import type { Failure } from "../api";
import { failures } from "./es";

/** The actions of the interface that can fail with a message of their own. */
export type Action = "signIn" | "register" | "signOut" | "session" | "readCatalogue" | "readListing" | "createAlert";

/** Whether the answer is that the Session is not valid: the session handles it, and it has no message of the action (BR-06). */
export function isSessionEnded(failure: Failure): boolean {
  return failure.kind === "answer" && failure.status === 401 && failure.code === "UNAUTHENTICATED";
}

/**
 * The message for a failure of an action, in Spanish.
 *
 * It chooses by the `code` of the answer, which is stable, and never shows the `message` of the API, which is
 * for people who read the API and may change. A failure that is not an answer, and an answer that the action
 * does not know, get the message of the action that says that something failed and nothing of the cause (BR-12).
 */
export function messageFor(action: Action, failure: Failure): string {
  if (failure.kind === "answer") {
    switch (action) {
      case "signIn":
        if (failure.code === "INVALID_CREDENTIALS") return failures.signIn.invalid;
        if (failure.code === "TOO_MANY_ATTEMPTS") return failures.signIn.locked(failure.retryAfterSeconds);
        break;
      case "register":
        if (failure.code === "EMAIL_ALREADY_REGISTERED") return failures.register.emailTaken;
        if (failure.code === "INVALID_REGISTRATION") {
          // The reason is stable, and the message of the API, in English, is not shown.
          if (failure.reason === "EMAIL_NOT_VALID") return failures.register.emailInvalid;
          if (failure.reason === "PASSWORD_TOO_SHORT") return failures.register.passwordTooShort;
          if (failure.reason === "PASSWORD_TOO_LONG") return failures.register.passwordTooLong;
          if (failure.reason === "PASSWORD_IS_EMAIL") return failures.register.passwordIsEmail;
        }
        break;
      case "readListing":
        if (failure.code === "LISTING_NOT_FOUND") return failures.readListing.notFound;
        break;
      case "createAlert":
        if (failure.code === "DUPLICATE_ALERT") return failures.createAlert.duplicate;
        if (failure.code === "TARGET_ALREADY_REACHED") return failures.createAlert.reached;
        if (failure.code === "INVALID_TARGET_PRICE") return failures.createAlert.invalidAmount;
        if (failure.code === "LISTING_NOT_FOUND") return failures.createAlert.notFound;
        break;
      default:
        break;
    }
  }
  return failures[action].other;
}
