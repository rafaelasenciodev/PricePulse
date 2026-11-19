/**
 * JSON Schemas of the endpoint.
 *
 * They validate the request and, at the same time, are the source of the API documentation
 * (OpenAPI), so the documentation cannot describe something other than what is enforced.
 */

import type { FastifySchema } from "fastify";

const priceAlert = {
  type: "object",
  required: ["id", "listingId", "targetAmount", "currency", "status"],
  properties: {
    id: { type: "string", description: "Identifier of the Price Alert" },
    listingId: { type: "string", description: "The Listing the Price Alert watches" },
    targetAmount: {
      type: "string",
      description: "The Target Price as text, in the currency of the Listing",
      examples: ["80.00"],
    },
    currency: { type: "string", description: "The currency of the Listing", examples: ["EUR"] },
    status: { type: "string", enum: ["active", "triggered"], description: "A new Price Alert is active" },
  },
};

const error = (description: string, codes: readonly string[]) => ({
  description,
  type: "object",
  required: ["code", "message"],
  properties: {
    code: { type: "string", enum: [...codes], description: "A stable identifier of the error" },
    message: { type: "string", description: "A description for people. Do not rely on its text" },
  },
});

export const createPriceAlertSchema: FastifySchema = {
  tags: ["Price alerts"],
  summary: "Create a Price Alert",
  description: [
    "Creates a Price Alert for a Listing: the User asks to be notified when the Current Price reaches the Target Price.",
    "",
    "- The User is identified by the bearer token, never by the body.",
    "- The Target Price is in the currency of the Listing. The threshold is inclusive.",
    "- A User has one Active Price Alert per Listing. Repeating the same request returns the existing one (200).",
  ].join("\n"),
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["listingId"],
    properties: { listingId: { type: "string", minLength: 1, description: "Identifier of the Listing" } },
  },
  body: {
    type: "object",
    required: ["targetAmount"],
    // The owner is never taken from the body: unknown fields are rejected.
    additionalProperties: false,
    properties: {
      targetAmount: {
        type: "string",
        description: "The Target Price as text, such as \"80.00\". A number is not accepted",
        examples: ["80.00"],
      },
    },
  },
  response: {
    201: { description: "The Price Alert was created", ...priceAlert },
    200: { description: "The same request was repeated: the existing Price Alert is returned", ...priceAlert },
    400: error("The request is malformed: a missing or unknown field, an amount that is not text, or a body that is not JSON", ["BAD_REQUEST"]),
    401: error("There is no valid bearer token", ["UNAUTHENTICATED"]),
    404: error("The Listing does not exist", ["LISTING_NOT_FOUND"]),
    409: error(
      "The request conflicts with the state of the system: the User already has an Active Price Alert for the Listing with another target, or the Current Price already reaches the target",
      ["DUPLICATE_ALERT", "TARGET_ALREADY_REACHED"],
    ),
    422: error("The amount is not a number, is not greater than zero, or has more decimals than the currency allows", ["INVALID_TARGET_PRICE"]),
    500: error("An unexpected failure. The response reveals no detail", ["INTERNAL_ERROR"]),
  },
};
