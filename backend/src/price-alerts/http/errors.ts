import {
  DuplicateAlert,
  InvalidTargetPrice,
  ListingNotFound,
  TargetAlreadyReached,
} from "../application";

/** BR-01: the request does not carry a valid credential. Raised at the HTTP boundary. */
export class Unauthenticated extends Error {
  constructor() {
    super("Authentication is required");
    this.name = "Unauthenticated";
  }
}

export interface HttpError {
  readonly status: number;
  /** A stable identifier, so a client can tell apart errors that share a status. */
  readonly code: string;
  readonly message: string;
}

/**
 * The HTTP response that reports an error of this feature, or null if the error is not one
 * of its own. What no feature recognises (a malformed request, an unexpected failure) is
 * handled once, by the application that connects the features.
 */
export function priceAlertHttpError(error: unknown): HttpError | null {
  if (error instanceof Unauthenticated) {
    return { status: 401, code: "UNAUTHENTICATED", message: error.message };
  }
  if (error instanceof ListingNotFound) {
    return { status: 404, code: "LISTING_NOT_FOUND", message: error.message };
  }
  if (error instanceof InvalidTargetPrice) {
    return { status: 422, code: "INVALID_TARGET_PRICE", message: error.message };
  }
  if (error instanceof DuplicateAlert) {
    return { status: 409, code: "DUPLICATE_ALERT", message: error.message };
  }
  if (error instanceof TargetAlreadyReached) {
    return { status: 409, code: "TARGET_ALREADY_REACHED", message: error.message };
  }
  return null;
}
