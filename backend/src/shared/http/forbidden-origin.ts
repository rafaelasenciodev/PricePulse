/** BR-07, BR-08 of feature 08: the request does not come from the pages of the application. */
export class ForbiddenOrigin extends Error {
  constructor() {
    super("The request does not come from the application");
    this.name = "ForbiddenOrigin";
  }
}

/** The HTTP response that reports an error. The same shape as in the features, declared here so that none imports another. */
export interface HttpError {
  readonly status: number;
  /** A stable identifier, so a client can tell apart errors that share a status. */
  readonly code: string;
  readonly message: string;
}

/**
 * The HTTP response that reports an error of this module, or null if the error is not one of its own. The
 * application that connects the features asks it, like it asks each feature.
 */
export function sharedHttpError(error: unknown): HttpError | null {
  if (error instanceof ForbiddenOrigin) return { status: 403, code: "FORBIDDEN_ORIGIN", message: error.message };
  return null;
}
