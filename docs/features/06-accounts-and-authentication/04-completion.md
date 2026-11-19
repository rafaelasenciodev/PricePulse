# 06 — Accounts and Authentication: Completion (Stage 5)

Status: Approved

The close of the feature: what was built, the decisions and their status, how it was verified, what the review found, what it does not do and what comes next. It links to the documents of each stage and does not repeat them. It is the third feature developed with the [method of five stages](../README.md), and the first to be built on an [ADR](../../adr/0004-authentication.md) written before its stage 1.

## 1. Summary

A person registers an Account with an email and a password, signs in to get the token of a Session, and sends it in `Authorization: Bearer` to be a User in every other request. Signing out ends that Session and no other, and a Session ends by itself after 7 days. Repeated failed sign-ins for an email are refused for 15 minutes. The fixed demo tokens are gone: the development server starts with two documented Accounts.

It runs end to end over HTTP with in-memory storage. It does not verify an email, recover or change a password, delete an Account, sign out of every Session at once, or authenticate price providers. Those are listed in the [discovery](01-discovery.md).

## 2. What was built

| Stage | Result | Where |
|---|---|---|
| 1 Understand | 11 questions decided, 12 rules, two new terms (Account, Session) | [Discovery and rules](01-discovery.md), [glossary](../../domain/ubiquitous-language.md) |
| 2 Scenarios | 25 Gherkin scenarios, 8 of them with several examples | [Scenarios](02-scenarios.feature) |
| 3 Design | A new module, 5 use cases, 6 ports, 4 routes, 10 decisions | [Design](03-design.md) |
| 4a Domain and use cases | `Email`, the rule of passwords, `Account`, `Session`, `FailedAttempts`; `RegisterAccount`, `SignIn`, `SignOut`, `ReadMyAccount`, `Authenticate` | `backend/src/accounts/domain/`, `backend/src/accounts/application/` |
| 4b Ports and adapters | In-memory stores, `scrypt` hasher, random tokens, with contracts for the five ports that have one | `backend/src/accounts/adapters/`, `backend/tests/accounts/adapters/` |
| 4c Way in | `POST /accounts`, `POST /sessions`, `DELETE /sessions/current`, `GET /accounts/me`; one reader of the bearer token; the wiring that replaces the fixed tokens | `backend/src/accounts/http/`, `backend/src/shared/http/`, `backend/src/composition-root.ts`, `backend/src/main.ts` |
| 4d Verification and review | Traceability of the sixth feature, 8 findings, one fixed | Sections 4 and 5 |

The feature changed 50 source files (1,121 insertions, 48 deletions; 28 new) and 59 test files (1,882 insertions, 168 deletions; 23 new) since the ADR. Most of those files only changed an import, when `UserId` moved to the shared module. No dependency was added.

## 3. Decisions and their status

The status of every decision of the discovery and the design is recorded here, and only here.

| Decision | Status | Evidence |
|---|---|---|
| Q1 Scope: register, sign in, sign out, read one's Account | Verified | The 25 scenarios |
| Q2 The email identifies the Account, normalised, not verified | Verified | SC-02, SC-06, SC-08 |
| Q3 A password has 10 to 128 characters and is not the email | Verified | SC-04, SC-05, at the limits |
| Q4 A registered email is a Conflict | Verified | SC-02, SC-03 |
| Q5 One answer for an unknown email and a wrong password, and the time does not tell them apart | Verified | SC-09, and by hand: 179.8 ms and 179.7 ms. No test measures time: a test checks that a hash is always verified |
| Q6 5 failed attempts in a row lock an email for 15 minutes | Verified | SC-11 to SC-15 and SC-25 |
| Q7 A Session lasts 7 days, with no renewal, and an Account can have several | Verified | SC-10, SC-18 |
| Q8 The fixed tokens go and two documented Accounts are created | Implemented | SC-24 checks that the fixed tokens are not valid. The two Accounts are made by `main.ts`, which has no test: checked by hand |
| Q9 to Q11 Registering does not sign in, the identifier is the `UserId`, the Account shows no secret | Verified | SC-01, SC-16, SC-21 |
| D1 A module `accounts`, and `UserId` in `shared` | Verified | The architecture test, and 898 tests that did not change when it moved |
| D2 The model and the policy of attempts in the domain | Verified | The tests of the domain |
| D3 Six ports | Verified | The contracts of the five that have one |
| D4 A hash is always checked when signing in | Implemented | A test counts one verification for each attempt, with a real hash for an unknown email. The time is checked by hand only |
| D5 The four routes | Verified | The API tests and the documentation tests |
| D6 The other modules keep their ports and hooks | Verified | The wiring tests: both credentials, in every direction |
| D7 One function reads the bearer token | Verified | Its own tests, and the three hooks that use it |
| D8 The adapters of accounts may use `node:crypto` | Implemented | The architecture test allows it to **every** adapter, not only these |
| D9 The hasher is an option of the Composition Root | Verified | A test with a hasher that counts its calls |
| D10 The attempt is counted before the password is checked, in one atomic step | Verified | SC-25, the atomic contract of the store, and 30 requests at once against the real server |

The values the ADR left to the feature were decided while building, reported at the end of the step and committed by the author: `scrypt` with N = 2¹⁶, r = 8, p = 2 (about 64 MiB and 180 ms here), a cap of 10,000 emails for the attempts, a cap of 1,024 characters on the email and the password of a request, and `Cache-Control: no-store` on the answer that carries a token. **Accepted.**

### Effect on the other features

- **All of them.** `UserId` moved from the module of Price Alerts to `shared`.
- **Features 01 to 05.** The three hooks that read the bearer token use the shared function, and the demo tokens are gone. `composeInMemoryApp` no longer returns an authenticator: it returns the use cases that make a User, and five test files use them. The routes, the use cases and the ports of the other modules did not change.

## 4. Verification

- **Tests:** 1,162 test cases in 66 files, all passing, of which 264 are of this feature: the domain 50, the use cases 59, the adapters and their contracts 64, the API 43 with its documentation, the wiring 25, the reader of the token 16, and 7 of the traceability guard.
- **Scenarios:** all 25 have tests, read from the titles, with no exemption. SC-24 has a test for the fixed tokens only.
- **Coverage, as a diagnostic:** 99.6 % of statements, 97.6 % of branches, 99.8 % of functions and 99.7 % of lines. What is not covered is the re-throw of an error that `Email.of` cannot raise, the `() => {}` that only runs if the hash of the fallback fails, and the guard of a route that is moved out of its hook.
- **Deliberate errors:** 102 changes were made by hand, one at a time, and the tests were run after each. **99 were detected**, and the 3 that were not change nothing a caller can see. Five of the others showed a hole in a test of mine at first (the hash of the fallback, the version and the `r` and `p` of a stored hash, and the hasher option), and each was closed and repeated.
- **By hand:** the development server was started with the real hash. A fixed token answered 401. A sign-in answered 201 in 0.19 s. The two demo Users saw their own alerts. A Provider's token was refused by the Account routes. Five failures gave 429 with `Retry-After`. Signing out ended the token. **30 wrong sign-ins at once gave 5 answers 401 and 25 answers 429**, and the right password was then refused. The log held no password or token.

## 5. Architecture review

Dependencies point inward and the architecture test passes. The change of the rules is two lines: `shared` also holds `shared/http`, and the adapters may import `node:crypto`. The other modules ask the Composition Root who a token belongs to, through the ports they already had.

| # | Finding | Outcome |
|---|---|---|
| 1 | **The limit of attempts could be bypassed.** The first design read the count, checked the password (180 ms) and wrote the count, so 30 attempts at once were all checked and counted as one. Measured, and against BR-06 | **Fixed** (decision D10, SC-25). The port is one atomic `update`, and the attempt is counted before the password is checked |
| 2 | `POST /accounts` has no limit. Each registration costs a hash and stores an Account, so one client can use the CPU and the memory | **Noted.** The limit by address was the option B of Q6 that was not chosen |
| 3 | Sessions that expired are not removed, and every sign-in adds one | **Noted** for persistence ([ADR-0004](../../adr/0004-authentication.md)) |
| 4 | Whoever knows an email can keep it locked, and 10,000 other emails push its lock out | **Accepted** (Q6), and written in the code |
| 5 | `scrypt` runs in the 4 threads of the pool of Node, so 4 sign-ins at once use all of them | **Noted.** The limit of attempts reduces it and does not remove it |
| 6 | `AccountRepository.find` scans every Account | **Noted** for persistence: an index by identifier |
| 7 | `app.ts` has 225 lines and 4 optional groups, the helper of the pages is written twice, and `Unauthenticated` three times | **Accepted**, as in feature 05. The reading of the token is resolved |
| 8 | A password is not normalised: two Unicode forms of a letter are two passwords | **Noted** |

## 6. What the process revealed

| When | What | Result |
|---|---|---|
| 3 | `UserId` lived inside the module of Price Alerts, and a module cannot import another | Moved to `shared`, as `Price` was: the biggest change of the feature in files, with no change in behaviour |
| 4a | The test of the fallback hash passed with an empty hash, which with `scrypt` is checked at once and would tell the time | A stronger test: the hash checked must be one the hasher made |
| 4b | Node reads `r = 0` and `p = 0` as its defaults, so a stored text with them would verify. My tampering tests started from a key that never matched | Tests that start from a real hash, so each change is the only reason it fails |
| 4b | A look at an email in the store inserted an empty entry and pushed another out | Fixed in the adapter: a state with no attempts takes no room |
| 4c | A test of mine registered an Account when it meant to send no body, because of a default parameter | Corrected, and the case now calls the route directly |
| 4d | The concurrency of the attempts, which the design had put off to persistence, was already a defect in memory | **Measured before deciding**, then fixed and given a scenario of its own |
| 4d | The traceability guard reads the titles of `it`, not of `describe` | The identifiers go in the titles of the tests |

## 7. Known limitations

- Storage is in memory: a restart loses every Account and Session, and the uniqueness and the atomic `update` have been tested only there ([ADR-0003](../../adr/0003-persistence-deferred.md)).
- The two demo Accounts and their passwords are in the source and in the README, which are public. The server refuses to start in production and listens on `127.0.0.1` only.
- There is no limit on registering, the attempts are limited by email only, and the response time is not tested.
- Providers still have a fixed credential, and any signed-in User reads any history.
- `main.ts` has no test. The tests have run on one version of Node, 25.9, no continuous integration runs them, and the repository has no licence.

## 8. Documentation volume

The documents of the first three stages have 581 lines (discovery and rules 192, scenarios 262, design 127). The previous feature had 470, so it is 24 % more. The discovery and the scenarios go over the 150 lines that the method suggests: 11 questions with options, and 25 scenarios of which 8 have examples. It is a sign that this feature is at the upper end of what one feature should hold.

## 9. Follow-up

**Next features,** in the order of [ADR-0003](../../adr/0003-persistence-deferred.md): the web interface, with its decision on how it is served and whether the token travels in a cookie; then persistence and the deployment, each with its ADR, and the final README, slides and video.

**For the persistence feature.** The email is unique by a constraint, and the port fails with `EmailAlreadyStored`. `LoginAttemptStore.update` is one transaction or one `UPDATE … RETURNING`, and its contract has the atomicity test. Sessions that expired are deleted from time to time. `find` by identifier needs an index. The demo Accounts are created only if they do not exist. Run the contracts of the three stores against the database adapters.

## 10. Completion checklist

- [x] Stages 1 to 4 completed
- [x] Documentation of stage 5 written (this document)
- [x] This document is approved by the author
- [x] The README and the documentation indexes describe this feature
- [ ] Feature 05, and then this one, are merged into `develop` with `--no-ff`, and `develop` into `main` and tagged (done by the developer, [ADR-0002](../../adr/0002-branching-model.md))
- [ ] A licence is chosen before the repository is published
