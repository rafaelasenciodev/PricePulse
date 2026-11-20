# 09 — Web Interface: Completion (Stage 5)

Status: Approved

The close of the feature: what was built, the decisions and their status, how it was verified, what the review found, what it does not do and what comes next. It links to the documents of each stage and does not repeat them. It is the sixth feature developed with the [method of five stages](../README.md), and the one that builds the interface that [ADR-0005](../../adr/0005-web-interface.md) decided.

## 1. Summary

A person opens `/app/` in a browser, registers or signs in, reads the Catalogue one page at a time, opens a Listing and asks to be told when it reaches a price. The screens are in Spanish and live in a new project, `frontend/`, a single-page application in React built with Vite. The backend serves the build under `/app/`, `/` leads there, and the session is the cookie of feature 08: the page never holds the token.

It runs end to end over HTTP with in-memory storage. It does not show the alerts of a person or their Notifications, which are [feature 10](#9-follow-up), and it does not build a way to deploy the interface. Those are listed in the [discovery](01-discovery.md).

## 2. What was built

| Stage | Result | Where |
|---|---|---|
| 1 Understand | 11 questions decided, 14 rules (BR-01 to BR-14), no new term | [Discovery and rules](01-discovery.md) |
| 2 Scenarios | 36 Gherkin scenarios (SC-01 to SC-36) | [Scenarios](02-scenarios.feature) |
| 3 Design | A project of four folders, the libraries, the way the backend serves it, 14 decisions | [Design](03-design.md) |
| 4a Project, client, texts, guards | The client of the API, the texts in Spanish, the guards of imports and of sources, a test of the client against the real application, and the stable `reason` of a registration that is not valid | `frontend/src/api`, `frontend/src/texts`, `backend/tests/web-interface/` |
| 4b Access and session | The session, the two hooks (`useRequest`, `useSubmit`) and the screens to sign in, register and sign out | `frontend/src/session`, `frontend/src/ui` |
| 4c Catalogue and Listing | The Catalogue with pages, the screen of a Listing and the form of a Price Alert | `frontend/src/ui` |
| 4d Serving | `@fastify/static` in the optional group `webInterface`, the redirects, the page for the addresses of the interface, the headers of `/app/`, `main.ts`, the development server with its proxy, and the traceability of the feature | `backend/src/app.ts`, `backend/src/main.ts`, `frontend/vite.config.ts` |
| 4e Verification and review | A check in a real browser and a review of the branch | Sections 4 and 5 |

The feature changed 8 source files of the backend (138 insertions, 14 deletions, none new) and 6 test files (555 insertions, 13 deletions, 2 new), and created `frontend/`: 26 source files (1,325 lines) and 13 files of tests (1,734 lines). The backend gained one dependency for production, `@fastify/static`. The frontend has its own `package.json` and no workspace.

## 3. Decisions and their status

The status of every decision of the discovery and the design is recorded here, and only here. The design's decisions are numbered D1 to D14, as in its section 7.

| Decision | Status | Evidence |
|---|---|---|
| Q1 Two features: this one has the project, the serving, access, the Catalogue and creating an alert | Implemented | This document. The second half is feature 10 |
| Q2 The interface asks the Catalogue for the titles of Listings in alerts and Notifications | Accepted | A question of feature 10. Nothing here shows alerts |
| Q3 Texts in Spanish, all in one file | Verified | `src/texts/es.ts`, its tests, and every screen test |
| Q4 CSS written by hand, with a few variables | Implemented | `src/ui/styles.css` |
| Q5 Types written by hand, with a test of the client against the real application | Verified | 32 tests of `client-contract.test.ts` |
| Q6 A package to serve static files, in an optional group, under `/app/` | Verified | SC-31 to SC-35 |
| Q7 Registering is a registration followed by a sign-in | Verified | SC-08, SC-10 |
| Q8 A 401 anywhere takes the person to sign in, with a message | Verified | SC-14, in the session, the Catalogue, the Listing and signing out |
| Q9 Data is read when a screen is entered and after a change, never guessed | Verified | SC-28, SC-29 |
| Q10 The sign-in screen does not show the demo Accounts | Implemented | No test: they are in the README |
| Q11 Accessibility baseline: semantic HTML, a label for every field, focus, keyboard | Implemented | Labels and roles are what the tests look for. The focus is the browser's own, and Enter sent the forms that were tried in the real browser. No audit was made |
| D1 Four folders with imports in one direction, kept by a test | Verified | `architecture.test.ts` |
| D2 The client never throws, never exposes the token and never sends `Authorization` | Verified | `client.test.ts`, `sources.test.ts`, SC-07 in the real browser |
| D3 The session is `checking`, `signedOut` or `signedIn`, and any 401 signs out | Verified | `session.test.tsx` and SC-14 |
| D4 The libraries of section 3 of the design, with none whose `engines` leaves out the Node of the repository | Implemented | Checked when they were installed. The same check was made for `@fastify/static` and its dependencies |
| D5 `react-router-dom`, base `/app/`, `?page=` for the page | Verified | The tests of the Catalogue, and the real browser |
| D6 One hook to read and one to send, with the mark of a call in progress set at once | Verified | SC-11, SC-28, and a test with two submissions in the same instant |
| D7 Every text in one file | Verified | As Q3 |
| D8 One stylesheet, semantic HTML, no inline style | Verified | The real browser applied it under a policy that refuses inline styles |
| D9 The backend serves the interface with `@fastify/static` in an optional group | Verified | `serving.test.ts`, and `main.ts` run with a real build |
| D10 `/` leads to `/app/` with a temporary redirect | Verified | SC-31 |
| D11 Headers of `/app/`: `nosniff`, referrer policy and content security policy | Verified | `serving.test.ts`, and read by the page in the real browser. Nothing was blocked |
| D12 Vite proxies the API in development, and the backend is told its origin | Verified | By hand, in a real browser |
| D13 The client is tested against the real application, and the screens with a `fetch` of the test | Verified | As Q5 |
| D14 The traceability guard reads the tests of the frontend, and SC-36 is an exemption | Verified | 7 tests of the guard for this feature |

Decisions taken while building, which the design left open. Each one was shown to the author at its stop and approved.

| When | Decision | Status |
|---|---|---|
| 4b | `useRequest(load, deps)` reads again when `deps` change and drops an answer that arrives late | Verified |
| 4b | A fourth reason for being signed out, `check-failed`, when the first check of the session fails for a reason that is not a 401 | Verified |
| 4b | `CredentialsForm`, one form for the two screens of access | Verified |
| 4c | The page size is 20. A `?page=` that is not a whole number from 1 is page 1, and one past the end leads to the last page | Verified |
| 4c | The result of creating an alert is kept by the screen, and the Listing is read again only when the alert exists, so that a refusal leaves what was written | Verified |
| 4d | `app` may use `node:path`, to tell a file of `assets/` from another | Implemented |
| 4e | `/app` without the slash leads to `/app/` | Verified |

### Effect on the other features

- **Feature 08 (session cookie).** Its check in a real browser, left out there, was made here (section 4).
- **Feature 06 (accounts).** The 422 of registering has a stable `reason` (`EMAIL_NOT_VALID`, `PASSWORD_TOO_SHORT`, `PASSWORD_TOO_LONG`, `PASSWORD_IS_EMAIL`), which the interface needs to say what is wrong in Spanish.
- **The Composition Root and `main.ts`.** One optional group, and `main.ts` serves `frontend/dist` when it has been built.

## 4. Verification

- **Tests:** the backend has 1,565 test cases in 76 files, and the frontend 272 in 10 files, all passing. Of the feature: the frontend all 272 (the client 83, the texts 52, the session 13, the hooks and the screens 85, the guards of imports and sources 39), the backend 59 in two files (the client against the real application 32, serving 27) and 7 of the traceability guard.
- **Scenarios:** 35 of the 36 have tests, read from their titles, and the 36th, SC-36, is exempt because it needs a real browser. It was checked by hand (below).
- **Coverage, as a diagnostic:** the frontend has 97.7 % of statements, 97.2 % of branches, 100 % of functions and 98.3 % of lines. What is not covered is the file that starts the page (`main.tsx`), the error of using the session outside its provider, and defaults of values that are never missing. The backend has 99.2 %, 97.3 %, 99.7 % and 99.3 %, and `app.ts` has three branches left, all of them defaults for a value that is never missing.
- **In a real browser,** Chrome, driven with the extension of the browser, with the interface served by the backend and with Vite and its proxy:

| What | Result |
|---|---|
| The cookie of feature 08 | Signing in sets it, and it is sent with the later requests: reading the Catalogue answers 200 |
| SC-36, a change carries an `Origin` that the application accepts | Creating an alert answered 201, served by the backend and through the proxy of Vite, where the `Origin` reached the application as it was |
| SC-07, the page does not hold the token | `localStorage`, `sessionStorage` and IndexedDB are empty, `document.cookie` is empty because the cookie is `HttpOnly`, and the token is in no address and not in the HTML |
| SC-12, going back after signing out | Signing out answers 204 and the next read of the Account answers 401. Going back through three entries of the history showed only the sign-in screen |
| SC-23, SC-25, SC-29 | An alert is created and the Listing is read again, an alert with another target says so and keeps the amount, and the message of the result stays |
| The headers of `/app/` | `nosniff`, the referrer policy and the content security policy reached the page, which was styled and ran with nothing blocked |
| A direct address to a Listing | Opening it with a full reload, through Vite, keeps the session |

- **Not done.** No deliberate errors were made in the code to see whether the tests detect them, as feature 08 did. Only Chrome was used, over HTTP on `127.0.0.1` and `localhost`: `Secure`, HTTPS and other browsers were not tried. The failures that are not an answer (no connection, a 500) and a Session that ended in another place were not made to happen in the browser, and are covered only by tests on a simulated page.

## 5. Architecture review

- **The folders and their imports** are one direction, `api`, then `texts`, then `session`, then `ui`, and a test fails if a file breaks it or if `api` imports React. The page that starts it puts the pieces together, as the Composition Root of the backend does.
- **The token** is in no place of the page. The client reads the Account from a sign-in and drops the rest, no source file may name the storage of the browser, `document.cookie` or the header of credentials, and only `api/` may make a request. Each of these guards has a test that shows it can see a violation.
- **Failures** are values: no operation of the client throws, and a failure that is not an answer shows a message that says that something failed and nothing of the cause.
- **In the backend,** serving is an optional group that the core does not depend on, the files are served by a package that refuses a path that leaves the folder, and the headers are given only under `/app/`, so the documentation page is as it was.

A review of the branch against `develop` found eight points. Each was checked against the code before deciding.

| # | Finding | What was done |
|---|---|---|
| 1 | An identifier of a Listing with a dot, such as `sku-1.5`, answers 404 when its address is reloaded, because the last segment looks like a file | A limitation, from the rule of SC-33 (section 7) |
| 2 | `/app` without the slash was an unknown route and had no headers | Fixed: it leads to `/app/`, with a test |
| 3 | Signing out with a Session that ended says that the session ended | Not a defect: SC-14 asks for it |
| 4 | When the `:id` of the route changes, one render shows the previous Listing | Not changed. No screen links from a Listing to another, so only the buttons of the browser can cause it |
| 5 | If reading the Listing again fails after an alert was created, the message of the result is shown with the error | A limitation, from the decision to keep the result in the screen (section 7) |
| 6 | The email is not trimmed before it is sent | Not a defect: the domain trims it and writes it in lower case |
| 7 | The change of the stylesheet made every form a column | Intended: it is what styles the form of the alert like the others |
| 8 | A cast of the error of registering that the compiler did not check | Fixed: it is checked with `instanceof` |

## 6. What the process revealed

| When | What | Result |
|---|---|---|
| 4a | The tests that read files must run in a Node environment, because the simulated page replaces `URL` | Marked in each of those files |
| 4a | The latest lines of Vitest and jsdom do not declare the Node that the repository runs on | The lines that do were chosen, and the rule of `engines` was written in the design |
| 4b | Vitest has no globals here, so Testing Library did not clean the page between tests, and 12 tests failed together | A setup file that cleans after each test |
| 4b | The fake client answered that the Session ended to the read of the Catalogue, which would have signed out every test that signs in | It answers an empty Catalogue by default |
| 4d | The package that serves files gives the callback of headers the reply of Fastify, and not the raw response | Read in its code before using it |
| 4d | A probe of the addresses that leave the folder was first run over the whole disk, and the tool to limit its time does not exist on this machine | The probe ran inside the project and was deleted |
| 4d | A test of the backend cited SC-36 and proved only that a change with no `Origin` is refused, which the browser must avoid | Its title no longer cites the scenario, and the exemption is honest |
| 4e | By default the development server forwards the API to port 3000, which another process of the machine may be using | It was restarted with `API_URL`, and the backend ran on another port |
| 4e | The first check of "going back" landed on an entry that was already the sign-in screen, which proves little | It was repeated through three entries |

## 7. Known limitations

- Storage is in memory ([ADR-0003](../../adr/0003-persistence-deferred.md)): a restart loses every Session and every Account, so every cookie stops working.
- A Listing whose identifier has a dot cannot be reloaded from its address: the page is served for an address with no dot in its last segment, and a missing file is a 404 (SC-33). The Catalogue still reaches it by a link. The identifiers of the demo have no dot.
- If the Listing cannot be read again after an alert was created, the message of the result appears next to the error, and the form is gone until the person tries again.
- The check in a real browser was one browser, over HTTP and on the local machine (section 4). `Secure`, the prefix `__Host-` and HTTPS are for the deployment.
- The interface was tested on a simulated page and in one browser, with no audit of accessibility and no end-to-end suite ([ADR-0005](../../adr/0005-web-interface.md)).
- Vite is the way to develop and the build is the way to serve, and nothing here decides how the application is built for production or where it runs.
- `main.ts` has no test, the tests have run on one version of Node, 25.9, no continuous integration runs them, and the repository has no licence.

## 8. Documentation volume

The documents of the first three stages have 742 lines (discovery and rules 182, scenarios 409, design 151). The previous feature had 563, so it is 32 % more. The scenarios are the longest of any feature: 36, 13 of them outlines, which carry the cases of each screen.

## 9. Follow-up

**Next feature,** feature 10: the alerts and the Notifications of a person, which is the second half of the interface (list, change the target price, cancel, and read Notifications). It follows Q2, and asks the Catalogue for the titles. After it, in the order agreed so far, the persistence and the deployment, each with its ADR, and the final README, slides and video.

**For the deployment.** `secure` on, the prefix `__Host-`, HTTPS, the origin of the application, whether the content security policy stays as it is, whether the identifiers with a dot matter, and the demo Accounts that no screen shows.

**For the persistence feature.** Nothing changes in the interface: it only talks to the API.

## 10. Completion checklist

- [x] Stages 1 to 4 completed
- [x] Documentation of stage 5 written (this document)
- [x] This document is approved by the author
- [x] The README and the documentation indexes describe this feature
- [ ] The feature is merged into `develop` with `--no-ff`, and `develop` into `main` and tagged (done by the developer, [ADR-0002](../../adr/0002-branching-model.md))
- [ ] A licence is chosen before the repository is published
