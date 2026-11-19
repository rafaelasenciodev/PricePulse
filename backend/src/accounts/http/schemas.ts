/**
 * JSON Schemas of the endpoints.
 *
 * They validate the request and, at the same time, are the source of the API documentation
 * (OpenAPI), so the documentation cannot describe something other than what is enforced. The
 * response schemas also decide what is sent: a field that is not in them is never written.
 */

import type { FastifySchema } from "fastify";

/** No email or password is read beyond this size: it bounds the work of a request, not what is valid. */
const MAXIMUM_TEXT = 1024;

const account = {
  type: "object",
  required: ["id", "email"],
  properties: {
    id: { type: "string", description: "Identifier of the Account, which is the one of its User" },
    email: { type: "string", description: "The email of the Account, written in lower case", examples: ["ana@example.com"] },
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

const credentials = {
  type: "object",
  required: ["email", "password"],
  additionalProperties: false,
  properties: {
    email: { type: "string", maxLength: MAXIMUM_TEXT, description: "The email of the Account", examples: ["ana@example.com"] },
    password: { type: "string", maxLength: MAXIMUM_TEXT, description: "The password" },
  },
};

export const registerAccountSchema: FastifySchema = {
  tags: ["Accounts"],
  summary: "Register an Account",
  description: [
    "Creates an Account with an email and a password. It does not sign the person in: do that with `POST /sessions`.",
    "",
    "- The email has text before and after a single `@`, and at most 254 characters. Upper and lower case, and spaces around it, make no difference. It is not verified.",
    "- The password has from 10 to 128 characters and is not the email. It is never stored or shown: only a hash of it is kept.",
  ].join("\n"),
  body: credentials,
  response: {
    201: { description: "The Account was created", ...account },
    400: error("The request is malformed: a missing or unknown field, a value that is not text, or a body that is not JSON", ["BAD_REQUEST"]),
    403: error(
      "The request does not come from the application: its `Origin` is not the one that the application accepts. Only when the application is set to use the session cookie",
      ["FORBIDDEN_ORIGIN"],
    ),
    409: error("The email already has an Account", ["EMAIL_ALREADY_REGISTERED"]),
    422: error("The email is not valid, or the password is too short, too long or the email", ["INVALID_REGISTRATION"]),
    500: error("An unexpected failure. The response reveals no detail", ["INTERNAL_ERROR"]),
  },
};

export const signInSchema: FastifySchema = {
  tags: ["Sessions"],
  summary: "Sign in",
  description: [
    "Creates a Session for the Account and gives its token. The token is shown only now: keep it, and send it in `Authorization: Bearer <token>`.",
    "",
    "- A Session lasts 7 days from now. An Account can have several.",
    "- When the application uses the session cookie, the answer also sets it, for the browser: `HttpOnly`, `SameSite=Strict`, for the life of the Session. The token is in the body all the same.",
    "- An email that has no Account and a wrong password get the same answer.",
    "- After 5 failed sign-ins in a row for an email, it is refused for 15 minutes, with the right password too. `Retry-After` says how many seconds to wait. A successful sign-in resets the count.",
  ].join("\n"),
  body: credentials,
  response: {
    201: {
      description: "The Session was created",
      type: "object",
      required: ["token", "expiresAt", "account"],
      properties: {
        token: { type: "string", description: "The token of the Session. It is not shown again" },
        expiresAt: { type: "string", description: "When the Session ends, in UTC", examples: ["2026-11-26T10:00:00.000Z"] },
        account,
      },
    },
    400: error("The request is malformed: a missing or unknown field, a value that is not text, or a body that is not JSON", ["BAD_REQUEST"]),
    401: error("The email or the password is not valid. It never says which", ["INVALID_CREDENTIALS"]),
    403: error(
      "The request does not come from the application: its `Origin` is not the one that the application accepts. Only when the application is set to use the session cookie",
      ["FORBIDDEN_ORIGIN"],
    ),
    429: error("Too many failed attempts for this email. `Retry-After` says how many seconds to wait", ["TOO_MANY_ATTEMPTS"]),
    500: error("An unexpected failure. The response reveals no detail", ["INTERNAL_ERROR"]),
  },
};

export const signOutSchema: FastifySchema = {
  tags: ["Sessions"],
  summary: "Sign out",
  description: "Ends the Session of the token that is sent. The other Sessions of the Account stay.",
  security: [{ bearerAuth: [] }],
  response: {
    204: { description: "The Session ended", type: "null" },
    401: error("There is no valid bearer token", ["UNAUTHENTICATED"]),
    403: error(
      "The request does not come from the application: its `Origin` is not the one that the application accepts. Only when the application is set to use the session cookie",
      ["FORBIDDEN_ORIGIN"],
    ),
    500: error("An unexpected failure. The response reveals no detail", ["INTERNAL_ERROR"]),
  },
};

export const readMyAccountSchema: FastifySchema = {
  tags: ["Accounts"],
  summary: "Read my Account",
  description: "The Account of the User who makes the request: its identifier and its email, and nothing of its password.",
  security: [{ bearerAuth: [] }],
  response: {
    200: { description: "The Account of the User", ...account },
    401: error("There is no valid bearer token", ["UNAUTHENTICATED"]),
    500: error("An unexpected failure. The response reveals no detail", ["INTERNAL_ERROR"]),
  },
};
