/**
 * JSON Schemas of the endpoint.
 *
 * They validate the request and, at the same time, are the source of the API documentation
 * (OpenAPI), so the documentation cannot describe something other than what is enforced.
 */

import type { FastifySchema } from "fastify";

/** A Price, or null when the Listing has none: it is unavailable (BR-03). */
const price = (description: string) => ({
  type: "object",
  nullable: true,
  description,
  required: ["amount", "currency"],
  additionalProperties: false,
  properties: {
    amount: { type: "string", description: "The amount as text, such as \"79.90\". A number is not accepted", examples: ["79.90"] },
    currency: { type: "string", description: "The currency. It must be the one of the Listing", examples: ["EUR"] },
  },
});

const observation = {
  type: "object",
  required: ["provider", "listingId", "observedAt", "price"],
  properties: {
    provider: { type: "string", description: "The Provider that reported it: the one of the credential" },
    listingId: { type: "string", description: "The Listing the observation is about" },
    observedAt: { type: "string", description: "The moment it was observed, in UTC", examples: ["2026-11-19T10:00:00.000Z"] },
    price: price("The Price, or null if the Listing was unavailable"),
  },
};

/** The most observations that one page of the history can hold, and how many it holds when nothing is said. */
export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 20;

const error = (description: string, codes: readonly string[]) => ({
  description,
  type: "object",
  required: ["code", "message"],
  properties: {
    code: { type: "string", enum: [...codes], description: "A stable identifier of the error" },
    message: { type: "string", description: "A description for people. Do not rely on its text" },
  },
});

export const recordPriceObservationSchema: FastifySchema = {
  tags: ["Price observations"],
  summary: "Record a Price Observation",
  description: [
    "A Provider reports the Price of a Listing at a point in time, or that it had none.",
    "",
    "- The Provider is identified by the bearer token, never by the body. A token of a User is not valid here.",
    "- `price` is required: send `null` when the Listing was unavailable. Zero is a valid Price (free).",
    "- The currency must be the one of the Listing.",
    "- `observedAt` is ISO 8601 with a time zone and seconds, such as `2026-11-19T10:00:00Z`. It may be later than now only by a few minutes.",
    "- Every observation is stored, including one that repeats the previous Price. An older one is stored too and does not change the Current Price.",
    "- Repeating the same observation (same Listing and `observedAt`, same content) returns the stored one (200). With other content it is a conflict (409).",
  ].join("\n"),
  security: [{ providerAuth: [] }],
  params: {
    type: "object",
    required: ["listingId"],
    properties: { listingId: { type: "string", minLength: 1, description: "Identifier of the Listing" } },
  },
  body: {
    type: "object",
    required: ["observedAt", "price"],
    // The Provider is never taken from the body: unknown fields are rejected.
    additionalProperties: false,
    properties: {
      observedAt: {
        type: "string",
        description: "When the Provider saw the Listing: ISO 8601 with a time zone, such as \"2026-11-19T10:00:00Z\"",
        examples: ["2026-11-19T10:00:00Z"],
      },
      price: price("The Price, or null when the Listing was unavailable"),
    },
  },
  response: {
    201: { description: "The Price Observation was recorded", ...observation },
    200: { description: "The same observation was repeated: the stored one is returned", ...observation },
    400: error("The request is malformed: a missing or unknown field, a value of the wrong type, or a body that is not JSON", ["BAD_REQUEST"]),
    401: error("There is no valid bearer token of a Provider", ["UNAUTHENTICATED"]),
    404: error("The Listing does not exist", ["LISTING_NOT_FOUND"]),
    409: error("An observation of the same Provider, Listing and `observedAt` is stored with different content", ["OBSERVATION_CONFLICT"]),
    422: error(
      "The observation is not valid: `observedAt` is not a valid instant or is too far in the future, the amount is not a number, is negative or has more decimals than the currency allows, or the currency is not the one of the Listing",
      ["INVALID_OBSERVATION"],
    ),
    500: error("An unexpected failure. The response reveals no detail", ["INTERNAL_ERROR"]),
  },
};

export const readPriceHistorySchema: FastifySchema = {
  tags: ["Price history"],
  summary: "Read the Price History of a Listing",
  description: [
    "The Price Observations of a Listing, newest Observed At first. Any signed-in User can read them.",
    "",
    "- The token is the one of a **User**. The token of a price provider is not valid here.",
    "- Every stored observation is in the history, an older one too, and one without a price, which means that the Listing was unavailable. Each shows the Provider that reported it, so that simulated data can be told.",
    "- `from` and `to` limit the history to a range of Observed At: `from` is included and `to` is excluded. Both are ISO 8601 with a time zone, such as `2026-11-19T10:00:00Z`, and `from` must be before `to`.",
    `- A page holds \`limit\` observations (${DEFAULT_LIMIT} by default, ${MAX_LIMIT} at most) after skipping \`offset\`, and \`total\` says how many the range includes in all.`,
  ].join("\n"),
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["listingId"],
    properties: { listingId: { type: "string", minLength: 1, description: "Identifier of the Listing" } },
  },
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      from: { type: "string", description: "The start of the range, included. ISO 8601 with a time zone", examples: ["2026-11-19T10:00:00Z"] },
      to: { type: "string", description: "The end of the range, excluded. ISO 8601 with a time zone", examples: ["2026-11-19T12:00:00Z"] },
      limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT, description: "How many observations at most" },
      offset: { type: "integer", minimum: 0, default: 0, description: "How many observations to skip, from the newest" },
    },
  },
  response: {
    200: {
      description: "A page of the Price History",
      type: "object",
      required: ["items", "total", "limit", "offset"],
      properties: {
        items: { type: "array", items: observation },
        total: { type: "integer", description: "How many observations the range includes, in all pages" },
        limit: { type: "integer" },
        offset: { type: "integer" },
      },
    },
    400: error("A query parameter is not valid: an unknown one, or a limit or an offset that is not a whole number in range", ["BAD_REQUEST"]),
    401: error("There is no valid bearer token of a User. The token of a price provider is not valid", ["UNAUTHENTICATED"]),
    404: error("The Listing does not exist", ["LISTING_NOT_FOUND"]),
    422: error("The range is not valid: `from` or `to` is not an instant, or `from` is not before `to`", ["INVALID_RANGE"]),
    500: error("An unexpected failure. The response reveals no detail", ["INTERNAL_ERROR"]),
  },
};
