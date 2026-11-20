# 08 — Session Cookie: Completion (Stage 5)

Status: Approved

The close of the feature: what was built, the decisions and their status, how it was verified, what the review found, what it does not do and what comes next. It links to the documents of each stage and does not repeat them. It is the fifth feature developed with the [method of five stages](../README.md), and the one that carries out the decision of [ADR-0005](../../adr/0005-web-interface.md) about the session of a browser.

## 1. Summary

When the application is given its origin, signing in also sets a cookie, `pricepulse_session`, that holds the token of the Session. The routes of Users accept it as they accept the header, and a request that the cookie authenticates and that changes something must come from the application's own origin. Signing out clears it. A Provider is never identified by a cookie, and an application that is not given an origin behaves exactly as before.

It runs end to end over HTTP with in-memory storage. It does not build the web interface, add a token against forged requests, enable CORS, set security headers, or change the Session or the credential of a Provider. Those are listed in the [discovery](01-discovery.md).

## 2. What was built

| Stage | Result | Where |
|---|---|---|
| 1 Understand | 10 questions decided, 11 rules, one new term (Session cookie) | [Discovery and rules](01-discovery.md), [glossary](../../domain/ubiquitous-language.md) |
| 2 Scenarios | 24 Gherkin scenarios, 13 of them with several examples | [Scenarios](02-scenarios.feature) |
| 3 Design | No use case and no model: one hook per plugin of Users, pure functions, 10 decisions | [Design](03-design.md) |
| 4a Pure functions and hooks | Reading and writing the cookie, the comparison of an origin, the two hooks, the error of a refused origin, and the seconds that a Session has left | `backend/src/shared/http/`, `backend/src/accounts/application/sign-in.ts` |
| 4c Way in and wiring | The hook in the four plugins of Users, the cookie set and cleared by Accounts, the option of `buildApp` and of the Composition Root, `WEB_ORIGIN` in `main.ts` | `backend/src/*/http/`, `backend/src/app.ts`, `backend/src/composition-root.ts`, `backend/src/main.ts` |
| 4d Verification and review | Traceability of the eighth feature, random tests, 8 findings | Sections 4 and 5 |

This feature has no stage 4b: it has no port and no adapter. The feature changed 14 source files (345 insertions, 31 deletions; 3 new) and 9 test files (926 insertions, 4 deletions; 4 new). No dependency was added.

## 3. Decisions and their status

The status of every decision of the discovery and the design is recorded here, and only here.

| Decision | Status | Evidence |
|---|---|---|
| Q1 Signing in always sets the cookie, and the body still has the token | Verified | SC-01, SC-24 |
| Q2 The name, `HttpOnly`, `SameSite=Strict`, `Path=/` and the life of the Session | Verified | SC-01, SC-02, and the random tests of the writing |
| Q3 `Secure` is a setting, off by default | Implemented | SC-03 checks the attribute. What a browser does with it on `http://127.0.0.1` was not tried |
| Q4 A change that the cookie authenticates must carry the origin of the application | Verified | SC-12 to SC-18 |
| Q5 The origin is one setting, built by `main.ts` from where it listens | Verified | The setting is checked when the application is built |
| Q6 The cookie is on only when the origin is given | Verified | SC-23, and the tests of the other features pass with the option off. Only three tests that list the statuses of a route changed, for the 403 |
| Q7 The header wins, and an invalid header is not replaced | Verified | SC-08, SC-09 |
| Q8 Only the routes of Users read the cookie | Verified | SC-05, SC-10, SC-11, and a deliberate error that gave the Providers' route the hook |
| Q9 Signing out clears the cookie, also when it is not valid | Verified | SC-19 to SC-22 |
| Q10 A failed sign-in sets no cookie | Verified | SC-04 |
| D1 The cookie is turned into the header by a hook in each plugin of Users | Verified | The five hooks of authentication and the use cases are unchanged |
| D2 The cookie is read and written by hand, with no package | Verified | The pure tests and 20,000 hostile inputs |
| D3 A request with an `Authorization` header is never given the cookie | Verified | SC-09. See finding 1 |
| D4 `ForbiddenOrigin` is shared, answered 403, and `app` may import `shared` | Verified | The API tests and the architecture test |
| D5 The origin is checked before the token, and a missing `Origin` is refused | Verified | SC-13 |
| D6 Signing out clears the cookie before the token is checked, after the origin | Verified | SC-14, SC-21 |
| D7 `SignIn` gives the seconds that the Session has left | Verified | Its tests, and SC-02 over HTTP |
| D8 One option, `{ origin, secure }` | Verified | SC-23 and the tests of the setting |
| D9 `main.ts` takes the origin from `WEB_ORIGIN` or from where it listens | Implemented | `main.ts` has no test: checked by hand, including a `WEB_ORIGIN` that is not valid |
| D10 The plugin of Accounts has two children | Verified | SC-14, SC-17 |

Two things were done differently from the design. The origin is checked and written in its normal form in `buildApp` and not in the Composition Root, because the rules of the architecture keep the Composition Root from importing `shared`. And the 403 is documented on the routes that can answer it also when the cookie is off, because the schemas are static: its description says so.

### Effect on the other features

- **Accounts.** The plugin has a child for the routes with no token and one for the routes of the Session. `SignIn` gives one more field, which the answer does not show.
- **Price Alerts, the Price History and the Catalogue.** Each plugin takes an optional `sessionCookie` and adds one hook first. Their hooks, use cases and tests did not change.
- **Price Observations.** The route that records a price was not touched, and a test fails if it ever reads the cookie.
- **Documentation tests.** Three tests that list the statuses of a route gained the 403.

## 4. Verification

- **Tests:** 1,485 test cases in 74 files, all passing, of which 204 are of this feature: the API 69, the pure functions and the random tests 81, the hooks 43, `SignIn` 4 and 7 of the traceability guard.
- **Scenarios:** all 24 have tests, read from the titles, with no exemption.
- **Coverage, as a diagnostic:** 99.6 % of statements, 97.8 % of branches, 99.8 % of functions and 99.7 % of lines. What is not covered is a guard that fails safe if a route moves out of its hook, and a branch of the error handler that was already there.
- **Random tests:** 20,000 hostile `Cookie` headers with a fixed seed, never throw, and no token that is read can hold a space, a line break, a semicolon, a comma or a quote. A token that is written is read back exactly. Five deliberate errors in the reader were detected by them.
- **Deliberate errors:** 73 changes were made by hand, one at a time, and the tests were run after each. **71 were detected,** and the 2 that were not change nothing a caller can see. One of them gave the route of the Providers a hook that reads the cookie, and was detected.
- **By hand, with `curl` and a file of cookies:** the cookie that is set, the reads with only the cookie, the refusal of a change with no origin and with another, the sign-in from another origin, the credential of a Provider in the cookie, the sign-out that is refused and the one that is not, and the clearing. The log held no token and no password. A `WEB_ORIGIN` that is not valid stops the server at start.
- **Not done: a real browser.** The extension of the browser was not connected, so these were not tried: that scripts cannot see the cookie, that a page of another port of the same host sends it and is refused for its origin, what the browser does with `Secure` on `http://127.0.0.1`, and how the documentation page behaves.

## 5. Architecture review

Dependencies point inward and the architecture test passes. The change of its rules is one line: `app` may import `shared`. The five hooks that authenticate and every use case are as they were.

| # | Finding | Outcome |
|---|---|---|
| 1 | Any `Authorization` header, also of another scheme, keeps the cookie from being read (decision D3). An application behind HTTP Basic authentication at a proxy would get that header on every request, and no one could use the cookie | **Noted.** To decide in the deployment. The fix is one line, to count only a bearer header, and it changes an accepted decision |
| 2 | A real browser was not tried (section 4) | **Noted** |
| 3 | The cookie lasts 7 days and outlives the browser. On a shared computer the session stays until it is signed out or expires | **Accepted** (Q2) |
| 4 | A stolen cookie works until it expires or its Session is signed out, and there is no way to sign out of every Session. `HttpOnly` makes a theft by a script harder and does not rule it out | **Noted.** It was already a limit of feature 06 |
| 5 | With `SameSite=Strict` the first navigation that arrives from another site carries no cookie. The calls of a single-page application are not affected, a page served by the backend would look signed out | **Noted** for the interface |
| 6 | The header that is made from the cookie lives in `request.headers`. The default log does not print headers, and one that did would print the token | **Noted** |
| 7 | In development the origin must be set by hand when the interface is served by another server, and `localhost` and `127.0.0.1` are different origins. A mismatch refuses every change with a clear code | **Accepted** (decision D9) |
| 8 | The cookie has no `__Host-` prefix and is not `Secure` unless it is told. The 403 is documented also when the cookie is off | **Noted** for the deployment, and the second one **Accepted** |

## 6. What the process revealed

| When | What | Result |
|---|---|---|
| 3 | In development a server that forwards the API makes the browser see its own origin, so an origin taken only from where the backend listens would refuse every change of the interface | `WEB_ORIGIN`, still one origin |
| 4a | The tests of this feature would have been counted as feature 01's or 06's, by the guard of traceability, as before | A folder of their own from the first step |
| 4c | Whether Fastify keeps a header that was set before an error, which the sign-out depends on, was open | **Measured with a probe**: it does |
| 4c | The rules of the architecture keep the Composition Root from importing `shared` | The origin is checked in `buildApp` |
| 4d | A check that the random tests can fail said yes, because the test was already failing for my own miscount | Found at once and repeated with the test passing |
| 4c, 4d | Three mistakes in tests of mine: a type, a count of attempts and a count of parts of a cookie | Corrected |
| 4c | The extension of the browser was not connected, and the check in a real browser was left out | Written as not done |

## 7. Known limitations

- Storage is in memory ([ADR-0003](../../adr/0003-persistence-deferred.md)): a restart loses every Session, so every cookie is useless until its person signs in again.
- The behaviour of a real browser was not tried (section 4), and `Secure`, the `__Host-` prefix and HTTPS are for the deployment.
- One origin only, so the documentation page works with the cookie only when it is opened at that origin.
- There is no token against forged requests: the defence is `SameSite=Strict`, the check of the origin and the absence of CORS.
- `main.ts` has no test, the tests have run on one version of Node, 25.9, no continuous integration runs them, and the repository has no licence.

## 8. Documentation volume

The documents of the first three stages have 563 lines (discovery and rules 176, scenarios 286, design 101). The previous feature had 468, so it is 20 % more. The scenarios are the longest document of any feature: 13 of the 24 are outlines, which carry the cases of origin that protect the feature.

## 9. Follow-up

**Next feature,** in the order agreed so far: the web interface, which sets `WEB_ORIGIN` when it starts its server in development and keeps nothing of the session in the page. Then, with the order still to be decided, the deployment and the persistence, each with its ADR, and the final README, slides and video.

**For the deployment.** `secure` on, the prefix `__Host-` and HTTPS, the origin of the application, and a decision on finding 1 if anything puts a header `Authorization` in front of it.

**For the persistence feature.** Nothing changes: the cookie holds the same token, and the Sessions keep behind their port.

## 10. Completion checklist

- [x] Stages 1 to 4 completed
- [x] Documentation of stage 5 written (this document)
- [x] This document is approved by the author
- [x] The README and the documentation indexes describe this feature
- [ ] The feature is merged into `develop` with `--no-ff`, and `develop` into `main` and tagged (done by the developer, [ADR-0002](../../adr/0002-branching-model.md))
- [ ] A licence is chosen before the repository is published
