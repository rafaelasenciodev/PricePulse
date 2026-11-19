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

/** Map an error to the HTTP response that reports it. Unexpected errors reveal nothing. */
export function toHttpError(error: unknown): HttpError {
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
  const status = clientErrorStatus(error);
  if (status !== null) {
    // The request itself is wrong: bad JSON, a body that does not match the schema, ...
    return {
      status,
      code: status === 400 ? "BAD_REQUEST" : "CLIENT_ERROR",
      message: error instanceof Error ? error.message : "Invalid request",
    };
  }
  return { status: 500, code: "INTERNAL_ERROR", message: "Internal server error" };
}

function clientErrorStatus(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const status = (error as { statusCode: unknown }).statusCode;
    if (typeof status === "number" && status >= 400 && status < 500) return status;
  }
  return null;
}
