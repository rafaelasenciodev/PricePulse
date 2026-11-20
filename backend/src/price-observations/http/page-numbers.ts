/**
 * The numbers of a URL arrive as text, and the validation of the application is strict on purpose.
 * Only for the two numbers of a page, whole numbers written in digits are read as numbers. Anything
 * else stays as it is and the validation rejects it.
 *
 * It is written once for the module: the Price History and the Catalogue read their pages with it.
 */
export async function readPageNumbers(request: { readonly query: unknown }): Promise<void> {
  const query = request.query as Record<string, unknown>;
  for (const key of ["limit", "offset"]) {
    const value = query[key];
    if (typeof value === "string" && /^\d+$/.test(value)) query[key] = Number(value);
  }
}
