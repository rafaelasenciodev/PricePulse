import { InvalidObservation, InvalidRange, ListingNotFound, ObservationConflict } from "../application";

/** BR-01: the request does not carry a valid credential of a Provider. Raised at the HTTP boundary. */
export class Unauthenticated extends Error {
  constructor() {
    super("Authentication is required");
    this.name = "Unauthenticated";
  }
}

/** The HTTP response that reports an error. The same shape as in the other features, declared by each so that none imports another. */
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
 *
 * Errors are told apart by their class, not by their name: other features have errors that
 * are named alike (ListingNotFound) and are translated by their own feature.
 */
export function priceObservationHttpError(error: unknown): HttpError | null {
  if (error instanceof Unauthenticated) {
    return { status: 401, code: "UNAUTHENTICATED", message: error.message };
  }
  if (error instanceof ListingNotFound) {
    return { status: 404, code: "LISTING_NOT_FOUND", message: error.message };
  }
  if (error instanceof InvalidObservation) {
    return { status: 422, code: "INVALID_OBSERVATION", message: error.message };
  }
  if (error instanceof InvalidRange) {
    return { status: 422, code: "INVALID_RANGE", message: error.message };
  }
  if (error instanceof ObservationConflict) {
    return { status: 409, code: "OBSERVATION_CONFLICT", message: error.message };
  }
  return null;
}
