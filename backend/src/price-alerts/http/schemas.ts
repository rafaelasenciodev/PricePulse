/**
 * JSON Schemas of the endpoint.
 *
 * They validate the request and, at the same time, are the source of the API documentation
 * (OpenAPI), so the documentation cannot describe something other than what is enforced.
 */

import type { FastifySchema } from "fastify";

const priceAlert = {
  type: "object",
  required: ["id", "listingId", "targetAmount", "currency", "status", "createdAt"],
  properties: {
    id: { type: "string", description: "Identifier of the Price Alert" },
    listingId: { type: "string", description: "The Listing the Price Alert watches" },
    targetAmount: {
      type: "string",
      description: "The Target Price as text, in the currency of the Listing",
      examples: ["80.00"],
    },
    currency: { type: "string", description: "The currency of the Listing", examples: ["EUR"] },
    status: {
      type: "string",
      enum: ["active", "triggered", "cancelled"],
      description: "Active while it waits, triggered when its target was reached, cancelled if its owner stopped it. A new one is active",
    },
    createdAt: { type: "string", description: "When the Price Alert was created, in UTC", examples: ["2026-11-19T10:00:00.000Z"] },
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

/** The most Price Alerts that one page of the list can hold, and how many it holds when nothing is said. */
export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 20;

const alertId = {
  type: "object",
  required: ["alertId"],
  properties: { alertId: { type: "string", minLength: 1, description: "Identifier of the Price Alert" } },
};

export const listPriceAlertsSchema: FastifySchema = {
  tags: ["Price alerts"],
  summary: "List my Price Alerts",
  description: [
    "The Price Alerts of the User, newest first.",
    "",
    "- Only the Price Alerts of the User who makes the request are listed.",
    `- A page holds \`limit\` Price Alerts (${DEFAULT_LIMIT} by default, ${MAX_LIMIT} at most) after skipping \`offset\`, and \`total\` says how many match in all.`,
    "- `status` keeps only the Price Alerts in that state.",
  ].join("\n"),
  security: [{ bearerAuth: [] }],
  querystring: {
    type: "object",
    // An unknown parameter is rejected, as an unknown field of a body is.
    additionalProperties: false,
    properties: {
      status: { type: "string", enum: ["active", "triggered", "cancelled"], description: "Only the Price Alerts in this state" },
      limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT, description: "How many Price Alerts at most" },
      offset: { type: "integer", minimum: 0, default: 0, description: "How many Price Alerts to skip, from the newest" },
    },
  },
  response: {
    200: {
      description: "A page of Price Alerts",
      type: "object",
      required: ["items", "total", "limit", "offset"],
      properties: {
        items: { type: "array", items: priceAlert },
        total: { type: "integer", description: "How many Price Alerts of the User match, in all pages" },
        limit: { type: "integer" },
        offset: { type: "integer" },
      },
    },
    400: error("A query parameter is not valid: an unknown one, a state that does not exist, or a limit or an offset that is not a whole number in range", ["BAD_REQUEST"]),
    401: error("There is no valid bearer token", ["UNAUTHENTICATED"]),
    500: error("An unexpected failure. The response reveals no detail", ["INTERNAL_ERROR"]),
  },
};

export const getPriceAlertSchema: FastifySchema = {
  tags: ["Price alerts"],
  summary: "Read a Price Alert",
  description: "One of the Price Alerts of the User. One of another User is answered as one that does not exist.",
  security: [{ bearerAuth: [] }],
  params: alertId,
  response: {
    200: { description: "The Price Alert", ...priceAlert },
    401: error("There is no valid bearer token", ["UNAUTHENTICATED"]),
    404: error("The Price Alert does not exist, or it belongs to another User", ["ALERT_NOT_FOUND"]),
    500: error("An unexpected failure. The response reveals no detail", ["INTERNAL_ERROR"]),
  },
};

export const patchPriceAlertSchema: FastifySchema = {
  tags: ["Price alerts"],
  summary: "Change a Price Alert: its Target Price, or cancel it",
  description: [
    "Changes a Price Alert of the User. The body carries exactly one of two things:",
    "",
    "- `targetAmount`: a new Target Price, as text, in the currency of the Listing. Only an Active Price Alert can be changed. The Current Price must not already reach it, as when it is created. The same Target Price changes nothing.",
    "- `status` with the value `cancelled`: the User stops the Price Alert. Cancelling a Cancelled one changes nothing, and a Triggered one cannot be cancelled.",
    "",
    "The answer is the Price Alert, also when nothing was changed. If the Price Alert changes state while the request is applied, for example because it is Triggered, the answer is a conflict and nothing is changed.",
  ].join("\n"),
  security: [{ bearerAuth: [] }],
  params: alertId,
  body: {
    type: "object",
    // Exactly one of the two changes, and nothing else.
    oneOf: [
      {
        type: "object",
        required: ["targetAmount"],
        additionalProperties: false,
        properties: {
          targetAmount: { type: "string", description: "The new Target Price as text, such as \"70.00\". A number is not accepted", examples: ["70.00"] },
        },
      },
      {
        type: "object",
        required: ["status"],
        additionalProperties: false,
        properties: { status: { type: "string", enum: ["cancelled"], description: "The only state that a User can give a Price Alert" } },
      },
    ],
  },
  response: {
    200: { description: "The Price Alert, changed or not", ...priceAlert },
    400: error("The body is not one of the two changes: a missing or unknown field, both fields, a state other than cancelled, a value of the wrong type, or a body that is not JSON", ["BAD_REQUEST"]),
    401: error("There is no valid bearer token", ["UNAUTHENTICATED"]),
    404: error("The Price Alert does not exist, or it belongs to another User", ["ALERT_NOT_FOUND"]),
    409: error(
      "The request conflicts with the state of the Price Alert: it is not Active, it changed while the request was applied, or the Current Price already reaches the new Target Price",
      ["ALERT_NOT_ACTIVE", "ALERT_CONFLICT", "TARGET_ALREADY_REACHED"],
    ),
    422: error("The amount is not a number, is not greater than zero, or has more decimals than the currency allows", ["INVALID_TARGET_PRICE"]),
    500: error("An unexpected failure. The response reveals no detail", ["INTERNAL_ERROR"]),
  },
};
