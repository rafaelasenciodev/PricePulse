# 08 — Session Cookie: Design (Stage 3)

Status: Approved. Every decision in section 6 has status Accepted.

The design of the feature: the pieces, the flow of a request, the way in and the setting. It builds on the [discovery and rules](01-discovery.md), the [scenarios](02-scenarios.feature) and [ADR-0005](../../adr/0005-web-interface.md). It has no use case of its own and no model.

## 1. The idea

The five hooks that read the token do not change. The routes of Users get **one more hook, before the one that authenticates**, that turns the cookie into the header of the request in memory. What follows reads the header, as it always did, and neither knows nor cares where the token came from. The route that records a price does not get the hook, so a cookie cannot make anyone a Provider because the code that would do it is not there.

| Piece | What it is | Rule |
|---|---|---|
| `session-cookie` (shared, pure) | The name of the cookie, the reading of it from the `Cookie` header, its writing for signing in and for clearing it, and the comparison of an origin | BR-02, BR-04 |
| `sessionCookieHook` (shared) | The hook of the routes of Users. If the request has an `Authorization` header, it does nothing. Else, if it has the cookie, it checks the origin when the request is not a read, and puts `Bearer <value>` in the header | BR-04, BR-05, BR-07 |
| `ForbiddenOrigin` (shared) | The error of a refused origin, which the application answers 403 `FORBIDDEN_ORIGIN` | BR-07, BR-08 |
| The setting | `{ origin, secure }`, given once to `buildApp`, and absent when the cookie is off | BR-10 |
| Hooks of Accounts | One before the sign-in and the registration that checks the origin, and one before the sign-out that sets the clearing cookie | BR-08, BR-09 |

| Where each rule lives | |
|---|---|
| BR-01, BR-02, BR-03 | The route of signing in, which sets the cookie after the Session exists. A failure never reaches that line |
| BR-04, BR-05 | `sessionCookieHook`: the cookie is read only when there is no `Authorization` header, even an empty or invalid one |
| BR-06 | The plugin of the Providers does not add the hook |
| BR-07 | `sessionCookieHook`, when the cookie is the credential and the method is not GET or HEAD |
| BR-08 | The hook of the two public routes of Accounts |
| BR-09 | The hook before the sign-out, and the route of signing out |
| BR-10 | Without the setting no hook is added and nothing is set |
| BR-11 | The five hooks and every use case are unchanged |

## 2. The flow

| Request | What happens |
|---|---|
| Any request of a User, with an `Authorization` header | The hook does nothing. The request is read as before, and no origin is looked at |
| A read with the cookie and no header | The header is made from the cookie. The origin is not looked at |
| A change with the cookie and no header | The `Origin` must be the one of the setting, or `ForbiddenOrigin` is raised **before** the token is checked. Then the header is made from the cookie |
| A request with a cookie whose value cannot be a token | It is as if there were no cookie, so the request is not authenticated |
| Sign in, or register | If it carries an `Origin` that is not the setting's, `ForbiddenOrigin`. With none, it goes on |
| Sign out | The origin is checked when the cookie is the credential. If it passes, the clearing cookie is set, and then the token is checked. So the answer clears the cookie whether it is 204 or 401, and a refused request does not |

A refused origin does not clear the cookie, because a page of another port of the same host could otherwise sign the person out. The token of a cookie is read as a token of the header: letters, digits and `-._~+/`, followed by `=` signs, and nothing else.

## 3. The way in

No route is new. `POST /sessions` also sets `pricepulse_session`, with `HttpOnly`, `SameSite=Strict`, `Path=/`, and a `Max-Age` that is the seconds the Session has left, and `Secure` when the setting says so. `DELETE /sessions/current` clears it with the same name, path and attributes and a `Max-Age` of 0. The routes that can be refused for their origin gain a 403 in their documentation.

`SignIn` gives its caller the seconds the Session has left, computed with its own clock, so that the cookie and the Session end together and a test that moves the clock moves both. The body of the answer does not change.

## 4. The setting

`buildApp` takes `sessionCookie?: { origin: string; secure: boolean }`. The Composition Root takes the same option, checks that the origin is `http` or `https` with a host and no path, and writes it in its normal form. `main.ts` builds the origin from where it listens, `http://127.0.0.1:<port>`, and lets the environment variable `WEB_ORIGIN` replace it: the interface in development is served by another server that forwards the API, and the browser then sees *its* origin. `secure` is false in `main.ts`, and the deployment will turn it on.

## 5. Concurrency and failure

Nothing is shared between requests, so there is nothing to protect. A hook that fails answers as any error of its module does. Reading a cookie that is malformed never throws: it gives no token.

## 6. Decisions

| ID | Decision | Status |
|---|---|---|
| 1 | The cookie is turned into the `Authorization` header by one hook in each plugin of Users, before their own, and the five hooks and the authenticators do not change | Accepted |
| 2 | The cookie is read and written by hand, in pure functions of the shared module, with no package | Accepted |
| 3 | A request that has an `Authorization` header, whatever it holds, is never given the cookie | Accepted |
| 4 | `ForbiddenOrigin` is a shared error, answered 403 `FORBIDDEN_ORIGIN`, and the rules of the architecture test let the `app` layer import `shared` for it | Accepted |
| 5 | The origin is checked before the token, when the cookie is the credential and the request is not a GET or a HEAD, and a missing `Origin` is refused | Accepted |
| 6 | The route of signing out clears the cookie before the token is checked, after the check of the origin | Accepted |
| 7 | `SignIn` gives the seconds the Session has left, and the HTTP layer uses it for `Max-Age` | Accepted |
| 8 | The setting is one option, `{ origin, secure }`, and its absence is the cookie off | Accepted |
| 9 | `main.ts` takes the origin from `WEB_ORIGIN` or from where it listens, and sets `secure` to false | Accepted |
| 10 | The plugin of Accounts is split in two children: the public routes, with the check of the origin, and the routes of the Session, with the hook of the cookie | Accepted |

Alternatives that were weighed:

- **Decision 1:** each of the five hooks reads the cookie itself. It repeats the rule five times, and the one of Providers would have to remember to leave it out. A hook of the application for the whole API would need to know which routes are the Providers', by path, and that list would grow stale.
- **Decision 2:** `@fastify/cookie`. It parses and signs cookies well, but it is a dependency for one name, and signing is not needed since the token is already opaque. It is reconsidered if the interface needs more cookies.
- **Decision 3:** falling back to the cookie when the header is not valid. It would let a stale header hide behind a good cookie and make BR-05 depend on what the header holds.
- **Decision 4:** the 403 written by the hook with `reply.send`. The shared module could not import the framework, and the error would skip the one place where errors become answers.
- **Decision 9:** several allowed origins. One is enough for the interface and for the documentation page, and a list can be added later. The documentation page must be opened at the origin of the setting: at `localhost` instead of `127.0.0.1` the cookie is another one and the origin does not match, so its changes are refused.

## 7. Where each scenario is handled

| Scenario | Handled by |
|---|---|
| SC-01 to SC-04 | The route of signing in, the setting and the pure writing of the cookie |
| SC-05 to SC-09 | `sessionCookieHook` in each plugin of Users, and the pure reading |
| SC-10, SC-11 | The plugin of the Providers, which does not add it |
| SC-12 to SC-16 | `sessionCookieHook` and its check of the origin |
| SC-17, SC-18 | The hook of the public routes of Accounts |
| SC-19 to SC-22 | The hook before the sign-out, and the rest of the routes, which touch nothing |
| SC-23, SC-24 | The absence of the setting, and the five hooks that are unchanged |

## 8. Effects on the other features

- **Accounts, Price Alerts, Price History and the Catalogue.** Their plugins take an optional `sessionCookie` and add the hook first. Their five hooks, use cases and tests do not change.
- **The architecture test.** `app` may import `shared`.
- **Documentation.** A 403 on the routes that can be refused, and a note on the cookie in the description of signing in.
- **The README.** The cookie, the setting and the origin of the documentation page.

## 9. Carried to the build

Whether Fastify keeps a header set before the error of the sign-out, and if not, how the error carries it. A check by hand, in a real browser, of what it does with the cookie on `http://127.0.0.1`, with `Secure` on and off, and with the documentation page. The tests of the pure functions, of the hook with a request that has every combination of header, cookie, method and origin, and of each of the four plugins with it.
