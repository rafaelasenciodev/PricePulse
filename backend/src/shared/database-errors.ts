/** How the adapters of PostgreSQL tell one failure from another. It knows no driver: it reads what an error carries. */

/** The SQLSTATE of a violation of a unique constraint or index. */
const UNIQUE_VIOLATION = "23505";

/**
 * Whether `error` is the violation of the unique constraint or index named `constraint`, and no other failure.
 * Only a violation that the adapter expects is turned into an error of the port. Anything else goes up as it is.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION &&
    (error as { constraint?: unknown }).constraint === constraint
  );
}
