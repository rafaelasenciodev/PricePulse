import {
  EmailAlreadyRegistered,
  InvalidCredentials,
  InvalidRegistration,
  TooManyAttempts,
  Unauthenticated,
} from "../application";

export interface HttpError {
  readonly status: number;
  /** A stable identifier, so a client can tell apart errors that share a status. */
  readonly code: string;
  readonly message: string;
  /** Headers that the answer carries, such as how long to wait. */
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * The HTTP response that reports an error of this feature, or null if the error is not one
 * of its own. What no feature recognises is handled once, by the application that connects them.
 */
export function accountsHttpError(error: unknown): HttpError | null {
  if (error instanceof Unauthenticated) {
    return { status: 401, code: "UNAUTHENTICATED", message: error.message };
  }
  if (error instanceof InvalidRegistration) {
    return { status: 422, code: "INVALID_REGISTRATION", message: error.message };
  }
  if (error instanceof EmailAlreadyRegistered) {
    return { status: 409, code: "EMAIL_ALREADY_REGISTERED", message: error.message };
  }
  if (error instanceof InvalidCredentials) {
    return { status: 401, code: "INVALID_CREDENTIALS", message: error.message };
  }
  if (error instanceof TooManyAttempts) {
    return {
      status: 429,
      code: "TOO_MANY_ATTEMPTS",
      message: error.message,
      headers: { "retry-after": String(error.secondsToWait) },
    };
  }
  return null;
}
